/**
 * DevRel Event Assets — form helpers, validation, and Google Docs–ready document generation.
 */

import { escapeHtml } from './htmlEscape.js'
import {
  APPROVED_SOCIAL_CHANNELS,
  BRAND_ASSET_LINKS,
  EVENT_ASSETS_HTML_LANG,
  getEventAssetsStrings,
  normalizeEventAssetsLanguage,
} from './devrelEventAssetsI18n.js'

export {
  APPROVED_SOCIAL_CHANNELS,
  BRAND_ASSET_LINKS,
  EVENT_ASSETS_HTML_LANG,
  EVENT_ASSETS_I18N,
  EVENT_ASSETS_LANGUAGE_OPTIONS,
  getEventAssetsStrings,
  normalizeEventAssetsLanguage,
} from './devrelEventAssetsI18n.js'

export const EVENT_ASSETS_STORAGE_KEY = 'devrel-event-assets-form-v1'

export const EVENT_TYPE_VALUES = ['conference', 'meetup', 'hackathon', 'community_event']

export const EVENT_TYPE_OPTIONS = [
  { value: 'conference', label: 'Conference' },
  { value: 'meetup', label: 'Meetup' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'community_event', label: 'Community event' },
]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function trimField(value) {
  return String(value ?? '').trim()
}

export function getInitialEventAssetsForm() {
  return {
    eventName: '',
    language: 'en',
    eventType: 'conference',
    participationDetails: '',
    speakerName: '',
    speakerTitle: '',
    speakerBio: '',
    sessionTitle: '',
    sessionDescription: '',
    contactName: '',
    contactEmail: '',
  }
}

export function getResetEventAssetsForm() {
  return getInitialEventAssetsForm()
}

export function isEventAssetsFormEmpty(form) {
  const base = getInitialEventAssetsForm()
  const keys = Object.keys(base)
  return keys.every((key) => {
    if (key === 'language' || key === 'eventType') {
      return trimField(form?.[key]) === base[key]
    }
    return !trimField(form?.[key])
  })
}

function normalizeEventType(value) {
  return EVENT_TYPE_VALUES.includes(value) ? value : 'conference'
}

export function normalizeEventAssetsForm(raw) {
  const base = getInitialEventAssetsForm()
  const src = raw && typeof raw === 'object' ? raw : {}
  return {
    eventName: typeof src.eventName === 'string' ? src.eventName : base.eventName,
    language: normalizeEventAssetsLanguage(src.language),
    eventType: normalizeEventType(src.eventType),
    participationDetails:
      typeof src.participationDetails === 'string' ? src.participationDetails : base.participationDetails,
    speakerName: typeof src.speakerName === 'string' ? src.speakerName : base.speakerName,
    speakerTitle: typeof src.speakerTitle === 'string' ? src.speakerTitle : base.speakerTitle,
    speakerBio: typeof src.speakerBio === 'string' ? src.speakerBio : base.speakerBio,
    sessionTitle: typeof src.sessionTitle === 'string' ? src.sessionTitle : base.sessionTitle,
    sessionDescription:
      typeof src.sessionDescription === 'string' ? src.sessionDescription : base.sessionDescription,
    contactName: typeof src.contactName === 'string' ? src.contactName : base.contactName,
    contactEmail: typeof src.contactEmail === 'string' ? src.contactEmail : base.contactEmail,
  }
}

export function loadEventAssetsForm() {
  try {
    if (typeof localStorage === 'undefined') return getInitialEventAssetsForm()
    const raw = localStorage.getItem(EVENT_ASSETS_STORAGE_KEY)
    if (!raw) return getInitialEventAssetsForm()
    const parsed = JSON.parse(raw)
    return normalizeEventAssetsForm(parsed)
  } catch {
    return getInitialEventAssetsForm()
  }
}

export function saveEventAssetsForm(form) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(EVENT_ASSETS_STORAGE_KEY, JSON.stringify(normalizeEventAssetsForm(form)))
  } catch {
    // ignore quota / private mode / blocked storage
  }
}

export function isValidContactEmail(value) {
  const email = trimField(value)
  if (!email) return true
  return EMAIL_PATTERN.test(email)
}

/**
 * @param {ReturnType<typeof getInitialEventAssetsForm>} form
 */
export function validateEventAssetsForm(form) {
  /** @type {Record<string, string>} */
  const fieldErrors = {}
  if (!trimField(form?.eventName)) {
    fieldErrors.eventName = 'Event name is required.'
  }
  if (!isValidContactEmail(form?.contactEmail)) {
    fieldErrors.contactEmail = 'Enter a valid email address.'
  }
  return {
    ok: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  }
}

export function getApprovedSocialChannels(channels = APPROVED_SOCIAL_CHANNELS) {
  if (!Array.isArray(channels)) return []
  return channels.filter((ch) => ch && trimField(ch.label) && trimField(ch.url))
}

function hasSpeakerInfo(form) {
  return Boolean(
    trimField(form.speakerName) || trimField(form.speakerTitle) || trimField(form.speakerBio),
  )
}

function hasSessionInfo(form) {
  return Boolean(trimField(form.sessionTitle) || trimField(form.sessionDescription))
}

function hasContactInfo(form) {
  const name = trimField(form.contactName)
  const email = trimField(form.contactEmail)
  if (name) return true
  return Boolean(email && isValidContactEmail(email))
}

function multilineHtml(text) {
  const trimmed = trimField(text)
  if (!trimmed) return ''
  return trimmed
    .split(/\n\s*\n/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function labeledLineHtml(label, value) {
  const trimmed = trimField(value)
  if (!trimmed) return ''
  if (!trimmed.includes('\n')) {
    return `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(trimmed)}</p>`
  }
  return `<p><strong>${escapeHtml(label)}:</strong></p>${multilineHtml(trimmed)}`
}

function labeledLinePlain(label, value) {
  const trimmed = trimField(value)
  if (!trimmed) return ''
  if (!trimmed.includes('\n')) return `${label}: ${trimmed}`
  return `${label}:\n${trimmed}`
}

function linkItemHtml(label, url) {
  const href = trimField(url)
  const text = trimField(label)
  if (!href || !text) return ''
  return `<li><a href="${escapeHtml(href)}">${escapeHtml(text)}</a></li>`
}

function linkItemPlain(label, url) {
  return `${trimField(label)}: ${trimField(url)}`
}

/**
 * @param {ReturnType<typeof getInitialEventAssetsForm>} form
 * @param {{ socialChannels?: typeof APPROVED_SOCIAL_CHANNELS }} [options]
 */
export function generateEventAssetsDocument(form, options = {}) {
  const normalized = normalizeEventAssetsForm(form)
  const t = getEventAssetsStrings(normalized.language)
  const htmlLang = EVENT_ASSETS_HTML_LANG[normalized.language] || 'en'
  const eventName = trimField(normalized.eventName)
  const eventTypeLabel = t.eventTypes[normalized.eventType] || t.eventTypes.conference
  const socialChannels = getApprovedSocialChannels(options.socialChannels)

  const htmlParts = []
  const plainParts = []

  htmlParts.push(`<h1>${escapeHtml(t.documentTitle)}</h1>`)
  plainParts.push(t.documentTitle, '')

  htmlParts.push(
    `<div><p><strong>${escapeHtml(t.eventLabel)}:</strong> ${escapeHtml(eventName)}</p><p><strong>${escapeHtml(t.eventTypeLabel)}:</strong> ${escapeHtml(eventTypeLabel)}</p></div>`,
  )
  plainParts.push(`${t.eventLabel}: ${eventName}`)
  plainParts.push(`${t.eventTypeLabel}: ${eventTypeLabel}`, '')

  htmlParts.push(`<h2>${escapeHtml(t.aboutElasticHeading)}</h2>`)
  htmlParts.push(`<p>${escapeHtml(t.aboutElasticBody)}</p>`)
  plainParts.push(t.aboutElasticHeading, t.aboutElasticBody, '')

  htmlParts.push(`<h2>${escapeHtml(t.developerRelationsHeading)}</h2>`)
  htmlParts.push(`<p>${escapeHtml(t.developerRelationsBody)}</p>`)
  plainParts.push(t.developerRelationsHeading, t.developerRelationsBody, '')

  const participation = trimField(normalized.participationDetails)
  if (participation) {
    htmlParts.push(`<h2>${escapeHtml(t.eventParticipationHeading)}</h2>`)
    htmlParts.push(multilineHtml(participation))
    plainParts.push(t.eventParticipationHeading, participation, '')
  }

  if (hasSpeakerInfo(normalized)) {
    htmlParts.push(`<h2>${escapeHtml(t.speakerInformationHeading)}</h2>`)
    htmlParts.push(labeledLineHtml(t.speakerNameLabel, normalized.speakerName))
    htmlParts.push(labeledLineHtml(t.speakerTitleLabel, normalized.speakerTitle))
    htmlParts.push(labeledLineHtml(t.speakerBioLabel, normalized.speakerBio))
    plainParts.push(t.speakerInformationHeading)
    const nameLine = labeledLinePlain(t.speakerNameLabel, normalized.speakerName)
    const titleLine = labeledLinePlain(t.speakerTitleLabel, normalized.speakerTitle)
    const bioLine = labeledLinePlain(t.speakerBioLabel, normalized.speakerBio)
    if (nameLine) plainParts.push(nameLine)
    if (titleLine) plainParts.push(titleLine)
    if (bioLine) plainParts.push(bioLine)
    plainParts.push('')
  }

  if (hasSessionInfo(normalized)) {
    htmlParts.push(`<h2>${escapeHtml(t.sessionInformationHeading)}</h2>`)
    htmlParts.push(labeledLineHtml(t.sessionTitleLabel, normalized.sessionTitle))
    htmlParts.push(labeledLineHtml(t.sessionDescriptionLabel, normalized.sessionDescription))
    plainParts.push(t.sessionInformationHeading)
    const sessionTitleLine = labeledLinePlain(t.sessionTitleLabel, normalized.sessionTitle)
    const sessionDescLine = labeledLinePlain(t.sessionDescriptionLabel, normalized.sessionDescription)
    if (sessionTitleLine) plainParts.push(sessionTitleLine)
    if (sessionDescLine) plainParts.push(sessionDescLine)
    plainParts.push('')
  }

  htmlParts.push(`<h2>${escapeHtml(t.logoAndBrandAssetsHeading)}</h2>`)
  htmlParts.push('<ul>')
  htmlParts.push(linkItemHtml(t.elasticLogoLabel, BRAND_ASSET_LINKS.logo))
  htmlParts.push(linkItemHtml(t.elasticBrandGuidelinesLabel, BRAND_ASSET_LINKS.brandGuidelines))
  htmlParts.push('</ul>')
  plainParts.push(t.logoAndBrandAssetsHeading)
  plainParts.push(`• ${linkItemPlain(t.elasticLogoLabel, BRAND_ASSET_LINKS.logo)}`)
  plainParts.push(`• ${linkItemPlain(t.elasticBrandGuidelinesLabel, BRAND_ASSET_LINKS.brandGuidelines)}`)
  plainParts.push('')

  if (socialChannels.length > 0) {
    htmlParts.push(`<h2>${escapeHtml(t.officialSocialChannelsHeading)}</h2>`)
    htmlParts.push('<ul>')
    socialChannels.forEach((ch) => {
      htmlParts.push(linkItemHtml(ch.label, ch.url))
    })
    htmlParts.push('</ul>')
    plainParts.push(t.officialSocialChannelsHeading)
    socialChannels.forEach((ch) => {
      plainParts.push(`• ${linkItemPlain(ch.label, ch.url)}`)
    })
    plainParts.push('')
  }

  if (hasContactInfo(normalized)) {
    htmlParts.push(`<h2>${escapeHtml(t.eventContactHeading)}</h2>`)
    htmlParts.push(labeledLineHtml(t.contactNameLabel, normalized.contactName))
    const email = trimField(normalized.contactEmail)
    if (email && isValidContactEmail(email)) {
      htmlParts.push(
        `<p><strong>${escapeHtml(t.contactEmailLabel)}:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>`,
      )
    }
    plainParts.push(t.eventContactHeading)
    const contactNameLine = labeledLinePlain(t.contactNameLabel, normalized.contactName)
    if (contactNameLine) plainParts.push(contactNameLine)
    if (email && isValidContactEmail(email)) {
      plainParts.push(`${t.contactEmailLabel}: ${email}`)
    }
    plainParts.push('')
  }

  const inner = htmlParts.filter(Boolean).join('')
  const html = `<div lang="${escapeHtml(htmlLang)}">${inner}</div>`
  const plain = plainParts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'

  return { html, plain, language: normalized.language }
}

/**
 * Full HTML document for clipboard consumers (charset preserves Portuguese accents).
 * @param {string} html From generateEventAssetsDocument().html
 */
export function buildEventAssetsClipboardHtml(html) {
  const body = String(html || '').trim()
  if (!body) return ''
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`
}

export function assertEventAssetsClipboardHtmlShape(html) {
  const s = String(html || '')
  return {
    hasHeadings: /<h1[\s>]/i.test(s) && /<h2[\s>]/i.test(s),
    hasParagraphs: /<p[\s>]/i.test(s),
    hasLists: /<ul[\s>]/i.test(s) && /<\/ul>/i.test(s),
    hasAnchors: /<a\s+href="/i.test(s),
    hasCharset: /charset="utf-8"/i.test(s),
    excludesClassAttr: !/\sclass\s*=/i.test(s),
    excludesScript: !/<script[\s>]/i.test(s),
    excludesButton: !/<button[\s>]/i.test(s),
  }
}

/**
 * Copy document as text/html + text/plain when supported.
 * @param {{ html?: string, plain?: string }} payload
 * @param {{ clipboard?: Clipboard, ClipboardItem?: typeof ClipboardItem }} [deps]
 * @returns {Promise<'html' | 'plain'>}
 */
export async function copyEventAssetsToClipboard(payload, deps = {}) {
  const plain = String(payload?.plain || '')
  const clipHtml = buildEventAssetsClipboardHtml(payload?.html || '')
  const clipboard = deps.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null)
  const ClipboardItemCtor =
    deps.ClipboardItem || (typeof ClipboardItem !== 'undefined' ? ClipboardItem : undefined)

  if (!clipboard) {
    throw new Error('Clipboard unavailable')
  }

  if (ClipboardItemCtor && clipHtml && typeof clipboard.write === 'function') {
    try {
      const htmlBlob = new Blob([clipHtml], { type: 'text/html;charset=utf-8' })
      const textBlob = new Blob([plain], { type: 'text/plain;charset=utf-8' })
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
