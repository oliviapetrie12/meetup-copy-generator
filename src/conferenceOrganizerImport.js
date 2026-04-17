/**
 * Organizer/sponsor import for Conference KBYG — multi-pass pipeline:
 * 1) chunk & group  →  2) classify (confidence)  →  3) route & format  →  dedupe
 * Chunks are classified once; no reassignment after classification.
 */

function trim(s) {
  return typeof s === 'string' ? s.trim() : ''
}

function firstNonEmptyLine(p) {
  const lines = p.split(/\n/).map((l) => l.trim())
  return lines.find(Boolean) || ''
}

/** Min score to accept a category (accuracy over completeness). */
const MIN_CLASSIFICATION_SCORE = 4

/** Min gap between best and second-best scores; smaller → treat as ambiguous. */
const MIN_SCORE_MARGIN = 2

/** Normalize heading line for synonym matching (does not change stored text). */
function normalizeHeadingLineForMatch(line) {
  return trim(line)
    .replace(/^#{1,3}\s+/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/**
 * Whitespace normalization for formatting pass.
 * @param {string} s
 */
export function formatChunkCleanly(s) {
  const t = trim(s.replace(/\r\n/g, '\n'))
  if (!t) return ''
  return t
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function collapseJoin(parts) {
  return parts
    .map((p) => formatChunkCleanly(p))
    .filter(Boolean)
    .join('\n\n')
}

/** @typedef {'keyContacts'|'eventVenue'|'foodBeverage'|'parkingTransportation'|'boothHours'|'setupMoveIn'|'teardownMoveOut'|'tickets'|'leadCapture'|'logisticsBoothInfo'|'additionalNotes'} OrganizerCategory */

const CATEGORY_ORDER = [
  'keyContacts',
  'teardownMoveOut',
  'setupMoveIn',
  'boothHours',
  'parkingTransportation',
  'leadCapture',
  'tickets',
  'logisticsBoothInfo',
  'foodBeverage',
  'eventVenue',
  'additionalNotes',
]

/**
 * Boost scores when the first line matches a known synonym for a standard category.
 * @param {Record<string, number>} score
 * @param {string} firstNorm
 */
function applyHeadingSynonyms(score, firstNorm) {
  const rules = [
    [/^(parking|transit|transportation|getting\s+there|rideshare)\b/, () => ((score.parkingTransportation = (score.parkingTransportation || 0) + 4))],
    [/^(venue|location|event\s+location|directions|map|floor\s+plan)\b/, () => ((score.eventVenue = (score.eventVenue || 0) + 4))],
    [/^(booth|exhibit|show|hall|demo)\s+(hours|times)\b/, () => ((score.boothHours = (score.boothHours || 0) + 5))],
    [/^(move[\s-]?in|setup|set[\s-]?up|installation)\b/, () => ((score.setupMoveIn = (score.setupMoveIn || 0) + 4))],
    [/^(teardown|move[\s-]?out|strike|load[\s-]?out)\b/, () => ((score.teardownMoveOut = (score.teardownMoveOut || 0) + 4))],
    [/^(tickets?|registration|badges?)\b/, () => ((score.tickets = (score.tickets || 0) + 4))],
    [/^(lead\s+capture|scanner|scanning)\b/, () => ((score.leadCapture = (score.leadCapture || 0) + 4))],
    [/^(shipping|freight|logistics|drayage|material\s+handling)\b/, () => ((score.logisticsBoothInfo = (score.logisticsBoothInfo || 0) + 4))],
    [/^(wifi|wi-?fi|network|internet)\b/, () => ((score.logisticsBoothInfo = (score.logisticsBoothInfo || 0) + 3))],
    [/^(contacts?|key\s+contacts?|organizer)\b/, () => ((score.keyContacts = (score.keyContacts || 0) + 4))],
    [/^(food|catering|meals|beverage)\b/, () => ((score.foodBeverage = (score.foodBeverage || 0) + 4))],
  ]
  for (const [re, fn] of rules) {
    if (re.test(firstNorm)) fn()
  }
}

function computeCategoryScores(chunk) {
  const ll = chunk.toLowerCase()
  const firstRaw = firstNonEmptyLine(chunk)
  const first = firstRaw.toLowerCase()
  const firstNorm = normalizeHeadingLineForMatch(firstRaw)

  /** @type {Record<string, number>} */
  const score = {}

  const add = (cat, w) => {
    score[cat] = (score[cat] || 0) + w
  }

  applyHeadingSynonyms(score, firstNorm)

  if (/\bkey\s+contacts?\b/i.test(ll) || /^contacts?\s*:/i.test(first)) add('keyContacts', 6)
  if (/\b(exhibitor\s+services|show\s+manager|onsite\s+contact|organizer\s+contact)\b/i.test(ll)) add('keyContacts', 5)
  if (/\bcontact\s+(name|info|details)\b/i.test(ll)) add('keyContacts', 3)

  if (/^(venue|location|event\s+location|address)\s*:/i.test(first)) add('eventVenue', 6)
  if (/\b(convention\s+center|expo\s+hall|exhibit\s+hall|conference\s+center)\b/i.test(ll)) add('eventVenue', 4)
  if (/\b(directions|wayfinding|map|floor\s+plan)\b/i.test(ll)) add('eventVenue', 4)

  if (/\b(catering|meals\s+included|breakfast|lunch\s+service|food\s+service|coffee\s+service|snacks?|beverage)\b/i.test(ll)) add('foodBeverage', 5)

  if (/\b(uber|lyft|rideshare|parking|garage|valet|shuttle|transit|public\s+transport)\b/i.test(ll)) add('parkingTransportation', 5)
  if (/^parking\s*:/i.test(first)) add('parkingTransportation', 6)

  if (/\b(demo\s+hours|booth\s+hours|exhibit\s+hall\s+hours|hall\s+hours|show\s+hours|expo\s+hours)\b/i.test(ll)) add('boothHours', 6)
  if (/\b(exhibit|show|hall)\s+hours\b/i.test(ll)) add('boothHours', 5)
  if (/\bhours\s+of\s+operation\b/i.test(ll)) add('boothHours', 4)
  if (/^hours\s*:/i.test(first)) add('boothHours', 4)

  if (/\b(move[\s-]?in|set[\s-]?up|setup|exhibitor\s+check[\s-]?in|booth\s+check[\s-]?in|installation|build[\s-]?out)\b/i.test(ll)) add('setupMoveIn', 5)
  if (/^setup\s*:/i.test(first) || /^move[\s-]?in\s*:/i.test(first)) add('setupMoveIn', 6)
  if (/\bcheck[\s-]?in\b/i.test(ll) && /\b(booth|exhibitor|move[\s-]?in|set[\s-]?up|hall|floor)\b/i.test(ll)) add('setupMoveIn', 4)
  if (/\bset[\s-]?up\b/i.test(ll) && /\b(booth|exhibitor|table)\b/i.test(ll)) add('setupMoveIn', 4)

  if (/\b(teardown|move[\s-]?out|strike|load[\s-]?out|dismantle|pack[\s-]?out|cleanup)\b/i.test(ll)) add('teardownMoveOut', 6)
  if (/^teardown\s*:/i.test(first) || /^move[\s-]?out\s*:/i.test(first)) add('teardownMoveOut', 6)

  if (/\b(tickets?|registration|badge\s+pickup|will\s+call|credential|exhibitor\s+pass)\b/i.test(ll)) add('tickets', 4)
  if (/^tickets\s*:/i.test(first) || /^registration\s*:/i.test(first)) add('tickets', 6)
  if (/\bcheck[\s-]?in\b/i.test(ll) && /\b(badge|registration|ticket|attendee)\b/i.test(ll) && !/\b(booth|exhibitor\s+move|set[\s-]?up|move[\s-]?in)\b/i.test(ll)) {
    add('tickets', 3)
  }

  if (/\blead\s+capture\b/i.test(ll) || /\bbadge\s+scan/i.test(ll) || /\bcapture\s+leads\b/i.test(ll) || /\bscan\s+leads\b/i.test(ll)) add('leadCapture', 6)

  if (/\b(shipping|freight|drayage|advance\s+warehouse|material\s+handling|marshalling|crate|pallet|return\s+(label|shipment))\b/i.test(ll)) add('logisticsBoothInfo', 5)
  if (/\b(booth\s+(number|assignment|id)|booth\s*#)\b/i.test(ll)) add('logisticsBoothInfo', 5)
  if (/\bwi-?fi\b/i.test(ll) || /\bssid\b/i.test(ll) || /\bnetwork\s+password\b/i.test(ll) || /\bethernet\b/i.test(ll) || /\binternet\s+access\b/i.test(ll)) {
    add('logisticsBoothInfo', 4)
  }

  return score
}

/**
 * @returns {{ category: OrganizerCategory, score: number, ambiguous: boolean }}
 */
export function classifyChunkWithConfidence(chunk) {
  const score = computeCategoryScores(chunk)
  const ll = chunk.toLowerCase()

  let best = 'additionalNotes'
  let bestScore = 0
  for (const cat of CATEGORY_ORDER) {
    const sc = score[cat] || 0
    if (sc > bestScore) {
      bestScore = sc
      best = cat
    }
  }

  const entries = Object.entries(score)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
  const secondScore = entries.length > 1 ? entries[1][1] : 0

  let ambiguous = false
  if (bestScore < MIN_CLASSIFICATION_SCORE) ambiguous = true
  else if (secondScore > 0 && bestScore - secondScore < MIN_SCORE_MARGIN) ambiguous = true

  if (ambiguous) {
    return { category: /** @type {OrganizerCategory} */ ('additionalNotes'), score: bestScore, ambiguous: true }
  }

  if (score.tickets && score.setupMoveIn && score.tickets === score.setupMoveIn && best === 'tickets') {
    if (/\b(booth|exhibitor|move[\s-]?in|set[\s-]?up)\b/i.test(ll)) {
      return { category: 'setupMoveIn', score: bestScore, ambiguous: false }
    }
  }

  return { category: /** @type {OrganizerCategory} */ (best), score: bestScore, ambiguous: false }
}

/** @deprecated use classifyChunkWithConfidence */
export function classifyChunk(chunk) {
  return classifyChunkWithConfidence(chunk).category
}

const TIME_OR_DAY_LINE =
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i

const LOOKS_LIKE_TIME_LINE = (line) => {
  const t = trim(line)
  if (!t) return false
  return (
    TIME_OR_DAY_LINE.test(t) ||
    /^\d{1,2}:\d{2}/.test(t) ||
    /^\d{1,2}\s*[–—-]\s*\d{1,2}/.test(t) ||
    /^[\s•\-\*]*\d{1,2}:\d{2}/.test(t) ||
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b[.,\s]/i.test(t)
  )
}

/**
 * True if chunk is only schedule/time lines (continuation under a parent heading).
 */
function isScheduleContinuationChunk(chunk) {
  const lines = chunk.split(/\n/).map((l) => trim(l)).filter(Boolean)
  if (lines.length === 0 || lines.length > 12) return false
  return lines.every((line) => LOOKS_LIKE_TIME_LINE(line) || /^[\s•\-–—]+\s*\S/.test(line))
}

function looksLikeScheduleParentChunk(chunk) {
  const first = firstNonEmptyLine(chunk).toLowerCase()
  const ll = chunk.toLowerCase()
  if (/^(hours|setup|move-in|teardown|move-out|booth|exhibit|show|hall|demo)\b/i.test(first)) return true
  if (/\b(hours|setup|move[\s-]?in|teardown|move[\s-]?out|booth\s+hours|demo\s+hours)\b/i.test(ll)) return true
  return false
}

/**
 * Merge time-only follow-on blocks into the previous chunk when they belong to a schedule parent.
 */
function groupTimeBlocksUnderHeadings(chunks) {
  if (chunks.length <= 1) return chunks
  const out = []
  for (const chunk of chunks) {
    const prev = out[out.length - 1]
    if (prev !== undefined && isScheduleContinuationChunk(chunk) && looksLikeScheduleParentChunk(prev)) {
      out[out.length - 1] = formatChunkCleanly(`${prev}\n${chunk}`)
    } else {
      out.push(chunk)
    }
  }
  return out
}

/**
 * Pass 1: split into chunks; group schedule lines; trim.
 */
export function splitIntoLogicalChunks(raw) {
  const text = trim(String(raw).replace(/\r\n/g, '\n'))
  if (!text) return []

  const rough = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const out = []

  const lineStartsNewChunk = (line) => {
    const t = line.trim()
    if (!t) return false
    if (/^#{1,3}\s+\S/.test(t)) return true
    if (/^[A-Z][A-Z0-9 &\-]{3,50}$/.test(t) && t === t.toUpperCase() && t.length < 55) return true
    return /^(parking|venue|location|address|setup|move-in|move-out|teardown|hours|booth|tickets|registration|lead capture|logistics|shipping|freight|key contact|contacts?|transportation|directions|maps?|wifi|wi-fi)\b/i.test(
      t,
    )
  }

  const subsplitLongBlock = (block) => {
    if (block.length < 380 && block.split('\n').length <= 10) return [block]
    const lines = block.split(/\n/)
    const subs = []
    let buf = []
    for (const line of lines) {
      if (lineStartsNewChunk(line) && buf.length) {
        subs.push(buf.join('\n').trim())
        buf = [line]
      } else {
        buf.push(line)
      }
    }
    if (buf.length) subs.push(buf.join('\n').trim())
    return subs.filter(Boolean)
  }

  for (const para of rough) {
    out.push(...subsplitLongBlock(para))
  }

  const cleaned = out.map((c) => formatChunkCleanly(c)).filter(Boolean)
  return groupTimeBlocksUnderHeadings(cleaned)
}

function normalizeForDedupe(s) {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/g, '')
    .trim()
}

function dedupeChunkList(chunks) {
  const seen = new Set()
  const out = []
  for (const c of chunks) {
    const key = normalizeForDedupe(c)
    if (key.length < 8) {
      out.push(c)
      continue
    }
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}

function splitLocationFromEventVenueChunk(p) {
  const first = firstNonEmptyLine(p)
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

/**
 * Route a single classified category to form buckets (no category changes here).
 * @param {OrganizerCategory} cat
 */
function routeClassifiedChunkToBuckets(buckets, cat, chunk) {
  switch (cat) {
    case 'keyContacts':
      buckets.keyContactsSection.push(chunk)
      break
    case 'foodBeverage':
      buckets.foodBeverageText.push(chunk)
      break
    case 'eventVenue': {
      const { venue, address } = splitLocationFromEventVenueChunk(chunk)
      if (venue) buckets.locationVenue.push(venue)
      if (address) buckets.locationAddress.push(address)
      break
    }
    case 'parkingTransportation':
      buckets.parkingText.push(chunk)
      break
    case 'boothHours':
      buckets.eventDatesBoothHours.push(chunk)
      break
    case 'setupMoveIn':
      buckets.eventDatesBoothSetup.push(chunk)
      break
    case 'teardownMoveOut':
      buckets.eventDatesBoothCleanup.push(chunk)
      break
    case 'tickets':
      buckets.ticketsText.push(chunk)
      break
    case 'leadCapture':
      buckets.leadCaptureText.push(chunk)
      break
    case 'logisticsBoothInfo': {
      const ll = chunk.toLowerCase()
      if (
        /\bwi-?fi\b/i.test(ll) ||
        /\bssid\b/i.test(ll) ||
        /\bnetwork\s+password\b/i.test(ll) ||
        /\bethernet\b/i.test(ll) ||
        /\binternet\s+access\b/i.test(ll) ||
        /\bwireless\b/i.test(ll)
      ) {
        buckets.avSetupRequirements.push(chunk)
      } else {
        buckets.eventDatesNotes.push(chunk)
      }
      break
    }
    case 'additionalNotes':
    default:
      buckets.additionalNotesOnly.push(chunk)
      break
  }
}

/**
 * Multi-pass: chunk → classify each → route → dedupe per bucket → format join.
 * @returns {Record<string, string>}
 */
export function parseOrganizerDetails(raw) {
  const chunksPass1 = splitIntoLogicalChunks(raw)
  if (chunksPass1.length === 0) return {}

  /** @type {Array<{ chunk: string, category: OrganizerCategory }>} */
  const classified = []
  for (const chunk of chunksPass1) {
    const { category } = classifyChunkWithConfidence(chunk)
    classified.push({ chunk, category })
  }

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
    keyContactsSection: [],
    additionalNotesOnly: [],
  }

  for (const { chunk, category } of classified) {
    routeClassifiedChunkToBuckets(buckets, category, chunk)
  }

  const deduped = {}
  for (const [key, arr] of Object.entries(buckets)) {
    deduped[key] = dedupeChunkList(arr)
  }

  const out = {}
  for (const [key, arr] of Object.entries(deduped)) {
    if (key === 'keyContactsSection' || key === 'additionalNotesOnly') continue
    const s = collapseJoin(arr)
    if (s) out[key] = s
  }
  const kc = collapseJoin(deduped.keyContactsSection)
  if (kc) out.keyContactsSection = kc
  const an = collapseJoin(deduped.additionalNotesOnly)
  if (an) out.additionalOrganizerNotes = an
  return out
}

const ADDITIONAL_NOTES_TITLE = 'Additional Notes'
const KEY_CONTACTS_TITLE = 'Key Contacts'

function mergeIntoNamedSection(prev, title, content) {
  const incoming = trim(String(content))
  if (!incoming) return prev
  const sections = [...(prev.additionalSections || [])]
  const idx = sections.findIndex((s) => trim(s.title).toLowerCase() === title.toLowerCase())
  if (idx >= 0) {
    const cur = trim(sections[idx].content)
    if (cur === '') {
      sections[idx] = { ...sections[idx], content: incoming }
      return { ...prev, additionalSections: sections }
    }
    return prev
  }
  return { ...prev, additionalSections: [...sections, { title, content: incoming }] }
}

export function mergeOrganizerParsedIntoForm(prev, parsed) {
  let next = { ...prev }
  for (const [key, val] of Object.entries(parsed)) {
    if (key === 'additionalOrganizerNotes' || key === 'keyContactsSection') continue
    if (val == null || trim(String(val)) === '') continue
    const cur = prev[key]
    if (typeof cur !== 'string' || trim(cur) !== '') continue
    next[key] = String(val).trim()
  }

  if (parsed.keyContactsSection != null && trim(String(parsed.keyContactsSection)) !== '') {
    next = mergeIntoNamedSection(next, KEY_CONTACTS_TITLE, parsed.keyContactsSection)
  }

  const notes = parsed.additionalOrganizerNotes
  if (notes != null && trim(String(notes)) !== '') {
    next = mergeIntoNamedSection(next, ADDITIONAL_NOTES_TITLE, notes)
  }

  return next
}
