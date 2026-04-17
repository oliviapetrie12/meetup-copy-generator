/**
 * Organizer/sponsor import for Conference KBYG:
 * split into logical chunks → classify each into one category → map to form fields / sections.
 */

function trim(s) {
  return typeof s === 'string' ? s.trim() : ''
}

function firstNonEmptyLine(p) {
  const lines = p.split(/\n/).map((l) => l.trim())
  return lines.find(Boolean) || ''
}

/** Normalize whitespace; keep list/paragraph structure. */
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

/**
 * Split on blank lines, markdown/ALL-CAPS headings, and common section labels.
 * Sub-splits long blocks so unrelated material is not grouped.
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
    if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i.test(t)) return true
    if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b[.,\s]/i.test(t)) return true
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

  return out.map((c) => formatChunkCleanly(c)).filter(Boolean)
}

/** @typedef {'keyContacts'|'eventVenue'|'parkingTransportation'|'boothHours'|'setupMoveIn'|'teardownMoveOut'|'tickets'|'leadCapture'|'logisticsBoothInfo'|'additionalNotes'} OrganizerCategory */

/**
 * Classify a single chunk into exactly one category (keyword + light context).
 * @returns {OrganizerCategory}
 */
export function classifyChunk(chunk) {
  const ll = chunk.toLowerCase()
  const first = firstNonEmptyLine(chunk).toLowerCase()

  /** @type {Record<string, number>} */
  const score = {}

  const add = (cat, w) => {
    score[cat] = (score[cat] || 0) + w
  }

  // Key Contacts
  if (/\bkey\s+contacts?\b/i.test(ll) || /^contacts?\s*:/i.test(first)) add('keyContacts', 6)
  if (/\b(exhibitor\s+services|show\s+manager|onsite\s+contact|organizer\s+contact)\b/i.test(ll)) add('keyContacts', 5)
  if (/\bcontact\s+(name|info|details)\b/i.test(ll)) add('keyContacts', 3)

  // Event & Venue (maps, directions, venue name, F&B at venue)
  if (/^(venue|location|event\s+location|address)\s*:/i.test(first)) add('eventVenue', 6)
  if (/\b(convention\s+center|expo\s+hall|exhibit\s+hall|conference\s+center)\b/i.test(ll)) add('eventVenue', 4)
  if (/\b(directions|wayfinding|map|floor\s+plan)\b/i.test(ll)) add('eventVenue', 4)
  if (/\b(catering|meals\s+included|breakfast|lunch\s+service|food\s+service)\b/i.test(ll)) add('eventVenue', 3)

  // Parking & Transportation
  if (/\b(uber|lyft|rideshare|parking|garage|valet|shuttle|transit|public\s+transport)\b/i.test(ll)) add('parkingTransportation', 5)
  if (/^parking\s*:/i.test(first)) add('parkingTransportation', 6)

  // Booth Hours (includes demo hours)
  if (/\b(demo\s+hours|booth\s+hours|exhibit\s+hall\s+hours|hall\s+hours|show\s+hours|expo\s+hours)\b/i.test(ll)) add('boothHours', 6)
  if (/\b(exhibit|show|hall)\s+hours\b/i.test(ll)) add('boothHours', 5)
  if (/\bhours\s+of\s+operation\b/i.test(ll)) add('boothHours', 4)
  if (/^hours\s*:/i.test(first)) add('boothHours', 4)

  // Setup & Move-in (check-in + set-up per product brief)
  if (/\b(move[\s-]?in|set[\s-]?up|setup|exhibitor\s+check[\s-]?in|booth\s+check[\s-]?in|installation|build[\s-]?out)\b/i.test(ll)) add('setupMoveIn', 5)
  if (/^setup\s*:/i.test(first) || /^move[\s-]?in\s*:/i.test(first)) add('setupMoveIn', 6)
  if (/\bcheck[\s-]?in\b/i.test(ll) && /\b(booth|exhibitor|move[\s-]?in|set[\s-]?up|hall|floor)\b/i.test(ll)) add('setupMoveIn', 4)
  if (/\bset[\s-]?up\b/i.test(ll) && /\b(booth|exhibitor|table)\b/i.test(ll)) add('setupMoveIn', 4)

  // Teardown / Move-out
  if (/\b(teardown|move[\s-]?out|strike|load[\s-]?out|dismantle|pack[\s-]?out|cleanup)\b/i.test(ll)) add('teardownMoveOut', 6)
  if (/^teardown\s*:/i.test(first) || /^move[\s-]?out\s*:/i.test(first)) add('teardownMoveOut', 6)

  // Tickets (registration, badges — prefer over setup when clearly attendee/badge)
  if (/\b(tickets?|registration|badge\s+pickup|will\s+call|credential|exhibitor\s+pass)\b/i.test(ll)) add('tickets', 4)
  if (/^tickets\s*:/i.test(first) || /^registration\s*:/i.test(first)) add('tickets', 6)
  if (/\bcheck[\s-]?in\b/i.test(ll) && /\b(badge|registration|ticket|attendee)\b/i.test(ll) && !/\b(booth|exhibitor\s+move|set[\s-]?up|move[\s-]?in)\b/i.test(ll)) {
    add('tickets', 3)
  }

  // Lead Capture
  if (/\blead\s+capture\b/i.test(ll) || /\bbadge\s+scan/i.test(ll) || /\bcapture\s+leads\b/i.test(ll) || /\bscan\s+leads\b/i.test(ll)) add('leadCapture', 6)

  // Logistics / Booth Info (shipping, booth #, materials, Wi‑Fi for booth)
  if (/\b(shipping|freight|drayage|advance\s+warehouse|material\s+handling|marshalling|crate|pallet|return\s+(label|shipment))\b/i.test(ll)) add('logisticsBoothInfo', 5)
  if (/\b(booth\s+(number|assignment|id)|booth\s*#)\b/i.test(ll)) add('logisticsBoothInfo', 5)
  if (/\bwi-?fi\b/i.test(ll) || /\bssid\b/i.test(ll) || /\bnetwork\s+password\b/i.test(ll) || /\bethernet\b/i.test(ll) || /\binternet\s+access\b/i.test(ll)) {
    add('logisticsBoothInfo', 4)
  }

  const CATEGORY_ORDER = [
    'keyContacts',
    'teardownMoveOut',
    'setupMoveIn',
    'boothHours',
    'parkingTransportation',
    'leadCapture',
    'tickets',
    'logisticsBoothInfo',
    'eventVenue',
    'additionalNotes',
  ]

  let best = 'additionalNotes'
  let bestScore = 0
  for (const cat of CATEGORY_ORDER) {
    const sc = score[cat] || 0
    if (sc > bestScore) {
      bestScore = sc
      best = cat
    }
  }

  if (bestScore < 3) return 'additionalNotes'

  // Tie-break: tickets vs setup when both matched
  if (score.tickets && score.setupMoveIn && score.tickets === score.setupMoveIn) {
    if (/\b(booth|exhibitor|move[\s-]?in|set[\s-]?up)\b/i.test(ll)) return 'setupMoveIn'
    return 'tickets'
  }

  return /** @type {OrganizerCategory} */ (best)
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
 * @returns {Record<string, string>} Form string fields + keyContactsSection + additionalOrganizerNotes
 */
export function parseOrganizerDetails(raw) {
  const chunks = splitIntoLogicalChunks(raw)
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
    keyContactsSection: [],
    additionalNotesOnly: [],
  }

  for (const chunk of chunks) {
    const cat = classifyChunk(chunk)
    switch (cat) {
      case 'keyContacts':
        buckets.keyContactsSection.push(chunk)
        break
      case 'eventVenue': {
        const ll = chunk.toLowerCase()
        const foodHeavy =
          /\b(catering|breakfast|lunch|snacks?|beverage|meals?\s+included|food\s+service|coffee\s+service)\b/i.test(ll) &&
          !/\b(convention|expo\s+hall|exhibit\s+hall|venue:|location:|directions|map|floor\s+plan)\b/i.test(ll)
        if (foodHeavy) {
          buckets.foodBeverageText.push(chunk)
        } else {
          const { venue, address } = splitLocationFromEventVenueChunk(chunk)
          if (venue) buckets.locationVenue.push(venue)
          if (address) buckets.locationAddress.push(address)
        }
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

  const out = {}
  for (const [key, arr] of Object.entries(buckets)) {
    if (key === 'keyContactsSection' || key === 'additionalNotesOnly') continue
    const s = collapseJoin(arr)
    if (s) out[key] = s
  }
  const kc = collapseJoin(buckets.keyContactsSection)
  if (kc) out.keyContactsSection = kc
  const an = collapseJoin(buckets.additionalNotesOnly)
  if (an) out.additionalOrganizerNotes = an
  return out
}

const ADDITIONAL_NOTES_TITLE = 'Additional Notes'
const KEY_CONTACTS_TITLE = 'Key Contacts'

/**
 * @param {object} prev
 * @param {string} title
 * @param {string} content
 */
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

/**
 * Merge parsed strings into previous form; only fills keys where previous string field is empty.
 * Fills named additional sections when empty.
 */
export function mergeOrganizerParsedIntoForm(prev, parsed) {
  let next = { ...prev }
  for (const [key, val] of Object.entries(parsed)) {
    if (
      key === 'additionalOrganizerNotes' ||
      key === 'keyContactsSection'
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
