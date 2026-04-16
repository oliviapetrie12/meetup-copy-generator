/**
 * Best-effort extraction from pasted exhibitor/organizer text for Conference KBYG.
 * Returns plain-string fields only — caller merges with mergeOrganizerParsedIntoForm (empty fields only).
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

/** Split on blank lines; also split long single blocks by lines starting with common headers */
function splitIntoChunks(raw) {
  const text = trim(raw)
  if (!text) return []
  let parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  if (parts.length === 1 && parts[0].length > 400) {
    const lines = parts[0].split(/\n/)
    const chunks = []
    let buf = []
    const headerLine = /^(parking|booth|setup|teardown|wifi|wi-fi|shipping|venue|location|address|badge|check[\s-]?in|food|lead|staffing|arrival|dock)\b/i
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

function primaryBucketForChunk(p) {
  const ll = p.toLowerCase()

  if (/^parking\b|^lot |parking:|garage|valet|parking permit/i.test(ll) || (/\bparking\b/.test(ll) && /lot|garage|deck|valet|free|\$/.test(ll)))
    return 'parkingText'

  if (/booth hours|exhibit hall hours|show hours|hall hours|floor hours|hours of operation|expo hours/i.test(ll))
    return 'eventDatesBoothHours'

  if (
    /setup|move[\s-]?in|build[\s-]?out|installation|ribbon cutting/i.test(ll) &&
    (/\d{1,2}:\d{2}|am\b|pm\b|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(ll) || /hour/i.test(ll))
  )
    return 'eventDatesBoothSetup'

  if (/teardown|strike|move[\s-]?out|load[\s-]?out|dismantle|pack[\s-]?out/i.test(ll)) return 'eventDatesBoothCleanup'

  if (/ship|freight|drayage|advance warehouse|material handling|return shipment|crate|pallet|marshalling yard/i.test(ll))
    return 'eventDatesNotes'

  if (/wi-?fi|wireless|ssid|internet access|network password|ethernet/i.test(ll)) return 'avSetupRequirements'

  if (/lead capture|badge scan|scanner|crm|capture leads|scan leads/i.test(ll)) return 'leadCaptureText'

  if (/^venue|^location:|^address:|convention center|expo hall|hall [a-z]/i.test(ll) || (/\bvenue\b/.test(ll) && /hall|center|convention/i.test(ll)))
    return 'locationMixed'

  if (/badge|check[\s-]?in|registration|credential|exhibitor pass|will call|ticket pickup/i.test(ll)) return 'ticketsText'

  if (/arrival|loading dock|dock door|freight door|entranc|marshalling/i.test(ll)) return 'ticketsText'

  if (/food|catering|coffee|breakfast|lunch|snack|beverage|meals included/i.test(ll)) return 'foodBeverageText'

  if (/staffing|shift|coverage|who.*booth(?! materials)/i.test(ll)) return 'staffingScheduleNotes'

  return null
}

function splitLocationChunk(p) {
  const lines = p.split(/\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length >= 2) {
    return { venue: lines[0], address: lines.slice(1).join('\n') }
  }
  const one = lines[0] || ''
  if (/^\d/.test(one) || (/,/.test(one) && !/^venue/i.test(one))) return { venue: '', address: one }
  const comma = one.indexOf(',')
  if (comma > 0 && comma < one.length - 3) {
    return { venue: one.slice(0, comma).trim(), address: one.slice(comma + 1).trim() }
  }
  return { venue: one, address: '' }
}

/**
 * @returns {Record<string, string>}
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

  for (const p of chunks) {
    const bucket = primaryBucketForChunk(p)
    if (bucket === 'locationMixed') {
      const { venue, address } = splitLocationChunk(p)
      if (venue) buckets.locationVenue.push(venue)
      if (address) buckets.locationAddress.push(address)
      continue
    }
    if (bucket && buckets[bucket]) {
      buckets[bucket].push(p)
      continue
    }
    if (/\bparking\b/i.test(p)) buckets.parkingText.push(p)
    else if (/\b(hour|am\b|pm\b|\d:\d)/i.test(p) && /booth|hall|exhibit|show/i.test(p)) buckets.eventDatesBoothHours.push(p)
    else buckets.eventDatesNotes.push(p)
  }

  const out = {}
  for (const [key, arr] of Object.entries(buckets)) {
    const s = collapseLines(arr)
    if (s) out[key] = s
  }
  return out
}

/**
 * Merge parsed strings into previous form; only fills keys where previous string field is empty.
 */
export function mergeOrganizerParsedIntoForm(prev, parsed) {
  const next = { ...prev }
  for (const [key, val] of Object.entries(parsed)) {
    if (val == null || trim(String(val)) === '') continue
    const cur = prev[key]
    if (typeof cur !== 'string' || trim(cur) !== '') continue
    next[key] = String(val).trim()
  }
  return next
}
