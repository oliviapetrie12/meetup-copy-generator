import { useState, useRef, useEffect, useMemo } from 'react'
import QRCodeStyling from "qr-code-styling"
import elasticLogo from './logo.png'
import ConferenceKnowBeforeYouGo from './ConferenceKnowBeforeYouGo.jsx'
import {
  makeMoreConcise,
  parseKbygPlainSections,
  rebuildKbygPlainFromSections,
  replaceKbygSectionBody,
} from './outputHelpers.js'
import {
  LANGUAGE_OPTIONS,
  normalizeLanguage,
  getEventPageStrings,
  getMeetupKbygStrings,
  getMeetupKbygTldrLabels,
  getMeetupKbygPhotoLines,
  getEventPageAgendaFallbackLines,
  buildEventPageWhatToExpectQuickDraft,
  formatLocalizedLongDate,
} from './generationLanguage.js'
import {
  getEventPageFieldDefaults,
  getGeneratorUiTranslations,
  getKbygSpeakerArrivalQuickFill,
  getKbygAvQuickFill,
} from './formTranslations.js'
import {
  tryRemoteGenerate,
  applyRemoteEventPageResult,
  meetupPlainTextToHtml,
  applyRemoteKbygResult,
  tryRemoteTranslate,
  extractTranslatedPlain,
} from './generateApi.js'
import { escapeHtml } from './htmlEscape.js'
import { normalizeElastiFlow } from './textNormalize.js'
import { buildAgenda } from './eventPageAgendaFallback.js'
import {
  buildSharedEventDataFromEventPageForm,
  buildSharedEventDataFromKbygForm,
  resolveAgendaBodyForEventPage,
} from './shared/eventData.js'
import { renderEventPagePlainMarkdown } from './channels/eventPagePlain.js'
import { renderKbygEmailHtml, renderKbygEmailPlain } from './channels/kbygEmail.js'
import { KBYG_TLDR_ITEM_ORDER, getInitialKbygTldrInclude } from './kbygTldr.js'
import {
  formatQuickImportFeedback,
  mergeKbygQuickImportPatch,
  parseKbygQuickImport,
} from './kbygQuickImportParse.js'

function SearchableSelect({ value, onChange, options, placeholder = 'Type to search…', id }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const containerRef = useRef(null)

  // Keep query in sync when parent resets the value
  useEffect(() => { setQuery(value) }, [value])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options

  const handleInput = (e) => {
    setQuery(e.target.value)
    onChange(e.target.value)
    setOpen(true)
  }

  const handleSelect = (opt) => {
    setQuery(opt)
    onChange(opt)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="ss-wrap" id={id}>
      <input
        type="text"
        className="ss-input"
        value={query}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (
        <ul className="ss-list">
          {filtered.length > 0
            ? filtered.map(o => (
                <li key={o} className={`ss-option${o === value ? ' ss-option-active' : ''}`} onMouseDown={() => handleSelect(o)}>
                  {o}
                </li>
              ))
            : <li className="ss-option ss-option-empty">No matches — press Enter to use "{query}"</li>
          }
        </ul>
      )}
    </div>
  )
}

const USER_GROUPS = [
  'Argentina Elastic User Group',
  'Canberra Elastic Fantastics',
  'Chile Elastic User Group',
  'Elastic Algeria User Group',
  'Elastic APJ Virtual User Group',
  'Elastic Atlanta User Group',
  'Elastic Austin User Group',
  'Elastic Bangalore User Group',
  'Elastic Barcelona User Group',
  'Elastic Baltic States User Group',
  'Elastic Bauru e região User Group',
  'Elastic Belgium User Group',
  'Elastic Blumenau User Group',
  'Elastic Boston User Group',
  'Elastic Brasil Virtual',
  'Elastic Brasília User Group',
  'Elastic Brisbane User Group',
  'Elastic Bulgaria User Group',
  'Elastic Campinas User Group',
  'Elastic Chennai User Group',
  'Elastic Chicago User Group',
  'Elastic Cincinnati User Group',
  'Elastic Cleveland User Group',
  'Elastic Colombia User Group',
  'Elastic Copenhagen User Group',
  'Elastic Costa Rica User Group',
  'Elastic CZ User Group',
  'Elastic Curitiba User Group',
  'Elastic Dallas User Group',
  'Elastic Delhi User Group',
  'Elastic Denver User Group',
  'Elastic Detroit User Group',
  'Elastic Dubai User Group',
  'Elastic Dublin User Group',
  'Elastic East Bay User Group',
  'Elastic Florianópolis User Group',
  'Elastic Fortaleza User Group',
  'Elastic FR User Group',
  'Elastic Goiânia User Group',
  'Elastic Göteborg User Group',
  'Elastic Greece',
  'Elastic Guadalajara user group',
  'Elastic Gujarat User Group',
  'Elastic Hanoi User Group',
  'Elastic Helsinki User Group',
  'Elastic Houston User Group',
  'Elastic Hyderabad User Group',
  'Elastic Indonesia User Group',
  'Elastic Italy User Group',
  'Elastic Jacksonville User Group',
  'Elastic Jaipur User Group',
  'Elastic Kansas City User Group',
  'Elastic Kochi User Group',
  'Elastic Kolkata User Group',
  'Elastic Krakow',
  'Elastic Kuala Lumpur User Group',
  'Elastic Lancaster User Group',
  'Elastic Las Vegas User Group',
  'Elastic Latin America Virtual',
  'Elastic London User Group',
  'Elastic Los Angeles User Group',
  'Elastic Luxembourg User Group',
  'Elastic Manchester User Group',
  'Elastic Melbourne User Group',
  'Elastic Mexico City User Group',
  'Elastic Miami User Group',
  'Elastic Minas Gerais User Group',
  'Elastic Minneapolis User Group',
  'Elastic Montreal User Group',
  'Elastic Morocco User Group',
  'Elastic Mumbai User Group',
  'Elastic Netherlands User Group',
  'Elastic New York City User Group',
  'Elastic New Zealand User Group',
  'Elastic Nigeria User Group',
  'Elastic Oslo User Group',
  'Elastic Orlando User Group',
  'Elastic Pakistan User Group',
  'Elastic Perth User Group',
  'Elastic Philadelphia User Group',
  'Elastic Phoenix User Group',
  'Elastic Pittsburgh User Group',
  'Elastic Portland User Group',
  'Elastic Portugal User Group',
  'Elastic Porto Alegre User Group',
  'Elastic Pune User Group',
  'Elastic Québec User Group',
  'Elastic Recife User Group',
  'Elastic Richmond User Group',
  'Elastic RheinRuhr',
  'Elastic Rio de Janeiro User Group',
  'Elastic Romania User Group',
  'Elastic Sacramento User Group',
  'Elastic Saint Louis User Group',
  'Elastic Salt Lake City User Group',
  'Elastic San Antonio User Group',
  'Elastic San Diego User Group',
  'Elastic San Francisco User Group',
  'Elastic São Paulo User Group',
  'Elastic Scotland User Group',
  'Elastic Seattle User Group',
  'Elastic Silicon Valley User Group',
  'Elastic Singapore User Group',
  'Elastic Slovak User Group',
  'Elastic South Africa User Group',
  'Elastic Stockholm User Group',
  'Elastic Sydney User Group',
  'Elastic Tel Aviv User Group',
  'Elastic Thailand User Group',
  'Elastic Toronto User Group',
  'Elastic Triangle User Group',
  'Elastic Turkey User Group',
  'Elastic United States and Canada Virtual User Group',
  'Elastic Vancouver User Group',
  'Elastic Vitória User Group',
  'Elastic Warsaw User Group',
  'Elastic Washington, D.C. User Group',
  'Elastic West Michigan User Group',
  'Elastic Wisconsin User Group',
  'Elastic Zagreb User Group',
  'Elasticsearch Berlin',
  'Elasticsearch Taipei',
  'Elasticsearch Toronto',
  'Elasticsearch Usergroup Vienna',
  'Elasticsearch勉強会(Elastic Tokyo User Group) #elasticsearchjp',
  'Hong Kong Elastic Fantastics',
  'Madrid Elasticsearch Meetup',
  'Ottawa Elastic User Group',
  'Search Meetup Munich',
  'Search Meetup NRW',
  'Search Technology Meetup Hamburg',
  'South West Elastic Community',
  'Waterloo/Kitchener Elastic User Group',
].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

const TIMEZONE_OPTIONS = [
  { value: '', label: 'Select timezone (optional)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles' },
  { value: 'America/Denver', label: 'America/Denver' },
  { value: 'America/Chicago', label: 'America/Chicago' },
  { value: 'America/New_York', label: 'America/New York' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney' },
]

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function ordinal(n) {
  const d = n % 10
  const teens = n >= 11 && n <= 13
  if (teens) return `${n}th`
  if (d === 1) return `${n}st`
  if (d === 2) return `${n}nd`
  if (d === 3) return `${n}rd`
  return `${n}th`
}

function formatDateForLinkedIn(dateStr) {
  const s = (dateStr || '').trim()
  if (!s) return ''
  let d
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    d = new Date(s + 'T12:00:00')
  } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
    const [a, b, c] = s.split('/').map(Number)
    const year = c < 100 ? 2000 + c : c
    d = new Date(year, a - 1, b)
  } else {
    const parsed = Date.parse(s)
    if (!Number.isNaN(parsed)) d = new Date(parsed)
  }
  if (d && !Number.isNaN(d.getTime())) {
    const dayName = DAY_NAMES[d.getDay()]
    const month = MONTH_NAMES[d.getMonth()]
    const dayNum = d.getDate()
    return `${dayName}, ${month} ${dayNum}`
  }
  return s
}

function formatDateWithOrdinal(dateStr) {
  const s = (dateStr || '').trim()
  if (!s) return ''
  let d
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) d = new Date(s + 'T12:00:00')
  else {
    const parsed = Date.parse(s)
    if (!Number.isNaN(parsed)) d = new Date(parsed)
  }
  if (d && !Number.isNaN(d.getTime())) {
    const dayName = DAY_NAMES[d.getDay()]
    const month = MONTH_NAMES[d.getMonth()]
    const dayNum = d.getDate()
    return `${dayName}, ${month} ${ordinal(dayNum)}`
  }
  return s
}

function emailTextToHtml(text) {
  const lines = String(text || '').split('\n')
  const parts = []
  let paragraph = []
  let listItems = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    parts.push(`<p style="margin:0 0 0.75em;line-height:1.5;">${paragraph.map((s) => escapeHtml(s)).join('<br>')}</p>`)
    paragraph = []
  }
  const flushList = () => {
    if (!listItems.length) return
    parts.push(`<ul style="margin:0 0 0.75em 1.2em;padding:0;">${listItems.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`)
    listItems = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const bulletMatch = line.match(/^\s*[-•]\s+(.+)$/)
    const boldHeader = line.match(/^\*\*(.+)\*\*$/)

    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }

    if (bulletMatch) {
      flushParagraph()
      listItems.push(bulletMatch[1].trim())
      continue
    }

    if (boldHeader) {
      flushParagraph()
      flushList()
      parts.push(`<p style="margin:0.75em 0 0.35em;line-height:1.4;"><strong>${escapeHtml(boldHeader[1].trim())}</strong></p>`)
      continue
    }

    flushList()
    paragraph.push(line)
  }

  flushParagraph()
  flushList()
  return `<div style="font-family:system-ui,-apple-system,sans-serif;">${parts.join('')}</div>`
}

/** Reusable defaults for the Meetup Event Page generator (merged into INITIAL_STATE; all editable in the UI). */
const EVENT_PAGE_FORM_DEFAULTS = {
  ...getEventPageFieldDefaults('en'),
  eventPageIncludeWhyAttend: true,
  eventPageIncludeWhatToExpect: true,
  eventPageIncludeSpeakerSection: true,
}

const INITIAL_STATE = {
  chapterOrCity: '',
  eventTitle: '',
  date: '',
  eventStartTime: '',
  timezone: '',
  venueName: '',
  venueAddress: '',
  speaker1Name: '',
  speaker1Title: '',
  speaker1Company: '',
  speaker1TalkTitle: '',
  speaker1TalkAbstract: '',
  speaker2Name: '',
  speaker2Title: '',
  speaker2Company: '',
  speaker2TalkTitle: '',
  speaker2TalkAbstract: '',
  speaker3Name: '',
  speaker3Title: '',
  speaker3Company: '',
  speaker3TalkTitle: '',
  speaker3TalkAbstract: '',
  hostOrSponsor: '',
  rsvpInstructions: '',
  arrivalInstructions: '',
  intuitionAudience: '',
  intuitionWhyAttend: '',
  intuitionKeyTakeaway: '',
  meetupPageAgenda: '',
  eventPageSectionEmojis: true,
  eventPageInviteSpeakers: false,
  ...EVENT_PAGE_FORM_DEFAULTS,
}

const GENERATOR_TYPES = [
  { value: 'eventPromotion', label: 'Event Promotion' },
  { value: 'knowBeforeYouGo', label: 'Meetup Know Before You Go' },
  { value: 'conferenceKnowBeforeYouGo', label: 'Conference Know Before You Go' },
  { value: 'speakerOutreach', label: 'Speaker Outreach' },
  { value: 'urlQrGenerator', label: 'URL with UTM Parameters' },
  { value: 'qrCodeGenerator', label: 'QR Code Generator' },
]

const GENERATOR_CARDS = [
  {
    value: 'eventPromotion',
    title: '📣 Event Promotion',
    description: 'Generate Meetup event page copy, LinkedIn promo copy, and Intuition Email Copy.',
  },
  {
    value: 'knowBeforeYouGo',
    title: '✉️ Meetup Know Before You Go',
    description: 'Generate the speaker and host logistics email, including TL;DR, agenda, and helpful contacts.',
  },
  {
    value: 'conferenceKnowBeforeYouGo',
    title: '🧳 Conference Know Before You Go',
    description:
      'Generate a conference booth logistics email for staff, including TL;DR, schedule, setup, and contacts.',
  },
  {
    value: 'speakerOutreach',
    title: '👤 Speaker Outreach',
    description: 'Generate a speaker outreach email and LinkedIn message.',
  },
  {
    value: 'urlQrGenerator',
    title: '🔗 UTM URL Builder',
    description: 'Build a UTM-tracked URL with source, medium, campaign, content, and term parameters. Shorten the link or turn it into a QR code instantly.',
  },
  {
    value: 'qrCodeGenerator',
    title: '◉ QR Code Generator',
    description: 'Generate a branded QR code with custom colours, dot and eye shapes, and the Elastic logo centred. Download as a high-res PNG.',
  },
]

const DOT_STYLES = [
  { value: 'square',         label: 'Square',   icon: '■' },
  { value: 'dots',           label: 'Dots',     icon: '●' },
  { value: 'rounded',        label: 'Rounded',  icon: '▢' },
  { value: 'extra-rounded',  label: 'Leaf',     icon: '◉' },
  { value: 'classy',         label: 'Classy',   icon: '◆' },
  { value: 'classy-rounded', label: 'Classy+',  icon: '◈' },
]

const EYE_STYLES = [
  { value: '',               label: 'Auto',     icon: '–' },
  { value: 'dot',            label: 'Circle',   icon: '●' },
  { value: 'extra-rounded',  label: 'Rounded',  icon: '◉' },
  { value: 'square',         label: 'Square',   icon: '■' },
]

const KBYG_INITIAL_STATE = {
  recipients: '',
  greetingNames: '',
  eventTitle: '',
  eventDate: '',
  eventTime: '',
  arrivalTime: '',
  venueName: '',
  venueAddress: '',
  parkingNotes: '',
  parkingBookingUrl: '',
  parkingBookingLabel: '',
  meetupLink: '',
  lumaLink: '',
  contacts: [
    { name: '', role: '', contactInfo: '' },
    { name: '', role: '', contactInfo: '' },
  ],
  speakerArrivalNote: '',
  foodDetails: '',
  drinkDetails: '',
  swagNotes: '',
  setupNotes: '',
  avNotes: '',
  internalAgenda: '',
  additionalNotes: '',
  includePhotos: true,
  generateTldr: true,
  kbygTldrInclude: getInitialKbygTldrInclude(),
  kbygEmojiHeaders: true,
}

const KBYG_FORM_STORAGE_KEY = 'meetup-kbyg-form-v1'

/** Removed standalone Speakers section — strip legacy keys from persisted JSON. */
const KBYG_LEGACY_SPEAKER_FIELD_KEYS = [
  'speaker1Name',
  'speaker1Title',
  'speaker1TalkTitle',
  'speaker2Name',
  'speaker2Title',
  'speaker2TalkTitle',
]

function loadKbygFormFromStorage() {
  if (typeof localStorage === 'undefined') return KBYG_INITIAL_STATE
  try {
    const raw = localStorage.getItem(KBYG_FORM_STORAGE_KEY)
    if (!raw) return KBYG_INITIAL_STATE
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return KBYG_INITIAL_STATE
    const parsedRest = { ...parsed }
    for (const k of KBYG_LEGACY_SPEAKER_FIELD_KEYS) delete parsedRest[k]
    return {
      ...KBYG_INITIAL_STATE,
      ...parsedRest,
      kbygTldrInclude: {
        ...getInitialKbygTldrInclude(),
        ...(parsed.kbygTldrInclude && typeof parsed.kbygTldrInclude === 'object' ? parsed.kbygTldrInclude : {}),
      },
      includePhotos: Object.prototype.hasOwnProperty.call(parsed, 'includePhotos')
        ? parsed.includePhotos
        : Object.prototype.hasOwnProperty.call(parsed, 'includeTakePhotos')
          ? parsed.includeTakePhotos
          : KBYG_INITIAL_STATE.includePhotos,
      kbygEmojiHeaders: Object.prototype.hasOwnProperty.call(parsed, 'kbygEmojiHeaders')
        ? parsed.kbygEmojiHeaders
        : KBYG_INITIAL_STATE.kbygEmojiHeaders,
    }
  } catch {
    return KBYG_INITIAL_STATE
  }
}

const SPEAKER_OUTREACH_INITIAL_STATE = {
  channel: 'linkedin',
  personalizationNote: '',
  speakerName: '',
  whyReachingOut: '',
  whereFoundThem: '',
  meetupChapterOrCity: '',
  eventThemeOrTopic: '',
  potentialTalkIdea: '',
  whatAsking: '',
  flexibilityNote: '',
  senderName: '',
}

const UTM_SOURCE_OPTIONS = [
  'linktree',
  'luma',
  'meetup',
  'speaker',
]

const UTM_MEDIUM_OPTIONS = [
  'ahmedabad',
  'amsterdam',
  'austin',
  'bangalore',
  'barcelona',
  'brisbane',
  'canberra',
  'chennai',
  'chicago',
  'dallas',
  'denver',
  'dublin',
  'hyderabad',
  'johannesburg',
  'kochi',
  'london',
  'melbourne',
  'mumbai',
  'new-delhi',
  'paris',
  'pune',
  'rouen',
  'sao-paulo',
  'seattle',
  'singapore',
  'sydney',
  'tokyo',
]

const UTM_CAMPAIGN_OPTIONS = [
  'hyperscalers',
  'meetup-followup-cm',
]

const URL_QR_INITIAL_STATE = {
  baseUrl: '',
  utmSource: '',
  utmMedium: '',
  utmCampaign: '',
  utmContent: '',
  utmTerm: '',
}

const QR_INITIAL_STATE = {
  qrLink: '',
  qrColor: '#000000',
  qrBgColor: '#FFFFFF',
  qrTransparent: false,
  qrDotStyle: 'square',
  qrEyeStyle: '',
}

function generateKnowBeforeYouGoSubject(form, opts = {}) {
  const S = getMeetupKbygStrings(normalizeLanguage(opts.language))
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const title = trim(form.eventTitle)
  const date = trim(form.eventDate)
  if (!title) return S.subjectSuffix
  return `${title} | ${S.subjectSuffix}${date ? ` | ${date}` : ''}`
}

function buildKnowBeforeYouGoEmailHtml(form, opts = {}) {
  const eventData = buildSharedEventDataFromKbygForm(form, normalizeLanguage(opts.language))
  return renderKbygEmailHtml(eventData, form, opts)
}

function generateKnowBeforeYouGoEmail(form, opts = {}) {
  const eventData = buildSharedEventDataFromKbygForm(form, normalizeLanguage(opts.language))
  return renderKbygEmailPlain(eventData, form, opts)
}

/** Options passed to Meetup KBYG plain + HTML renderers (emoji headers default on). */
function meetupKbygRenderOpts(form, tldrRotation, language) {
  return {
    tldrRotation,
    language,
    emojisEnabled: form.kbygEmojiHeaders !== false,
  }
}

const OUTREACH_SUBJECT_VARIANTS = [
  (chapter) => chapter ? `Potential speaking opportunity with ${chapter}` : 'Potential speaking opportunity with Elastic Meetup',
  (chapter) => chapter ? `Speaking at ${chapter}?` : 'Speaking at an Elastic meetup?',
  (chapter) => chapter ? `Invitation: speak at ${chapter}` : 'Invitation: speak at an Elastic meetup',
]

function generateSpeakerOutreachSubject(form, variant = 0) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const chapter = trim(form.meetupChapterOrCity)
  return OUTREACH_SUBJECT_VARIANTS[variant % 3](chapter)
}

function generateSpeakerOutreachEmail(form, variant = 0) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const v = variant % 3
  const name = trim(form.speakerName) || 'there'
  const sender = trim(form.senderName)
  const why = trim(form.whyReachingOut)
  const personalization = trim(form.personalizationNote)
  const chapter = trim(form.meetupChapterOrCity)
  const ask = trim(form.whatAsking)
  const flex = trim(form.flexibilityNote)

  const lines = []
  lines.push(`Hi ${name},`)
  lines.push('')
  if (sender && chapter) {
    lines.push(`My name is ${sender} and I help organize the ${chapter}.`)
  } else if (sender) {
    lines.push(`My name is ${sender} and I help organize our Elastic meetup.`)
  } else if (chapter) {
    lines.push(`I help organize the ${chapter}.`)
  }
  lines.push('')
  if (personalization) {
    const t = personalization.trim().replace(/^[Ss]aw\s+/, '')
    const phrase = t.toLowerCase().startsWith('your') ? t : `your work on ${t}`
    lines.push(`I came across ${phrase}${phrase.endsWith('.') ? '' : '.'}`)
    lines.push('')
    lines.push('I thought it could make for a great meetup talk for our community.')
  } else if (why) {
    lines.push(why.endsWith('.') ? why : `${why}.`)
    lines.push('')
    lines.push('I thought it could make for a great meetup talk for our community.')
  } else {
    lines.push('I thought your experience could make for a great meetup talk for our community.')
  }
  lines.push('')
  const bodyVariants = [
    () => { lines.push('We typically host local engineers for a casual evening of technical talks and networking.'); return ask || 'Would you be open to speaking at an upcoming meetup?'; },
    () => { lines.push('We run informal evenings with technical talks and networking.'); return ask || 'Would you be interested in speaking at one?'; },
    () => { lines.push('Our meetups are casual — local engineers, short talks, and networking.'); return ask || 'Would you consider speaking at an upcoming one?'; },
  ]
  const getAsk = bodyVariants[v]
  const askLine = getAsk()
  lines.push(askLine.endsWith('.') ? askLine : `${askLine}.`)
  lines.push('')
  const signOffs = [
    () => { if (flex) lines.push(flex.endsWith('.') ? flex : `${flex}.`); else lines.push('Happy to share more details if you\'re interested.'); },
    () => { if (flex) lines.push(flex.endsWith('.') ? flex : `${flex}.`); else lines.push('Happy to share more if you\'d like.'); },
    () => { if (flex) lines.push(flex.endsWith('.') ? flex : `${flex}.`); else lines.push('Let me know if you\'d like more info.'); },
  ]
  signOffs[v]()
  lines.push('')
  lines.push('Best,')
  if (sender) lines.push(sender)
  return lines.join('\n')
}

const OUTREACH_LINKEDIN_VARIANTS = [
  (name, intro, cameAcross, askText, sender) => [
    `Hi ${name} — ${intro} and ${cameAcross}`,
    'I thought it could make for a great meetup talk.',
    askText.endsWith('.') ? askText : `${askText}.`,
    'Happy to share more details if helpful.',
    sender ? `— ${sender}` : '',
  ].filter(Boolean).join(' '),
  (name, intro, cameAcross, askText, sender) => [
    `Hi ${name} — ${intro} and ${cameAcross}`,
    'Seems like a great fit for a meetup talk.',
    askText.endsWith('.') ? askText : `${askText}.`,
    'Happy to share more if useful.',
    sender ? `— ${sender}` : '',
  ].filter(Boolean).join(' '),
  (name, intro, cameAcross, askText, sender) => [
    `Hi ${name} — ${intro} and ${cameAcross}`,
    'Would make a great session for our community.',
    askText.endsWith('.') ? askText : `${askText}.`,
    'Let me know if you\'d like more info.',
    sender ? `— ${sender}` : '',
  ].filter(Boolean).join(' '),
]

function generateSpeakerOutreachLinkedIn(form, variant = 0) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const v = variant % 3
  const name = trim(form.speakerName) || 'there'
  const sender = trim(form.senderName)
  const why = trim(form.whyReachingOut)
  const personalization = trim(form.personalizationNote)
  const chapter = trim(form.meetupChapterOrCity)
  const ask = trim(form.whatAsking)

  const intro = chapter ? `I help organize the ${chapter}` : 'I help organize our Elastic meetup'
  const t = personalization || why
  const cameAcross = t
    ? (() => {
        const x = t.trim().replace(/^[Ss]aw\s+/, '')
        const phrase = x.toLowerCase().startsWith('your') ? x : `your work on ${x}`
        return `came across ${phrase}${phrase.endsWith('.') ? '' : '.'}`
      })()
    : 'came across your work.'
  const askText = ask || 'Would you be open to speaking at an upcoming event?'
  return OUTREACH_LINKEDIN_VARIANTS[v](name, intro, cameAcross, askText, sender)
}

function getLinkedInGroupName(form) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const cityRaw = trim(form.chapterOrCity)
  const city = cityRaw || extractCity(form)
  if (cityRaw && (cityRaw.includes('User Group') || cityRaw.includes('Elastic') || cityRaw.includes('Meetup'))) return cityRaw
  if (city) return `Elastic ${city} User Group`
  return 'Elastic community'
}

function buildLinkedInPost(form, variant = 0) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const v = variant % 3
  const groupName = getLinkedInGroupName(form)
  const city = extractCity(form) || trim(form.chapterOrCity)
  const dateStr = trim(form.date)
  const dateFormatted = formatDateForLinkedIn(dateStr) || dateStr
  const venue = trim(form.venueName) || trim(form.venueAddress)
  const name1 = trim(form.speaker1Name)
  const title1 = trim(form.speaker1Title)
  const company1 = trim(form.speaker1Company)
  const name2 = trim(form.speaker2Name)
  const title2 = trim(form.speaker2Title)
  const company2 = trim(form.speaker2Company)
  const name3 = trim(form.speaker3Name)
  const title3 = trim(form.speaker3Title)
  const company3 = trim(form.speaker3Company)
  const hasSpeaker2 = [form.speaker2Name, form.speaker2Title, form.speaker2Company, form.speaker2TalkTitle, form.speaker2TalkAbstract].some((x) => trim(x).length > 0)
  const hasSpeaker3 = [form.speaker3Name, form.speaker3Title, form.speaker3Company, form.speaker3TalkTitle, form.speaker3TalkAbstract].some((x) => trim(x).length > 0)

  const speakerCredits = (name, title, company) => {
    if (!name) return ''
    const cred = [title, company].filter(Boolean).join(' at ')
    return cred ? `${name} (${cred})` : name
  }

  const communityLine = city ? `with the ${city} tech and Elastic community` : 'with the local Elastic community'

  const para1Variants = [
    () => dateFormatted ? `Join the ${groupName} on ${dateFormatted} for an evening of technical talks and community networking.` : `Join the ${groupName} for an evening of technical talks and community networking.`,
    () => dateFormatted ? `You're invited — join the ${groupName} on ${dateFormatted} for an evening of technical talks and community networking.` : `You're invited — join the ${groupName} for an evening of technical talks and community networking.`,
    () => dateFormatted ? `Save the date: the ${groupName} is hosting a meetup on ${dateFormatted} for technical talks and community networking.` : `The ${groupName} is hosting an evening of technical talks and community networking.`,
  ]

  let para2 = ''
  const insightsSuffix = ', sharing insights from real-world Elastic use cases.'
  if (hasSpeaker2 && hasSpeaker3 && name1 && name2 && name3) {
    const cred1 = speakerCredits(name1, title1, company1)
    const cred2 = speakerCredits(name2, title2, company2)
    const cred3 = speakerCredits(name3, title3, company3)
    const para2Variants = [
      `We'll feature presentations from ${cred1}, ${cred2}, and ${cred3}${insightsSuffix}`,
      `We'll hear from ${cred1}, ${cred2}, and ${cred3}${insightsSuffix}`,
      `Presentations from ${cred1}, ${cred2}, and ${cred3}${insightsSuffix}`,
    ]
    para2 = para2Variants[v]
  } else if (hasSpeaker2 && name1 && name2) {
    const cred1 = speakerCredits(name1, title1, company1)
    const cred2 = speakerCredits(name2, title2, company2)
    const para2Variants = [
      `We'll feature presentations from ${cred1} and ${cred2}${insightsSuffix}`,
      `We'll hear from ${cred1} and ${cred2}${insightsSuffix}`,
      `Presentations from ${cred1} and ${cred2}${insightsSuffix}`,
    ]
    para2 = para2Variants[v]
  } else if (name1) {
    const cred1 = speakerCredits(name1, title1, company1)
    const para2Variants = [
      `We'll feature a presentation from ${cred1}${insightsSuffix}`,
      `We'll hear from ${cred1}${insightsSuffix}`,
      `${cred1} will present${insightsSuffix}`,
    ]
    para2 = para2Variants[v]
  } else {
    para2 = "We'll have community talks and demos, sharing insights from real-world Elastic use cases."
  }

  const multiTalk = (hasSpeaker2 && name2) || (hasSpeaker3 && name3)
  const para3 = multiTalk
    ? `After the talks, stick around for pizza, refreshments, and networking ${communityLine}.`
    : `After the talk, stick around for pizza, refreshments, and networking ${communityLine}.`

  const cityForHashtag = extractCity(form)
  const shortCityTag = cityForHashtag && cityForHashtag.length <= 20 && cityForHashtag.split(/\s+/).length <= 2
    ? ` #${cityForHashtag.replace(/\s+/g, '')}Tech`
    : ' #ElasticMeetups'
  const hashtags = `#Elastic #ElasticCommunity${shortCityTag}`

  const parts = [para1Variants[v](), '', para2, '', para3]
  if (venue) parts.push('', `The meetup will take place at ${venue}.`)
  parts.push('', '👉 RSVP: [Meetup Link]', '', hashtags)
  return parts.join('\n')
}

function extractCity(form) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')

  const fromChapter = (raw) => {
    if (!raw) return null
    let s = raw.replace(/^Elastic\s+/i, '').replace(/\s+User Group$/i, '').replace(/\s+Meetup$/i, '').replace(/\s+community$/i, '').trim()
    if (s.length > 0 && s.length < 50) return s
    return null
  }

  const chapter = trim(form.chapterOrCity)
  if (chapter) {
    const c = fromChapter(chapter)
    if (c) return c
  }

  const title = trim(form.eventTitle)
  if (title) {
    const m = title.match(/\b(\w+(?:\s+\w+)?)\s+Elastic\s+(?:Meetup|User\s+Group)/i)
    if (m && m[1]) return m[1].trim()
    const m1b = title.match(/\b(?:Elastic\s+)?(\w+(?:\s+\w+)?)\s+(?:Meetup|User\s+Group|community)\b/i)
    if (m1b && m1b[1]) return m1b[1].trim()
    const m2 = title.match(/\b(?:Meetup|event)\s+in\s+(\w+(?:\s+\w+)?)(?:\s|$)/i)
    if (m2 && m2[1]) return m2[1].trim()
    const m3 = title.match(/\b(\w+(?:\s+\w+)?)\s+[-–—]\s+(?:Elastic|Meetup)/i)
    if (m3 && m3[1]) return m3[1].trim()
  }

  const venue = trim(form.venueName) || trim(form.venueAddress)
  if (venue) {
    const parts = venue.split(/[,]/).map((p) => p.trim())
    if (parts.length >= 2 && parts[1].length > 0 && parts[1].length < 30 && !/^\d+$/.test(parts[1])) return parts[1]
    const words = venue.split(/\s+/)
    if (words.length >= 2) {
      const last = words[words.length - 1]
      if (last.length > 1 && last.length < 25 && !/^\d+$/.test(last)) return last
    }
  }

  const address = trim(form.venueAddress)
  if (address) {
    const m = address.match(/,?\s*([A-Za-z\s]+?),?\s*(?:[A-Z]{2}|Texas|California|Washington|New York|Colorado|Illinois)\s+\d+/i)
    if (m && m[1]) return m[1].trim()
  }

  return null
}

function getCityForIntuition(form) {
  return extractCity(form)
}

const MAX_SUBJECT_LENGTH = 70
const PREVIEW_MIN = 40
const PREVIEW_MAX = 90

function getTalkTheme(talkTitle, talkAbstract) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const title = trim(talkTitle)
  const abs = trim(talkAbstract)
  const text = `${title} ${abs}`.toLowerCase()
  if (/\b(search|elasticsearch|relevance|vector|knn)\b/.test(text)) return 'search and relevance'
  if (/\b(observability|apm|logging|metrics|monitoring)\b/.test(text)) return 'observability and monitoring'
  if (/\b(ai|ml|machine learning|vector)\b/.test(text)) return 'AI and ML with Elastic'
  if (/\b(pipeline|ingest|etl)\b/.test(text)) return 'data pipelines and ingest'
  if (/\b(scal(e|ing)|production|real-world)\b/.test(text)) return 'scaling and production use cases'
  if (/\b(migration|upgrade)\b/.test(text)) return 'migration and upgrades'
  if (title && title.length < 50) return title
  return 'real-world Elastic use cases'
}

function getIntroTheme(talkTitle, talkAbstract) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const rawTitle = trim(talkTitle)
  const title = cleanTalkInput(rawTitle) || rawTitle
  const lower = title.toLowerCase()
  if (!title) return getTalkTheme(talkTitle, talkAbstract)
  if (title.length <= 45) return title
  const mTo = title.match(/\bto\s+(the\s+[^.]{5,55}?)(?:\s*\.|$)/i)
  if (mTo && mTo[1].trim().length >= 5) return mTo[1].trim()
  const mIntro = title.match(/introduc(?:e|ing)\s+(?:\w+\s+)*to\s+(.+?)(?:\s*\.|$)/i)
  if (mIntro && mIntro[1].trim().length < 55) return mIntro[1].trim()
  const mOn = title.match(/\b(on|about)\s+(.+?)(?:\s*[.—]|$)/i)
  if (mOn && mOn[2].trim().length >= 8 && mOn[2].trim().length < 50) return mOn[2].trim()
  if (/\b(streaming|real-time)\s+data\s+.+/i.test(lower)) return 'streaming data architectures'
  if (/\bkafka\b/i.test(lower)) return 'streaming data and Kafka'
  if (/\b(mcp|model context protocol)\b/i.test(lower)) return 'the Model Context Protocol (MCP)'
  if (/\b(long[- ]?term\s+health|health\s+tracking)\b/i.test(lower)) return 'long-term health tracking with Elasticsearch'
  if (/\b(ai|ml|machine learning)\b/i.test(lower)) return 'emerging AI development patterns'
  const theme = getTalkTheme(talkTitle, talkAbstract)
  if (theme !== 'real-world Elastic use cases') return theme
  const words = title.split(/\s+/).slice(0, 5).join(' ')
  return words.length > 12 ? words.replace(/\s+$/, '') + '…' : title.slice(0, 42)
}

const TECHNICAL_HOOKS = [
  { pattern: /\b(ai[- ]?powered\s+search|ai\s+search)\b/i, phrase: 'AI-powered search', priority: 10 },
  { pattern: /\b(llm\s+queries?|llm[- ]?powered)\b/i, phrase: 'LLM queries', priority: 10 },
  { pattern: /\bnatural\s+language\s+(?:search|to\s+elasticsearch|queries?)\b/i, phrase: 'Natural language to Elasticsearch', priority: 10 },
  { pattern: /\bnatural\s+language\b/i, phrase: 'Natural language', priority: 9 },
  { pattern: /\belasticsearch\s+queries?\b/i, phrase: 'Elasticsearch queries', priority: 9 },
  { pattern: /\bzero[- ]?downtime\s+reindex(ing)?\b/i, phrase: 'Zero-downtime reindexing', priority: 10 },
  { pattern: /\bzero[- ]?downtime\b/i, phrase: 'Zero-downtime', priority: 8 },
  { pattern: /\breindex(ing)?\b/i, phrase: 'reindexing', priority: 7 },
  { pattern: /\bblue[- ]?green\s+(?:deployments?|index)\b/i, phrase: 'Blue-green deployments', priority: 9 },
  { pattern: /\bblue[- ]?green\b/i, phrase: 'Blue-green deployment', priority: 8 },
  { pattern: /\btime[- ]?series\s+analytics\b/i, phrase: 'Time-series analytics', priority: 9 },
  { pattern: /\btime[- ]?series\b/i, phrase: 'Time-series analytics', priority: 7 },
  { pattern: /\breal[- ]?time\s+(?:analytics|search|data)\b/i, phrase: 'Real-time analytics', priority: 8 },
  { pattern: /\breal[- ]?time\b/i, phrase: 'Real-time', priority: 6 },
  { pattern: /\bproduction\s+elasticsearch\s+architectures?\b/i, phrase: 'Production Elasticsearch architectures', priority: 9 },
  { pattern: /\belasticsearch\s+architectures?\b/i, phrase: 'Elasticsearch architectures', priority: 7 },
  { pattern: /\binventory\s+analytics\b/i, phrase: 'Inventory analytics', priority: 8 },
  { pattern: /\breal[- ]?world\s+engineering\b/i, phrase: 'Real-world engineering lessons', priority: 8 },
  { pattern: /\bvector\s+search\b/i, phrase: 'Vector search', priority: 7 },
  { pattern: /\b(knn|k\-?nn)\b/i, phrase: 'KNN search', priority: 7 },
  { pattern: /\bobservability\b/i, phrase: 'Observability', priority: 6 },
  { pattern: /\b(apm|application\s+performance)\b/i, phrase: 'APM', priority: 6 },
  { pattern: /\bstreaming\s+data\b/i, phrase: 'Streaming data', priority: 6 },
  { pattern: /\bkafka\b/i, phrase: 'Kafka', priority: 6 },
  { pattern: /\bml\s+workloads?\b/i, phrase: 'ML workloads', priority: 6 },
  { pattern: /\bmachine\s+learning\b/i, phrase: 'Machine learning', priority: 6 },
  { pattern: /\bproduction\s+(?:use\s+cases?|deployments?)\b/i, phrase: 'Production use cases', priority: 5 },
]

function getTechnicalHooks(talkTitle, talkAbstract) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const text = `${trim(talkTitle)} ${trim(talkAbstract)}`
  const lower = text.toLowerCase()
  const seen = new Set()
  const hooks = []
  for (const { pattern, phrase, priority } of TECHNICAL_HOOKS) {
    const re = new RegExp(pattern.source, pattern.flags)
    if (re.test(lower) && !seen.has(phrase)) {
      seen.add(phrase)
      hooks.push({ phrase, priority: priority || 5 })
    }
  }
  return hooks.sort((a, b) => (b.priority - a.priority)).map((h) => h.phrase)
}

function extractKeyThemes(form) {
  const hooks1 = getTechnicalHooks(form.speaker1TalkTitle, form.speaker1TalkAbstract)
  const hooks2 = getTechnicalHooks(form.speaker2TalkTitle, form.speaker2TalkAbstract)
  const all = []
  const seen = new Set()
  for (const p of [...hooks1, ...hooks2]) {
    if (!seen.has(p)) {
      seen.add(p)
      all.push(p)
    }
  }
  if (all.length === 0) return []
  const theme1 = all[0]
  if (all.length === 1) return [theme1]
  const a = all[0]
  const b = all[1]
  if ((a === 'Zero-downtime' && b === 'reindexing') || (a === 'reindexing' && b === 'Zero-downtime')) return ['Zero-downtime reindexing']
  if ((a === 'Zero-downtime' && b !== 'reindexing') || (b === 'Zero-downtime' && a !== 'reindexing')) {
    const other = a === 'Zero-downtime' ? b : a
    return ['Zero-downtime reindexing', other]
  }
  if ((a === 'Natural language' || a === 'Natural language to Elasticsearch') && (b && (b.toLowerCase().includes('elasticsearch') || b === 'Elasticsearch queries'))) return ['Natural language to Elasticsearch']
  return [theme1, b].filter(Boolean).slice(0, 2)
}

function getCombinedHook(hooks, maxLen = 38) {
  if (!hooks.length) return null
  const themes = extractKeyThemesFromHooks(hooks)
  if (themes.length === 1) return themes[0]
  if (themes.length >= 2) {
    const [t1, t2] = themes
    if ((t1 === 'Zero-downtime' && t2 === 'reindexing') || (t1 === 'reindexing' && t2 === 'Zero-downtime')) return 'Zero-downtime reindexing'
    const withPlus = `${t1} + ${t2}`
    return withPlus.length <= maxLen ? withPlus : t1
  }
  return hooks[0]
}

function extractKeyThemesFromHooks(hooks) {
  if (!hooks.length) return []
  const seen = new Set()
  const out = []
  for (const h of hooks) {
    if (seen.has(h)) continue
    if ((h === 'Zero-downtime' || h === 'reindexing') && (hooks.includes('Zero-downtime') && hooks.includes('reindexing'))) {
      if (!seen.has('Zero-downtime reindexing')) {
        out.push('Zero-downtime reindexing')
        seen.add('Zero-downtime')
        seen.add('reindexing')
        seen.add('Zero-downtime reindexing')
      }
      continue
    }
    if (h === 'Zero-downtime' || h === 'reindexing') continue
    seen.add(h)
    out.push(h)
  }
  if (out.length === 0 && hooks.includes('Zero-downtime')) out.push('Zero-downtime reindexing')
  if (out.length === 0) return hooks.slice(0, 2)
  return out.slice(0, 2)
}

const SUBJECT_TOPIC_PHRASES = {
  'search and relevance': 'Search with Elasticsearch',
  'observability and monitoring': 'Observability and monitoring',
  'AI and ML with Elastic': 'AI and ML with Elastic',
  'data pipelines and ingest': 'Data pipelines and ingest',
  'scaling and production use cases': 'Production use cases with Elastic',
  'migration and upgrades': 'Migration and upgrades',
  'real-world Elastic use cases': 'Real-world use cases',
}

function capitalizeTopic(s) {
  if (!s || typeof s !== 'string') return ''
  const t = s.trim()
  if (!t) return ''
  const proper = ['Elastic', 'Elasticsearch', 'Kafka', 'AI', 'ML', 'MCP', 'AWS', 'EKS', 'Kubernetes']
  const words = t.split(/\s+/)
  const out = words.map((w, i) => {
    const clean = w.replace(/[&]/g, ' and ')
    const lower = clean.toLowerCase()
    if (i === 0 && lower.length > 0) return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()
    const match = proper.find((p) => lower === p.toLowerCase())
    if (match) return match
    if (lower === 'and' || lower === 'with' || lower === 'for' || lower === 'the') return lower
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()
  })
  return out.join(' ')
}

function getSubjectTopic(talkTitle, talkAbstract) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const theme = getTalkTheme(talkTitle, talkAbstract)
  const title = trim(talkTitle)
  const text = `${title} ${trim(talkAbstract)}`.toLowerCase()
  if (/\bkafka\b/.test(text) && /\bstream(ing)?\b/.test(text)) return 'Streaming data with Kafka'
  if (/\bvector\s+search\b/.test(text) || (/\bvector\b/.test(text) && /\bsearch\b/.test(text))) return 'Vector search with Elasticsearch'
  const phrase = SUBJECT_TOPIC_PHRASES[theme]
  if (phrase) return phrase
  if (theme.length <= 28) return capitalizeTopic(theme)
  const short = theme.split(/\s+/).slice(0, 4).join(' ')
  return capitalizeTopic(short)
}

function capSubject(s, max = MAX_SUBJECT_LENGTH) {
  if (typeof s !== 'string' || !s.trim()) return ''
  const t = s.trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1).trim()
  const last = cut.charAt(cut.length - 1)
  return last === '.' || last === ':' || last === '—' ? cut : cut + '…'
}

function buildIntuitionEmailSubjects(form, variant = 0) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const title = trim(form.eventTitle)
  const dateRaw = trim(form.date)
  const date = dateRaw ? (formatDateForLinkedIn(dateRaw) || dateRaw) : ''
  const city = getCityForIntuition(form)

  const keyThemes = extractKeyThemes(form)
  const hooks1 = getTechnicalHooks(form.speaker1TalkTitle, form.speaker1TalkAbstract)
  const hooks2 = getTechnicalHooks(form.speaker2TalkTitle, form.speaker2TalkAbstract)
  const allHooks = []
  const seenHook = new Set()
  for (const p of [...hooks1, ...hooks2]) {
    if (!seenHook.has(p)) {
      seenHook.add(p)
      allHooks.push(p)
    }
  }
  const hook = keyThemes.length > 0 ? keyThemes[0] : (getCombinedHook(allHooks) || (allHooks[0] || null))
  const hook2 = keyThemes.length >= 2 ? keyThemes[1] : (allHooks[1] || null)
  const topic1 = getSubjectTopic(form.speaker1TalkTitle, form.speaker1TalkAbstract)
  const topic2 = trim(form.speaker2TalkTitle) ? getSubjectTopic(form.speaker2TalkTitle, form.speaker2TalkAbstract) : ''
  const topic = topic1 || topic2 || 'Real-world use cases'
  const topicNoSuffix = topic.replace(/\s+with Elastic$/i, '').trim() || topic
  const addWithElastic = (t) => (/\s+with Elastic$/i.test(t) ? t : `${t} with Elastic`)
  const isGenericTopic = (t) => /^Search with Elasticsearch$/i.test(t) || /^Real-world use cases$/i.test(t)
  const useGenericFallbacks = !hook || isGenericTopic(topic)
  const options = []

  if (hook && !isGenericTopic(hook)) {
    options.push(capSubject(`${hook} with Elasticsearch — ${city || 'Elastic Meetup'}`))
    options.push(capSubject(`${hook}: Real-world Elasticsearch lessons`))
    if (city) {
      options.push(capSubject(`From ${hook} to Elasticsearch: ${city} Meetup`))
      options.push(capSubject(`Building ${hook} with Elasticsearch — ${city}`))
      options.push(capSubject(`${hook} — ${city} Elastic Meetup`))
      if (hook2 && (hook + hook2).length < 50) options.push(capSubject(`${hook} + ${hook2} — ${city}`))
    } else {
      options.push(capSubject(`From ${hook} to Elasticsearch: Elastic Meetup`))
      options.push(capSubject(`Building ${hook} with Elasticsearch`))
    }
  }

  if (city) {
    if (date && hook && !isGenericTopic(hook)) {
      options.push(capSubject(`${city} Elastic Meetup on ${date}: ${hook}`))
    }
    if (useGenericFallbacks || !hook) {
      options.push(capSubject(`${city} Elastic Meetup: ${topic}`))
      options.push(capSubject(`${addWithElastic(topicNoSuffix)} — ${city} Meetup`))
      options.push(capSubject(`How teams use ${topicNoSuffix} — ${city} Meetup`))
    }
    if (date) {
      options.push(capSubject(`${city} Elastic Meetup on ${date}: ${hook || topic}`))
      options.push(capSubject(`${city} on ${date}: ${hook ? hook + ' with Elasticsearch' : addWithElastic(topicNoSuffix)}`))
    }
  }

  if (date && !city) {
    options.push(capSubject(`Elastic Meetup on ${date}: ${hook || topic}`))
    options.push(capSubject(`${hook ? hook + ' with Elasticsearch' : addWithElastic(topicNoSuffix)} — ${date}`))
  }

  if (useGenericFallbacks) {
    const realWorldLine = topic === 'Real-world use cases' ? 'Real-world Elastic use cases' : `Real-world ${topicNoSuffix} with Elastic`
    options.push(capSubject(realWorldLine))
    options.push(capSubject(`${addWithElastic(topicNoSuffix)} — community meetup`))
  }
  options.push(capSubject(`Elastic Meetup: ${hook || topic}`))

  if (title && title.length <= 50) {
    if (city) options.push(capSubject(`${city} Elastic Meetup: ${title}`))
    if (date) options.push(capSubject(`${title} — ${date}`))
  }

  const seen = new Set()
  const dedupe = options.filter((o) => {
    const s = (o || '').trim()
    if (!s || s.length > MAX_SUBJECT_LENGTH) return false
    if (useGenericFallbacks && /Search with Elasticsearch/i.test(s) && keyThemes.length > 0) return false
    const k = s.slice(0, 52)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  let result = dedupe.slice(0, 5).map((o) => capSubject(o))
  if (result.length < 3) {
    const fallbackTopic = hook || topic
    const extra = [capSubject(`${fallbackTopic} and Elastic community`), capSubject(`Elastic: ${fallbackTopic} talks`), capSubject(`Meetup: ${hook ? hook + ' with Elasticsearch' : addWithElastic(topicNoSuffix)}`)].filter((o) => o && !result.includes(o))
    result = [...result, ...extra].slice(0, 5)
  }
  return result
}

function buildIntuitionPreviewText(form, variant = 0) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const title = trim(form.eventTitle)
  const why = trim(form.intuitionWhyAttend)
  const city = getCityForIntuition(form)
  const talk1 = trim(form.speaker1TalkTitle)
  const theme1 = getTalkTheme(form.speaker1TalkTitle, form.speaker1TalkAbstract)
  const cap = (s) => {
    if (s.length <= PREVIEW_MAX) return s
    return s.slice(0, PREVIEW_MAX - 1).trim() + (s[PREVIEW_MAX - 1] === ' ' ? '' : '…')
  }
  const v = variant % 3
  const previews = []
  if (city && theme1) {
    previews.push(`Hear real-world ${theme1} and connect with the ${city} Elastic community.`)
    previews.push(`Learn from ${theme1} and network with local engineers in ${city}.`)
    previews.push(`Technical talks on ${theme1}, plus networking with the ${city} community.`)
  }
  if (city && talk1) {
    previews.push(`Featured: ${talk1}. Join the ${city} Elastic community for talks and networking.`)
    previews.push(`Hear about ${talk1} and meet the ${city} Elastic community.`)
  }
  if (city) {
    previews.push(`Real-world talks and networking with the ${city} Elastic community.`)
    previews.push(`Join the ${city} Elastic community for technical talks and networking.`)
  }
  if (why && why.length >= PREVIEW_MIN) previews.push(why)
  previews.push('Technical talks, practical takeaways, and networking with local Elastic users.')
  previews.push('Learn from real production use cases and meet the local Elastic community.')
  previews.push('Hear how teams use Elastic in production and connect with the community.')
  const fallback = 'Practical knowledge and networking with the Elastic community.'
  const pick = previews[v % Math.max(1, previews.length)] || previews[0] || fallback
  let text = pick
  if (text.length < PREVIEW_MIN) text = fallback
  return cap(text)
}

const WHY_ATTEND_INTROS = [
  'Learn how ',
  'Hear how ',
  'Explore how ',
  'Get a practical look at ',
  'Understand how ',
]

function cleanTalkInput(text) {
  if (!text || typeof text !== 'string') return ''
  let s = text.trim().replace(/\s+/g, ' ')
  const stripPatterns = [
    /^this\s+talk\s+will\s+(?:introduce|cover|explore|discuss|present|walk\s+through)\s+/i,
    /^in\s+this\s+(?:session|talk|presentation)\s+(?:\w+\s+)?(?:we'll|we\s+will|you'll|i'll)?\s*(?:explore|cover|discuss|introduce|walk\s+through)?\s*/i,
    /^in\s+this\s+(?:session|talk)\s*,?\s*/i,
    /^(?:\w+\s+){1,3}will\s+(?:discuss|cover|explore|present|speak\s+about|be\s+speaking\s+about)\s+/i,
    /^the\s+speaker\s+will\s+(?:discuss|cover|explore|present)\s+/i,
    /^(?:we'll|we\s+will)\s+(?:explore|cover|discuss|introduce|walk\s+through)\s+/i,
    /^(?:this\s+)?(?:session\s+)?(?:will\s+)?(?:introduce|cover|discuss)\s+/i,
  ]
  for (const re of stripPatterns) {
    s = s.replace(re, '').trim()
  }
  return s.replace(/^\.+\s*/, '').trim()
}

function extractTopicForBullet(talkTitle, talkAbstract) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const title = trim(talkTitle)
  const abstract = trim(talkAbstract)
  const cleanedAbs = cleanTalkInput(abstract)
  const cleanedTitle = cleanTalkInput(title)
  const text = `${cleanedTitle} ${cleanedAbs}`.trim() || `${title} ${abstract}`.trim()
  const lower = text.toLowerCase()

  if (!text) return null

  const cap = (s) => (s.length ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s)
  const short = (phrase, maxWords = 12) => {
    const w = phrase.trim().split(/\s+/)
    if (w.length <= maxWords) return phrase.trim()
    return w.slice(0, maxWords).join(' ').trim()
  }

  if (/\b(model context protocol|mcp)\b/i.test(text)) return short('the Model Context Protocol (MCP) helps developers build smarter AI applications')
  if (/\bkafka\b/i.test(lower) || /\bstreaming\s+data\b/i.test(lower)) return short('streaming data architectures power modern applications')
  if (/\bkubernetes\s+operator\b/i.test(lower) && /\beks\b/i.test(lower)) return short('a Kubernetes operator improves ML workload resilience on AWS EKS')
  if (/\b(search|elasticsearch|relevance)\b/i.test(lower)) return short('teams build better search and relevance with Elastic')
  if (/\b(observability|apm|logging)\b/i.test(lower)) return short('observability and monitoring work in production')
  if (/\b(ai|ml|machine learning)\b/i.test(lower)) return short('AI and ML use cases with Elastic')
  if (/\b(pipeline|ingest)\b/i.test(lower)) return short('data pipelines and ingest scale in practice')
  if (/\b(long[- ]?term\s+health|health\s+tracking)\b/i.test(lower)) return short('long-term health tracking with Elasticsearch')
  if (cleanedAbs.length > 15) {
    const first = cleanedAbs.split(/[.!?]/)[0].trim()
    if (first.length > 20 && first.length < 120 && !/^(this|in\s+this|the\s+speaker)\s+/i.test(first)) return short(first, 12)
  }
  const useTitle = cleanedTitle.length > 0 ? cleanedTitle : title
  if (useTitle.length <= 50) {
    const t = useTitle.toLowerCase()
    if (t.includes(' with ')) return short(cap(t.replace(/\bwith\s+/, 'and ')) + ' in practice')
    if (t.includes(' for ')) return short('teams use ' + cap(t.split(/\s+for\s+/)[1] || t) + ' in production')
    return short(cap(useTitle) + ' in practice')
  }
  const words = useTitle.split(/\s+/).slice(0, 6).join(' ')
  return short(cap(words) + ' in practice')
}

function toLearningOutcomeBullet(talkTitle, talkAbstract, introIndex) {
  const intro = WHY_ATTEND_INTROS[introIndex % WHY_ATTEND_INTROS.length]
  const topic = extractTopicForBullet(talkTitle, talkAbstract)
  if (!topic) return null
  const tail = topic.endsWith('.') ? topic.slice(0, -1) : topic
  if (tail.toLowerCase().startsWith('how ') || tail.toLowerCase().startsWith('the ') || tail.toLowerCase().startsWith('teams ')) {
    return intro === 'Hear how ' ? `Hear ${tail}.` : intro.slice(0, -5) + ' ' + tail + '.'
  }
  return intro + tail + '.'
}

function buildIntuitionWhyAttend(form, variant = 0) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const city = getCityForIntuition(form)
  const networkBullet = city
    ? `Network with the ${city} Elastic community.`
    : 'Network with the local Elastic community.'
  const talk1Title = trim(form.speaker1TalkTitle)
  const talk1Abstract = trim(form.speaker1TalkAbstract)
  const talk2Title = trim(form.speaker2TalkTitle)
  const talk2Abstract = trim(form.speaker2TalkAbstract)
  const hasSpeaker2 = [form.speaker2Name, form.speaker2Title, form.speaker2Company, form.speaker2TalkTitle, form.speaker2TalkAbstract].some((v) => trim(v).length > 0)
  const whyAttend = trim(form.intuitionWhyAttend)
  const takeaway = trim(form.intuitionKeyTakeaway)
  const v = variant % 3
  const introOffset = v * 2
  const bullet1 = toLearningOutcomeBullet(talk1Title, talk1Abstract, 0 + introOffset) ||
    (whyAttend ? (whyAttend.endsWith('.') ? whyAttend : `${whyAttend}.`) : 'Learn how Elastic users solve real-world search and observability challenges.')
  const bullet2 = (hasSpeaker2 && (talk2Title || talk2Abstract))
    ? (toLearningOutcomeBullet(talk2Title, talk2Abstract, 1 + introOffset) || `Hear how ${talk2Title || 'the community'} applies in practice.`)
    : (takeaway ? (takeaway.endsWith('.') ? takeaway : `${takeaway}.`) : 'Explore how others are building with Elastic in production.')
  const three = [
    bullet1.endsWith('.') ? bullet1 : `${bullet1}.`,
    bullet2.endsWith('.') ? bullet2 : `${bullet2}.`,
    networkBullet.endsWith('.') ? networkBullet : `${networkBullet}.`,
  ]
  return three
}

function buildIntuitionWhyAttendText(bullets) {
  return bullets.map((b) => `- ${b}`).join('\n')
}

function buildIntuitionEmailBody(form, variant = 0) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const dateRaw = trim(form.date)
  const date = dateRaw ? (formatDateForLinkedIn(dateRaw) || dateRaw) : ''
  const city = getCityForIntuition(form)
  const v = variant % 3
  const theme1 = getIntroTheme(form.speaker1TalkTitle, form.speaker1TalkAbstract)
  const hasTalk2 = [form.speaker2TalkTitle, form.speaker2TalkAbstract].some((x) => trim(x).length > 0)
  const theme2 = hasTalk2 ? getIntroTheme(form.speaker2TalkTitle, form.speaker2TalkAbstract) : ''
  const hasTalk1 = [form.speaker1TalkTitle, form.speaker1TalkAbstract].some((x) => trim(x).length > 0)

  const communityName = city ? `the ${city} Elastic community` : 'the local Elastic community'
  const intros = [
    (() => {
      let s1 = 'Join us for the next Elastic meetup.'
      if (date && city) s1 = `Join us on ${date} for the next Elastic meetup in ${city}.`
      else if (date) s1 = `Join us on ${date} for the next Elastic meetup.`
      else if (city) s1 = `Join us in ${city} for the next Elastic meetup.`
      let s2 = "We'll hear from community speakers sharing insights on practical Elastic use cases."
      if (hasTalk1 && hasTalk2 && theme2) s2 = `We'll hear from community speakers sharing insights on ${theme1} and ${theme2}.`
      else if (hasTalk1) s2 = `We'll hear from community speakers sharing insights on ${theme1}.`
      const s3 = `We'll wrap up the evening with networking and conversations with ${communityName}.`
      return `${s1} ${s2} ${s3}`
    })(),
    (() => {
      let s1 = 'You\'re invited — join us for the next Elastic meetup.'
      if (date && city) s1 = `You're invited — join us on ${date} for the next Elastic meetup in ${city}.`
      else if (date) s1 = `You're invited — join us on ${date} for the next Elastic meetup.`
      else if (city) s1 = `You're invited — join us in ${city} for the next Elastic meetup.`
      let s2 = 'Community speakers will share insights on practical Elastic use cases.'
      if (hasTalk1 && hasTalk2 && theme2) s2 = `Community speakers will share insights on ${theme1} and ${theme2}.`
      else if (hasTalk1) s2 = `Community speakers will share insights on ${theme1}.`
      const s3 = `We'll close with networking and conversations with ${communityName}.`
      return `${s1} ${s2} ${s3}`
    })(),
    (() => {
      let s1 = 'Save the date for the next Elastic meetup.'
      if (date && city) s1 = `Save the date: ${date}. We're hosting the next Elastic meetup in ${city}.`
      else if (date) s1 = `Save the date: ${date}. We're hosting the next Elastic meetup.`
      else if (city) s1 = `We're hosting the next Elastic meetup in ${city}.`
      let s2 = 'We\'ll hear from the community on practical Elastic use cases.'
      if (hasTalk1 && hasTalk2 && theme2) s2 = `We'll hear from the community on ${theme1} and ${theme2}.`
      else if (hasTalk1) s2 = `We'll hear from the community on ${theme1}.`
      const s3 = `We'll wrap up with networking and conversations with ${communityName}.`
      return `${s1} ${s2} ${s3}`
    })(),
  ]
  const intro = intros[v]
  const closings = [
    'We would love to see you there.',
    'Hope you can join us.',
    'Looking forward to seeing you there.',
  ]
  const lines = []
  lines.push('Hi there,')
  lines.push('')
  lines.push(intro)
  lines.push('')
  lines.push('**Why Attend**')
  const whyBullets = buildIntuitionWhyAttend(form, variant)
  whyBullets.forEach((b) => lines.push(`- ${b}`))
  lines.push('')
  lines.push(closings[v])
  return lines.join('\n')
}

function formatSpeakerForEvent(name, title, company) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const n = trim(name)
  if (!n) return ''
  const cred = [trim(title), trim(company)].filter(Boolean).join(' at ')
  return cred ? `${n} (${cred})` : n
}

function meetupEventPageFieldIsEmpty(value) {
  return typeof value !== 'string' || !value.trim()
}

/** Draft text for Meetup Event Page optional sections; only includes keys that should be filled (caller merges when field is empty). */
function buildQuickMeetupEventPageDraft(form, language = 'en') {
  const n = normalizeLanguage(language)
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const out = {}

  if (meetupEventPageFieldIsEmpty(form.meetupPageWhyAttend)) {
    if (n === 'en') {
      const bullets = buildIntuitionWhyAttend(form, 0)
      out.meetupPageWhyAttend = bullets.map((b) => `- ${trim(b).replace(/^[-•]\s*/, '')}`).join('\n')
    } else {
      out.meetupPageWhyAttend = ''
    }
  }

  if (meetupEventPageFieldIsEmpty(form.meetupPageWhatToExpect)) {
    out.meetupPageWhatToExpect = buildEventPageWhatToExpectQuickDraft({
      city: getCityForIntuition(form),
      theme1: getIntroTheme(form.speaker1TalkTitle, form.speaker1TalkAbstract),
      lang: n,
    })
  }

  if (meetupEventPageFieldIsEmpty(form.meetupPageAgenda)) {
    const built = trim(buildAgenda(form, n))
    out.meetupPageAgenda = built || getEventPageAgendaFallbackLines(n)
  }

  if (meetupEventPageFieldIsEmpty(form.meetupPageClosing)) {
    out.meetupPageClosing = getGeneratorUiTranslations(n).quickClosing
  }

  return out
}

function buildIntro(form, lang = 'en') {
  const n = normalizeLanguage(lang)
  const S = getEventPageStrings(n)
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const dateRaw = trim(form.date)
  const date = dateRaw ? formatLocalizedLongDate(dateRaw, n) || dateRaw : ''
  const s1 = formatSpeakerForEvent(form.speaker1Name, form.speaker1Title, form.speaker1Company)
  const s2 = formatSpeakerForEvent(form.speaker2Name, form.speaker2Title, form.speaker2Company)
  const s3 = formatSpeakerForEvent(form.speaker3Name, form.speaker3Title, form.speaker3Company)
  const hasSpeaker2 = [form.speaker2Name, form.speaker2Title, form.speaker2Company, form.speaker2TalkTitle, form.speaker2TalkAbstract].some((v) => trim(v).length > 0)
  const hasSpeaker3 = [form.speaker3Name, form.speaker3Title, form.speaker3Company, form.speaker3TalkTitle, form.speaker3TalkAbstract].some((v) => trim(v).length > 0)

  const rawGroup = getLinkedInGroupName(form)
  const groupName =
    n === 'en'
      ? rawGroup.startsWith('The ')
        ? rawGroup
        : `The ${rawGroup}`
      : rawGroup.replace(/^The\s+/i, '').trim() || rawGroup
  const when = date ? S.onDate(date) : ''
  if (s1 && hasSpeaker2 && s2 && hasSpeaker3 && s3) {
    return normalizeElastiFlow(S.intro3speakers(groupName, when, s1, s2, s3))
  }
  if (s1 && hasSpeaker2 && s2) {
    return normalizeElastiFlow(S.intro2speakers(groupName, when, s1, s2))
  }
  if (s1) {
    return normalizeElastiFlow(S.intro1speaker(groupName, when, s1))
  }
  return normalizeElastiFlow(S.introNone(groupName, when))
}

/**
 * Single entry for localized Meetup event page plain + HTML from form + optional API structured fields.
 * @param {string} language - generator locale (en | es | pt)
 * @param {object} form - full event page form state
 * @param {object} [generatedData] - `{ structured }` or `{ remoteSections }` from /api/generate
 */
function buildLocalizedEventPageContent(language, form, generatedData = {}) {
  const lang = normalizeLanguage(language)
  const remoteSections = generatedData?.structured ?? generatedData?.remoteSections
  if (import.meta.env.DEV) {
    console.log('[EventPage] buildLocalizedEventPageContent', {
      language: lang,
      hasStructuredRemote: !!(remoteSections && Object.keys(remoteSections).length),
      fieldLengths: {
        rsvp: String(form.rsvpInstructions || '').length,
        arrival: String(form.arrivalInstructions || '').length,
        parking: String(form.parkingNotes || '').length,
        whatToExpect: String(form.meetupPageWhatToExpect || '').length,
        agenda: String(form.meetupPageAgenda || '').length,
        whyAttend: String(form.meetupPageWhyAttend || '').length,
      },
    })
  }
  const out = generateMeetupCopy(form, {
    language: lang,
    remoteSections: remoteSections || undefined,
  })
  if (import.meta.env.DEV) {
    console.log('[EventPage] generated output (plain excerpt)', out.plain?.slice(0, 400))
    console.log('[EventPage] generated HTML length', out.html?.length ?? 0)
  }
  return out
}

function generateMeetupCopy(form, opts = {}) {
  const lang = normalizeLanguage(opts.language)
  const S = getEventPageStrings(lang)
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const has = (s) => trim(s).length > 0
  const rs = opts.remoteSections
  const eventData = buildSharedEventDataFromEventPageForm(form, lang, { remoteSections: rs })
  const agendaPlainFallback = resolveAgendaBodyForEventPage(form, lang, trim, has, rs)
  const intro = buildIntro(form, lang)
  const plain = renderEventPagePlainMarkdown({
    eventData,
    form,
    S,
    intro,
    remoteSections: rs,
    agendaPlainFallback,
  })
  return { plain, html: '' }
}

function buildUrlWithUtm(form) {
  const { baseUrl, utmSource, utmMedium, utmCampaign, utmContent, utmTerm } = form
  if (!baseUrl) return ''
  const params = new URLSearchParams()
  if (utmSource) params.append('utm_source', utmSource)
  if (utmMedium) params.append('utm_medium', utmMedium)
  if (utmCampaign) params.append('utm_campaign', utmCampaign)
  if (utmContent) params.append('utm_content', utmContent)
  if (utmTerm) params.append('utm_term', utmTerm)
  return `${baseUrl}?${params.toString()}`
}

export default function App() {
  const [generatorType, setGeneratorType] = useState('eventPromotion')
  const [form, setForm] = useState(INITIAL_STATE)
  const [kbygForm, setKbygForm] = useState(loadKbygFormFromStorage)
  useEffect(() => {
    try {
      localStorage.setItem(KBYG_FORM_STORAGE_KEY, JSON.stringify(kbygForm))
    } catch {
      // ignore quota / private mode
    }
  }, [kbygForm])

  const [outreachForm, setOutreachForm] = useState(SPEAKER_OUTREACH_INITIAL_STATE)
  const [urlQrForm, setUrlQrForm] = useState(URL_QR_INITIAL_STATE)
  const [qrForm, setQrForm] = useState(QR_INITIAL_STATE)
  const [generatedQr, setGeneratedQr] = useState(false)
  const [qrCopied, setQrCopied] = useState(false)
  const qrContainerRef = useRef(null)
  const qrCodeRef = useRef(null)
  const qrOptionsRef = useRef(null)
  const [shortenCopied, setShortenCopied] = useState(false)
  const [generatedCopy, setGeneratedCopy] = useState('')
  const [meetupPageHtml, setMeetupPageHtml] = useState('')
  /** Last successful /api/generate structured fields for event page (arrival, parking, agenda); drives preview merge over form. */
  const [eventPageGeneratedContent, setEventPageGeneratedContent] = useState(null)
  const [kbygEmailHtml, setKbygEmailHtml] = useState('')
  const [generatedSubject, setGeneratedSubject] = useState('')
  const [generatedOutreachLinkedIn, setGeneratedOutreachLinkedIn] = useState('')
  const [linkedInPost, setLinkedInPost] = useState('')
  const [linkedinVariant, setLinkedinVariant] = useState(0)
  const [outreachVariant, setOutreachVariant] = useState(0)
  const [emailBodyVariant, setEmailBodyVariant] = useState(0)
  const [subjectCopied, setSubjectCopied] = useState(false)
  const [copied, setCopied] = useState(false)
  const [kbygEmailHtmlCopied, setKbygEmailHtmlCopied] = useState(false)
  const [linkedInCopied, setLinkedInCopied] = useState(false)
  const [outreachLinkedInCopied, setOutreachLinkedInCopied] = useState(false)
  const [intuitionSubjectCopiedIndex, setIntuitionSubjectCopiedIndex] = useState(null)
  const [intuitionPreviewCopied, setIntuitionPreviewCopied] = useState(false)
  const [intuitionWhyAttendCopied, setIntuitionWhyAttendCopied] = useState(false)
  const [intuitionBodyCopied, setIntuitionBodyCopied] = useState(false)
  const [kbygTldrRotation, setKbygTldrRotation] = useState(0)
  const [eventPageLanguage, setEventPageLanguage] = useState('en')
  const [meetupKbygLanguage, setMeetupKbygLanguage] = useState('en')
  const tEvent = useMemo(() => getGeneratorUiTranslations(eventPageLanguage), [eventPageLanguage])
  const tKbyg = useMemo(() => getGeneratorUiTranslations(meetupKbygLanguage), [meetupKbygLanguage])
  const [kbygQuickImportPaste, setKbygQuickImportPaste] = useState('')
  const [kbygQuickImportFeedback, setKbygQuickImportFeedback] = useState('')
  useEffect(() => {
    if (!kbygQuickImportFeedback) return
    const t = window.setTimeout(() => setKbygQuickImportFeedback(''), 8000)
    return () => window.clearTimeout(t)
  }, [kbygQuickImportFeedback])
  const [translateMessage, setTranslateMessage] = useState(null)
  const [kbygSectionCopiedId, setKbygSectionCopiedId] = useState(null)
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [comboboxHighlight, setComboboxHighlight] = useState(0)
  const comboboxRef = useRef(null)
  const [showSpeaker2, setShowSpeaker2] = useState(false)
  const [showSpeaker3, setShowSpeaker3] = useState(false)

  const formRef = useRef(form)
  formRef.current = form
  /** Skip first Event Page mount; reset when leaving Event Page generator. */
  const prevEventPageLangForTranslateRef = useRef(null)

  const kbygSections = useMemo(
    () =>
      generatorType === 'knowBeforeYouGo' && generatedCopy
        ? parseKbygPlainSections(generatedCopy)
        : [],
    [generatorType, generatedCopy],
  )

  const generatedCopyRef = useRef(generatedCopy)
  generatedCopyRef.current = generatedCopy
  const kbygEmojiHeadersPrevRef = useRef(null)

  useEffect(() => {
    kbygEmojiHeadersPrevRef.current = null
  }, [generatorType])

  /** Refresh plain + HTML output when emoji header toggle changes (after initial preview exists). */
  useEffect(() => {
    if (generatorType !== 'knowBeforeYouGo') return
    const enabled = kbygForm.kbygEmojiHeaders !== false
    const prev = kbygEmojiHeadersPrevRef.current
    kbygEmojiHeadersPrevRef.current = enabled
    if (prev === null) return
    if (prev === enabled) return
    if (!generatedCopyRef.current.trim()) return
    const opts = meetupKbygRenderOpts(kbygForm, kbygTldrRotation, meetupKbygLanguage)
    setGeneratedSubject(generateKnowBeforeYouGoSubject(kbygForm, opts))
    setGeneratedCopy(generateKnowBeforeYouGoEmail(kbygForm, opts))
    setKbygEmailHtml(buildKnowBeforeYouGoEmailHtml(kbygForm, opts))
  }, [kbygForm.kbygEmojiHeaders, generatorType, kbygTldrRotation, meetupKbygLanguage])

  const query = (form.chapterOrCity || '').trim().toLowerCase()
  const filteredGroups = query
    ? USER_GROUPS.filter((g) => g.toLowerCase().includes(query))
    : USER_GROUPS

  useEffect(() => {
    if (!comboboxOpen) return
    setComboboxHighlight(0)
  }, [form.chapterOrCity, comboboxOpen])

  useEffect(() => {
    const d = getEventPageFieldDefaults(eventPageLanguage)
    setForm((prev) => {
      const next = { ...prev }
      if (!String(prev.meetupPageWhyAttend || '').trim()) next.meetupPageWhyAttend = d.meetupPageWhyAttend
      if (!String(prev.meetupPageWhatToExpect || '').trim()) next.meetupPageWhatToExpect = d.meetupPageWhatToExpect
      if (!String(prev.meetupPageClosing || '').trim()) next.meetupPageClosing = d.meetupPageClosing
      return next
    })
  }, [eventPageLanguage])

  /** On Event Page language change: translate arrival / parking / agenda via API and refresh preview. */
  useEffect(() => {
    if (generatorType !== 'eventPromotion') {
      prevEventPageLangForTranslateRef.current = null
      return
    }

    if (prevEventPageLangForTranslateRef.current === null) {
      prevEventPageLangForTranslateRef.current = eventPageLanguage
      return
    }

    if (prevEventPageLangForTranslateRef.current === eventPageLanguage) return
    prevEventPageLangForTranslateRef.current = eventPageLanguage

    let cancelled = false

    ;(async () => {
      const snapshot = formRef.current
      const keys = ['arrivalInstructions', 'parkingNotes', 'meetupPageAgenda']
      const updates = {}

      await Promise.all(
        keys.map(async (key) => {
          const raw = String(snapshot[key] ?? '').trim()
          if (!raw) return
          const data = await tryRemoteTranslate(raw, eventPageLanguage)
          const out = extractTranslatedPlain(data)
          if (out) updates[key] = out
        }),
      )

      if (cancelled) return

      const mergedForm = { ...formRef.current }
      for (const key of Object.keys(updates)) {
        const atStart = String(snapshot[key] ?? '').trim()
        const latest = String(formRef.current[key] ?? '').trim()
        if (latest === atStart) mergedForm[key] = updates[key]
      }

      if (Object.keys(updates).length > 0) {
        setForm((prev) => {
          const next = { ...prev }
          for (const key of Object.keys(updates)) {
            const atStart = String(snapshot[key] ?? '').trim()
            const cur = String(prev[key] ?? '').trim()
            if (cur === atStart) next[key] = updates[key]
          }
          return next
        })
      }
      setEventPageGeneratedContent(null)

      const page = buildLocalizedEventPageContent(eventPageLanguage, mergedForm, {})
      setGeneratedCopy(page.plain)
      setMeetupPageHtml(page.html)
    })()

    return () => {
      cancelled = true
    }
  }, [eventPageLanguage, generatorType])

  useEffect(() => {
    function handleClickOutside(e) {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
        setComboboxOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!generatedQr) {
      qrCodeRef.current = null
      return
    }
    if (!qrContainerRef.current) return
    const opts = {
      width: 256,
      height: 256,
      data: qrForm.qrLink,
      dotsOptions: { color: qrForm.qrColor, type: qrForm.qrDotStyle },
      backgroundOptions: { color: qrForm.qrTransparent ? 'transparent' : qrForm.qrBgColor },
      ...(qrForm.qrEyeStyle ? {
        cornersSquareOptions: { type: qrForm.qrEyeStyle, color: qrForm.qrColor },
        cornersDotOptions: { type: qrForm.qrEyeStyle === 'dot' ? 'dot' : 'square', color: qrForm.qrColor },
      } : {}),
      image: elasticLogo,
      imageOptions: { crossOrigin: 'anonymous', margin: 5, imageSize: 0.3 },
      qrOptions: { errorCorrectionLevel: 'H' },
    }
    qrOptionsRef.current = opts
    if (!qrCodeRef.current) {
      qrCodeRef.current = new QRCodeStyling(opts)
      qrContainerRef.current.innerHTML = ''
      qrCodeRef.current.append(qrContainerRef.current)
    } else {
      qrCodeRef.current.update(opts)
    }
  }, [generatedQr, qrForm])

  const selectGroup = (name) => {
    setForm((prev) => ({ ...prev, chapterOrCity: name }))
    setComboboxOpen(false)
    setComboboxHighlight(0)
  }

  const handleComboboxKeyDown = (e) => {
    if (!comboboxOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        setComboboxOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setComboboxHighlight((i) => (i < filteredGroups.length - 1 ? i + 1 : i))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setComboboxHighlight((i) => (i > 0 ? i - 1 : 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredGroups[comboboxHighlight] != null) {
        selectGroup(filteredGroups[comboboxHighlight])
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setComboboxOpen(false)
    }
  }

  const update = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleQuickMeetupDraft = () => {
    setForm((prev) => ({ ...prev, ...buildQuickMeetupEventPageDraft(prev, eventPageLanguage) }))
  }

  const updateKbyg = (key) => (e) =>
    setKbygForm((prev) => ({ ...prev, [key]: e.target.value }))

  const kbygTldrIncludeMerged = { ...getInitialKbygTldrInclude(), ...(kbygForm.kbygTldrInclude || {}) }
  const kbygTldrLabels = getMeetupKbygTldrLabels(meetupKbygLanguage)

  const updateKbygCheckbox = (key) => (e) =>
    setKbygForm((prev) => ({ ...prev, [key]: e.target.checked }))

  const updateKbygTldrInclude = (id) => (e) =>
    setKbygForm((prev) => ({
      ...prev,
      kbygTldrInclude: { ...getInitialKbygTldrInclude(), ...(prev.kbygTldrInclude || {}), [id]: e.target.checked },
    }))

  /** Quick-fill replaces the entire field value (does not append to existing text). */
  const applyMeetupKbygQuickFill = (fieldKey, value) => {
    setKbygForm((prev) => ({ ...prev, [fieldKey]: value }))
  }

  const handleKbygQuickImportParse = () => {
    setKbygForm((prev) => {
      const { patch } = parseKbygQuickImport(kbygQuickImportPaste)
      const { next, appliedKeys } = mergeKbygQuickImportPatch(prev, patch)
      queueMicrotask(() => {
        setKbygQuickImportFeedback(formatQuickImportFeedback(appliedKeys, tKbyg))
      })
      return next
    })
  }

  const updateKbygContact = (index, field) => (e) =>
    setKbygForm((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => (i === index ? { ...c, [field]: e.target.value } : c)),
    }))

  const addKbygContact = () =>
    setKbygForm((prev) => ({
      ...prev,
      contacts: [...prev.contacts, { name: '', role: '', contactInfo: '' }],
    }))

  const updateOutreach = (key) => (e) =>
    setOutreachForm((prev) => ({ ...prev, [key]: e.target.value }))

  const updateUrlQr = (key) => (e) =>
    setUrlQrForm((prev) => ({ ...prev, [key]: e.target.value }))

  const updateQr = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setQrForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleGenerateQr = (e) => {
    e.preventDefault()
    if (qrForm.qrLink) setGeneratedQr(true)
  }

  const handleCreateQrFromUrl = () => {
    setQrForm(prev => ({ ...prev, qrLink: generatedCopy }))
    setGeneratedQr(false)
    setGeneratorType('qrCodeGenerator')
    setGeneratedCopy('')
    setKbygEmailHtml('')
  }

  const handleShortenLink = () => {
    navigator.clipboard.writeText(generatedCopy).then(() => {
      setShortenCopied(true)
      setTimeout(() => setShortenCopied(false), 2000)
    }).catch(() => {})
    window.open('https://links.app.elstc.co', '_blank', 'noopener,noreferrer')
  }

  const handleTranslateOutput = async (targetLang) => {
    const text = generatedCopy.trim()
    if (!text) return
    setTranslateMessage(null)
    const data = await tryRemoteTranslate(text, targetLang)
    const n = normalizeLanguage(targetLang)

    if (generatorType === 'eventPromotion') {
      const applied = applyRemoteEventPageResult(data)
      if (applied) {
        const structured = applied.structured
        setEventPageGeneratedContent(structured)
        const mergedPage = buildLocalizedEventPageContent(n, form, { structured })
        const finalPlain = applied.plain.trim() || mergedPage.plain
        let finalHtml = (applied.html && applied.html.trim()) || ''
        if (!finalHtml) {
          if (structured && Object.keys(structured).length > 0) {
            finalHtml = mergedPage.html
          } else {
            finalHtml = meetupPlainTextToHtml(finalPlain)
          }
        }
        setGeneratedCopy(finalPlain)
        setMeetupPageHtml(finalHtml)
        setEventPageLanguage(n)
        if (import.meta.env.DEV) {
          console.log('[EventPage] final rendered preview (translate)', {
            selectedLanguage: n,
            htmlSnippet: finalHtml?.slice(0, 280),
          })
        }
        return
      }
    } else {
      const applied = applyRemoteKbygResult(data)
      if (applied?.plain) {
        setGeneratedCopy(applied.plain)
        if (applied.html) {
          if (generatorType === 'knowBeforeYouGo') setKbygEmailHtml(applied.html)
        }
        return
      }
    }

    setTranslateMessage(
      'Translation needs your /api/generate backend (POST with action: translate). Output was not changed.',
    )
    setTimeout(() => setTranslateMessage(null), 6000)
  }

  const handleGenerate = async () => {
    if (generatorType === 'knowBeforeYouGo') {
      setKbygTldrRotation(0)
      const opts = meetupKbygRenderOpts(kbygForm, 0, meetupKbygLanguage)
      const remote = await tryRemoteGenerate({
        generator: 'meetupKbyg',
        language: meetupKbygLanguage,
        form: kbygForm,
        options: opts,
      })
      const applied = applyRemoteKbygResult(remote)
      if (applied?.plain) {
        setGeneratedSubject(generateKnowBeforeYouGoSubject(kbygForm, opts))
        setGeneratedCopy(applied.plain)
        setKbygEmailHtml(applied.html || buildKnowBeforeYouGoEmailHtml(kbygForm, opts))
        setMeetupPageHtml('')
        setGeneratedOutreachLinkedIn('')
        return
      }
      setGeneratedSubject(generateKnowBeforeYouGoSubject(kbygForm, opts))
      const emailText = generateKnowBeforeYouGoEmail(kbygForm, opts)
      setGeneratedCopy(emailText)
      setKbygEmailHtml(buildKnowBeforeYouGoEmailHtml(kbygForm, opts))
      setMeetupPageHtml('')
      setGeneratedOutreachLinkedIn('')
    } else if (generatorType === 'speakerOutreach') {
      const channel = outreachForm.channel || 'linkedin'
      if (channel === 'email') {
        setGeneratedSubject(generateSpeakerOutreachSubject(outreachForm, outreachVariant))
        setGeneratedCopy(generateSpeakerOutreachEmail(outreachForm, outreachVariant))
        setMeetupPageHtml('')
        setKbygEmailHtml('')
        setGeneratedOutreachLinkedIn('')
      } else {
        setGeneratedSubject('')
        setGeneratedCopy('')
        setMeetupPageHtml('')
        setKbygEmailHtml('')
        setGeneratedOutreachLinkedIn(generateSpeakerOutreachLinkedIn(outreachForm, outreachVariant))
      }
    } else if (generatorType === 'urlQrGenerator') {
      const finalUrl = buildUrlWithUtm(urlQrForm)
      setGeneratedCopy(finalUrl)
      setGeneratedSubject('')
      setMeetupPageHtml('')
      setKbygEmailHtml('')
      setGeneratedOutreachLinkedIn('')
    } else if (generatorType === 'qrCodeGenerator') {
      if (qrForm.qrLink) setGeneratedQr(true)
    } else {
      setGeneratedSubject('')
      const remote = await tryRemoteGenerate({
        generator: 'eventPage',
        language: eventPageLanguage,
        form,
      })
      const applied = applyRemoteEventPageResult(remote)
      if (applied) {
        const structured = applied.structured
        setEventPageGeneratedContent(structured)
        const mergedPage = buildLocalizedEventPageContent(eventPageLanguage, form, { structured })
        const finalPlain = applied.plain.trim() || mergedPage.plain
        let finalHtml = (applied.html && applied.html.trim()) || ''
        if (!finalHtml) {
          if (structured && Object.keys(structured).length > 0) {
            finalHtml = mergedPage.html
          } else {
            finalHtml = meetupPlainTextToHtml(finalPlain)
          }
        }
        setGeneratedCopy(finalPlain)
        setMeetupPageHtml(finalHtml)
        if (import.meta.env.DEV) {
          console.log('[EventPage] final rendered preview (remote)', {
            selectedLanguage: eventPageLanguage,
            htmlSnippet: finalHtml?.slice(0, 280),
            usedMergedHtml: Boolean(structured && Object.keys(structured).length && !String(applied.html || '').trim()),
            usedPlainToHtml: Boolean(
              !String(applied.html || '').trim() && !(structured && Object.keys(structured).length),
            ),
          })
        }
        setKbygEmailHtml('')
        setGeneratedOutreachLinkedIn('')
        setLinkedInPost(buildLinkedInPost(form, linkedinVariant))
        return
      }
      setEventPageGeneratedContent(null)
      const page = buildLocalizedEventPageContent(eventPageLanguage, form, {})
      setGeneratedCopy(page.plain)
      setMeetupPageHtml(page.html)
      if (import.meta.env.DEV) {
        console.log('[EventPage] final rendered preview (local generator)', {
          selectedLanguage: eventPageLanguage,
          htmlSnippet: page.html?.slice(0, 280),
        })
      }
      setKbygEmailHtml('')
      setGeneratedOutreachLinkedIn('')
      setLinkedInPost(buildLinkedInPost(form, linkedinVariant))
    }
  }

  const handleRegenLinkedIn = () => {
    const nextVariant = (linkedinVariant + 1) % 3
    setLinkedinVariant(nextVariant)
    setLinkedInPost(buildLinkedInPost(form, nextVariant))
  }
  const handleRegenIntuition = () => {
    setEmailBodyVariant((v) => (v + 1) % 3)
  }
  const handleRegenOutreachLinkedIn = () => {
    const nextVariant = (outreachVariant + 1) % 3
    setOutreachVariant(nextVariant)
    setGeneratedOutreachLinkedIn(generateSpeakerOutreachLinkedIn(outreachForm, nextVariant))
  }
  const handleRegenOutreachEmail = () => {
    const nextVariant = (outreachVariant + 1) % 3
    setOutreachVariant(nextVariant)
    setGeneratedSubject(generateSpeakerOutreachSubject(outreachForm, nextVariant))
    setGeneratedCopy(generateSpeakerOutreachEmail(outreachForm, nextVariant))
  }

  const handleRegenKbygTldr = () => {
    const next = kbygTldrRotation + 1
    setKbygTldrRotation(next)
    const opts = meetupKbygRenderOpts(kbygForm, next, meetupKbygLanguage)
    setGeneratedSubject(generateKnowBeforeYouGoSubject(kbygForm, opts))
    setGeneratedCopy(generateKnowBeforeYouGoEmail(kbygForm, opts))
    setKbygEmailHtml(buildKnowBeforeYouGoEmailHtml(kbygForm, opts))
  }

  const handleKbygSectionConcise = (sectionKey) => {
    const sections = parseKbygPlainSections(generatedCopy)
    const target = sections.find((s) => s.key === sectionKey)
    if (!target) return
    const updated = replaceKbygSectionBody(sections, sectionKey, makeMoreConcise(target.body))
    setGeneratedCopy(rebuildKbygPlainFromSections(updated))
    setKbygEmailHtml('')
  }

  const handleKbygFullConcise = () => {
    setGeneratedCopy(makeMoreConcise(generatedCopy))
    setKbygEmailHtml('')
  }

  const copyKbygSection = async (sectionKey, text) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setKbygSectionCopiedId(sectionKey)
      setTimeout(() => setKbygSectionCopiedId(null), 2000)
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  const handleMeetupPageConcise = () => {
    setGeneratedCopy(makeMoreConcise(generatedCopy))
    setMeetupPageHtml('')
  }

  /** Rebuild Meetup event page + LinkedIn preview from current `form` only — does not modify form state. */
  const handleRegenerateEventPageFromDetails = () => {
    if (generatorType !== 'eventPromotion') return
    handleGenerate()
  }

  const handleLinkedInConcise = () => {
    const src = linkedInPost || buildLinkedInPost(form, linkedinVariant)
    setLinkedInPost(makeMoreConcise(src))
  }

  const handleOutreachSubjectConcise = () => {
    setGeneratedSubject(makeMoreConcise(generatedSubject))
  }

  const handleOutreachBodyConcise = () => {
    setGeneratedCopy(makeMoreConcise(generatedCopy))
  }

  const handleOutreachLinkedInConcise = () => {
    setGeneratedOutreachLinkedIn(makeMoreConcise(generatedOutreachLinkedIn))
  }

  const handleCopy = async () => {
    if (!generatedCopy) return
    try {
      if (generatorType === 'eventPromotion' && meetupPageHtml && typeof ClipboardItem !== 'undefined') {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([meetupPageHtml], { type: 'text/html' }),
              'text/plain': new Blob([generatedCopy], { type: 'text/plain' }),
            }),
          ])
        } catch {
          await navigator.clipboard.writeText(generatedCopy)
        }
      } else {
        await navigator.clipboard.writeText(generatedCopy)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  const handleReset = () => {
    if (generatorType === 'knowBeforeYouGo') {
      setKbygTldrRotation(0)
      setKbygForm(KBYG_INITIAL_STATE)
      setKbygQuickImportPaste('')
      setKbygQuickImportFeedback('')
    } else if (generatorType === 'speakerOutreach') {
      setOutreachForm(SPEAKER_OUTREACH_INITIAL_STATE)
    } else if (generatorType === 'urlQrGenerator') {
      setUrlQrForm(URL_QR_INITIAL_STATE)
    } else if (generatorType === 'qrCodeGenerator') {
      setQrForm(QR_INITIAL_STATE)
      setGeneratedQr(false)
    } else {
      setForm(INITIAL_STATE)
      setShowSpeaker2(false)
      setShowSpeaker3(false)
    }
    setGeneratedCopy('')
    setMeetupPageHtml('')
    setEventPageGeneratedContent(null)
    setKbygEmailHtml('')
    setGeneratedSubject('')
    setGeneratedOutreachLinkedIn('')
    setLinkedInPost('')
  }

  const handleCopyKbygEmailHtml = async () => {
    if (!kbygEmailHtml || !generatedCopy) return
    try {
      if (typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([kbygEmailHtml], { type: 'text/html' }),
            'text/plain': new Blob([generatedCopy], { type: 'text/plain' }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(generatedCopy)
      }
      setKbygEmailHtmlCopied(true)
      setTimeout(() => setKbygEmailHtmlCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed', err)
      try {
        await navigator.clipboard.writeText(generatedCopy)
      } catch (e2) {
        console.error(e2)
      }
    }
  }

  const handleCopySubject = async () => {
    if (!generatedSubject) return
    try {
      await navigator.clipboard.writeText(generatedSubject)
      setSubjectCopied(true)
      setTimeout(() => setSubjectCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  const handleCopyLinkedIn = async () => {
    const post = linkedInPost || buildLinkedInPost(form)
    if (!post) return
    try {
      await navigator.clipboard.writeText(post)
      setLinkedInCopied(true)
      setTimeout(() => setLinkedInCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  const handleCopyOutreachLinkedIn = async () => {
    if (!generatedOutreachLinkedIn) return
    try {
      await navigator.clipboard.writeText(generatedOutreachLinkedIn)
      setOutreachLinkedInCopied(true)
      setTimeout(() => setOutreachLinkedInCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  const copyIntuition = (getText, setCopiedState, getHtml) => async () => {
    const text = getText()
    if (!text) return
    try {
      const html = typeof getHtml === 'function' ? getHtml() : ''
      if (html && typeof ClipboardItem !== 'undefined') {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([html], { type: 'text/html' }),
              'text/plain': new Blob([text], { type: 'text/plain' }),
            }),
          ])
        } catch {
          await navigator.clipboard.writeText(text)
        }
      } else {
        await navigator.clipboard.writeText(text)
      }
      setCopiedState(true)
      setTimeout(() => setCopiedState(false), 2000)
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>
          <span className="header-emoji" role="img" aria-hidden="true">
            🧰
          </span>
          Elastic DevRel (Programs) Toolkit -{' '}
          <span className="header-tagline">
            Everything needed for meetups and conference logistics, all in one place.
          </span>
        </h1>
      </header>

      <div className="app-body">
        <nav className="sidebar" aria-label="Generator navigation">
          <div className="sidebar-heading">Generators</div>
          {GENERATOR_CARDS.map((card) => {
            const [icon, ...rest] = card.title.split(' ')
            const label = rest.join(' ')
            return (
              <button
                key={card.value}
                type="button"
                className={`sidebar-item ${generatorType === card.value ? 'sidebar-item-active' : ''}`}
                onClick={() => {
                  setGeneratorType(card.value)
                  setGeneratedCopy('')
                  setMeetupPageHtml('')
                  setEventPageGeneratedContent(null)
                  setKbygEmailHtml('')
                  setGeneratedSubject('')
                  setGeneratedOutreachLinkedIn('')
                  setLinkedInPost('')
                }}
                aria-pressed={generatorType === card.value}
                title={card.title}
              >
                <span className="sidebar-icon">{icon}</span>
                <span className="sidebar-item-text">
                  <span className="sidebar-label-text">{label}</span>
                  <span className="sidebar-item-desc">{card.description}</span>
                </span>
              </button>
            )
          })}
        </nav>
        <div className="app-content">
        <div className="layout">
        {generatorType === 'conferenceKnowBeforeYouGo' ? (
          <ConferenceKnowBeforeYouGo />
        ) : (
        <>
        <aside className="form-panel">

          {generatorType === 'eventPromotion' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleGenerate()
            }}
            className="form"
          >
            <label>
              User Group (optional)
              <div className="combobox" ref={comboboxRef}>
                <input
                  type="text"
                  value={form.chapterOrCity}
                  onChange={update('chapterOrCity')}
                  onFocus={() => setComboboxOpen(true)}
                  onKeyDown={handleComboboxKeyDown}
                  placeholder="Search or select a user group..."
                  autoComplete="off"
                  aria-expanded={comboboxOpen}
                  aria-haspopup="listbox"
                  aria-autocomplete="list"
                />
                {comboboxOpen && (
                  <ul
                    className="combobox-list"
                    role="listbox"
                    aria-label="User groups"
                  >
                    {filteredGroups.map((group, i) => (
                      <li
                        key={group}
                        role="option"
                        aria-selected={i === comboboxHighlight}
                        className={i === comboboxHighlight ? 'combobox-option combobox-option-highlight' : 'combobox-option'}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          selectGroup(group)
                        }}
                        onMouseEnter={() => setComboboxHighlight(i)}
                      >
                        {group}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <span className="form-hint">Optional: select a user group to auto-fill details.</span>
            </label>
            <label>
              Event title
              <input
                type="text"
                value={form.eventTitle}
                onChange={update('eventTitle')}
                placeholder="e.g. March Meetup: State Management"
              />
            </label>
            <label>
              Date
              <input
                type="text"
                value={form.date}
                onChange={update('date')}
                placeholder="e.g. Tuesday, March 18"
              />
            </label>
            <label>
              Event start time
              <input
                type="text"
                value={form.eventStartTime}
                onChange={update('eventStartTime')}
                placeholder="e.g. 6:00 PM"
              />
            </label>
            <label>
              Timezone
              <select
                value={form.timezone}
                onChange={update('timezone')}
                aria-label="Event timezone (optional)"
              >
                {TIMEZONE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Venue name
              <input
                type="text"
                value={form.venueName}
                onChange={update('venueName')}
                placeholder="e.g. WeWork Downtown"
              />
            </label>
            <label>
              Venue address
              <input
                type="text"
                value={form.venueAddress}
                onChange={update('venueAddress')}
                placeholder="e.g. 123 Main St, Seattle, WA"
              />
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.eventPageSectionEmojis !== false}
                onChange={(e) => setForm((prev) => ({ ...prev, eventPageSectionEmojis: e.target.checked }))}
                aria-label="Add section emojis to event page copy"
              />
              <span>Add section emojis</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.eventPageInviteSpeakers === true}
                onChange={(e) => setForm((prev) => ({ ...prev, eventPageInviteSpeakers: e.target.checked }))}
                aria-label="Add call for speakers section"
              />
              <span>Add call for speakers section</span>
            </label>
            <span className="form-hint">When enabled, event page sections show emojis (e.g. 📅 Date and Time, 📍 Location).</span>
            <span className="form-hint">When enabled, adds a call-for-speakers section after the Agenda.</span>

            <fieldset className="form-fieldset">
              <legend>Speaker 1</legend>
              <label>
                Speaker 1 name
                <input
                  type="text"
                  value={form.speaker1Name}
                  onChange={update('speaker1Name')}
                  placeholder="e.g. Jane Smith"
                />
              </label>
              <label>
                Speaker 1 title
                <input
                  type="text"
                  value={form.speaker1Title}
                  onChange={update('speaker1Title')}
                  placeholder="e.g. Staff Engineer"
                />
              </label>
              <label>
                Speaker 1 company
                <input
                  type="text"
                  value={form.speaker1Company}
                  onChange={update('speaker1Company')}
                  placeholder="e.g. Acme Inc"
                />
              </label>
              <label>
                Speaker 1 talk title
                <input
                  type="text"
                  value={form.speaker1TalkTitle}
                  onChange={update('speaker1TalkTitle')}
                  placeholder="e.g. React Server Components in Production"
                />
              </label>
              <label>
                Speaker 1 talk abstract
                <textarea
                  value={form.speaker1TalkAbstract}
                  onChange={update('speaker1TalkAbstract')}
                  placeholder="Brief description of the talk..."
                  rows={3}
                />
              </label>
            </fieldset>

            <div className="speaker-toggle-row">
              {showSpeaker2 ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowSpeaker2(false)
                    setShowSpeaker3(false)
                    setForm((prev) => ({
                      ...prev,
                      speaker2Name: '',
                      speaker2Title: '',
                      speaker2Company: '',
                      speaker2TalkTitle: '',
                      speaker2TalkAbstract: '',
                      speaker3Name: '',
                      speaker3Title: '',
                      speaker3Company: '',
                      speaker3TalkTitle: '',
                      speaker3TalkAbstract: '',
                    }))
                  }}
                  className="btn-remove-speaker"
                >
                  Remove Speaker 2
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSpeaker2(true)}
                  className="btn-add-speaker"
                >
                  + Add Speaker 2
                </button>
              )}
            </div>

            {showSpeaker2 && (
            <fieldset className="form-fieldset">
              <legend>Speaker 2</legend>
              <label>
                Speaker 2 name
                <input
                  type="text"
                  value={form.speaker2Name}
                  onChange={update('speaker2Name')}
                  placeholder="e.g. John Doe"
                />
              </label>
              <label>
                Speaker 2 title
                <input
                  type="text"
                  value={form.speaker2Title}
                  onChange={update('speaker2Title')}
                  placeholder="e.g. Principal Engineer"
                />
              </label>
              <label>
                Speaker 2 company
                <input
                  type="text"
                  value={form.speaker2Company}
                  onChange={update('speaker2Company')}
                  placeholder="e.g. TechCo"
                />
              </label>
              <label>
                Speaker 2 talk title
                <input
                  type="text"
                  value={form.speaker2TalkTitle}
                  onChange={update('speaker2TalkTitle')}
                  placeholder="e.g. Building Scalable APIs"
                />
              </label>
              <label>
                Speaker 2 talk abstract
                <textarea
                  value={form.speaker2TalkAbstract}
                  onChange={update('speaker2TalkAbstract')}
                  placeholder="Brief description of the talk..."
                  rows={3}
                />
              </label>
            </fieldset>
            )}

            {showSpeaker2 && (
              <div className="speaker-toggle-row">
                {showSpeaker3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSpeaker3(false)
                      setForm((prev) => ({
                        ...prev,
                        speaker3Name: '',
                        speaker3Title: '',
                        speaker3Company: '',
                        speaker3TalkTitle: '',
                        speaker3TalkAbstract: '',
                      }))
                    }}
                    className="btn-remove-speaker"
                  >
                    Remove Speaker 3
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSpeaker3(true)}
                    className="btn-add-speaker"
                  >
                    + Add Speaker 3
                  </button>
                )}
              </div>
            )}

            {showSpeaker3 && (
            <fieldset className="form-fieldset">
              <legend>Speaker 3</legend>
              <label>
                Speaker 3 name
                <input
                  type="text"
                  value={form.speaker3Name}
                  onChange={update('speaker3Name')}
                  placeholder="e.g. Alex Chen"
                />
              </label>
              <label>
                Speaker 3 title
                <input
                  type="text"
                  value={form.speaker3Title}
                  onChange={update('speaker3Title')}
                  placeholder="e.g. Senior Developer"
                />
              </label>
              <label>
                Speaker 3 company
                <input
                  type="text"
                  value={form.speaker3Company}
                  onChange={update('speaker3Company')}
                  placeholder="e.g. StartupCo"
                />
              </label>
              <label>
                Speaker 3 talk title
                <input
                  type="text"
                  value={form.speaker3TalkTitle}
                  onChange={update('speaker3TalkTitle')}
                  placeholder="e.g. Talk title"
                />
              </label>
              <label>
                Speaker 3 talk abstract
                <textarea
                  value={form.speaker3TalkAbstract}
                  onChange={update('speaker3TalkAbstract')}
                  placeholder="Brief description of the talk..."
                  rows={3}
                />
              </label>
            </fieldset>
            )}

            <label>
              {tEvent.hostOrSponsor}
              <input
                type="text"
                value={form.hostOrSponsor}
                onChange={update('hostOrSponsor')}
                placeholder={tEvent.phHostOrSponsor}
              />
            </label>
            <label>
              {tEvent.rsvpInstructions}
              <input
                type="text"
                value={form.rsvpInstructions}
                onChange={update('rsvpInstructions')}
                placeholder={tEvent.phRsvp}
              />
            </label>
            <label>
              {tEvent.arrivalInstructions}
              <input
                type="text"
                value={form.arrivalInstructions}
                onChange={update('arrivalInstructions')}
                placeholder={tEvent.phArrival}
              />
            </label>
            <label>
              {tEvent.parkingNotes}
              <input
                type="text"
                value={form.parkingNotes}
                onChange={update('parkingNotes')}
                placeholder={tEvent.phParking}
              />
            </label>
            <fieldset className="form-fieldset">
              <legend>{tEvent.meetupPageSectionsLegend}</legend>
              <p className="form-hint kbyg-quick-fill-hint">
                {tEvent.meetupPageSectionsHint}
              </p>
              <div className="quick-draft-stack">
                <button type="button" className="btn-quick-draft" onClick={handleQuickMeetupDraft}>
                  {tEvent.quickGenerateDraft}
                </button>
                <p className="form-hint">{tEvent.quickGenerateDraftSub}</p>
              </div>
              <div className="event-page-section-toggles" role="group" aria-label={tEvent.includeOnPage}>
                <span className="form-hint tldr-include-heading">{tEvent.includeOnPage}</span>
                <div className="tldr-include-checkboxes">
                  <label className="checkbox-label tldr-include-option">
                    <input
                      type="checkbox"
                      checked={form.eventPageIncludeWhyAttend !== false}
                      onChange={(e) => setForm((prev) => ({ ...prev, eventPageIncludeWhyAttend: e.target.checked }))}
                    />
                    {tEvent.whyAttendSection}
                  </label>
                  <label className="checkbox-label tldr-include-option">
                    <input
                      type="checkbox"
                      checked={form.eventPageIncludeWhatToExpect !== false}
                      onChange={(e) => setForm((prev) => ({ ...prev, eventPageIncludeWhatToExpect: e.target.checked }))}
                    />
                    {tEvent.whatToExpectSection}
                  </label>
                  <label className="checkbox-label tldr-include-option">
                    <input
                      type="checkbox"
                      checked={form.eventPageIncludeSpeakerSection !== false}
                      onChange={(e) => setForm((prev) => ({ ...prev, eventPageIncludeSpeakerSection: e.target.checked }))}
                    />
                    {tEvent.speakerSection}
                  </label>
                </div>
              </div>
              <label>
                {tEvent.labelWhyAttend}
                <textarea
                  value={form.meetupPageWhyAttend}
                  onChange={update('meetupPageWhyAttend')}
                  placeholder={tEvent.phWhyAttend}
                  rows={4}
                />
              </label>
              <label>
                {tEvent.labelWhatToExpect}
                <textarea
                  value={form.meetupPageWhatToExpect}
                  onChange={update('meetupPageWhatToExpect')}
                  placeholder={tEvent.phWhatToExpect}
                  rows={3}
                />
              </label>
              <label>
                {tEvent.labelAgenda}
                <textarea
                  value={form.meetupPageAgenda}
                  onChange={update('meetupPageAgenda')}
                  placeholder={tEvent.phAgenda}
                  rows={5}
                />
              </label>
              <label>
                {tEvent.labelClosing}
                <textarea
                  value={form.meetupPageClosing}
                  onChange={update('meetupPageClosing')}
                  placeholder={tEvent.phClosing}
                  rows={2}
                />
              </label>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>{tEvent.intuitionLegend}</legend>
              <label>{tEvent.audienceLabel} <input type="text" value={form.intuitionAudience} onChange={update('intuitionAudience')} placeholder={tEvent.phAudience} /></label>
              <label>{tEvent.intuitionWhyLabel} <input type="text" value={form.intuitionWhyAttend} onChange={update('intuitionWhyAttend')} placeholder={tEvent.phIntuitionWhy} /></label>
              <label>{tEvent.intuitionKeyLabel} <input type="text" value={form.intuitionKeyTakeaway} onChange={update('intuitionKeyTakeaway')} placeholder={tEvent.phIntuitionKey} /></label>
            </fieldset>
            <div className="form-language-row" role="group" aria-label={tEvent.languageLabel}>
              <label>
                {tEvent.languageLabel}
                <select
                  value={eventPageLanguage}
                  onChange={(e) => setEventPageLanguage(e.target.value)}
                >
                  {LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" className="btn-generate">
              {tEvent.btnGenerateMeetupCopy}
            </button>
            <button type="button" onClick={handleReset} className="btn-reset">
              🔄 {tEvent.btnResetForm}
            </button>
          </form>
          )}

          {generatorType === 'knowBeforeYouGo' && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleGenerate() }}
            className="form"
          >
            <div className="form-kbyg-toolbar" role="toolbar" aria-label="Form quick actions">
              <div
                className="form-language-row form-kbyg-toolbar-settings"
                role="group"
                aria-label={tKbyg.kbyg_generatorSettingsGroup}
              >
                <label className="checkbox-label kbyg-emoji-headers-toggle">
                  <input
                    type="checkbox"
                    checked={kbygForm.kbygEmojiHeaders !== false}
                    onChange={(e) =>
                      setKbygForm((prev) => ({ ...prev, kbygEmojiHeaders: e.target.checked }))
                    }
                    aria-label={tKbyg.kbyg_enableEmojis}
                  />
                  <span>{tKbyg.kbyg_enableEmojis}</span>
                </label>
                <label>
                  {tKbyg.languageLabel}
                  <select
                    value={meetupKbygLanguage}
                    onChange={(e) => setMeetupKbygLanguage(e.target.value)}
                  >
                    {LANGUAGE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="button" onClick={handleReset} className="btn-reset">
                🔄 {tKbyg.kbyg_btnReset}
              </button>
            </div>
            <fieldset className="form-fieldset">
              <legend>{tKbyg.kbyg_quickImport}</legend>
              <p className="form-hint">{tKbyg.kbyg_quickImportHint}</p>
              <label>
                {tKbyg.kbyg_quickImportPasteLabel}
                <textarea
                  value={kbygQuickImportPaste}
                  onChange={(e) => setKbygQuickImportPaste(e.target.value)}
                  placeholder={tKbyg.kbyg_quickImportPlaceholder}
                  rows={6}
                  autoComplete="off"
                />
              </label>
              <div className="quick-draft-stack">
                <button
                  type="button"
                  className="btn-quick-draft"
                  onClick={handleKbygQuickImportParse}
                >
                  {tKbyg.kbyg_parseEventDetails}
                </button>
              </div>
              {kbygQuickImportFeedback ? (
                <p className="form-hint" role="status" aria-live="polite">
                  {kbygQuickImportFeedback}
                </p>
              ) : null}
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>{tKbyg.kbyg_emailDetails}</legend>
              <label>{tKbyg.kbyg_recipients} <input type="text" value={kbygForm.recipients} onChange={updateKbyg('recipients')} placeholder={tKbyg.kbyg_ph_recipients} /></label>
              <label>{tKbyg.kbyg_greetingNames} <input type="text" value={kbygForm.greetingNames} onChange={updateKbyg('greetingNames')} placeholder={tKbyg.kbyg_ph_greeting} /></label>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>{tKbyg.kbyg_eventDetails}</legend>
              <label>{tKbyg.kbyg_eventTitle} <input type="text" value={kbygForm.eventTitle} onChange={updateKbyg('eventTitle')} placeholder={tKbyg.kbyg_ph_eventTitle} /></label>
              <label>{tKbyg.kbyg_eventDate} <input type="text" value={kbygForm.eventDate} onChange={updateKbyg('eventDate')} placeholder={tKbyg.kbyg_ph_eventDate} /></label>
              <label>{tKbyg.kbyg_eventTime} <input type="text" value={kbygForm.eventTime} onChange={updateKbyg('eventTime')} placeholder={tKbyg.kbyg_ph_eventTime} /></label>
              <label>{tKbyg.kbyg_arrivalTime} <input type="text" value={kbygForm.arrivalTime} onChange={updateKbyg('arrivalTime')} placeholder={tKbyg.kbyg_ph_arrivalTime} /></label>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>{tKbyg.kbyg_location}</legend>
              <label>{tKbyg.kbyg_venueName} <input type="text" value={kbygForm.venueName} onChange={updateKbyg('venueName')} placeholder={tKbyg.kbyg_ph_venueName} /></label>
              <label>{tKbyg.kbyg_venueAddress} <input type="text" value={kbygForm.venueAddress} onChange={updateKbyg('venueAddress')} placeholder={tKbyg.kbyg_ph_venueAddress} /></label>
              <label>
                {tKbyg.kbyg_parkingLabel} <span className="form-hint">({tKbyg.kbyg_optional})</span>
                <input type="text" value={kbygForm.parkingNotes} onChange={updateKbyg('parkingNotes')} />
              </label>
              <label>
                {tKbyg.kbyg_parkingBookingUrl}{' '}
                <span className="form-hint">({tKbyg.kbyg_optional})</span>
                <input
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  value={kbygForm.parkingBookingUrl}
                  onChange={updateKbyg('parkingBookingUrl')}
                  placeholder={tKbyg.kbyg_ph_parkingBookingUrl}
                />
              </label>
              <label>
                {tKbyg.kbyg_parkingBookingLabel}{' '}
                <span className="form-hint">({tKbyg.kbyg_optional})</span>
                <input
                  type="text"
                  value={kbygForm.parkingBookingLabel}
                  onChange={updateKbyg('parkingBookingLabel')}
                  placeholder={tKbyg.kbyg_ph_parkingBookingLabel}
                />
              </label>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>{tKbyg.kbyg_eventLinks}</legend>
              <label>{tKbyg.kbyg_meetupLink} <input type="text" value={kbygForm.meetupLink} onChange={updateKbyg('meetupLink')} placeholder="https://..." /></label>
              <label>{tKbyg.kbyg_lumaLink} <input type="text" value={kbygForm.lumaLink} onChange={updateKbyg('lumaLink')} placeholder="https://..." /></label>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>{tKbyg.kbyg_helpfulContacts}</legend>
              {(kbygForm.contacts || []).map((contact, index) => (
                <div key={index} className="contact-row">
                  <label>{tKbyg.kbyg_contactName} <input type="text" value={contact.name} onChange={updateKbygContact(index, 'name')} placeholder={tKbyg.kbyg_ph_contactName} /></label>
                  <label>{tKbyg.kbyg_contactRole} <input type="text" value={contact.role} onChange={updateKbygContact(index, 'role')} placeholder={tKbyg.kbyg_ph_contactRole} /></label>
                  <label>{tKbyg.kbyg_contactInfo} <input type="text" value={contact.contactInfo} onChange={updateKbygContact(index, 'contactInfo')} placeholder={tKbyg.kbyg_ph_contactInfo} /></label>
                </div>
              ))}
              <button type="button" onClick={addKbygContact} className="btn-add-speaker">{tKbyg.kbyg_addContact}</button>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>{tKbyg.kbyg_speakerArrivalLegend}</legend>
              <div className="kbyg-quick-fill-wrap">
                <span className="form-hint kbyg-quick-fill-hint">{tKbyg.kbyg_quickFill}</span>
                <div className="quick-fill-chips" role="group" aria-label={tKbyg.kbyg_speakerArrivalLegend}>
                  {getKbygSpeakerArrivalQuickFill(meetupKbygLanguage).map((text) => (
                    <button
                      key={text}
                      type="button"
                      className="kbyg-quick-fill-btn"
                      onClick={() => applyMeetupKbygQuickFill('speakerArrivalNote', text)}
                    >
                      {text}
                    </button>
                  ))}
                </div>
                <label>
                  {tKbyg.kbyg_speakerArrival} <span className="form-hint">({tKbyg.kbyg_optional})</span>
                  <input type="text" value={kbygForm.speakerArrivalNote} onChange={updateKbyg('speakerArrivalNote')} />
                </label>
              </div>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>{tKbyg.kbyg_logistics}</legend>
              <label>{tKbyg.kbyg_food} <input type="text" value={kbygForm.foodDetails} onChange={updateKbyg('foodDetails')} placeholder={tKbyg.kbyg_ph_food} /></label>
              <label>{tKbyg.kbyg_drink} <input type="text" value={kbygForm.drinkDetails} onChange={updateKbyg('drinkDetails')} placeholder={tKbyg.kbyg_ph_drink} /></label>
              <label>{tKbyg.kbyg_swag} <input type="text" value={kbygForm.swagNotes} onChange={updateKbyg('swagNotes')} placeholder={tKbyg.kbyg_ph_swag} /></label>
              <label>{tKbyg.kbyg_setup} <input type="text" value={kbygForm.setupNotes} onChange={updateKbyg('setupNotes')} placeholder={tKbyg.kbyg_ph_setup} /></label>
              <div className="kbyg-quick-fill-wrap">
                <span className="form-hint kbyg-quick-fill-hint">{tKbyg.kbyg_quickFill}</span>
                <div className="quick-fill-chips" role="group" aria-label={tKbyg.kbyg_av}>
                  {getKbygAvQuickFill(meetupKbygLanguage).map((text) => (
                    <button
                      key={text}
                      type="button"
                      className="kbyg-quick-fill-btn"
                      onClick={() => applyMeetupKbygQuickFill('avNotes', text)}
                    >
                      {text}
                    </button>
                  ))}
                </div>
                <label>
                  {tKbyg.kbyg_av}
                  <input type="text" value={kbygForm.avNotes} onChange={updateKbyg('avNotes')} placeholder={tKbyg.kbyg_ph_av} />
                </label>
              </div>
              <div
                className={`kbyg-photo-checklist-card${kbygForm.includePhotos !== false ? ' kbyg-photo-checklist-card--on' : ''}`}
                aria-labelledby="kbyg-photo-checklist-title"
              >
                <div className="kbyg-photo-checklist-card-header">
                  <div className="kbyg-photo-checklist-card-intro">
                    <h3 id="kbyg-photo-checklist-title" className="kbyg-photo-checklist-card-title">
                      {tKbyg.kbyg_photoTitle}
                    </h3>
                    <p className="kbyg-photo-checklist-card-desc">{tKbyg.kbyg_photoDesc}</p>
                  </div>
                  <label className="kbyg-photo-checklist-include checkbox-label">
                    <input
                      type="checkbox"
                      checked={kbygForm.includePhotos !== false}
                      onChange={updateKbygCheckbox('includePhotos')}
                      aria-describedby="kbyg-photo-checklist-title"
                    />
                    <span className="kbyg-photo-checklist-include-text">{tKbyg.kbyg_includeEmail}</span>
                  </label>
                </div>
                <ul className="kbyg-photo-checklist-preview" aria-label={tKbyg.kbyg_photoTitle}>
                  <li>{tKbyg.kbyg_photoLi1}</li>
                  <li>{tKbyg.kbyg_photoLi2}</li>
                  <li>{tKbyg.kbyg_photoLi3}</li>
                </ul>
              </div>
            </fieldset>
            {/* Tail flow: Photo checklist (above) → Internal agenda → TL;DR → Additional */}
            <fieldset className="form-fieldset">
              <legend>{tKbyg.kbyg_agenda}</legend>
              <div className="kbyg-internal-agenda-field">
                <label htmlFor="kbyg-internal-agenda">{tKbyg.kbyg_internalAgenda}</label>
                <p id="kbyg-internal-agenda-desc" className="form-hint kbyg-internal-agenda-hint">
                  {tKbyg.kbyg_internalAgendaHint}
                </p>
                <textarea
                  id="kbyg-internal-agenda"
                  className="kbyg-internal-agenda-textarea"
                  aria-describedby="kbyg-internal-agenda-desc"
                  value={kbygForm.internalAgenda}
                  onChange={updateKbyg('internalAgenda')}
                  placeholder={tKbyg.kbyg_ph_internalAgenda}
                  rows={14}
                />
              </div>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>{tKbyg.kbyg_tldr}</legend>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={kbygForm.generateTldr !== false}
                  onChange={updateKbygCheckbox('generateTldr')}
                />
                {tKbyg.kbyg_generateTldr}
              </label>
              {kbygForm.generateTldr !== false && (
                <div className="tldr-include-group" role="group" aria-label={tKbyg.kbyg_tldrCallouts}>
                  <span className="tldr-include-heading">{tKbyg.kbyg_tldrCallouts}</span>
                  <div className="tldr-include-checkboxes">
                    {KBYG_TLDR_ITEM_ORDER.map((id) => (
                      <label key={id} className="checkbox-label tldr-include-option">
                        <input
                          type="checkbox"
                          checked={!!kbygTldrIncludeMerged[id]}
                          onChange={updateKbygTldrInclude(id)}
                        />
                        {kbygTldrLabels[id]}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>{tKbyg.kbyg_additional}</legend>
              <label>{tKbyg.kbyg_additionalNotes} <textarea value={kbygForm.additionalNotes} onChange={updateKbyg('additionalNotes')} placeholder={tKbyg.kbyg_ph_additionalNotes} rows={3} /></label>
            </fieldset>
            <button type="submit" className="btn-generate">{tKbyg.kbyg_btnGenerate}</button>
            <button type="button" onClick={handleReset} className="btn-reset">🔄 {tKbyg.kbyg_btnReset}</button>
          </form>
          )}

          {generatorType === 'speakerOutreach' && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleGenerate() }}
            className="form"
          >
            <fieldset className="form-fieldset">
              <legend>Channel</legend>
              <div className="channel-selector" role="group" aria-label="Outreach channel">
                <label className={`channel-option ${outreachForm.channel === 'linkedin' ? 'channel-option-active' : ''}`}>
                  <input type="radio" name="outreachChannel" value="linkedin" checked={outreachForm.channel === 'linkedin'} onChange={() => { setOutreachForm((p) => ({ ...p, channel: 'linkedin' })); setGeneratedSubject(''); setGeneratedCopy(''); setKbygEmailHtml(''); setGeneratedOutreachLinkedIn(''); setLinkedInPost(''); }} />
                  <span>💬 LinkedIn Message</span>
                </label>
                <label className={`channel-option ${outreachForm.channel === 'email' ? 'channel-option-active' : ''}`}>
                  <input type="radio" name="outreachChannel" value="email" checked={outreachForm.channel === 'email'} onChange={() => { setOutreachForm((p) => ({ ...p, channel: 'email' })); setGeneratedSubject(''); setGeneratedCopy(''); setKbygEmailHtml(''); setGeneratedOutreachLinkedIn(''); setLinkedInPost(''); }} />
                  <span>📧 Email</span>
                </label>
              </div>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>Speaker</legend>
              <label>Speaker name <input type="text" value={outreachForm.speakerName} onChange={updateOutreach('speakerName')} placeholder="e.g. Jane Smith" /></label>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>Outreach Context</legend>
              <label>Personalization note (optional) <input type="text" value={outreachForm.personalizationNote} onChange={updateOutreach('personalizationNote')} placeholder="e.g. Saw your post about search relevance tuning" /></label>
              <label>Why I'm Reaching Out <textarea value={outreachForm.whyReachingOut} onChange={updateOutreach('whyReachingOut')} placeholder="e.g. I saw your blog post about vector search with Elasticsearch; I noticed you indicated interest in presenting when you joined the user group." rows={4} /></label>
              <label>Where I found them (optional) <input type="text" value={outreachForm.whereFoundThem} onChange={updateOutreach('whereFoundThem')} placeholder="e.g. LinkedIn, user group signup, conference talk, blog post" /></label>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>Meetup Details</legend>
              <label>Meetup chapter / city <input type="text" value={outreachForm.meetupChapterOrCity} onChange={updateOutreach('meetupChapterOrCity')} placeholder="e.g. Elastic Seattle User Group" /></label>
              <label>Event theme or topic area <input type="text" value={outreachForm.eventThemeOrTopic} onChange={updateOutreach('eventThemeOrTopic')} placeholder="e.g. search and observability" /></label>
              <label>Potential talk idea (optional) <input type="text" value={outreachForm.potentialTalkIdea} onChange={updateOutreach('potentialTalkIdea')} placeholder="e.g. a 20-min session on your recent work" /></label>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>Ask</legend>
              <label>What I'm asking <textarea value={outreachForm.whatAsking} onChange={updateOutreach('whatAsking')} placeholder="e.g. Would you be open to giving a 20 minute talk followed by Q&A at an upcoming meetup?" rows={2} /></label>
              <label>Flexibility note (optional) <input type="text" value={outreachForm.flexibilityNote} onChange={updateOutreach('flexibilityNote')} placeholder="e.g. Happy to work around your schedule and topic if something sounds interesting." /></label>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>Sender</legend>
              <label>Sender name <input type="text" value={outreachForm.senderName} onChange={updateOutreach('senderName')} placeholder="e.g. Your Name" /></label>
            </fieldset>
            <button type="submit" className="btn-generate">Generate</button>
            <button type="button" onClick={handleReset} className="btn-reset">🔄 Reset Form</button>
          </form>
          )}

          {generatorType === 'urlQrGenerator' && (
            <form
              onSubmit={(e) => { e.preventDefault(); handleGenerate() }}
              className="form"
            >
              <fieldset className="form-fieldset">
                <legend>Destination</legend>
                <label>
                  Base URL *
                  <input
                    type="text"
                    value={urlQrForm.baseUrl}
                    onChange={updateUrlQr('baseUrl')}
                    placeholder="e.g. https://example.com/event"
                    required
                  />
                </label>
              </fieldset>
              <fieldset className="form-fieldset">
                <legend>UTM Parameters</legend>
                <label>
                  UTM Source
                  <SearchableSelect
                    value={urlQrForm.utmSource}
                    onChange={(v) => setUrlQrForm(prev => ({ ...prev, utmSource: v }))}
                    options={UTM_SOURCE_OPTIONS}
                    placeholder="Type to search or enter custom…"
                  />
                </label>
                <label>
                  UTM Medium
                  <SearchableSelect
                    value={urlQrForm.utmMedium}
                    onChange={(v) => setUrlQrForm(prev => ({ ...prev, utmMedium: v }))}
                    options={UTM_MEDIUM_OPTIONS}
                    placeholder="Type to search or enter custom…"
                  />
                </label>
                <label>
                  UTM Campaign
                  <SearchableSelect
                    value={urlQrForm.utmCampaign}
                    onChange={(v) => setUrlQrForm(prev => ({ ...prev, utmCampaign: v }))}
                    options={UTM_CAMPAIGN_OPTIONS}
                    placeholder="Type to search or enter custom…"
                  />
                </label>
                <label>
                  UTM Content
                  <input type="text" value={urlQrForm.utmContent} onChange={updateUrlQr('utmContent')} placeholder="e.g. email" />
                </label>
                <label>
                  UTM Term
                  <input type="text" value={urlQrForm.utmTerm} onChange={updateUrlQr('utmTerm')} placeholder="e.g. elastic" />
                </label>
              </fieldset>
              <button type="submit" className="btn-generate">Generate URL</button>
              <button type="button" onClick={handleReset} className="btn-reset">🔄 Reset Form</button>
            </form>
          )}

          {generatorType === 'qrCodeGenerator' && (
            <form
              onSubmit={(e) => { e.preventDefault(); handleGenerate() }}
              className="form"
            >
              <fieldset className="form-fieldset">
                <legend>Link</legend>
                <label>
                  Link to encode *
                  <input
                    type="text"
                    value={qrForm.qrLink}
                    onChange={updateQr('qrLink')}
                    placeholder="e.g. https://example.com/event"
                    required
                  />
                </label>
              </fieldset>
              <fieldset className="form-fieldset">
                <legend>Appearance</legend>
                <div className="qr-color-row">
                  <label>
                    QR Code Colour
                    <div className="qr-color-input-group">
                      <input type="color" value={qrForm.qrColor} onChange={updateQr('qrColor')} className="qr-color-swatch" />
                      <input type="text" value={qrForm.qrColor} onChange={updateQr('qrColor')} placeholder="#000000" maxLength="7" className="qr-color-hex" />
                    </div>
                  </label>
                  <label className={qrForm.qrTransparent ? 'qr-color-label-disabled' : ''}>
                    Background Colour
                    <div className="qr-color-input-group">
                      <input type="color" value={qrForm.qrTransparent ? '#ffffff' : qrForm.qrBgColor} onChange={updateQr('qrBgColor')} className="qr-color-swatch" disabled={qrForm.qrTransparent} />
                      <input type="text" value={qrForm.qrTransparent ? 'transparent' : qrForm.qrBgColor} onChange={updateQr('qrBgColor')} placeholder="#FFFFFF" maxLength="7" className="qr-color-hex" disabled={qrForm.qrTransparent} />
                    </div>
                  </label>
                </div>
                <label className="qr-transparent-label">
                  <input type="checkbox" checked={qrForm.qrTransparent} onChange={updateQr('qrTransparent')} className="qr-transparent-checkbox" />
                  Transparent background
                </label>
                <div className="qr-shape-row">
                  <div className="qr-shape-group">
                    <span className="qr-shape-label">Dot shape</span>
                    <div className="qr-shape-picker">
                      {DOT_STYLES.map(s => (
                        <button
                          key={s.value}
                          type="button"
                          title={s.label}
                          className={`qr-shape-btn${qrForm.qrDotStyle === s.value ? ' qr-shape-btn-active' : ''}`}
                          onClick={() => setQrForm(prev => ({ ...prev, qrDotStyle: s.value }))}
                        >
                          <span className="qr-shape-icon">{s.icon}</span>
                          <span className="qr-shape-name">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="qr-shape-group">
                    <span className="qr-shape-label">Eye shape</span>
                    <div className="qr-shape-picker">
                      {EYE_STYLES.map(s => (
                        <button
                          key={s.value}
                          type="button"
                          title={s.label}
                          className={`qr-shape-btn${qrForm.qrEyeStyle === s.value ? ' qr-shape-btn-active' : ''}`}
                          onClick={() => setQrForm(prev => ({ ...prev, qrEyeStyle: s.value }))}
                        >
                          <span className="qr-shape-icon">{s.icon}</span>
                          <span className="qr-shape-name">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </fieldset>
              <button type="submit" className="btn-generate">Generate QR Code</button>
              <button type="button" onClick={handleReset} className="btn-reset">🔄 Reset Form</button>
            </form>
          )}
        </aside>

        <main className="output-panel">
          <div className="output-header">
            <h2>
              {generatorType === 'knowBeforeYouGo' ? 'Generated email'
                : generatorType === 'speakerOutreach' ? 'Speaker Outreach'
                : generatorType === 'urlQrGenerator' ? 'Generated URL'
                : generatorType === 'qrCodeGenerator' ? 'QR Code'
                : 'Generated copy'}
            </h2>
          </div>
          <div className="output-content">
            {generatedCopy || (generatorType === 'qrCodeGenerator' && generatedQr) || (generatorType === 'speakerOutreach' && (generatedSubject || generatedOutreachLinkedIn)) ? (
              <>
                {generatorType === 'speakerOutreach' && (
                  <div className="outreach-output-wrapper">
                    <div className="section-heading-row outreach-actions-row">
                      <h3 className="subject-line-heading">Outreach output</h3>
                      <div className="output-actions">
                        {outreachForm.channel === 'linkedin' ? (
                          <button type="button" onClick={handleRegenOutreachLinkedIn} className="btn-regenerate" title="Regenerate this section">🔄 Regenerate</button>
                        ) : (
                          <button type="button" onClick={handleRegenOutreachEmail} className="btn-regenerate" title="Regenerate this section">🔄 Regenerate</button>
                        )}
                      </div>
                    </div>
                    {outreachForm.channel === 'linkedin' && generatedOutreachLinkedIn && (
                      <div className="subject-line-section outreach-output-card">
                        <h3 className="subject-line-heading">💬 LinkedIn Message</h3>
                        <pre className="output-text subject-line-text">{generatedOutreachLinkedIn}</pre>
                        <p className="outreach-char-count">{generatedOutreachLinkedIn.length} characters</p>
                        <div className="output-actions output-actions-inline">
                          <button type="button" onClick={handleOutreachLinkedInConcise} className="btn-section-action">
                            Make concise
                          </button>
                          <button type="button" onClick={handleCopyOutreachLinkedIn} className="btn-copy" aria-pressed={outreachLinkedInCopied}>
                            {outreachLinkedInCopied ? 'Copied!' : 'Copy LinkedIn Message'}
                          </button>
                        </div>
                      </div>
                    )}
                    {outreachForm.channel === 'email' && (generatedSubject || generatedCopy) && (
                      <>
                        {generatedSubject && (
                          <div className="subject-line-section outreach-output-card">
                            <h3 className="subject-line-heading">Subject</h3>
                            <pre className="output-text subject-line-text">{generatedSubject}</pre>
                            <div className="output-actions output-actions-inline">
                              <button type="button" onClick={handleOutreachSubjectConcise} className="btn-section-action">
                                Make concise
                              </button>
                              <button type="button" onClick={handleCopySubject} className="btn-copy" aria-pressed={subjectCopied}>
                                {subjectCopied ? 'Copied!' : 'Copy Subject'}
                              </button>
                            </div>
                          </div>
                        )}
                        {generatedCopy && (
                          <div className="subject-line-section outreach-output-card">
                            <h3 className="subject-line-heading">📧 Email Body</h3>
                            <pre className="output-text subject-line-text">{generatedCopy}</pre>
                            <div className="output-actions output-actions-inline">
                              <button type="button" onClick={handleOutreachBodyConcise} className="btn-section-action">
                                Make concise
                              </button>
                              <button type="button" onClick={handleCopy} className="btn-copy" aria-pressed={copied}>
                                {copied ? 'Copied!' : 'Copy Email'}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                {generatorType === 'knowBeforeYouGo' && (
                  <>
                    {generatedSubject && (
                      <div className="subject-line-section">
                        <h3 className="subject-line-heading">Subject Line</h3>
                        <pre className="output-text subject-line-text">{generatedSubject}</pre>
                        <div className="output-actions output-actions-inline">
                          <button
                            type="button"
                            className="btn-section-action"
                            onClick={() => setGeneratedSubject(makeMoreConcise(generatedSubject))}
                          >
                            Make concise
                          </button>
                          <button type="button" onClick={handleCopySubject} className="btn-copy" aria-pressed={subjectCopied}>
                            {subjectCopied ? 'Copied!' : 'Copy Subject'}
                          </button>
                        </div>
                      </div>
                    )}
                    <h3 className="generated-email-heading">Generated Email</h3>
                    {generatedCopy ? (
                      <div className="translate-output-bar" role="group" aria-label="Translate output via API">
                        <span className="form-hint translate-output-label">Translate output</span>
                        <button type="button" className="btn-section-action" onClick={() => handleTranslateOutput('es')}>
                          → Spanish
                        </button>
                        <button type="button" className="btn-section-action" onClick={() => handleTranslateOutput('pt')}>
                          → Portuguese (BR)
                        </button>
                      </div>
                    ) : null}
                    {translateMessage ? <p className="form-hint translate-api-hint">{translateMessage}</p> : null}
                    {kbygSections.length > 0 && (
                      <div className="kbyg-per-section-tools">
                        <span className="form-hint kbyg-per-section-hint">Sections</span>
                        <ul className="kbyg-section-tools-list" aria-label="Email sections">
                          {kbygSections.map((sec) => (
                            <li key={sec.key} className="kbyg-section-tools-item">
                              <span className="kbyg-section-tools-label">{sec.label}</span>
                              <button
                                type="button"
                                className="btn-section-action"
                                onClick={() => copyKbygSection(sec.key, sec.body)}
                              >
                                {kbygSectionCopiedId === sec.key ? 'Copied!' : 'Copy'}
                              </button>
                              <button
                                type="button"
                                className="btn-section-action"
                                onClick={() => handleKbygSectionConcise(sec.key)}
                              >
                                Concise
                              </button>
                              {sec.label === 'TL;DR' && (
                                <button
                                  type="button"
                                  className="btn-regenerate btn-regenerate-compact"
                                  onClick={handleRegenKbygTldr}
                                  title="Regenerate TL;DR order"
                                >
                                  🔄
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                        <button type="button" className="btn-section-action btn-section-action-wide" onClick={handleKbygFullConcise}>
                          Make entire email more concise
                        </button>
                        {!kbygEmailHtml && generatedCopy ? (
                          <p className="form-hint kbyg-plain-hint">Rich HTML preview is off after concise edits. Copy plain text below or Generate again to restore HTML.</p>
                        ) : null}
                      </div>
                    )}
                    {kbygEmailHtml ? (
                      <div
                        className="meetup-page-preview kbyg-email-html-preview"
                        dangerouslySetInnerHTML={{ __html: kbygEmailHtml }}
                      />
                    ) : (
                      <pre className="output-text">{generatedCopy}</pre>
                    )}
                    <div className="output-actions output-actions-inline kbyg-copy-actions">
                      <button type="button" onClick={handleCopyKbygEmailHtml} className="btn-copy" disabled={!kbygEmailHtml}>
                        {kbygEmailHtmlCopied ? 'Copied!' : 'Copy for Email (HTML)'}
                      </button>
                      <button type="button" onClick={handleCopy} className="btn-copy" aria-pressed={copied}>
                        {copied ? 'Copied!' : 'Copy plain text (Slack / Docs)'}
                      </button>
                    </div>
                  </>
                )}
                {generatorType === 'eventPromotion' && (
                  <>
                    <h3 className="generated-email-heading">Meetup Event Page Copy</h3>
                    {generatedCopy ? (
                      <div className="translate-output-bar" role="group" aria-label="Translate output via API">
                        <span className="form-hint translate-output-label">Translate output</span>
                        <button type="button" className="btn-section-action" onClick={() => handleTranslateOutput('es')}>
                          → Spanish
                        </button>
                        <button type="button" className="btn-section-action" onClick={() => handleTranslateOutput('pt')}>
                          → Portuguese (BR)
                        </button>
                      </div>
                    ) : null}
                    <p className="form-hint" style={{ marginTop: 0 }}>Preview below. Output is plain text with section headers and “-” bullets—paste into Meetup, Luma, or any editor.</p>
                    {eventPageGeneratedContent ? (
                      <p className="form-hint">Preview merges API fields (arrival, parking, agenda when returned) with your form so translated logistics are not replaced by English defaults.</p>
                    ) : null}
                    {meetupPageHtml ? (
                      <div className="meetup-page-preview output-text" dangerouslySetInnerHTML={{ __html: meetupPageHtml }} />
                    ) : (
                      <pre className="output-text">{generatedCopy}</pre>
                    )}
                    <div className="output-actions output-actions-inline event-page-output-actions">
                      <button type="button" onClick={handleMeetupPageConcise} className="btn-section-action">
                        Make concise
                      </button>
                      <div className="event-regenerate-action">
                        <button
                          type="button"
                          onClick={handleRegenerateEventPageFromDetails}
                          className="btn-regenerate"
                          title="Rebuild preview from your current form fields"
                        >
                          🔄 Regenerate from current details
                        </button>
                        <p className="form-hint event-page-regenerate-hint">
                          Rebuilds the draft using your latest edits without clearing your inputs
                        </p>
                      </div>
                      <button type="button" onClick={handleCopy} className="btn-copy" aria-pressed={copied}>
                        {copied ? 'Copied!' : 'Copy for Meetup (HTML + plain text)'}
                      </button>
                    </div>
                    {!meetupPageHtml && generatedCopy ? (
                      <p className="form-hint kbyg-plain-hint">HTML preview is off after concise edits. Copy plain text or Generate again to restore HTML.</p>
                    ) : null}
                    <div className="linkedin-section">
                      <h3 className="linkedin-heading">📣 LinkedIn Promo Post</h3>
                      <pre className="linkedin-text">{linkedInPost || buildLinkedInPost(form)}</pre>
                      <div className="output-actions output-actions-inline">
                        <button type="button" onClick={handleLinkedInConcise} className="btn-section-action">
                          Make concise
                        </button>
                        <button type="button" onClick={handleRegenLinkedIn} className="btn-regenerate" title="Regenerate this section">
                          🔄 Regenerate
                        </button>
                        <button type="button" onClick={handleCopyLinkedIn} className="btn-copy btn-copy-linkedin" aria-pressed={linkedInCopied}>
                          {linkedInCopied ? 'Copied!' : 'Copy LinkedIn Post'}
                        </button>
                      </div>
                    </div>
                    <div className="linkedin-section intuition-email-section" key={`intuition-body-${emailBodyVariant}`}>
                      <div className="section-heading-row">
                        <h3 className="linkedin-heading">Intuition Email Copy</h3>
                        <button type="button" onClick={handleRegenIntuition} className="btn-regenerate" title="Regenerate email body only">🔄 Regenerate Body</button>
                      </div>
                      <div className="subject-line-section">
                        <h4 className="intuition-subheading">Subject Line</h4>
                        <p className="intuition-subject-hint">Choose one (3–5 options, ~70 characters or less).</p>
                        <ul className="intuition-subject-list">
                          {buildIntuitionEmailSubjects(form, 0).map((subject, i) => (
                            <li key={i} className="intuition-subject-item">
                              <span className="intuition-subject-text">{subject}</span>
                              <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(subject); setIntuitionSubjectCopiedIndex(i); setTimeout(() => setIntuitionSubjectCopiedIndex(null), 2000) } catch (e) { console.error(e) } }} className="btn-copy btn-copy-sm" aria-pressed={intuitionSubjectCopiedIndex === i}>
                                {intuitionSubjectCopiedIndex === i ? 'Copied!' : 'Copy'}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="subject-line-section">
                        <h4 className="intuition-subheading">Preview Text</h4>
                        <pre className="output-text subject-line-text">{buildIntuitionPreviewText(form, 0)}</pre>
                        <div className="output-actions output-actions-inline">
                          <button
                            type="button"
                            className="btn-section-action"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(makeMoreConcise(buildIntuitionPreviewText(form, 0)))
                                setIntuitionPreviewCopied(true)
                                setTimeout(() => setIntuitionPreviewCopied(false), 2000)
                              } catch (e) {
                                console.error(e)
                              }
                            }}
                          >
                            Copy concise
                          </button>
                          <button type="button" onClick={copyIntuition(() => buildIntuitionPreviewText(form, 0), setIntuitionPreviewCopied)} className="btn-copy" aria-pressed={intuitionPreviewCopied}>
                            {intuitionPreviewCopied ? 'Copied!' : 'Copy Preview Text'}
                          </button>
                        </div>
                      </div>
                      <div className="subject-line-section">
                        <h4 className="intuition-subheading">Why Attend</h4>
                        <ul className="intuition-why-attend-list">
                          {buildIntuitionWhyAttend(form, emailBodyVariant).map((bullet, i) => (
                            <li key={i}>{bullet}</li>
                          ))}
                        </ul>
                        <div className="output-actions output-actions-inline">
                          <button
                            type="button"
                            className="btn-section-action"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  makeMoreConcise(
                                    buildIntuitionWhyAttendText(buildIntuitionWhyAttend(form, emailBodyVariant)),
                                  ),
                                )
                                setIntuitionWhyAttendCopied(true)
                                setTimeout(() => setIntuitionWhyAttendCopied(false), 2000)
                              } catch (e) {
                                console.error(e)
                              }
                            }}
                          >
                            Copy concise
                          </button>
                          <button
                            type="button"
                            onClick={copyIntuition(
                              () => buildIntuitionWhyAttendText(buildIntuitionWhyAttend(form, emailBodyVariant)),
                              setIntuitionWhyAttendCopied,
                              () => `<div style="font-family:system-ui,-apple-system,sans-serif;"><ul>${buildIntuitionWhyAttend(form, emailBodyVariant).map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul></div>`,
                            )}
                            className="btn-copy"
                            aria-pressed={intuitionWhyAttendCopied}
                          >
                            {intuitionWhyAttendCopied ? 'Copied!' : 'Copy Why Attend'}
                          </button>
                        </div>
                      </div>
                      <div className="subject-line-section">
                        <h4 className="intuition-subheading">Email</h4>
                        <div className="meetup-page-preview output-text subject-line-text" dangerouslySetInnerHTML={{ __html: emailTextToHtml(buildIntuitionEmailBody(form, emailBodyVariant)) }} />
                        <div className="output-actions output-actions-inline">
                          <button
                            type="button"
                            className="btn-section-action"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(makeMoreConcise(buildIntuitionEmailBody(form, emailBodyVariant)))
                                setIntuitionBodyCopied(true)
                                setTimeout(() => setIntuitionBodyCopied(false), 2000)
                              } catch (e) {
                                console.error(e)
                              }
                            }}
                          >
                            Copy concise
                          </button>
                          <button
                            type="button"
                            onClick={copyIntuition(
                              () => buildIntuitionEmailBody(form, emailBodyVariant),
                              setIntuitionBodyCopied,
                              () => emailTextToHtml(buildIntuitionEmailBody(form, emailBodyVariant)),
                            )}
                            className="btn-copy"
                            aria-pressed={intuitionBodyCopied}
                          >
                            {intuitionBodyCopied ? 'Copied!' : 'Copy Email'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {generatorType === 'urlQrGenerator' && generatedCopy && (
                  <div className="url-output-section">
                    <pre className="output-text url-output-text">{generatedCopy}</pre>
                    <div className="output-actions url-output-actions">
                      <button type="button" onClick={handleCopy} className="btn-copy" aria-pressed={copied}>
                        {copied ? 'Copied!' : 'Copy URL'}
                      </button>
                      <button type="button" onClick={handleCreateQrFromUrl} className="btn-action">
                        ◉ Create QR Code
                      </button>
                      <button type="button" onClick={handleShortenLink} className="btn-action">
                        {shortenCopied ? '✓ Copied & Opening…' : '✂️ Shorten Link'}
                      </button>
                    </div>
                  </div>
                )}
                {generatorType === 'qrCodeGenerator' && generatedQr && (
                  <div className="qr-standalone-output">
                    <div
                      className="qr-preview-container"
                      style={{ background: qrForm.qrTransparent ? 'repeating-conic-gradient(#e0e0e0 0% 25%, #fff 0% 50%) 0 0 / 16px 16px' : qrForm.qrBgColor }}
                    >
                      <div ref={qrContainerRef} className="qr-canvas-wrapper" />
                    </div>
                    <p className="qr-encoded-url">{qrForm.qrLink}</p>
                    <div className="output-actions">
                      <button
                        type="button"
                        className="btn-copy"
                        aria-pressed={qrCopied}
                        onClick={async () => {
                          if (!qrOptionsRef.current) return
                          try {
                            const hiRes = new QRCodeStyling({ ...qrOptionsRef.current, width: 1024, height: 1024 })
                            const blob = await hiRes.getRawData('png')
                            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                            setQrCopied(true)
                            setTimeout(() => setQrCopied(false), 2000)
                          } catch (err) {
                            console.error('Copy failed', err)
                          }
                        }}
                      >
                        {qrCopied ? 'Copied!' : 'Copy Image'}
                      </button>
                      <button
                        type="button"
                        className="btn-copy"
                        onClick={async () => {
                          if (!qrOptionsRef.current) return
                          try {
                            const hiRes = new QRCodeStyling({ ...qrOptionsRef.current, width: 1024, height: 1024 })
                            await hiRes.download({ name: 'elastic-qr-code', extension: 'png' })
                          } catch (err) {
                            console.error('Download failed', err)
                          }
                        }}
                      >
                        Download PNG
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="output-placeholder">
                {generatorType === 'knowBeforeYouGo'
                  ? 'Fill in the form and click "Generate Email" to create the Know Before You Go logistics email.'
                  : generatorType === 'speakerOutreach'
                    ? 'Fill in the form and click "Generate" to create the subject line, outreach email, and LinkedIn message.'
                    : generatorType === 'urlQrGenerator'
                      ? 'Fill in the URL and UTM parameters, then click "Generate URL" to create your tracking link.'
                      : generatorType === 'qrCodeGenerator'
                        ? 'Enter a link and choose colours, then click "Generate QR Code" to create your branded QR code.'
                        : 'Fill in the form and click "Generate Meetup Copy" to see the event description here. Use the buttons below to add optional Speaker 2 or Speaker 3.'}
              </p>
            )}
          </div>
        </main>
        </>
        )}
      </div>
      </div>
      </div>
    </div>
  )
}
