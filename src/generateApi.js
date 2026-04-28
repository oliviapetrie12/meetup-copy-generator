import {
  languageInstruction,
  FORMAT_RULE,
  eventPageRemotePrompt,
  meetupKbygRemotePrompt,
  conferenceKbygRemotePrompt,
} from './generationLanguage.js'

/**
 * @typedef {Object} EventPageRemoteSections
 * @property {string} [arrivalInstructions]
 * @property {string} [parking]
 * @property {string|string[]} [agenda]
 * @property {string} [meetupPageAgenda]
 */

/**
 * POST /api/generate — optional remote backend. Returns null if unavailable or invalid.
 * Validates JSON response shape so SPA fallback HTML is never pasted as “output”.
 */
export async function tryRemoteGenerate(body) {
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        instruction:
          body.generator === 'eventPage'
            ? eventPageRemotePrompt(body.language)
            : body.generator === 'meetupKbyg'
              ? meetupKbygRemotePrompt(body.language)
              : body.generator === 'conferenceKbyg'
                ? conferenceKbygRemotePrompt(body.language)
                : languageInstruction(body.language),
        formatRule: FORMAT_RULE,
      }),
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return null
    const data = await res.json()
    if (!data || typeof data !== 'object') return null
    return data
  } catch {
    return null
  }
}

/**
 * Translate existing generated text without re-running form generators.
 * Same endpoint contract; backend may implement action === 'translate'.
 */
export async function tryRemoteTranslate(text, targetLanguage) {
  return tryRemoteGenerate({
    action: 'translate',
    text,
    language: targetLanguage,
  })
}

/**
 * Escape text for safe HTML body (minimal entity set).
 * @param {string} s
 */
function escapeHtmlText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Fallback HTML when the API returns translated plain text but no HTML — avoids rebuilding from form (English).
 * @param {string} plain
 */
export function meetupPlainTextToHtml(plain) {
  const raw = String(plain || '').replace(/\r\n/g, '\n').trim()
  if (!raw) return ''
  const blocks = raw.split(/\n\n+/)
  const inner = blocks
    .map((block) => {
      const lines = block.split('\n')
      return `<p style="margin:0 0 0.75em;line-height:1.5;white-space:pre-wrap;">${escapeHtmlText(lines.join('\n')).replace(/\n/g, '<br>')}</p>`
    })
    .join('')
  return `<div class="meetup-page-generated" style="font-family:system-ui,sans-serif;">${inner}</div>`
}

/**
 * Extract optional structured fields from /api/generate JSON (top-level or `sections`).
 * @param {Record<string, unknown>} data
 * @returns {EventPageRemoteSections | null}
 */
export function extractEventPageStructured(data) {
  if (!data || typeof data !== 'object') return null
  const base = /** @type {Record<string, unknown>} */ (data)
  const sec =
    data.sections && typeof data.sections === 'object' && !Array.isArray(data.sections)
      ? /** @type {Record<string, unknown>} */ (data.sections)
      : {}
  const src = { ...base, ...sec }
  /** @type {EventPageRemoteSections} */
  const out = {}
  if (Object.prototype.hasOwnProperty.call(src, 'arrivalInstructions') && src.arrivalInstructions != null) {
    out.arrivalInstructions = String(src.arrivalInstructions)
  }
  if (Object.prototype.hasOwnProperty.call(src, 'parking') && src.parking != null) {
    out.parking = String(src.parking)
  }
  if (Object.prototype.hasOwnProperty.call(src, 'agenda') && src.agenda != null) {
    out.agenda = src.agenda
  }
  if (
    Object.prototype.hasOwnProperty.call(src, 'meetupPageAgenda') &&
    src.meetupPageAgenda != null &&
    out.agenda === undefined
  ) {
    out.meetupPageAgenda = String(src.meetupPageAgenda)
  }
  return Object.keys(out).length ? out : null
}

/**
 * Normalize successful API payloads into plain + html + optional structured fields for Meetup event page.
 * Supports `plain` | `output`, optional `html`, and structured `arrivalInstructions`, `parking`, `agenda` (array or string).
 */
export function applyRemoteEventPageResult(data) {
  if (!data || typeof data !== 'object') return null
  const structured = extractEventPageStructured(data)
  const plainRaw =
    typeof data.plain === 'string' ? data.plain : typeof data.output === 'string' ? data.output : ''
  const plain = plainRaw.trim()
  const html = typeof data.html === 'string' ? data.html : ''
  const hasStructured = structured && Object.keys(structured).length > 0
  if (!plain && !hasStructured && !html.trim()) return null
  return { plain, html, structured }
}

/** Normalize payload for KBYG-style generators (plain body + optional html). */
export function applyRemoteKbygResult(data) {
  if (!data || typeof data !== 'object') return null
  if (typeof data.plain === 'string') {
    return { plain: data.plain, html: typeof data.html === 'string' ? data.html : '' }
  }
  if (typeof data.output === 'string') {
    return { plain: data.output, html: typeof data.html === 'string' ? data.html : '' }
  }
  return null
}
