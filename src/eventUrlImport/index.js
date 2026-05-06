/**
 * Quick Import URL pipeline — extend with new platforms in `platformRegistry.js`
 * and (for server fetch) `lib/eventFetchCore.mjs` allowlist.
 */

export { extractImportedContent } from './extractImportedContent.js'
export { fetchEventPageHtml } from './fetchEventPage.js'
export {
  detectPlatform,
  looksLikeHttpUrl,
  normalizeEventImportUrl,
} from './platformRegistry.js'
export { resolveQuickImportInput } from './resolveQuickImportInput.js'
export { formatQuickImportFetchError } from './quickImportErrors.js'
