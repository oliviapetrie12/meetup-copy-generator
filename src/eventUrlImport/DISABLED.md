# Meetup / Luma URL import (temporarily disabled)

The KBYG **Quick Import** field is **paste-only** (Meetup/Luma page **text**). Direct URL fetching is turned off to keep the parser stable while it evolves.

## What stays in the repo

| Piece | Role |
|--------|------|
| `src/eventUrlImport/*` | Platform allowlist, HTML → text extraction, client fetch helper |
| `lib/eventFetchCore.mjs` | SSRF-safe server fetch |
| `api/fetch-event-page.js` | Vercel handler (`POST` JSON `{ "url": "…" }`) |

## Re-enable checklist

1. **`App.jsx`** — Import `resolveQuickImportInput` (and errors/registry as needed). Restore async handler: resolve URL → `extractImportedContent` → `parseKbygQuickImport(text)`.
2. **`vite.config.js`** — Re-add `configureServer` middleware for `POST /api/fetch-event-page` (see git history before URL removal).
3. **Translations** — Restore URL-oriented hints / errors in `formTranslations.js` if desired.
4. **Deploy** — Ensure production hosts the same POST route (e.g. Vercel `api/fetch-event-page.js`).

Optional: gate behind `import.meta.env.VITE_ENABLE_EVENT_URL_IMPORT === 'true'` so paste-only remains the default.
