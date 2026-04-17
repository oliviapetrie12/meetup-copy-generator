/**
 * Conservative extraction from pasted exhibitor/organizer text for Conference KBYG.
 * Assigns only on clear keyword or strong contextual signals — no guessing.
 * Unmatched chunks go to Additional Notes (merged separately).
 */

function trim(s) {
  return typeof s === 'string' ? s.trim() : ''
}

function collapseLines(parts) {
  return parts
    .flatMap((p) => (typeof p === 'string' ? p.split(/\n/) : []))
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

/** Split on blank lines; split long single blocks by lines that look like section headers */
function splitIntoChunks(raw) {
  const text = trim(raw)
  if (!text) return []
  let parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  if (parts.length === 1 && parts[0].length > 400) {
    const lines = parts[0].split(/\n/)
    const chunks = []
    let buf = []
    const headerLine =
      /^(parking|booth|setup|teardown|wifi|wi[\s-]?fi|shipping|freight|venue|location|address|badge|check[\s-]?in|food|lead|staffing|hours|exhibit)\b/i
    for (const line of lines) {
      if (headerLine.test(line.trim()) && buf.length) {
        chunks.push(buf.join('\n').trim())
        buf = [line]
      } else buf.push(line)
    }
    if (buf.length) chunks.push(buf.join('\n').trim())
    if (chunks.length > 1) parts = chunks
  }
  return parts
}

const FIRST_LINE = (p) => {
  const lines = p.split(/\n/).map((l) => l.trim())
  return lines.find(Boolean) || ''
}

/** High-confidence bucket only; otherwise null (caller sends chunk to Additional Notes). */
function primaryBucketForChunk(p) {
  const ll = p.toLowerCase()
  const first = FIRST_LINE(p).toLowerCase()

  if (
    /^parking\s*:/i.test(first) ||
    /^parking\b/i.test(first) ||
    /\bparking\s+(lot|garage|deck|structure|pass|permit|valet|rate|fee|free)\b/i.test(ll) ||
    /\bvalet\s+parking\b/i.test(ll) ||
    /\bparking\s+is\b/i.test(ll)
  ) {
    return 'parkingText'
  }

  if (
    /\bexhibit\s+hall\s+hours\b/i.test(ll) ||
    /\b(booth|exhibit|expo|show|hall)\s+hours\b/i.test(ll) ||
    /\b(hall|exhibit|expo|show)\s+hours\b/i.test(ll) ||
    /\bhours\s+of\s+operation\b/i.test(ll) ||
    /^hours\s*:/i.test(first)
  ) {
    return 'eventDatesBoothHours'
  }

  if (
    /\b(move[\s-]?in|move-in|exhibitor\s+setup|booth\s+setup|installation\s+(begins|opens|hours))\b/i.test(ll) ||
    /^setup\s*:/i.test(first) ||
    /^move[\s-]?in\s*:/i.test(first)
  ) {
    if (/\d{1,2}:\d{2}|\b(am|pm)\b|\b(mon|tues|wednes|thurs|fri|satur|sun)day?\b/i.test(ll)) {
      return 'eventDatesBoothSetup'
    }
    return null
  }

  if (
    /\b(teardown|strike|move[\s-]?out|load[\s-]?out|dismantle|pack[\s-]?out)\b/i.test(ll) ||
    /^teardown\s*:/i.test(first) ||
    /^strike\s*:/i.test(first)
  ) {
    return 'eventDatesBoothCleanup'
  }

  if (
    /\b(drayage|advance\s+warehouse|material\s+handling)\b/i.test(ll) ||
    /\b(return\s+(shipment|label|freight))\b/i.test(ll) ||
    /\bmarshalling\s+yard\b/i.test(ll) ||
    (/\bfreight\b/i.test(ll) && /\b(exhibitor|booth|crate|pallet|dock|deliver)\b/i.test(ll)) ||
    (/\bshipping\b/i.test(ll) && /\b(booth|exhibitor|crate|freight|warehouse)\b/i.test(ll))
  ) {
    return 'eventDatesNotes'
  }

  if (
    /\bwi-?fi\b/i.test(ll) ||
    /\bwireless\b/i.test(ll) ||
    /\bssid\b/i.test(ll) ||
    /\bnetwork\s+password\b/i.test(ll) ||
    /\bethernet\b/i.test(ll) ||
    /\binternet\s+access\b/i.test(ll)
  ) {
    return 'avSetupRequirements'
  }

  if (/\blead\s+capture\b/i.test(ll) || /\bbadge\s+scan/i.test(ll) || /\bcapture\s+leads\b/i.test(ll) || /\bscan\s+leads\b/i.test(ll)) {
    return 'leadCaptureText'
  }

  if (/^(venue|location|exhibitor\s+location)\s*:/i.test(first)) {
    return 'locationMixed'
  }

  if (/^address\s*:/i.test(first)) {
    return 'locationAddressOnly'
  }

  const lines = p.split(/\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length >= 2) {
    const line2 = lines[1].toLowerCase()
    if (!/^\d/.test(lines[0]) && /^\d+\s/.test(lines[1]) && /(street|st\.|avenue|ave|road|rd|boulevard|blvd|drive|dr|way|lane|court|plaza|blvd\.)/i.test(line2)) {
      return 'locationMixed'
    }
  }

  if (
    /\b(badge\s+pickup|check[\s-]?in|registration|credential|exhibitor\s+pass|will\s+call|ticket\s+pickup)\b/i.test(ll)
  ) {
    return 'ticketsText'
  }

  if (/\b(catering|breakfast|lunch|snacks?|beverage|meals?\s+included|food\s+service|coffee\s+service)\b/i.test(ll)) {
    return 'foodBeverageText'
  }

  if (/\b(booth\s+coverage|staff\s+schedule|staffing\s+plan|shift\s+schedule)\b/i.test(ll) || /\bstaging\s+staff\b/i.test(ll)) {
    return 'staffingScheduleNotes'
  }

  return null
}

/** Only split when we already classified locationMixed with a clear structure */
function splitLocationChunk(p) {
  const first = FIRST_LINE(p)
  const venueMatch = first.match(/^(?:venue|location|exhibitor\s+location)\s*:\s*(.*)$/i)
  if (venueMatch) {
    const rest = p.slice(first.length).replace(/^\s*\n/, '')
    const addrMatch = rest.match(/^address\s*:\s*(.+)/is)
    if (addrMatch) {
      return { venue: trim(venueMatch[1]), address: trim(addrMatch[1]) }
    }
    const restLines = rest.split(/\n/).map((l) => l.trim()).filter(Boolean)
    if (restLines.length) {
      return { venue: trim(venueMatch[1]), address: restLines.join('\n') }
    }
    return { venue: trim(venueMatch[1]), address: '' }
  }

  const lines = p.split(/\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length >= 2 && !/^\d/.test(lines[0]) && /^\d+\s/.test(lines[1])) {
    return { venue: lines[0], address: lines.slice(1).join('\n') }
  }

  return { venue: p, address: '' }
}

function splitAddressOnlyChunk(p) {
  const m = p.match(/^address\s*:\s*(.+)/is)
  return m ? trim(m[1]) : trim(p)
}

/**
 * @returns {Record<string, string>} String fields plus optional additionalOrganizerNotes
 */
export function parseOrganizerDetails(raw) {
  const chunks = splitIntoChunks(raw)
  if (chunks.length === 0) return {}

  const buckets = {
    parkingText: [],
    eventDatesBoothHours: [],
    eventDatesBoothSetup: [],
    eventDatesBoothCleanup: [],
    eventDatesNotes: [],
    avSetupRequirements: [],
    leadCaptureText: [],
    locationVenue: [],
    locationAddress: [],
    ticketsText: [],
    foodBeverageText: [],
    staffingScheduleNotes: [],
  }
  const additional = []

  for (const p of chunks) {
    const bucket = primaryBucketForChunk(p)
    if (bucket === 'locationMixed') {
      const { venue, address } = splitLocationChunk(p)
      if (venue) buckets.locationVenue.push(venue)
      if (address) buckets.locationAddress.push(address)
      continue
    }
    if (bucket === 'locationAddressOnly') {
      const addr = splitAddressOnlyChunk(p)
      if (addr) buckets.locationAddress.push(addr)
      continue
    }
    if (bucket && buckets[bucket]) {
      buckets[bucket].push(p)
      continue
    }
    additional.push(p)
  }

  const out = {}
  for (const [key, arr] of Object.entries(buckets)) {
    const s = collapseLines(arr)
    if (s) out[key] = s
  }
  if (additional.length) {
    out.additionalOrganizerNotes = additional.join('\n\n')
  }
  return out
}

const ADDITIONAL_NOTES_TITLE = 'Additional Notes'

/**
 * Merge parsed strings into previous form; only fills keys where previous string field is empty.
 * Appends parsed unmatched text to an "Additional Notes" section when that section's content is empty.
 */
export function mergeOrganizerParsedIntoForm(prev, parsed) {
  const next = { ...prev }
  for (const [key, val] of Object.entries(parsed)) {
    if (key === 'additionalOrganizerNotes') continue
    if (val == null || trim(String(val)) === '') continue
    const cur = prev[key]
    if (typeof cur !== 'string' || trim(cur) !== '') continue
    next[key] = String(val).trim()
  }

  const notes = parsed.additionalOrganizerNotes
  if (notes == null || trim(String(notes)) === '') return next

  const incoming = String(notes).trim()
  const sections = [...(prev.additionalSections || [])]
  const idx = sections.findIndex((s) => trim(s.title).toLowerCase() === ADDITIONAL_NOTES_TITLE.toLowerCase())

  if (idx >= 0) {
    const cur = trim(sections[idx].content)
    if (cur === '') {
      sections[idx] = { ...sections[idx], content: incoming }
      next.additionalSections = sections
    }
  } else {
    next.additionalSections = [...sections, { title: ADDITIONAL_NOTES_TITLE, content: incoming }]
  }

  return next
}
