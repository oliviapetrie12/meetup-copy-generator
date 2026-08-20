/**
 * Meetup Follow-Up generator — UTM helpers, validation, and email generation.
 */

import { escapeHtml, escapeHtmlAttr } from './htmlEscape.js'

export const MEETUP_FOLLOWUP_STORAGE_KEY = 'meetup-followup-form-v1'

/** Device-local only: remembered advocate name across form resets and sessions. */
export const ADVOCATE_NAME_STORAGE_KEY = 'elastic-devrel-advocate-name'

export const FOLLOWUP_DESTINATIONS = {
  training: 'https://www.elastic.co/training',
  newsletter: 'https://www.elastic.co/community/newsletter',
  slack: 'https://ela.st/slack',
  discuss: 'https://discuss.elastic.co/',
  sessionize: 'https://sessionize.com/elastic-meetups/',
  meetupsGithub: 'https://github.com/elastic/meetups',
}

export const UTM_CAMPAIGN = 'meetup-followup-cm'

/** @returns {{ id: string, talkTitle: string, speakerName: string, slidesUrl: string }} */
export function createEmptyTalk() {
  return {
    id: `talk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    talkTitle: '',
    speakerName: '',
    slidesUrl: '',
  }
}

/**
 * Read the remembered advocate name from this browser only.
 * @returns {string}
 */
export function loadSavedAdvocateName() {
  try {
    if (typeof localStorage === 'undefined') return ''
    const raw = localStorage.getItem(ADVOCATE_NAME_STORAGE_KEY)
    return typeof raw === 'string' ? raw : ''
  } catch {
    return ''
  }
}

/**
 * Persist advocate name for this device. Empty/whitespace clears the saved value.
 * @param {string} name
 */
export function saveSavedAdvocateName(name) {
  try {
    if (typeof localStorage === 'undefined') return
    const trimmed = String(name || '').trim()
    if (!trimmed) {
      localStorage.removeItem(ADVOCATE_NAME_STORAGE_KEY)
      return
    }
    localStorage.setItem(ADVOCATE_NAME_STORAGE_KEY, trimmed)
  } catch {
    // ignore quota / private mode / blocked storage
  }
}

export function getInitialMeetupFollowUpForm() {
  return {
    meetupCity: '',
    meetupName: '',
    registrationPlatform: 'luma',
    advocateName: loadSavedAdvocateName(),
    talks: [createEmptyTalk(), createEmptyTalk()],
    nextMeetupName: '',
    nextMeetupUrl: '',
    nextMeetupDate: '',
  }
}

/**
 * Cleared event fields after Reset — keeps the saved advocate name populated.
 * @returns {ReturnType<typeof getInitialMeetupFollowUpForm>}
 */
export function getResetMeetupFollowUpForm() {
  return {
    meetupCity: '',
    meetupName: '',
    registrationPlatform: 'luma',
    advocateName: loadSavedAdvocateName(),
    talks: [createEmptyTalk(), createEmptyTalk()],
    nextMeetupName: '',
    nextMeetupUrl: '',
    nextMeetupDate: '',
  }
}

/**
 * True when form has no event content (advocate name alone does not count).
 * @param {ReturnType<typeof getInitialMeetupFollowUpForm>} form
 */
export function isMeetupFollowUpFormEmpty(form) {
  if (!form) return true
  if (String(form.meetupCity || '').trim()) return false
  if (String(form.meetupName || '').trim()) return false
  if (form.registrationPlatform !== 'luma') return false
  if (String(form.nextMeetupName || '').trim()) return false
  if (String(form.nextMeetupUrl || '').trim()) return false
  if (String(form.nextMeetupDate || '').trim()) return false
  const talks = Array.isArray(form.talks) ? form.talks : []
  if (talks.length !== 2) return false
  return talks.every(
    (t) =>
      !String(t.talkTitle || '').trim() &&
      !String(t.speakerName || '').trim() &&
      !String(t.slidesUrl || '').trim(),
  )
}

export function loadMeetupFollowUpForm() {
  const savedAdvocate = loadSavedAdvocateName()
  if (typeof localStorage === 'undefined') {
    return { ...getInitialMeetupFollowUpForm(), advocateName: savedAdvocate }
  }
  try {
    const raw = localStorage.getItem(MEETUP_FOLLOWUP_STORAGE_KEY)
    if (!raw) {
      return { ...getInitialMeetupFollowUpForm(), advocateName: savedAdvocate }
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...getInitialMeetupFollowUpForm(), advocateName: savedAdvocate }
    }
    const base = getInitialMeetupFollowUpForm()
    const talks = Array.isArray(parsed.talks)
      ? parsed.talks.map((t) => ({
          id: typeof t?.id === 'string' ? t.id : createEmptyTalk().id,
          talkTitle: typeof t?.talkTitle === 'string' ? t.talkTitle : '',
          speakerName: typeof t?.speakerName === 'string' ? t.speakerName : '',
          slidesUrl: typeof t?.slidesUrl === 'string' ? t.slidesUrl : '',
        }))
      : base.talks
    const fromDraft = typeof parsed.advocateName === 'string' ? parsed.advocateName.trim() : ''
    return {
      ...base,
      meetupCity: typeof parsed.meetupCity === 'string' ? parsed.meetupCity : '',
      meetupName: typeof parsed.meetupName === 'string' ? parsed.meetupName : '',
      registrationPlatform:
        parsed.registrationPlatform === 'meetup' || parsed.registrationPlatform === 'luma'
          ? parsed.registrationPlatform
          : 'luma',
      advocateName: fromDraft || savedAdvocate,
      talks: talks.length >= 1 ? talks : base.talks,
      nextMeetupName: typeof parsed.nextMeetupName === 'string' ? parsed.nextMeetupName : '',
      nextMeetupUrl: typeof parsed.nextMeetupUrl === 'string' ? parsed.nextMeetupUrl : '',
      nextMeetupDate: typeof parsed.nextMeetupDate === 'string' ? parsed.nextMeetupDate : '',
    }
  } catch {
    return { ...getInitialMeetupFollowUpForm(), advocateName: savedAdvocate }
  }
}

export function saveMeetupFollowUpForm(form) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MEETUP_FOLLOWUP_STORAGE_KEY, JSON.stringify(form))
    }
  } catch {
    // ignore quota / private mode
  }
  if (form && Object.prototype.hasOwnProperty.call(form, 'advocateName')) {
    saveSavedAdvocateName(form.advocateName)
  }
}

/**
 * Normalize city for utm_medium: lowercase, trim, spaces → hyphens, strip punctuation.
 * @param {string} city
 */
export function normalizeCityForUtm(city) {
  return String(city || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Append or merge UTM query params onto a URL safely.
 * @param {string} baseUrl
 * @param {Record<string, string>} utm
 */
export function appendUtmParams(baseUrl, utm) {
  const raw = String(baseUrl || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    for (const [k, v] of Object.entries(utm || {})) {
      if (v != null && String(v).trim() !== '') u.searchParams.set(k, String(v).trim())
    }
    return u.toString()
  } catch {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(utm || {})) {
      if (v != null && String(v).trim() !== '') params.set(k, String(v).trim())
    }
    const qs = params.toString()
    if (!qs) return raw
    return raw.includes('?') ? `${raw}&${qs}` : `${raw}?${qs}`
  }
}

/**
 * @param {{ meetupCity: string, registrationPlatform: string }} form
 */
export function buildFollowUpUtm(form) {
  const source = form.registrationPlatform === 'meetup' ? 'meetup' : 'luma'
  const medium = normalizeCityForUtm(form.meetupCity) || 'meetup'
  return {
    utm_campaign: UTM_CAMPAIGN,
    utm_source: source,
    utm_medium: medium,
  }
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isValidHttpUrl(value) {
  const s = String(value || '').trim()
  if (!s) return false
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * True for elastic.co and subdomains (www.elastic.co, etc.).
 * @param {string} url
 */
export function isElasticCoHost(url) {
  try {
    const host = new URL(String(url || '').trim()).hostname.toLowerCase()
    return host === 'elastic.co' || host.endsWith('.elastic.co')
  } catch {
    return false
  }
}

/**
 * Format next-meetup date as “September 24, 2026”.
 * Prefers YYYY-MM-DD from <input type="date"> (UTC calendar day).
 * @param {string} value
 * @returns {string}
 */
export function formatNextMeetupDate(value) {
  const s = String(value || '').trim()
  if (!s) return ''
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (iso) {
    const year = Number(iso[1])
    const month = Number(iso[2])
    const day = Number(iso[3])
    const d = new Date(Date.UTC(year, month - 1, day))
    if (
      d.getUTCFullYear() !== year ||
      d.getUTCMonth() !== month - 1 ||
      d.getUTCDate() !== day
    ) {
      return s
    }
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(d)
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

/**
 * Inspect optional Next Meetup fields.
 * @param {ReturnType<typeof getInitialMeetupFollowUpForm>} form
 */
export function getNextMeetupState(form) {
  const name = String(form?.nextMeetupName || '').trim()
  const url = String(form?.nextMeetupUrl || '').trim()
  const date = String(form?.nextMeetupDate || '').trim()
  const hasName = Boolean(name)
  const hasUrl = Boolean(url)
  const urlValid = hasUrl && isValidHttpUrl(url)
  const incompletePair = (hasName && !hasUrl) || (!hasName && hasUrl)
  const complete = hasName && urlValid
  return {
    name,
    url,
    date,
    hasName,
    hasUrl,
    urlValid,
    incompletePair,
    complete,
    pairMessage: incompletePair
      ? 'Both event name and event page URL are required to include the next meetup.'
      : '',
  }
}

/**
 * Append follow-up UTMs only for elastic.co hosts; leave other URLs unchanged.
 * Existing query params are preserved (URLSearchParams.set merges UTMs).
 * @param {string} url
 * @param {Record<string, string>} utm
 */
export function resolveNextMeetupEventUrl(url, utm) {
  const raw = String(url || '').trim()
  if (!isValidHttpUrl(raw)) return raw
  if (!isElasticCoHost(raw)) return raw
  return appendUtmParams(raw, utm)
}

/**
 * Build plain + HTML next-meetup paragraph pieces when complete.
 * @param {ReturnType<typeof getInitialMeetupFollowUpForm>} form
 * @param {Record<string, string>} utm
 * @returns {{ plain: string, html: string } | null}
 */
export function buildNextMeetupParagraph(form, utm) {
  const state = getNextMeetupState(form)
  if (!state.complete) return null
  const href = resolveNextMeetupEventUrl(state.url, utm)
  const formattedDate = formatNextMeetupDate(state.date)
  const plain = formattedDate
    ? `Join us at our next meetup on ${formattedDate}: ${state.name} (${href}).`
    : `Join us at our next meetup: ${state.name} (${href}).`
  const linked = `<a href="${escapeHtmlAttr(href)}">${escapeHtml(state.name)}</a>`
  const html = formattedDate
    ? `<p>Join us at our next meetup on ${escapeHtml(formattedDate)}: ${linked}.</p>`
    : `<p>Join us at our next meetup: ${linked}.</p>`
  return { plain, html }
}

/**
 * @param {ReturnType<typeof getInitialMeetupFollowUpForm>} form
 * @returns {{ ok: boolean, fieldErrors: Record<string, string>, talkErrors: Record<string, Record<string, string>> }}
 */
export function validateMeetupFollowUpForm(form) {
  /** @type {Record<string, string>} */
  const fieldErrors = {}
  /** @type {Record<string, Record<string, string>>} */
  const talkErrors = {}

  if (!String(form.meetupCity || '').trim()) {
    fieldErrors.meetupCity = 'Meetup city is required.'
  }
  if (!String(form.meetupName || '').trim()) {
    fieldErrors.meetupName = 'Meetup name is required.'
  }
  if (form.registrationPlatform !== 'luma' && form.registrationPlatform !== 'meetup') {
    fieldErrors.registrationPlatform = 'Select Luma or Meetup.'
  }
  if (!String(form.advocateName || '').trim()) {
    fieldErrors.advocateName = 'Advocate name is required.'
  }

  const talks = Array.isArray(form.talks) ? form.talks : []
  if (talks.length === 0) {
    fieldErrors.talks = 'Add at least one talk.'
  }

  talks.forEach((talk) => {
    /** @type {Record<string, string>} */
    const err = {}
    if (!String(talk.talkTitle || '').trim()) err.talkTitle = 'Talk title is required.'
    if (!String(talk.speakerName || '').trim()) err.speakerName = 'Speaker name is required.'
    const url = String(talk.slidesUrl || '').trim()
    if (!url) err.slidesUrl = 'Slides URL is required.'
    else if (!isValidHttpUrl(url)) err.slidesUrl = 'Enter a valid http(s) URL.'
    if (Object.keys(err).length) talkErrors[talk.id] = err
  })

  const next = getNextMeetupState(form)
  if (next.hasName && next.hasUrl && !next.urlValid) {
    fieldErrors.nextMeetupUrl = 'Enter a valid http(s) URL.'
  }

  const ok = Object.keys(fieldErrors).length === 0 && Object.keys(talkErrors).length === 0
  return { ok, fieldErrors, talkErrors }
}

/**
 * Subject line from meetup name: “[Meetup Name] Follow-Up”.
 * @param {string} meetupName
 */
export function defaultFollowUpSubject(meetupName) {
  const name = String(meetupName || '').trim() || 'Meetup'
  return `${name} Follow-Up`
}

/**
 * @param {ReturnType<typeof getInitialMeetupFollowUpForm>} form
 */
export function resolveFollowUpSubject(form) {
  return defaultFollowUpSubject(form.meetupName)
}

/**
 * @param {ReturnType<typeof getInitialMeetupFollowUpForm>} form
 * @returns {{ subject: string, plain: string, html: string }}
 */
export function generateMeetupFollowUpEmail(form) {
  const subject = resolveFollowUpSubject(form)
  const city = String(form.meetupCity || '').trim()
  const advocate = String(form.advocateName || '').trim() || 'Advocate'
  const utm = buildFollowUpUtm(form)

  const trainingUrl = appendUtmParams(FOLLOWUP_DESTINATIONS.training, utm)
  const newsletterUrl = appendUtmParams(FOLLOWUP_DESTINATIONS.newsletter, utm)
  const discussUrl = appendUtmParams(FOLLOWUP_DESTINATIONS.discuss, utm)
  const sessionizeUrl = appendUtmParams(FOLLOWUP_DESTINATIONS.sessionize, utm)
  const slackUrl = FOLLOWUP_DESTINATIONS.slack

  const talks = (Array.isArray(form.talks) ? form.talks : []).filter(
    (t) => String(t.talkTitle || '').trim() || String(t.speakerName || '').trim() || String(t.slidesUrl || '').trim(),
  )

  const plainTalkLines = talks.map((t, i) => {
    const title = String(t.talkTitle || '').trim() || 'Talk'
    const speaker = String(t.speakerName || '').trim() || 'Speaker'
    const url = String(t.slidesUrl || '').trim()
    return `${i + 1}. ${title} (${url}), ${speaker}`
  })

  const plainParts = [
    'Hi there,',
    '',
    'Here are the slides from the meetup:',
    '',
    ...plainTalkLines,
    '',
    `To learn more about Elasticsearch and our products, take a look at the free and instructor-led training: ${trainingUrl}`,
    '',
    'If you’d like to stay connected:',
    '',
    `- Subscribe to the Elastic community newsletter: ${newsletterUrl}`,
    `- Ask technical questions on Slack (${slackUrl}) or Discuss (${discussUrl})`,
    `- Submit a session to speak at a future meetup: ${sessionizeUrl}`,
    '',
  ]

  const nextMeetup = buildNextMeetupParagraph(form, utm)
  if (nextMeetup) {
    plainParts.push(nextMeetup.plain, '')
  }

  plainParts.push('See you soon at the next meetup,', advocate)
  const plain = plainParts.join('\n')

  const talkLis = talks
    .map((t) => {
      const title = escapeHtml(String(t.talkTitle || '').trim() || 'Talk')
      const speaker = escapeHtml(String(t.speakerName || '').trim() || 'Speaker')
      const url = escapeHtmlAttr(String(t.slidesUrl || '').trim())
      return `<li><a href="${url}">${title}</a>, ${speaker}</li>`
    })
    .join('')

  const htmlParts = [
    '<p>Hi there,</p>',
    '<p>Here are the slides from the meetup:</p>',
    `<ol>${talkLis}</ol>`,
    `<p>To learn more about Elasticsearch and our products, take a look at the <a href="${escapeHtmlAttr(trainingUrl)}">free and instructor-led training</a>.</p>`,
    '<p>If you’d like to stay connected:</p>',
    '<ul>',
    `<li><a href="${escapeHtmlAttr(newsletterUrl)}">Subscribe to the Elastic community newsletter</a></li>`,
    `<li>Ask technical questions on <a href="${escapeHtmlAttr(slackUrl)}">Slack</a> or <a href="${escapeHtmlAttr(discussUrl)}">Discuss</a></li>`,
    `<li><a href="${escapeHtmlAttr(sessionizeUrl)}">Submit a session to speak at a future meetup</a></li>`,
    '</ul>',
  ]
  if (nextMeetup) {
    htmlParts.push(nextMeetup.html)
  }
  htmlParts.push(`<p>See you soon at the next meetup,<br>${escapeHtml(advocate)}</p>`)
  const html = htmlParts.join('')

  void city
  return { subject, plain, html }
}

/**
 * Attendee-only clipboard HTML: semantic tags only, no checklist / UI chrome.
 * @param {string} html From generateMeetupFollowUpEmail().html
 * @returns {string}
 */
export function buildMeetupFollowUpClipboardHtml(html) {
  const body = String(html || '').trim()
  if (!body) return ''
  // Reject accidental inclusion of internal checklist copy
  if (/internal checklist/i.test(body)) {
    return body.replace(/[\s\S]*?(?=<p>Hi there,)/i, '').trim() || body
  }
  return body
}

/**
 * Assert clipboard HTML is attendee-facing semantic markup (for tests / QA helpers).
 * @param {string} html
 */
export function assertMeetupFollowUpClipboardHtmlShape(html) {
  const s = String(html || '')
  return {
    hasAnchors: /<a\s+href="/i.test(s),
    hasOrderedList: /<ol[\s>]/i.test(s) && /<\/ol>/i.test(s),
    hasUnorderedList: /<ul[\s>]/i.test(s) && /<\/ul>/i.test(s),
    hasParagraphs: /<p[\s>]/i.test(s),
    hasSignatureBreak: /<br\s*\/?>/i.test(s),
    excludesChecklist: !/internal checklist/i.test(s),
    excludesClassAttr: !/\sclass\s*=/i.test(s),
    excludesScript: !/<script[\s>]/i.test(s),
  }
}

/**
 * Copy attendee email as text/html + text/plain when supported.
 * @param {{ html?: string, plain?: string }} payload
 * @param {{ clipboard?: Clipboard, ClipboardItem?: typeof ClipboardItem }} [deps]
 * @returns {Promise<'html' | 'plain'>}
 */
export async function copyMeetupFollowUpEmailToClipboard(payload, deps = {}) {
  const plain = String(payload?.plain || '')
  const clipHtml = buildMeetupFollowUpClipboardHtml(payload?.html || '')
  const clipboard = deps.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null)
  const ClipboardItemCtor =
    deps.ClipboardItem || (typeof ClipboardItem !== 'undefined' ? ClipboardItem : undefined)

  if (!clipboard) {
    throw new Error('Clipboard unavailable')
  }

  if (ClipboardItemCtor && clipHtml && typeof clipboard.write === 'function') {
    try {
      const htmlBlob = new Blob([clipHtml], { type: 'text/html' })
      const textBlob = new Blob([plain], { type: 'text/plain' })
      await clipboard.write([
        new ClipboardItemCtor({
          'text/html': htmlBlob,
          'text/plain': textBlob,
        }),
      ])
      return 'html'
    } catch {
      // fall through to plain text
    }
  }

  await clipboard.writeText(plain)
  return 'plain'
}

export const INTERNAL_CHECKLIST_ITEMS = [
  'Confirm all slide links work',
  {
    before: 'Export the slides and upload them to the ',
    linkText: 'Elastic meetups GitHub repository',
    href: FOLLOWUP_DESTINATIONS.meetupsGithub,
    after: '',
  },
  'Send the follow-up through the same registration platform used for the event',
  'Test every link before sending',
]
