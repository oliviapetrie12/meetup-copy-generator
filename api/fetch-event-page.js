/**
 * Vercel / Node serverless: proxy-fetch allowed event pages (Meetup, Luma).
 *
 * STATUS: Deployable but unused — KBYG Quick Import no longer calls this endpoint.
 * See `src/eventUrlImport/DISABLED.md` to re-enable with the SPA + `vite.config.js`.
 */

import { fetchEventHtmlSafe } from '../lib/eventFetchCore.mjs'

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Allow', 'POST')
    res.end()
    return
  }

  try {
    const raw = await readBody(req)
    const json = JSON.parse(raw || '{}')
    const url = json.url
    const result = await fetchEventHtmlSafe(url)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: true, ...result }))
  } catch (e) {
    const code = /** @type {{ code?: string }} */ (e)?.code || 'FETCH_FAILED'
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        ok: false,
        code,
        message: typeof e?.message === 'string' ? e.message : String(e),
      }),
    )
  }
}
