/**
 * Preliminary Booth Staff Email — early registration note for confirmed booth staff.
 * Final onsite logistics stay in Conference Know Before You Go.
 */

import { escapeHtml, escapeHtmlAttr } from './htmlEscape.js'
import { readDraft, writeDraft, mergeDraftRecord, draftsEqual } from './draftStorage.js'
import { copyMeetupFollowUpEmailToClipboard, isValidHttpUrl } from './meetupFollowUp.js'

export const PRELIMINARY_BOOTH_STAFF_STORAGE_KEY = 'preliminary-booth-staff-form-v1'

const APOSTROPHE = '\u2019'

export const LOGISTICS_PARAGRAPH =
  `This is a preliminary overview. I${APOSTROPHE}ll share the finalized staffing schedule, booth details, setup instructions, and other onsite logistics closer to the event.`

const LET_ME_KNOW = `Let me know once you${APOSTROPHE}ve registered.`

export const REGISTRATION_MODE_SELF = 'self'
export const REGISTRATION_MODE_ALREADY = 'already'

export const ALREADY_REGISTERED_MESSAGE =
  'Everyone has been registered using the code provided as part of our sponsorship.'

function trim(value) {
  return String(value || '').trim()
}

/**
 * @param {string} conferenceName
 * @returns {string}
 */
export function defaultSubject(conferenceName) {
  const name = trim(conferenceName) || '[conference name]'
  return `${name}: Preliminary Booth Staffing & Registration`
}

/**
 * @param {Record<string, unknown>} form
 * @returns {string}
 */
export function effectiveRegistrationLinkText(form) {
  if (form?.registrationLinkTextManual) return trim(form.registrationLinkText)
  return trim(form?.conferenceName)
}

/**
 * Default registration block. The code step is left out when no code is set.
 * Returns an empty string until a deadline, link, or code is entered.
 * @param {Record<string, unknown>} form
 * @returns {string}
 */
export function defaultRegistrationInstructions(form) {
  const deadline = trim(form?.registrationDeadline)
  const code = trim(form?.registrationCode)
  const url = trim(form?.registrationLink)
  const linkText = trim(form?.registrationLinkText)
  if (!deadline && !code && !url) return ''

  const lines = [deadline ? `Please register by ${deadline}:` : 'Please register:', '']
  const steps = []
  const visitLabel = linkText || url
  if (visitLabel) steps.push(`Visit ${visitLabel}.`)
  if (code) steps.push(`Use code ${code} to redeem your booth staff pass.`)
  if (steps.length) steps.push(LET_ME_KNOW)
  steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`))
  return lines.join('\n').trim()
}

/**
 * Fill subject, link text, and registration steps from the other fields
 * until the user edits those lines directly.
 * @param {Record<string, unknown>} form
 */
export function withDerivedFields(form) {
  const next = { ...(form || {}) }
  if (!next.subjectManual) next.subject = defaultSubject(next.conferenceName)
  if (!next.registrationLinkTextManual) {
    next.registrationLinkText = trim(next.conferenceName)
  }
  if (!next.registrationInstructionsManual) {
    next.registrationInstructions = defaultRegistrationInstructions(next)
  }
  if (next.registrationMode !== REGISTRATION_MODE_ALREADY) {
    next.registrationMode = REGISTRATION_MODE_SELF
  }
  if (!next.alreadyRegisteredMessageManual) {
    next.alreadyRegisteredMessage = ALREADY_REGISTERED_MESSAGE
  }
  return next
}

export function getInitialPreliminaryBoothStaffForm() {
  return withDerivedFields({
    conferenceName: '',
    eventDates: '',
    location: '',
    sponsorshipDetails: '',
    registrationDeadline: '',
    registrationLink: '',
    registrationLinkText: '',
    registrationLinkTextManual: false,
    registrationCode: '',
    registrationInstructions: '',
    registrationInstructionsManual: false,
    registrationMode: REGISTRATION_MODE_SELF,
    alreadyRegisteredMessage: '',
    alreadyRegisteredMessageManual: false,
    additionalNote: '',
    senderName: '',
    subject: '',
    subjectManual: false,
  })
}

/**
 * @param {Record<string, unknown>} form
 * @param {Record<string, unknown>} patch
 */
export function updatePreliminaryBoothStaffForm(form, patch) {
  return withDerivedFields({ ...form, ...patch })
}

export function isPreliminaryBoothStaffFormEmpty(form) {
  if (!form) return true
  return draftsEqual(withDerivedFields(form), getInitialPreliminaryBoothStaffForm())
}

export function loadPreliminaryBoothStaffForm() {
  const initial = getInitialPreliminaryBoothStaffForm()
  return withDerivedFields(mergeDraftRecord(initial, readDraft(PRELIMINARY_BOOTH_STAFF_STORAGE_KEY)))
}

/**
 * @param {Record<string, unknown>} form
 * @returns {boolean}
 */
export function savePreliminaryBoothStaffForm(form) {
  return writeDraft(PRELIMINARY_BOOTH_STAFF_STORAGE_KEY, form)
}

/**
 * @param {Record<string, unknown>} form
 * @returns {{ ok: boolean, fieldErrors: Record<string, string> }}
 */
export function validatePreliminaryBoothStaffForm(form) {
  const fieldErrors = {}
  if (!trim(form?.conferenceName)) fieldErrors.conferenceName = 'Enter a conference name.'
  const link = trim(form?.registrationLink)
  const staffRegisterThemselves = form?.registrationMode !== REGISTRATION_MODE_ALREADY
  if (staffRegisterThemselves && link && !isValidHttpUrl(link)) {
    fieldErrors.registrationLink = 'Enter a valid http(s) registration link.'
  }
  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors }
}

function introSentence(form, includeRegistrationInstructions) {
  const name = trim(form.conferenceName)
  const dates = trim(form.eventDates)
  let sentence = 'Thank you for helping staff the DevRel booth'
  if (name) sentence += ` at ${name}`
  if (dates) sentence += ` on ${dates}`
  sentence += '! I wanted to share some preliminary details'
  if (includeRegistrationInstructions) sentence += ' and registration instructions'
  sentence += '.'
  return sentence
}

function overviewItems(form) {
  const items = []
  const dates = trim(form.eventDates)
  const location = trim(form.location)
  const sponsorship = trim(form.sponsorshipDetails)
  if (dates) items.push(['Dates', dates])
  if (location) items.push(['Location', location])
  if (sponsorship) items.push(['Elastic sponsorship', sponsorship])
  return items
}

function renderMessage(text) {
  const parts = noteParagraphs(text)
  return {
    html: parts.map((part) => `<p>${escapeMultiline(part)}</p>`).join(''),
    plain: parts.join('\n\n'),
  }
}

function noteParagraphs(note) {
  return trim(note)
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function escapeMultiline(text) {
  return escapeHtml(text).replace(/\n/g, '<br>')
}

/**
 * Turn the first matching registration label or URL into an anchor.
 * @param {string} text
 * @param {string} linkText
 * @param {string} url
 * @returns {{ html: string, plain: string, linked: boolean }}
 */
function linkifySegment(text, linkText, url) {
  const raw = String(text || '')
  const href = isValidHttpUrl(url) ? trim(url) : ''
  const label = trim(linkText)
  if (href && label && raw.includes(label)) {
    const index = raw.indexOf(label)
    return {
      linked: true,
      html:
        escapeHtml(raw.slice(0, index)) +
        `<a href="${escapeHtmlAttr(href)}">${escapeHtml(label)}</a>` +
        escapeHtml(raw.slice(index + label.length)),
      plain: `${raw.slice(0, index)}${label} (${href})${raw.slice(index + label.length)}`,
    }
  }
  if (href && raw.includes(href)) {
    const index = raw.indexOf(href)
    return {
      linked: true,
      html:
        escapeHtml(raw.slice(0, index)) +
        `<a href="${escapeHtmlAttr(href)}">${escapeHtml(href)}</a>` +
        escapeHtml(raw.slice(index + href.length)),
      plain: raw,
    }
  }
  return { linked: false, html: escapeHtml(raw), plain: raw }
}

/**
 * @param {string} text
 * @returns {Array<{ type: 'p', lines: string[] } | { type: 'ol' | 'ul', items: string[] }>}
 */
function parseInstructionBlocks(text) {
  const blocks = []
  let current = null
  const push = () => {
    if (current) blocks.push(current)
    current = null
  }
  String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .forEach((line) => {
      if (!trim(line)) {
        push()
        return
      }
      const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/)
      const unordered = line.match(/^\s*[-*]\s+(.*)$/)
      if (ordered) {
        if (!current || current.type !== 'ol') {
          push()
          current = { type: 'ol', items: [] }
        }
        current.items.push(ordered[1])
      } else if (unordered) {
        if (!current || current.type !== 'ul') {
          push()
          current = { type: 'ul', items: [] }
        }
        current.items.push(unordered[1])
      } else {
        if (!current || current.type !== 'p') {
          push()
          current = { type: 'p', lines: [] }
        }
        current.lines.push(trim(line))
      }
    })
  push()
  return blocks
}

/**
 * @param {string} text
 * @param {string} linkText
 * @param {string} url
 * @returns {{ html: string, plain: string }}
 */
function renderInstructions(text, linkText, url) {
  let linked = false
  const renderPiece = (value) => {
    if (linked) return { html: escapeHtml(value), plain: value }
    const piece = linkifySegment(value, linkText, url)
    if (piece.linked) linked = true
    return piece
  }

  const html = []
  const plainBlocks = []
  parseInstructionBlocks(text).forEach((block) => {
    if (block.type === 'p') {
      const pieces = block.lines.map((line) => renderPiece(line))
      html.push(`<p>${pieces.map((piece) => piece.html).join('<br>')}</p>`)
      plainBlocks.push(pieces.map((piece) => piece.plain).join('\n'))
      return
    }
    const pieces = block.items.map((item) => renderPiece(item))
    const tag = block.type === 'ol' ? 'ol' : 'ul'
    html.push(`<${tag}>${pieces.map((piece) => `<li>${piece.html}</li>`).join('')}</${tag}>`)
    plainBlocks.push(
      pieces
        .map((piece, index) => `${block.type === 'ol' ? `${index + 1}. ` : '- '}${piece.plain}`)
        .join('\n'),
    )
  })
  return { html: html.join(''), plain: plainBlocks.join('\n\n') }
}

/**
 * @param {Record<string, unknown>} form
 * @returns {{ subject: string, plain: string, html: string }}
 */
export function generatePreliminaryBoothStaffEmail(form) {
  const normalized = withDerivedFields(form || {})
  const subject =
    typeof normalized.subject === 'string' ? normalized.subject : defaultSubject(normalized.conferenceName)
  const teamAlreadyRegistered = normalized.registrationMode === REGISTRATION_MODE_ALREADY
  const instructions = trim(normalized.registrationInstructions)
  const registeredMessage = trim(normalized.alreadyRegisteredMessage)
  const hasSelfRegistration = !teamAlreadyRegistered && Boolean(instructions)
  const hasRegisteredNote = teamAlreadyRegistered && Boolean(registeredMessage)
  const intro = introSentence(normalized, hasSelfRegistration)
  const overview = overviewItems(normalized)
  const notes = noteParagraphs(normalized.additionalNote)
  const sender = trim(normalized.senderName)
  const rendered = hasSelfRegistration
    ? renderInstructions(
        normalized.registrationInstructions,
        trim(normalized.registrationLinkText),
        trim(normalized.registrationLink),
      )
    : hasRegisteredNote
      ? renderMessage(registeredMessage)
      : { html: '', plain: '' }

  const plainLines = ['Hi team,', '', intro]
  const htmlParts = ['<p>Hi team,</p>', `<p>${escapeHtml(intro)}</p>`]

  if (hasSelfRegistration || hasRegisteredNote) {
    plainLines.push('', '🎟️ Registration', '', rendered.plain)
    htmlParts.push('<p><strong>🎟️ Registration</strong></p>', rendered.html)
  }

  if (overview.length) {
    plainLines.push('', 'Event Overview', '')
    overview.forEach(([label, value]) => plainLines.push(`- ${label}: ${value}`))
    htmlParts.push(
      '<p><strong>Event Overview</strong></p>',
      `<ul>${overview.map(([label, value]) => `<li>${escapeHtml(label)}: ${escapeHtml(value)}</li>`).join('')}</ul>`,
    )
  }

  plainLines.push('', 'Booth Staffing and Logistics', '', LOGISTICS_PARAGRAPH)
  htmlParts.push('<p><strong>Booth Staffing and Logistics</strong></p>', `<p>${escapeHtml(LOGISTICS_PARAGRAPH)}</p>`)

  notes.forEach((note) => {
    plainLines.push('', note)
    htmlParts.push(`<p>${escapeMultiline(note)}</p>`)
  })

  plainLines.push('', 'Thanks again for your help!')
  htmlParts.push('<p>Thanks again for your help!</p>')
  if (sender) {
    plainLines.push(sender)
    htmlParts.push(`<p>${escapeHtml(sender)}</p>`)
  }

  return {
    subject,
    plain: plainLines.join('\n'),
    html: htmlParts.join(''),
  }
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}

function inlineToPlain(value) {
  let s = String(value || '')
  s = s.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
    const label = decodeHtml(text.replace(/<[^>]+>/g, '')).trim()
    const url = decodeHtml(href).trim()
    if (!url || label.includes(url)) return label
    return `${label} (${url})`
  })
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<[^>]+>/g, '')
  return decodeHtml(s)
}

/**
 * Plain-text fallback for an edited email body. Keeps list numbers and anchor URLs.
 * @param {string} html
 * @returns {string}
 */
export function preliminaryBoothStaffHtmlToPlain(html) {
  let s = String(html || '')
  s = s.replace(/<ol[^>]*>[\s\S]*?<\/ol>/gi, (list) => {
    const items = []
    list.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
      items.push(`${items.length + 1}. ${inlineToPlain(inner).trim()}`)
      return ''
    })
    return `\n${items.join('\n')}\n`
  })
  s = s.replace(/<ul[^>]*>[\s\S]*?<\/ul>/gi, (list) => {
    const items = []
    list.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
      items.push(`- ${inlineToPlain(inner).trim()}`)
      return ''
    })
    return `\n${items.join('\n')}\n`
  })
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/p>/gi, '\n\n')
  s = s.replace(/<p[^>]*>/gi, '')
  s = s.replace(/<[^>]+>/g, '')
  s = decodeHtml(s)
  return s
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Copy the email as text/html + text/plain, falling back to plain text.
 * @param {{ html?: string, plain?: string }} payload
 * @param {{ clipboard?: Clipboard, ClipboardItem?: typeof ClipboardItem }} [deps]
 * @returns {Promise<'html' | 'plain'>}
 */
export function copyPreliminaryBoothStaffEmailToClipboard(payload, deps) {
  return copyMeetupFollowUpEmailToClipboard(payload, deps)
}
