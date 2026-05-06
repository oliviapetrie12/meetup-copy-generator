/**
 * Client: POST to same-origin fetch API (Vite dev middleware or deployed serverless).
 */

/**
 * @returns {Promise<{ html: string, finalUrl: string, platform: string }>}
 */
export async function fetchEventPageHtml(urlString) {
  const apiPath =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EVENT_FETCH_API) ||
    '/api/fetch-event-page'

  let res
  try {
    res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlString }),
    })
  } catch {
    const err = new Error('NETWORK')
    err.code = 'NETWORK'
    throw err
  }

  const ct = res.headers.get('content-type') || ''
  const isJson = ct.includes('application/json')
  const payload = isJson ? await res.json().catch(() => ({})) : {}

  if (!res.ok) {
    const err = new Error(payload.message || res.statusText || 'HTTP_ERROR')
    err.code = payload.code || 'HTTP_ERROR'
    err.status = res.status
    throw err
  }

  if (!payload.ok || typeof payload.html !== 'string') {
    const err = new Error(payload.message || 'BAD_RESPONSE')
    err.code = payload.code || 'BAD_RESPONSE'
    throw err
  }

  return {
    html: payload.html,
    finalUrl: typeof payload.finalUrl === 'string' ? payload.finalUrl : urlString,
    platform: typeof payload.platform === 'string' ? payload.platform : 'unknown',
  }
}
