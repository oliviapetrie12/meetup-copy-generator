import { languageInstruction, FORMAT_RULE, eventPageRemotePrompt } from './generationLanguage.js'

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

/** Normalize successful API payloads into plain + html for Meetup event page. */
export function applyRemoteEventPageResult(data) {
  if (!data || typeof data !== 'object') return null
  if (typeof data.plain === 'string' && data.plain.trim()) {
    return { plain: data.plain, html: typeof data.html === 'string' ? data.html : '' }
  }
  if (typeof data.output === 'string' && data.output.trim()) {
    return { plain: data.output, html: typeof data.html === 'string' ? data.html : '' }
  }
  return null
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
