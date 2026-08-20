/**
 * Meetup Follow-Up generator — UTM helpers, validation, and email generation.
 */

import { escapeHtml, escapeHtmlAttr } from './htmlEscape.js'

export const MEETUP_FOLLOWUP_STORAGE_KEY = 'meetup-followup-form-v1'

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

export function getInitialMeetupFollowUpForm() {
  return {
    meetupCity: '',
    registrationPlatform: 'luma',
    advocateName: '',
    emailSubject: '',
    talks: [createEmptyTalk(), createEmptyTalk()],
  }
}

export function loadMeetupFollowUpForm() {
  if (typeof localStorage === 'undefined') return getInitialMeetupFollowUpForm()
  try {
    const raw = localStorage.getItem(MEETUP_FOLLOWUP_STORAGE_KEY)
    if (!raw) return getInitialMeetupFollowUpForm()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return getInitialMeetupFollowUpForm()
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
    return {
      ...base,
      meetupCity: typeof parsed.meetupCity === 'string' ? parsed.meetupCity : '',
      registrationPlatform:
        parsed.registrationPlatform === 'meetup' || parsed.registrationPlatform === 'luma'
          ? parsed.registrationPlatform
          : 'luma',
      advocateName: typeof parsed.advocateName === 'string' ? parsed.advocateName : '',
      emailSubject: typeof parsed.emailSubject === 'string' ? parsed.emailSubject : '',
      talks: talks.length >= 1 ? talks : base.talks,
    }
  } catch {
    return getInitialMeetupFollowUpForm()
  }
}

export function saveMeetupFollowUpForm(form) {
  try {
    localStorage.setItem(MEETUP_FOLLOWUP_STORAGE_KEY, JSON.stringify(form))
  } catch {
    // ignore quota / private mode
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

  const ok = Object.keys(fieldErrors).length === 0 && Object.keys(talkErrors).length === 0
  return { ok, fieldErrors, talkErrors }
}

/**
 * Default subject when the optional field is blank.
 * @param {string} city
 */
export function defaultFollowUpSubject(city) {
  const c = String(city || '').trim() || 'City'
  return `Slides from the ${c} Elastic Meetup`
}

/**
 * @param {ReturnType<typeof getInitialMeetupFollowUpForm>} form
 */
export function resolveFollowUpSubject(form) {
  const custom = String(form.emailSubject || '').trim()
  if (custom) return custom
  return defaultFollowUpSubject(form.meetupCity)
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

  const plain = [
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
    'See you soon at the next meetup,',
    advocate,
  ].join('\n')

  const talkLis = talks
    .map((t) => {
      const title = escapeHtml(String(t.talkTitle || '').trim() || 'Talk')
      const speaker = escapeHtml(String(t.speakerName || '').trim() || 'Speaker')
      const url = escapeHtmlAttr(String(t.slidesUrl || '').trim())
      return `<li><a href="${url}">${title}</a>, ${speaker}</li>`
    })
    .join('')

  const html = [
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
    `<p>See you soon at the next meetup,<br>${escapeHtml(advocate)}</p>`,
  ].join('')

  void city
  return { subject, plain, html }
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
