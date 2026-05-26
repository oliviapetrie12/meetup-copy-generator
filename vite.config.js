import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Meetup/Luma URL fetch API is temporarily disabled (see `src/eventUrlImport/DISABLED.md`).
 * To restore dev-only proxy: import `fetchEventHtmlSafe` from `./lib/eventFetchCore.mjs`
 * and register `POST /api/fetch-event-page` in `configureServer` (see git history).
 */

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
