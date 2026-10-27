/**
 * Per-generator drafts stored in localStorage on this device.
 * Each generator uses its own key. Generated output is not stored here.
 */

export function readDraft(key) {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeDraft(key, value) {
  try {
    if (typeof localStorage === 'undefined') return false
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/**
 * Copy known fields from a saved record onto a defaults object.
 * Unknown keys and mismatched types are ignored so an old draft cannot
 * change the shape of the form.
 */
export function mergeDraftRecord(initial, saved) {
  const next = { ...initial }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return next
  for (const key of Object.keys(initial)) {
    const incoming = saved[key]
    const current = initial[key]
    if (incoming === undefined) continue
    if (typeof current === 'boolean') {
      if (typeof incoming === 'boolean') next[key] = incoming
    } else if (typeof current === 'string') {
      if (typeof incoming === 'string') next[key] = incoming
    } else if (typeof current === 'number') {
      if (typeof incoming === 'number') next[key] = incoming
    } else if (Array.isArray(current)) {
      if (Array.isArray(incoming)) next[key] = incoming
    } else if (current && typeof current === 'object') {
      if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
        next[key] = { ...current, ...incoming }
      }
    }
  }
  return next
}

function normalizeForCompare(value) {
  if (Array.isArray(value)) return value.map(normalizeForCompare)
  if (value && typeof value === 'object') {
    const out = {}
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined) continue
      out[key] = normalizeForCompare(value[key])
    }
    return out
  }
  return value
}

export function draftsEqual(a, b) {
  return JSON.stringify(normalizeForCompare(a)) === JSON.stringify(normalizeForCompare(b))
}
