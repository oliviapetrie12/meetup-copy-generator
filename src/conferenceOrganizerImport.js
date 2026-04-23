/**
 * Conference / sponsor paste → Conference KBYG
 *
 * Pipeline: CHUNK → NORMALIZE → CLASSIFY (independent; heading / keyword / time) → validation (STEP 9) → DEDUPE → form patch + structured KBYG (+ optional debug).
 * Chunks are never reclassified after the classify step.
 */

function trim(s) {
  return typeof s === 'string' ? s.trim() : ''
}

function firstNonEmptyLine(p) {
  const lines = p.split(/\n/).map((l) => l.trim())
  return lines.find(Boolean) || ''
}

/** STEP 2: normalize for matching only (original chunk text preserved for output). */
export function normalizeTextForMatching(s) {
  let t = trim(String(s).replace(/\r\n/g, '\n'))
  t = t.replace(/\b(move-out|teardown|dismantle|remove materials|strike|pack-out|load-out)\b/gi, 'teardown')
  t = t.replace(/\b(check-in|set-up|set up|booth set-up|setup|install|installation)\b/gi, 'setup')
  t = t.replace(/\b(expo hours|demo hours|exhibit hall hours)\b/gi, 'booth hours')
  return t.toLowerCase()
}

function normalizeHeadingLineForMatch(line) {
  return trim(line)
    .replace(/^#{1,3}\s+/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/** Min score to accept a category. */
const MIN_CLASSIFICATION_SCORE = 4
const MIN_SCORE_MARGIN = 2

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

function applyHeadingSynonyms(score, firstNorm) {
  const rules = [
    [/^(parking|transit|transportation|getting\s+there|rideshare|uber|lyft|taxi)\b/, () => (score.parkingTransportation = (score.parkingTransportation || 0) + 5)],
    [/^(venue|location|event\s+location|directions|map|floor\s+plan)\b/, () => (score.eventVenue = (score.eventVenue || 0) + 5)],
    [/^(booth|exhibit|show|hall|demo)\s+(hours|times)\b/, () => (score.boothHours = (score.boothHours || 0) + 6)],
    [/^(move[\s-]?in|setup|set[\s-]?up|installation)\b/, () => (score.setupMoveIn = (score.setupMoveIn || 0) + 5)],
    [/^(teardown|move[\s-]?out|strike|load[\s-]?out)\b/, () => (score.teardownMoveOut = (score.teardownMoveOut || 0) + 5)],
    [/^(tickets?|registration|badges?|redeem)\b/, () => (score.tickets = (score.tickets || 0) + 5)],
    [/^(lead\s+capture|scanner|scanning|app)\b/, () => (score.leadCapture = (score.leadCapture || 0) + 5)],
    [/^(shipping|freight|logistics|drayage|material\s+handling)\b/, () => (score.logisticsBoothInfo = (score.logisticsBoothInfo || 0) + 5)],
    [/^(wifi|wi-?fi|network|internet)\b/, () => (score.logisticsBoothInfo = (score.logisticsBoothInfo || 0) + 4)],
    [/^(contacts?|key\s+contacts?|organizer)\b/, () => (score.keyContacts = (score.keyContacts || 0) + 5)],
    [/^(food|catering|meals|beverage)\b/, () => (score.foodBeverage = (score.foodBeverage || 0) + 4)],
  ]
  for (const [re, fn] of rules) {
    if (re.test(firstNorm)) fn()
  }
}

/**
 * STEP 6: time + keyword on same line boosts the right section.
 * @param {Record<string, number>} score
 * @param {string} chunk
 */
function applyTimeBasedRules(score, chunk) {
  const add = (cat, w) => {
    score[cat] = (score[cat] || 0) + w
  }
  const lines = chunk.split(/\n/)
  for (const line of lines) {
    if (!/\d{1,2}:\d{2}|\b(am|pm)\b/i.test(line)) continue
    const low = line.toLowerCase()
    if (/\b(setup|check-in|move-in|installation|exhibitor check-in|booth check-in)\b/i.test(low)) add('setupMoveIn', 4)
    if (/\b(demo|exhibit|hall|show|booth)\s+hours\b|\bdemo\b/i.test(low)) add('boothHours', 4)
    if (/\b(teardown|move-out|dismantle|strike|remove materials)\b/i.test(low)) add('teardownMoveOut', 4)
  }
}

function computeCategoryScores(chunk) {
  const ll = chunk.toLowerCase()
  const nm = normalizeTextForMatching(chunk)
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

  if (/\b(uber|lyft|taxi|rideshare|parking|garage|valet|shuttle|transit|public\s+transport)\b/i.test(ll)) add('parkingTransportation', 5)
  if (/\bparking\b/i.test(nm)) add('parkingTransportation', 1)
  if (/^parking\s*:/i.test(first)) add('parkingTransportation', 6)

  if (/\b(demo\s+hours|booth\s+hours|exhibit\s+hall\s+hours|hall\s+hours|show\s+hours|expo\s+hours)\b/i.test(ll)) add('boothHours', 6)
  if (/\b(booth hours|expo hours|demo hours)\b/i.test(nm)) add('boothHours', 2)
  if (/\b(exhibit|show|hall)\s+hours\b/i.test(ll)) add('boothHours', 5)
  if (/\bhours\s+of\s+operation\b/i.test(ll)) add('boothHours', 4)
  if (/^hours\s*:/i.test(first)) add('boothHours', 4)

  if (/\b(move[\s-]?in|set[\s-]?up|setup|exhibitor\s+check[\s-]?in|booth\s+check[\s-]?in|installation|build[\s-]?out)\b/i.test(ll)) add('setupMoveIn', 5)
  if (/\b(setup|check-in)\b/i.test(nm)) add('setupMoveIn', 2)
  if (/^setup\s*:/i.test(first) || /^move[\s-]?in\s*:/i.test(first)) add('setupMoveIn', 6)
  if (/\bcheck[\s-]?in\b/i.test(ll) && /\b(booth|exhibitor|move[\s-]?in|set[\s-]?up|hall|floor)\b/i.test(ll)) add('setupMoveIn', 4)
  if (/\bset[\s-]?up\b/i.test(ll) && /\b(booth|exhibitor|table)\b/i.test(ll)) add('setupMoveIn', 4)

  if (/\b(teardown|move[\s-]?out|strike|load[\s-]?out|dismantle|pack[\s-]?out|cleanup|remove materials)\b/i.test(ll)) add('teardownMoveOut', 6)
  if (/\bteardown\b/i.test(nm)) add('teardownMoveOut', 2)
  if (/^teardown\s*:/i.test(first) || /^move[\s-]?out\s*:/i.test(first)) add('teardownMoveOut', 6)

  if (/\b(tickets?|registration|badge\s+pickup|will\s+call|credential|exhibitor\s+pass|redeem)\b/i.test(ll)) add('tickets', 4)
  if (/^tickets\s*:/i.test(first) || /^registration\s*:/i.test(first)) add('tickets', 6)
  if (/\bcheck[\s-]?in\b/i.test(ll) && /\b(badge|registration|ticket|attendee)\b/i.test(ll) && !/\b(booth|exhibitor\s+move|set[\s-]?up|move[\s-]?in)\b/i.test(ll)) {
    add('tickets', 3)
  }

  if (
    /\blead\s+capture\b/i.test(ll) ||
    /\bbadge\s+scan/i.test(ll) ||
    /\bcapture\s+leads\b/i.test(ll) ||
    /\bscan\s+leads\b/i.test(ll) ||
    /\bscanner\b/i.test(ll) ||
    /\bscanner\s+app\b/i.test(ll) ||
    /\blead\s+[\w\s]{0,40}\bapp\b/i.test(ll)
  ) {
    add('leadCapture', 6)
  }
  if (/\b(lead capture|scanner app|crm)\b/i.test(nm)) add('leadCapture', 2)

  if (/\b(shipping|freight|drayage|advance\s+warehouse|material\s+handling|marshalling|crate|pallet|return\s+(label|shipment))\b/i.test(ll)) add('logisticsBoothInfo', 5)
  if (/\b(booth\s+(number|assignment|id)|booth\s*#)\b/i.test(ll)) add('logisticsBoothInfo', 5)
  if (/\bwi-?fi\b/i.test(ll) || /\bssid\b/i.test(ll) || /\bnetwork\s+password\b/i.test(ll) || /\bethernet\b/i.test(ll) || /\binternet\s+access\b/i.test(ll)) {
    add('logisticsBoothInfo', 4)
  }

  applyTimeBasedRules(score, chunk)

  return score
}

/**
 * @returns {{ category: OrganizerCategory, score: number, ambiguous: boolean, weakMatch: boolean, reason: string }}
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
  const margin = secondScore > 0 ? bestScore - secondScore : 999

  let ambiguous = false
  if (bestScore < MIN_CLASSIFICATION_SCORE) ambiguous = true
  else if (secondScore > 0 && margin < MIN_SCORE_MARGIN) ambiguous = true

  /** STEP 10: borderline scores → Additional Notes with ⚠️ */
  const weakMargin = !ambiguous && secondScore > 0 && margin === MIN_SCORE_MARGIN

  if (ambiguous) {
    return {
      category: /** @type {OrganizerCategory} */ ('additionalNotes'),
      score: bestScore,
      ambiguous: true,
      weakMatch: true,
      reason: 'fallback',
    }
  }

  if (score.tickets && score.setupMoveIn && score.tickets === score.setupMoveIn && best === 'tickets') {
    if (/\b(booth|exhibitor|move[\s-]?in|set[\s-]?up)\b/i.test(ll)) {
      return {
        category: 'setupMoveIn',
        score: bestScore,
        ambiguous: false,
        weakMatch: false,
        reason: inferClassificationReason(chunk, score, 'setupMoveIn'),
      }
    }
  }

  if (weakMargin) {
    return {
      category: /** @type {OrganizerCategory} */ ('additionalNotes'),
      score: bestScore,
      ambiguous: false,
      weakMatch: true,
      reason: 'weak margin',
    }
  }

  return {
    category: /** @type {OrganizerCategory} */ (best),
    score: bestScore,
    ambiguous: false,
    weakMatch: false,
    reason: inferClassificationReason(chunk, score, best),
  }
}

function inferClassificationReason(chunk, score, category) {
  const firstRaw = firstNonEmptyLine(chunk)
  const firstNorm = normalizeHeadingLineForMatch(firstRaw)
  const headingRules = [
    [/^(parking|transit|uber|lyft|taxi)/, 'parkingTransportation'],
    [/^(venue|location|address)/, 'eventVenue'],
    [/^(booth|demo|hall|exhibit).*(hours|times)/, 'boothHours'],
    [/^(move-in|setup|set-up)/, 'setupMoveIn'],
    [/^(teardown|move-out)/, 'teardownMoveOut'],
    [/^(tickets|registration)/, 'tickets'],
    [/^(lead|scanner)/, 'leadCapture'],
    [/^(shipping|freight|logistics|wifi|wi-fi)/, 'logisticsBoothInfo'],
    [/^(contacts?|key contacts)/, 'keyContacts'],
  ]
  for (const [re, cat] of headingRules) {
    if (re.test(firstNorm) && cat === category) return 'heading'
  }
  const lines = chunk.split('\n')
  for (const line of lines) {
    if (!/\d{1,2}:\d{2}|\b(am|pm)\b/i.test(line)) continue
    const low = line.toLowerCase()
    if (category === 'setupMoveIn' && /\b(setup|check-in|move-in)\b/i.test(low)) return 'time'
    if (category === 'boothHours' && /\b(demo|hours|exhibit|hall|show)\b/i.test(low)) return 'time'
    if (category === 'teardownMoveOut' && /\b(teardown|move-out)\b/i.test(low)) return 'time'
  }
  return 'keyword'
}

export function classifyChunk(chunk) {
  return classifyChunkWithConfidence(chunk).category
}

const TIME_OR_DAY_LINE = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i

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

/**
 * Split paragraphs that classify into different concepts (STEP 1 / strict).
 */
export function splitMultiConceptChunks(chunks) {
  const out = []
  for (const c of chunks) {
    const parts = c.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    if (parts.length < 2) {
      out.push(c)
      continue
    }
    const cls = parts.map((p) => classifyChunkWithConfidence(formatChunkCleanly(p)))
    const cats = cls.map((x) => x.category)
    const distinct = new Set(cats)
    if (distinct.size > 1) {
      out.push(...parts.map((p) => formatChunkCleanly(p)).filter(Boolean))
    } else {
      out.push(c)
    }
  }
  return out
}

function normalizeForDedupe(s) {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/g, '')
    .trim()
}

/** STEP 8: remove duplicates; keep the longest / most complete version. */
function dedupeChunkListPreferComplete(chunks) {
  const keyOrder = []
  const keyToLongest = new Map()
  for (const c of chunks) {
    const k = normalizeForDedupe(c)
    if (k.length < 8) {
      keyOrder.push({ type: 'raw', chunk: c })
      continue
    }
    if (!keyToLongest.has(k)) {
      keyOrder.push({ type: 'key', key: k })
      keyToLongest.set(k, c)
    } else {
      const prev = keyToLongest.get(k)
      if (c.length > prev.length) keyToLongest.set(k, c)
    }
  }
  return keyOrder.map((e) => (e.type === 'raw' ? e.chunk : keyToLongest.get(e.key)))
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

function buildFormBucketsFromClassified(classified) {
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
    deduped[key] = dedupeChunkListPreferComplete(arr)
  }
  return deduped
}

function bucketsToFormPatch(deduped) {
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

/** STEP 9: expected patterns per section — mismatch → Additional Notes */
function passesSectionPattern(category, chunk) {
  const ll = chunk.toLowerCase()
  switch (category) {
    case 'parkingTransportation':
      return /\b(uber|lyft|taxi|rideshare|parking|garage|valet|shuttle|transit|public\s+transport|lot|deck|permits?)\b/i.test(ll)
    case 'boothHours':
      return (
        /\d{1,2}:\d{2}/.test(chunk) ||
        /\b(am|pm|hours?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|schedule)\b/i.test(ll) ||
        /\b(demo|exhibit|show|hall|booth|floor|expo).{0,48}\b(hours|times)\b/i.test(ll)
      )
    case 'teardownMoveOut':
      return /\b(teardown|move-out|strike|dismantle|pack|remove|load-out|cleanup|end of|closing|crate|materials)\b/i.test(ll)
    default:
      return true
  }
}

/**
 * @param {Array<{ chunk: string, category: OrganizerCategory, reason: string, weakMatch: boolean, ambiguous: boolean }>} rows
 */
function applyValidationSanity(rows) {
  return rows.map((row) => {
    if (row.category === 'additionalNotes') return { ...row, validationMoved: false }
    if (!passesSectionPattern(row.category, row.chunk)) {
      return {
        ...row,
        category: /** @type {OrganizerCategory} */ ('additionalNotes'),
        validationMoved: true,
        originalCategory: row.category,
        reason: `${row.reason} → validation`,
      }
    }
    return { ...row, validationMoved: false }
  })
}

function dedupeClassifiedRowsPreferComplete(rows) {
  const keyToRow = new Map()
  const order = []
  for (const row of rows) {
    const k = normalizeForDedupe(row.chunk)
    if (k.length < 8) {
      order.push({ type: 'raw', row })
      continue
    }
    const key = `${row.category}::${k}`
    if (!keyToRow.has(key)) {
      keyToRow.set(key, row)
      order.push({ type: 'key', key })
    } else {
      const prev = keyToRow.get(key)
      if (row.chunk.length > prev.chunk.length) keyToRow.set(key, row)
    }
  }
  return order.map((e) => (e.type === 'raw' ? e.row : keyToRow.get(e.key)))
}

/**
 * @typedef {{ chunk: string, category: OrganizerCategory, reason: string, weakMatch: boolean, ambiguous: boolean, validationMoved?: boolean, originalCategory?: OrganizerCategory }} ClassifiedRow
 */

/** STEP 11: section order and emojis (📋 = Logistics — 10 sections, 9 emojis in brief; Logistics uses 📋). */
const KBYG_SECTION_SPEC = [
  { cats: ['keyContacts'], emoji: '🔑', title: 'Key Contacts' },
  { cats: ['eventVenue', 'foodBeverage'], emoji: '📍', title: 'Event & Venue' },
  { cats: ['boothHours'], emoji: '🕒', title: 'Booth Hours' },
  { cats: ['setupMoveIn'], emoji: '🛠️', title: 'Setup & Move-in' },
  { cats: ['teardownMoveOut'], emoji: '📦', title: 'Teardown / Move-out' },
  { cats: ['parkingTransportation'], emoji: '🚗', title: 'Parking & Transportation' },
  { cats: ['logisticsBoothInfo'], emoji: '📋', title: 'Logistics / Booth Info' },
  { cats: ['tickets'], emoji: '🎟️', title: 'Tickets' },
  { cats: ['leadCapture'], emoji: '📱', title: 'Lead Capture' },
  { cats: ['additionalNotes'], emoji: '📎', title: 'Additional Notes' },
]

function chunkLinesToBullets(text) {
  const lines = text.split(/\n/).map((l) => trim(l)).filter(Boolean)
  if (lines.length === 0) return []
  return lines.map((l) => (l.startsWith('•') || l.startsWith('-') ? `• ${l.replace(/^[\s•\-–—]+\s*/, '')}` : `• ${l}`))
}

function formatChunkForStructuredKbyg(row) {
  if (!row.weakMatch && !row.validationMoved) return row.chunk
  const lines = row.chunk.split(/\n/)
  if (lines.length === 0) return row.chunk
  lines[0] = `⚠️ ${trim(lines[0])}`
  return lines.join('\n')
}

/**
 * Structured Know Before You Go plain text (STEP 11).
 * @param {ClassifiedRow[]} rows
 */
export function buildStructuredKbygPlain(rows) {
  const byCat = {}
  for (const row of rows) {
    const cat = row.category === 'foodBeverage' ? 'eventVenue' : row.category
    if (!byCat[cat]) byCat[cat] = []
    byCat[cat].push(formatChunkForStructuredKbyg(row))
  }
  for (const k of Object.keys(byCat)) {
    byCat[k] = dedupeChunkListPreferComplete(byCat[k])
  }

  const parts = []
  for (const spec of KBYG_SECTION_SPEC) {
    const texts = spec.cats.flatMap((c) => byCat[c] || [])
    if (texts.length === 0) continue
    const block = [`${spec.emoji} ${spec.title}`, '']
    for (const t of texts) {
      block.push(...chunkLinesToBullets(t))
      block.push('')
    }
    parts.push(block.join('\n').trimEnd())
  }
  return parts.join('\n\n').trim()
}

function runPipelineClassifiedRows(raw) {
  const pass1 = splitIntoLogicalChunks(raw)
  const pass2 = splitMultiConceptChunks(pass1)
  /** @type {ClassifiedRow[]} */
  const classified = []
  for (const chunk of pass2) {
    const clean = formatChunkCleanly(chunk)
    const meta = classifyChunkWithConfidence(clean)
    classified.push({
      chunk: clean,
      category: meta.category,
      weakMatch: meta.weakMatch,
      ambiguous: meta.ambiguous,
      reason: meta.reason,
    })
  }
  const validated = applyValidationSanity(classified)
  return dedupeClassifiedRowsPreferComplete(validated)
}

/**
 * Form patch + structured KBYG (STEP 11).
 */
export function processOrganizerImport(raw) {
  const rows = runPipelineClassifiedRows(raw)
  const simple = rows.map((r) => ({ chunk: r.chunk, category: r.category }))
  const deduped = buildFormBucketsFromClassified(simple)
  const formPatch = bucketsToFormPatch(deduped)
  const structuredKbygPlain = buildStructuredKbygPlain(rows)
  return { ...formPatch, structuredKbygPlain }
}

/**
 * Chunk → classify → validate → dedupe → form field patch (empty fields only via merge helper).
 */
export function parseOrganizerDetails(raw) {
  const r = processOrganizerImport(raw)
  const { structuredKbygPlain: _sk, ...formPatch } = r
  return formPatch
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
    if (
      key === 'additionalOrganizerNotes' ||
      key === 'keyContactsSection' ||
      key === 'structuredKbygPlain'
    ) {
      continue
    }
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
