import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fetchEventHtmlSafe } from './lib/eventFetchCore.mjs'

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function fetchEventPageApiPlugin() {
  return {
    name: 'fetch-event-page-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0] || ''
        if (path !== '/api/fetch-event-page' || req.method !== 'POST') {
          return next()
        }
        try {
          const raw = await readRequestBody(req)
          const json = JSON.parse(raw || '{}')
          const { url } = json
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
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), fetchEventPageApiPlugin()],
})
