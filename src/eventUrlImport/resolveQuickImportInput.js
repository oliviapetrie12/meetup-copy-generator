import { extractImportedContent } from './extractImportedContent.js'
import { fetchEventPageHtml } from './fetchEventPage.js'
import {
  detectPlatform,
  looksLikeHttpUrl,
  normalizeEventImportUrl,
} from './platformRegistry.js'

/**
 * @typedef {{
 *   kind: 'paste'
 *   text: string
 *   urlMeta?: undefined
 * } | {
 *   kind: 'url'
 *   text: string
 *   urlMeta: { platform: string, pageUrl: string, partial: boolean, extractionNotes: string[] }
 * } | {
 *   kind: 'error'
 *   code: string
 *   message?: string
 * }} ResolvedQuickImport
 */

/**
 * @param {string} rawInput
 * @returns {Promise<ResolvedQuickImport>}
 */
export async function resolveQuickImportInput(rawInput) {
  const trimmed = String(rawInput || '').trim()
  if (!trimmed) {
    return { kind: 'error', code: 'EMPTY' }
  }

  if (!looksLikeHttpUrl(trimmed)) {
    return { kind: 'paste', text: trimmed }
  }

  const normalized = normalizeEventImportUrl(trimmed)
  let platform
  try {
    platform = detectPlatform(normalized)
  } catch {
    return { kind: 'error', code: 'INVALID_URL' }
  }

  if (platform === 'unknown') {
    return { kind: 'error', code: 'UNSUPPORTED_PLATFORM' }
  }

  try {
    const { html, finalUrl, platform: plat } = await fetchEventPageHtml(normalized)
    const extracted = extractImportedContent(html, { platform: plat, pageUrl: finalUrl })
    return {
      kind: 'url',
      text: extracted.text,
      urlMeta: {
        platform: plat,
        pageUrl: finalUrl,
        partial: extracted.partial,
        extractionNotes: extracted.notes,
      },
    }
  } catch (e) {
    const code = /** @type {{ code?: string }} */ (e)?.code || 'FETCH_FAILED'
    return {
      kind: 'error',
      code,
      message: typeof e?.message === 'string' ? e.message : undefined,
    }
  }
}
