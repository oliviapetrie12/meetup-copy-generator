/**
 * Server-only: validate URLs (SSRF-safe allowlist) and fetch raw HTML.
 * Used by Vite dev middleware and Vercel `api/fetch-event-page`.
 */

import {
  FETCH_TIMEOUT_MS,
  MAX_HTML_BYTES,
  detectPlatform,
  isAllowedEventFetchHost,
  normalizeEventImportUrl,
} from '../src/eventUrlImport/platformRegistry.js'

const UA =
  'Mozilla/5.0 (compatible; MeetupCopyGenerator/1.0; +https://github.com/oliviapetrie12/meetup-copy-generator)'

/**
 * @param {string} rawUrl
 * @returns {{ url: string, platform: ReturnType<typeof detectPlatform> }}
 */
export function validateAndNormalizeFetchUrl(rawUrl) {
  const normalized = normalizeEventImportUrl(rawUrl)
  if (!normalized) {
    const err = new Error('INVALID_URL')
    err.code = 'INVALID_URL'
    throw err
  }
  let parsed
  try {
    parsed = new URL(normalized)
  } catch {
    const err = new Error('INVALID_URL')
    err.code = 'INVALID_URL'
    throw err
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    const err = new Error('UNSUPPORTED_PROTOCOL')
    err.code = 'UNSUPPORTED_PROTOCOL'
    throw err
  }
  if (!isAllowedEventFetchHost(parsed)) {
    const err = new Error('UNSUPPORTED_PLATFORM')
    err.code = 'UNSUPPORTED_PLATFORM'
    throw err
  }
  const platform = detectPlatform(parsed.href)
  if (platform === 'unknown') {
    const err = new Error('UNSUPPORTED_PLATFORM')
    err.code = 'UNSUPPORTED_PLATFORM'
    throw err
  }
  return { url: parsed.href, platform }
}

/**
 * @param {string} rawUrl
 * @returns {Promise<{ html: string, finalUrl: string, platform: string }>}
 */
export async function fetchEventHtmlSafe(rawUrl) {
  const { url, platform } = validateAndNormalizeFetchUrl(rawUrl)

  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)

  let res
  try {
    res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ac.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
  } catch (e) {
    const err = new Error(e?.name === 'AbortError' ? 'FETCH_TIMEOUT' : 'FETCH_FAILED')
    err.code = e?.name === 'AbortError' ? 'FETCH_TIMEOUT' : 'FETCH_FAILED'
    throw err
  } finally {
    clearTimeout(t)
  }

  const ct = res.headers.get('content-type') || ''
  if (!res.ok) {
    const err = new Error('HTTP_ERROR')
    err.code = 'HTTP_ERROR'
    err.status = res.status
    throw err
  }
  if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
    const err = new Error('NOT_HTML')
    err.code = 'NOT_HTML'
    throw err
  }

  const buf = await res.arrayBuffer()
  if (buf.byteLength > MAX_HTML_BYTES) {
    const err = new Error('RESPONSE_TOO_LARGE')
    err.code = 'RESPONSE_TOO_LARGE'
    throw err
  }

  const html = new TextDecoder('utf-8').decode(buf)

  return {
    html,
    finalUrl: res.url || url,
    platform,
  }
}
