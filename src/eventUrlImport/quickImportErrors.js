/**
 * Map fetch/import error codes to localized strings from formTranslations.
 * @param {Record<string, string>} t
 * @param {string} code
 */
export function formatQuickImportFetchError(t, code) {
  const key = `kbyg_quickImportErr_${code}`
  const msg = t[key]
  if (typeof msg === 'string' && msg.trim()) return msg
  return String(t.kbyg_quickImportErr_generic || '')
    .replace(/\{\{code\}\}/g, code || 'unknown')
}
