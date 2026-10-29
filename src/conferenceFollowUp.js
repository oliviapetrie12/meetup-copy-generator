/**
 * Conference Follow-Up generator — UTM tagging and email copy.
 *
 * Mirrors meetup follow-up: a static campaign for the program, source for the
 * platform, and medium for the event. Medium uses the toolkit’s existing UTM
 * token rules (normalizeCityForUtm): trim, lowercase, spaces to hyphens,
 * punctuation removed.
 *
 * Tracking matches meetup follow-up. elastic.co hosts (including Discuss) and
 * the Sessionize destination are tagged. Slack (ela.st) is not. Other custom
 * links are tagged only when they are elastic.co hosts.
 */

import { escapeHtml, escapeHtmlAttr } from './htmlEscape.js'
import {
  FOLLOWUP_DESTINATIONS,
  appendUtmParams,
  copyMeetupFollowUpEmailToClipboard,
  isElasticCoHost,
  isValidHttpUrl,
  normalizeCityForUtm,
} from './meetupFollowUp.js'

export const CONFERENCE_FOLLOWUP_STORAGE_KEY = 'conference-followup-form-v1'

/** Intuition is the platform that sends this follow-up. */
export const DEFAULT_UTM_SOURCE = 'intuition'

/** Static program id, parallel to meetup-followup-cm. */
export const DEFAULT_UTM_CAMPAIGN = 'conference-followup-cm'

/** Previous medium default, used only when reading older saved drafts. */
const LEGACY_UTM_MEDIUM = 'email'

export const DEFAULT_PREVIEW_TEXT =
  'Explore Elastic training, connect with the community, and share what you’re building.'

const APOSTROPHE = '\u2019'

/**
 * @param {string} conferenceName
 * @returns {string}
 */
/**
 * Conference slug for utm_medium.
 * @param {string} conferenceName
 * @returns {string}
 */
export function conferenceMediumFromName(conferenceName) {
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

/** Standard links in the follow-up email. All are included unless turned off. */
export const STANDARD_RESOURCES = [
  { id: 'training', label: 'Free and instructor-led training' },
  { id: 'newsletter', label: 'Community newsletter' },
  { id: 'slack', label: 'Slack' },
  { id: 'discuss', label: 'Discuss' },
  { id: 'sessionize', label: 'Submit a session' },
]

export function defaultIncludedResources() {
  return {
    training: true,
    newsletter: true,
    slack: true,
    discuss: true,
    sessionize: true,
  }
}

/**
 * @param {ReturnType<typeof getInitialConferenceFollowUpForm> | null | undefined} form
 */
export function includedResourcesFromForm(form) {
  const defaults = defaultIncludedResources()
  const raw = form?.includedResources
  if (!raw || typeof raw !== 'object') return defaults
  const next = { ...defaults }
  for (const resource of STANDARD_RESOURCES) {
    if (typeof raw[resource.id] === 'boolean') next[resource.id] = raw[resource.id]
  }
  return next
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
    subject: defaultSubject(''),
    subjectManual: false,
    openingSentence: defaultOpeningSentence(''),
    openingManual: false,
    includedResources: defaultIncludedResources(),
    utmSource: DEFAULT_UTM_SOURCE,
    utmMedium: '',
    utmMediumManual: false,
    utmCampaign: DEFAULT_UTM_CAMPAIGN,
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
  if (!form.subjectManual) {
    next.subject = defaultSubject(conferenceName)
  }
  if (!form.openingManual) {
    next.openingSentence = defaultOpeningSentence(conferenceName)
  }
  if (!form.utmMediumManual) {
    next.utmMedium = conferenceMediumFromName(conferenceName)
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
  if (form.utmMediumManual) return false
  if (String(form.utmMedium || '').trim() !== conferenceMediumFromName(form.conferenceName)) return false
  if (form.utmCampaignManual) return false
  if (String(form.utmCampaign || '').trim() !== DEFAULT_UTM_CAMPAIGN) return false
  if (form.subjectManual) return false
  if (String(form.subject ?? defaultSubject('')) !== defaultSubject('')) return false
  if (form.openingManual) return false
  if (String(form.openingSentence || '') !== defaultOpeningSentence('')) return false
  const included = includedResourcesFromForm(form)
  if (STANDARD_RESOURCES.some((resource) => !included[resource.id])) return false
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
    const utmMediumRaw = typeof parsed.utmMedium === 'string' ? parsed.utmMedium : ''
    const openingSentence =
      typeof parsed.openingSentence === 'string' && parsed.openingSentence
        ? parsed.openingSentence
        : defaultOpeningSentence(conferenceName)
    const subjectRaw = typeof parsed.subject === 'string' ? parsed.subject : ''
    const generatedMedium = conferenceMediumFromName(conferenceName)
    const generatedOpening = defaultOpeningSentence(conferenceName)
    const generatedSubject = defaultSubject(conferenceName)
    const subjectManual =
      typeof parsed.subjectManual === 'boolean'
        ? parsed.subjectManual
        : Boolean(subjectRaw.trim()) && subjectRaw !== generatedSubject
    const campaignTrim = utmCampaignRaw.trim()
    const mediumTrim = utmMediumRaw.trim()
    const utmCampaignManual =
      typeof parsed.utmCampaignManual === 'boolean'
        ? parsed.utmCampaignManual
        : Boolean(campaignTrim) &&
          campaignTrim !== generatedMedium &&
          campaignTrim !== DEFAULT_UTM_CAMPAIGN
    const utmMediumManual =
      typeof parsed.utmMediumManual === 'boolean'
        ? parsed.utmMediumManual
        : Boolean(mediumTrim) && mediumTrim !== LEGACY_UTM_MEDIUM && mediumTrim !== generatedMedium
    return {
      conferenceName,
      subject: subjectManual ? subjectRaw : generatedSubject,
      subjectManual,
      openingSentence,
      includedResources: includedResourcesFromForm(parsed),
      openingManual:
        typeof parsed.openingManual === 'boolean'
          ? parsed.openingManual
          : openingSentence !== generatedOpening,
      utmSource:
        typeof parsed.utmSource === 'string' && parsed.utmSource.trim()
          ? parsed.utmSource
          : DEFAULT_UTM_SOURCE,
      utmMedium: utmMediumManual ? utmMediumRaw : generatedMedium,
      utmMediumManual,
      utmCampaign: utmCampaignManual ? utmCampaignRaw : DEFAULT_UTM_CAMPAIGN,
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
 * Tag a user-entered link the way meetup follow-up tags a next-event URL:
 * elastic.co hosts only. Other domains are returned unchanged.
 * @param {string} url
 * @param {Record<string, string>} utm
 */
export function tagConferenceCustomUrl(url, utm) {
  const raw = String(url || '').trim()
  if (!isElasticCoHost(raw)) return raw
  return appendUtmParams(raw, utm)
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
    slack: FOLLOWUP_DESTINATIONS.slack,
    discuss: appendUtmParams(FOLLOWUP_DESTINATIONS.discuss, utm),
    sessionize: appendUtmParams(FOLLOWUP_DESTINATIONS.sessionize, utm),
    custom: validCustomResources(form).map((r) => ({
      label: r.label,
      url: tagConferenceCustomUrl(r.url, utm),
    })),
  }
}

/**
 * @param {ReturnType<typeof getInitialConferenceFollowUpForm>} form
 * @returns {{ id: string, label: string, href: string }[]}
 */
export function listConferenceTrackedLinks(form) {
  const links = buildConferenceResourceLinks(form)
  const included = includedResourcesFromForm(form)
  const standard = [
    { id: 'training', label: 'Training', href: links.training },
    { id: 'newsletter', label: 'Newsletter', href: links.newsletter },
    { id: 'slack', label: 'Slack', href: links.slack },
    { id: 'discuss', label: 'Discuss', href: links.discuss },
    { id: 'sessionize', label: 'Meetup sessions', href: links.sessionize },
  ].filter((link) => included[link.id])
  return [
    ...standard,
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
 * Stay-connected bullets for the resources that are turned on.
 * Slack and Discuss share one sentence when both are included.
 * @param {ReturnType<typeof includedResourcesFromForm>} included
 * @param {ReturnType<typeof buildConferenceResourceLinks>} urls
 * @returns {{ plain: string, html: string }[]}
 */
function stayConnectedBullets(included, urls) {
  /** @type {{ plain: string, html: string }[]} */
  const bullets = []
  if (included.newsletter) {
    bullets.push({
      plain: `- Subscribe to the Elastic community newsletter: ${urls.newsletter}`,
      html: `<li><a href="${escapeHtmlAttr(urls.newsletter)}">Subscribe to the Elastic community newsletter</a></li>`,
    })
  }
  if (included.slack && included.discuss) {
    bullets.push({
      plain: `- Ask technical questions on Slack (${urls.slack}) or Discuss (${urls.discuss})`,
      html: `<li>Ask technical questions on <a href="${escapeHtmlAttr(urls.slack)}">Slack</a> or <a href="${escapeHtmlAttr(urls.discuss)}">Discuss</a></li>`,
    })
  } else if (included.slack) {
    bullets.push({
      plain: `- Ask technical questions on Slack (${urls.slack})`,
      html: `<li>Ask technical questions on <a href="${escapeHtmlAttr(urls.slack)}">Slack</a></li>`,
    })
  } else if (included.discuss) {
    bullets.push({
      plain: `- Ask technical questions on Discuss (${urls.discuss})`,
      html: `<li>Ask technical questions on <a href="${escapeHtmlAttr(urls.discuss)}">Discuss</a></li>`,
    })
  }
  if (included.sessionize) {
    bullets.push({
      plain: `- Submit a session to speak at a future meetup: ${urls.sessionize}`,
      html: `<li><a href="${escapeHtmlAttr(urls.sessionize)}">Submit a session</a> to speak at a future meetup</li>`,
    })
  }
  urls.custom.forEach((resource) => {
    bullets.push({
      plain: `- ${resource.label}: ${resource.url}`,
      html: `<li><a href="${escapeHtmlAttr(resource.url)}">${escapeHtml(resource.label)}</a></li>`,
    })
  })
  return bullets
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
  const opening = String(form?.openingSentence || '').trim() || defaultOpeningSentence(form?.conferenceName)
  const subject =
    typeof form?.subject === 'string' ? form.subject : defaultSubject(form?.conferenceName)
  const preview = DEFAULT_PREVIEW_TEXT
  const included = includedResourcesFromForm(form)
  const utm = buildConferenceFollowUpUtm(form)
  const urls = buildConferenceResourceLinks(form)
  const bullets = stayConnectedBullets(included, urls)

  const plainLines = [opening, '']
  if (included.training) {
    plainLines.push(
      `To learn more about Elasticsearch and our products, take a look at the free and instructor-led training: ${urls.training}`,
      '',
    )
  }
  if (bullets.length) {
    plainLines.push(`If you${APOSTROPHE}d like to stay connected:`, '')
    bullets.forEach((bullet) => plainLines.push(bullet.plain))
    plainLines.push('')
  }
  plainLines.push('We hope to see you at another event soon!', '', 'The Elastic DevRel Team')

  const htmlParts = [`<p>${openingToHtml(opening)}</p>`]
  if (included.training) {
    htmlParts.push(
      `<p>To learn more about Elasticsearch and our products, take a look at the <a href="${escapeHtmlAttr(urls.training)}">free and instructor-led training</a>.</p>`,
    )
  }
  if (bullets.length) {
    htmlParts.push(
      `<p>If you${APOSTROPHE}d like to stay connected:</p>`,
      `<ul>${bullets.map((bullet) => bullet.html).join('')}</ul>`,
    )
  }
  htmlParts.push('<p>We hope to see you at another event soon!</p>', '<p>The Elastic DevRel Team</p>')

  return {
    subject,
    preview,
    plain: plainLines.join('\n'),
    html: htmlParts.join(''),
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
