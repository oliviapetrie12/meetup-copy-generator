/**
 * Conference Follow-Up generator — campaign slug, UTM tagging, and email copy.
 *
 * Campaign uses the toolkit’s existing UTM token rules (normalizeCityForUtm):
 * trim, lowercase, spaces to hyphens, punctuation removed.
 * Source and medium default to the Intuition email send. Meetup follow-up
 * still uses its own presets (luma or meetup, plus a city medium).
 */

import { escapeHtml, escapeHtmlAttr } from './htmlEscape.js'
import {
  FOLLOWUP_DESTINATIONS,
  appendUtmParams,
  copyMeetupFollowUpEmailToClipboard,
  isValidHttpUrl,
  normalizeCityForUtm,
} from './meetupFollowUp.js'

export const CONFERENCE_FOLLOWUP_STORAGE_KEY = 'conference-followup-form-v1'

/** Intuition is the platform that sends this follow-up. */
export const DEFAULT_UTM_SOURCE = 'intuition'

/** Marketing channel for the follow-up email. */
export const DEFAULT_UTM_MEDIUM = 'email'

export const DEFAULT_PREVIEW_TEXT =
  'Explore Elastic training, connect with the community, and share what you’re building.'

const APOSTROPHE = '\u2019'

/**
 * @param {string} conferenceName
 * @returns {string}
 */
export function conferenceCampaignFromName(conferenceName) {
  return normalizeCityForUtm(conferenceName)
}

/**
 * @param {string} conferenceName
 * @returns {string}
 */
export function defaultOpeningSentence(conferenceName) {
  const name = String(conferenceName || '').trim() || '[conference name]'
  return `Thank you for stopping by our booth at ${name}!`
}

/**
 * @param {string} conferenceName
 * @returns {string}
 */
export function defaultSubject(conferenceName) {
  const name = String(conferenceName || '').trim() || '[conference name]'
  return `Thanks for stopping by Elastic${APOSTROPHE}s booth at ${name}!`
}

/**
 * @returns {{ id: string, label: string, url: string }}
 */
export function createEmptyResource() {
  return {
    id: `resource-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    label: '',
    url: '',
  }
}

export function getInitialConferenceFollowUpForm() {
  return {
    conferenceName: '',
    openingSentence: defaultOpeningSentence(''),
    openingManual: false,
    utmSource: DEFAULT_UTM_SOURCE,
    utmMedium: DEFAULT_UTM_MEDIUM,
    utmCampaign: '',
    utmCampaignManual: false,
    resources: [],
  }
}

export function getResetConferenceFollowUpForm() {
  return getInitialConferenceFollowUpForm()
}

/**
 * @param {ReturnType<typeof getInitialConferenceFollowUpForm>} form
 * @param {string} conferenceName
 */
export function applyConferenceNameChange(form, conferenceName) {
  const next = { ...form, conferenceName }
  if (!form.openingManual) {
    next.openingSentence = defaultOpeningSentence(conferenceName)
  }
  if (!form.utmCampaignManual) {
    next.utmCampaign = conferenceCampaignFromName(conferenceName)
  }
  return next
}

/**
 * @param {ReturnType<typeof getInitialConferenceFollowUpForm> | null | undefined} form
 */
export function isConferenceFollowUpFormEmpty(form) {
  if (!form) return true
  if (String(form.conferenceName || '').trim()) return false
  if (String(form.utmSource || '').trim() !== DEFAULT_UTM_SOURCE) return false
  if (String(form.utmMedium || '').trim() !== DEFAULT_UTM_MEDIUM) return false
  if (String(form.utmCampaign || '').trim()) return false
  if (form.openingManual) return false
  if (form.utmCampaignManual) return false
  if (String(form.openingSentence || '') !== defaultOpeningSentence('')) return false
  const resources = Array.isArray(form.resources) ? form.resources : []
  return resources.every((r) => !String(r.label || '').trim() && !String(r.url || '').trim())
}

export function loadConferenceFollowUpForm() {
  const initial = getInitialConferenceFollowUpForm()
  if (typeof localStorage === 'undefined') return initial
  try {
    const raw = localStorage.getItem(CONFERENCE_FOLLOWUP_STORAGE_KEY)
    if (!raw) return initial
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return initial
    const conferenceName = typeof parsed.conferenceName === 'string' ? parsed.conferenceName : ''
    const resources = Array.isArray(parsed.resources)
      ? parsed.resources.map((r) => ({
          id: typeof r?.id === 'string' ? r.id : createEmptyResource().id,
          label: typeof r?.label === 'string' ? r.label : '',
          url: typeof r?.url === 'string' ? r.url : '',
        }))
      : []
    const utmCampaignRaw = typeof parsed.utmCampaign === 'string' ? parsed.utmCampaign : ''
    const openingSentence =
      typeof parsed.openingSentence === 'string' && parsed.openingSentence
        ? parsed.openingSentence
        : defaultOpeningSentence(conferenceName)
    const generatedCampaign = conferenceCampaignFromName(conferenceName)
    const generatedOpening = defaultOpeningSentence(conferenceName)
    const utmCampaignManual =
      typeof parsed.utmCampaignManual === 'boolean'
        ? parsed.utmCampaignManual
        : Boolean(utmCampaignRaw.trim()) && utmCampaignRaw !== generatedCampaign
    const utmCampaign = utmCampaignManual ? utmCampaignRaw : generatedCampaign
    return {
      conferenceName,
      openingSentence,
      openingManual:
        typeof parsed.openingManual === 'boolean'
          ? parsed.openingManual
          : openingSentence !== generatedOpening,
      utmSource:
        typeof parsed.utmSource === 'string' && parsed.utmSource.trim()
          ? parsed.utmSource
          : DEFAULT_UTM_SOURCE,
      utmMedium:
        typeof parsed.utmMedium === 'string' && parsed.utmMedium.trim()
          ? parsed.utmMedium
          : DEFAULT_UTM_MEDIUM,
      utmCampaign,
      utmCampaignManual,
      resources,
    }
  } catch {
    return initial
  }
}

/**
 * @param {ReturnType<typeof getInitialConferenceFollowUpForm>} form
 */
export function saveConferenceFollowUpForm(form) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CONFERENCE_FOLLOWUP_STORAGE_KEY, JSON.stringify(form))
    }
  } catch {
    // ignore quota / private mode
  }
}

/**
 * @param {ReturnType<typeof getInitialConferenceFollowUpForm>} form
 */
export function buildConferenceFollowUpUtm(form) {
  return {
    utm_campaign: String(form?.utmCampaign || '').trim(),
    utm_source: String(form?.utmSource || '').trim(),
    utm_medium: String(form?.utmMedium || '').trim(),
  }
}

/**
 * Custom rows that have both link text and a valid http(s) URL.
 * @param {ReturnType<typeof getInitialConferenceFollowUpForm>} form
 * @returns {{ label: string, url: string }[]}
 */
export function validCustomResources(form) {
  const resources = Array.isArray(form?.resources) ? form.resources : []
  return resources
    .map((r) => ({
      label: String(r?.label || '').trim(),
      url: String(r?.url || '').trim(),
    }))
    .filter((r) => r.label && isValidHttpUrl(r.url))
}

/**
 * @param {ReturnType<typeof getInitialConferenceFollowUpForm>} form
 * @returns {{
 *   training: string,
 *   newsletter: string,
 *   slack: string,
 *   discuss: string,
 *   sessionize: string,
 *   custom: { label: string, url: string }[],
 * }}
 */
export function buildConferenceResourceLinks(form) {
  const utm = buildConferenceFollowUpUtm(form)
  return {
    training: appendUtmParams(FOLLOWUP_DESTINATIONS.training, utm),
    newsletter: appendUtmParams(FOLLOWUP_DESTINATIONS.newsletter, utm),
    slack: appendUtmParams(FOLLOWUP_DESTINATIONS.slack, utm),
    discuss: appendUtmParams(FOLLOWUP_DESTINATIONS.discuss, utm),
    sessionize: appendUtmParams(FOLLOWUP_DESTINATIONS.sessionize, utm),
    custom: validCustomResources(form).map((r) => ({
      label: r.label,
      url: appendUtmParams(r.url, utm),
    })),
  }
}

/**
 * @param {ReturnType<typeof getInitialConferenceFollowUpForm>} form
 * @returns {{ id: string, label: string, href: string }[]}
 */
export function listConferenceTrackedLinks(form) {
  const links = buildConferenceResourceLinks(form)
  return [
    { id: 'training', label: 'Training', href: links.training },
    { id: 'newsletter', label: 'Newsletter', href: links.newsletter },
    { id: 'slack', label: 'Slack', href: links.slack },
    { id: 'discuss', label: 'Discuss', href: links.discuss },
    { id: 'sessionize', label: 'Meetup sessions', href: links.sessionize },
    ...links.custom.map((r, i) => ({
      id: `custom-${i}`,
      label: r.label,
      href: r.url,
    })),
  ]
}

/**
 * @param {ReturnType<typeof getInitialConferenceFollowUpForm>} form
 * @returns {{ ok: boolean, fieldErrors: Record<string, string>, resourceErrors: Record<string, Record<string, string>> }}
 */
export function validateConferenceFollowUpForm(form) {
  /** @type {Record<string, string>} */
  const fieldErrors = {}
  /** @type {Record<string, Record<string, string>>} */
  const resourceErrors = {}

  if (!String(form?.conferenceName || '').trim()) {
    fieldErrors.conferenceName = 'Conference name is required.'
  }

  const resources = Array.isArray(form?.resources) ? form.resources : []
  resources.forEach((resource) => {
    const label = String(resource?.label || '').trim()
    const url = String(resource?.url || '').trim()
    if (!label && !url) return
    /** @type {Record<string, string>} */
    const err = {}
    if (!label) err.label = 'Link text is required.'
    if (!url) err.url = 'URL is required.'
    else if (!isValidHttpUrl(url)) err.url = 'Enter a valid http(s) URL.'
    if (Object.keys(err).length) resourceErrors[resource.id] = err
  })

  const ok = Object.keys(fieldErrors).length === 0 && Object.keys(resourceErrors).length === 0
  return { ok, fieldErrors, resourceErrors }
}

function openingToHtml(opening) {
  return escapeHtml(opening).replace(/\n/g, '<br>')
}

/**
 * @param {ReturnType<typeof getInitialConferenceFollowUpForm>} form
 * @returns {{
 *   subject: string,
 *   preview: string,
 *   plain: string,
 *   html: string,
 *   utm: { utm_campaign: string, utm_source: string, utm_medium: string },
 *   links: ReturnType<typeof listConferenceTrackedLinks>,
 * }}
 */
export function generateConferenceFollowUpEmail(form) {
  const name = String(form?.conferenceName || '').trim() || '[conference name]'
  const opening = String(form?.openingSentence || '').trim() || defaultOpeningSentence(form?.conferenceName)
  const subject = defaultSubject(form?.conferenceName)
  const preview = DEFAULT_PREVIEW_TEXT
  const utm = buildConferenceFollowUpUtm(form)
  const urls = buildConferenceResourceLinks(form)

  const plainLines = [
    `Elastic @ ${name}`,
    '',
    opening,
    '',
    `To learn more about Elasticsearch and our products, take a look at the free and instructor-led training: ${urls.training}`,
    '',
    `If you${APOSTROPHE}d like to stay connected:`,
    '',
    `- Subscribe to the Elastic community newsletter: ${urls.newsletter}`,
    `- Ask technical questions on Slack (${urls.slack}) or Discuss (${urls.discuss})`,
    `- Submit a session to speak at a future meetup: ${urls.sessionize}`,
  ]

  urls.custom.forEach((resource) => {
    plainLines.push(`- ${resource.label}: ${resource.url}`)
  })

  plainLines.push('', 'We hope to see you at another event soon!', '', 'The Elastic DevRel Team')

  const customLis = urls.custom
    .map(
      (resource) =>
        `<li><a href="${escapeHtmlAttr(resource.url)}">${escapeHtml(resource.label)}</a></li>`,
    )
    .join('')

  const html = [
    `<p>Elastic @ ${escapeHtml(name)}</p>`,
    `<p>${openingToHtml(opening)}</p>`,
    `<p>To learn more about Elasticsearch and our products, take a look at the <a href="${escapeHtmlAttr(urls.training)}">free and instructor-led training</a>.</p>`,
    `<p>If you${APOSTROPHE}d like to stay connected:</p>`,
    '<ul>',
    `<li><a href="${escapeHtmlAttr(urls.newsletter)}">Subscribe to the Elastic community newsletter</a></li>`,
    `<li>Ask technical questions on <a href="${escapeHtmlAttr(urls.slack)}">Slack</a> or <a href="${escapeHtmlAttr(urls.discuss)}">Discuss</a></li>`,
    `<li><a href="${escapeHtmlAttr(urls.sessionize)}">Submit a session to speak at a future meetup</a></li>`,
    customLis,
    '</ul>',
    '<p>We hope to see you at another event soon!</p>',
    '<p>The Elastic DevRel Team</p>',
  ].join('')

  return {
    subject,
    preview,
    plain: plainLines.join('\n'),
    html,
    utm,
    links: listConferenceTrackedLinks(form),
  }
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}

function stripTags(value) {
  return String(value || '').replace(/<[^>]+>/g, '')
}

/**
 * Plain-text fallback for an edited rich-text body. Keeps anchor URLs.
 * @param {string} html
 * @returns {string}
 */
export function htmlEmailToPlain(html) {
  let s = String(html || '')
  s = s.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
    const label = decodeHtml(stripTags(text)).trim()
    const url = decodeHtml(href).trim()
    if (!url || label.includes(url)) return label
    return `${label} (${url})`
  })
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/p>/gi, '\n\n')
  s = s.replace(/<p[^>]*>/gi, '')
  s = s.replace(/<li[^>]*>/gi, '- ')
  s = s.replace(/<\/li>/gi, '\n')
  s = s.replace(/<\/(ul|ol|div|h\d)>/gi, '\n')
  s = s.replace(/<[^>]+>/g, '')
  s = decodeHtml(s)
  return s
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Copy the email body as text/html + text/plain, falling back to plain text.
 * @param {{ html?: string, plain?: string }} payload
 * @param {{ clipboard?: Clipboard, ClipboardItem?: typeof ClipboardItem }} [deps]
 * @returns {Promise<'html' | 'plain'>}
 */
export function copyConferenceFollowUpEmailToClipboard(payload, deps) {
  return copyMeetupFollowUpEmailToClipboard(payload, deps)
}
