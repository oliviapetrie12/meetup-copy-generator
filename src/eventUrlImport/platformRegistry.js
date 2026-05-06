/**
 * Shared allowlist + platform detection for Meetup / Luma URL import.
 * Used by client UI and server-side fetch (must stay in sync — single source).
 */

/** @typedef {'meetup' | 'luma' | 'unknown'} EventPlatform */

export const FETCH_TIMEOUT_MS = 18_000
export const MAX_HTML_BYTES = 2_500_000

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeEventImportUrl(raw) {
  let u = String(raw || '').trim()
  if (!u) return ''
  if (/^www\./i.test(u)) u = `https://${u}`
  return u
}

/**
 * Hosts allowed for server-side HTML fetch (anti-SSRF guardrail).
 * @param {URL} url
 */
export function isAllowedEventFetchHost(url) {
  const host = url.hostname.toLowerCase()
  if (host === 'lu.ma' || host.endsWith('.lu.ma')) return true
  if (host === 'luma.com' || host.endsWith('.luma.com')) return true
  if (host.endsWith('meetup.com')) return true
  return false
}

/**
 * @param {string} urlString normalized absolute URL
 * @returns {EventPlatform}
 */
export function detectPlatform(urlString) {
  try {
    const u = new URL(urlString)
    const host = u.hostname.toLowerCase()
    if (host.endsWith('meetup.com')) return 'meetup'
    if (host === 'lu.ma' || host.endsWith('.lu.ma') || host.endsWith('luma.com')) return 'luma'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * True if the trimmed input looks like an HTTP(S) URL users paste for import.
 * @param {string} s
 */
export function looksLikeHttpUrl(s) {
  const t = String(s || '').trim()
  if (!t || t.includes('\n')) return false
  if (/^https?:\/\//i.test(t)) return true
  if (/^www\.[^\s]+\.[^\s]+/i.test(t)) return true
  return false
}
