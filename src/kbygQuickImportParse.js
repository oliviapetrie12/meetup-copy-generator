import { getInitialKbygTldrInclude } from './kbygTldr.js'

/**
 * Section-aware, confidence-based Quick Import parser for KBYG forms.
 * Flow: detectSections → section-specific extraction + conservative fallbacks.
 * Never fills eventTitle. Merge only writes empty string fields.
 */

const URL_RE = /https?:\/\/[^\s\]<)"',]+/gi

/** Never auto-filled */
export const KBYG_QUICK_IMPORT_DISABLED_KEYS = ['eventTitle']

function quickImportDebug(payload) {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    const { phase, line, type, field, detail } = payload
    console.log('[QuickImport]', phase, {
      line: line != null ? String(line).slice(0, 120) : undefined,
      classified: type,
      field: field ?? null,
      detail,
    })
  }
}

export const KBYG_QUICK_IMPORT_I18N_KEYS = {
  meetupLink: 'kbyg_meetupLink',
  lumaLink: 'kbyg_lumaLink',
  eventDate: 'kbyg_eventDate',
  eventTime: 'kbyg_eventTime',
  arrivalTime: 'kbyg_arrivalTime',
  venueName: 'kbyg_venueName',
  venueAddress: 'kbyg_venueAddress',
  parkingNotes: 'kbyg_parkingLabel',
  speakerArrivalNote: 'kbyg_speakerArrival',
  internalAgenda: 'kbyg_internalAgenda',
  additionalNotes: 'kbyg_additionalNotes',
  foodDetails: 'kbyg_food',
  drinkDetails: 'kbyg_drink',
}

export const KBYG_QUICK_IMPORT_FIELD_LABELS = {
  meetupLink: 'Meetup link',
  lumaLink: 'Luma link',
  eventDate: 'Event date',
  eventTime: 'Event time',
  arrivalTime: 'Arrival time',
  venueName: 'Venue name',
  venueAddress: 'Venue address',
  parkingNotes: 'Parking',
  speakerArrivalNote: 'Speaker arrival',
  internalAgenda: 'Agenda',
  additionalNotes: 'Additional notes',
  foodDetails: 'Food details',
  drinkDetails: 'Drink details',
}

/**
 * @typedef {{
 *   eventDate?: string
 *   eventTime?: string
 *   arrivalTime?: string
 *   venueName?: string
 *   venueAddress?: string
 *   parkingNotes?: string
 *   speakerArrivalNote?: string
 *   internalAgenda?: string
 *   meetupLink?: string
 *   lumaLink?: string
 *   additionalNotes?: string
 *   foodDetails?: string
 *   drinkDetails?: string
 *   kbygTldrInclude?: Partial<Record<string, boolean>>
 * }} KbygQuickImportPatch */

/**
 * @typedef {{
 *   venueSectionSeen: boolean
 *   venueFilled: boolean
 *   parkingSectionSeen: boolean
 *   parkingKeywordLinesSeen: boolean
 *   parkingFilled: boolean
 *   rsvpSectionSeen: boolean
 *   rsvpFilled: boolean
 *   foodSignalsSeen: boolean
 *   foodFilled: boolean
 *   needsReview: string[]
 *   internal?: { hostGuess?: string, coHostGuess?: string }
 * }} QuickImportParseMeta
 */

// --- Normalization ---------------------------------------------------------

export function normalizeWhitespace(s) {
  if (s == null || typeof s !== 'string') return ''
  let t = s.replace(/\r\n/g, '\n')
  t = t.replace(/([.!?])([A-Za-z])/g, '$1 $2')
  t = t.replace(/([,;:)])([A-Za-z])/g, '$1 $2')
  t = t.replace(/\b([a-z]{2,})([A-Z][a-z]{2,})\b/g, '$1. $2')
  t = t.replace(/([.!?])(?=[A-Za-z])/g, '$1 ')
  t = t
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
  t = t.replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

/** Typographic quotes and bullets → ASCII for predictable downstream matching */
export function normalizePunctuation(s) {
  return String(s || '')
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u2023\u25E6\u2043]/g, '•')
}

/**
 * Agenda: unicode dashes, am/pm casing, bullet cleanup, spacing.
 * @param {string} text
 */
export function normalizeAgenda(text) {
  let t = String(text || '').replace(/\r\n/g, '\n')
  t = normalizePunctuation(t)
  t = t.replace(/[\u2013\u2014\u2212]/g, ' – ')
  t = t.replace(/\s*-\s*-\s*/g, ' – ')
  const lines = t.split('\n').map((line) => {
    let L = line.trimEnd()
    L = L.replace(/^\s*[-*•·]\s*/, '- ')
    L = L.replace(/\b(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})\s*([ap])\.?\s*m\.?\b/gi, (_, a, b, ap) => {
      const suf = ap.toUpperCase() === 'A' ? 'AM' : 'PM'
      return `${a} – ${b} ${suf}`
    })
    L = L.replace(/\b(\d{1,2}:\d{2})\s*([ap])\.?\s*m\.?\b/gi, (_, time, ap) => {
      const suf = ap.toUpperCase() === 'A' ? 'AM' : 'PM'
      return `${time} ${suf}`
    })
    return L
  })
  return normalizeWhitespace(lines.join('\n'))
}

export function normalizeParkingBlock(s) {
  return normalizeWhitespace(normalizePunctuation(String(s || '')))
}

export function stripEmojiPrefix(s) {
  return String(s || '')
    .replace(/^[\s\uFE0F\u200d]*([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+[\s\uFE0F]*)+/gu, '')
    .trim()
}

// --- Section detection ------------------------------------------------------

const LABELED_ARRIVAL_BODY_STOP =
  /^(?:📍|🅿|🗓|📅|📝|📋|📌)?\s*(location|venue|parking|address|where\b|date\s*(?:and\s*)?time|when\b|agenda|schedule|program|meetup|rsvp|registration)\b/i

/**
 * @typedef {{ id: string, matchers: RegExp[] }} SectionRule
 */

/** @type {SectionRule[]} Order: more specific headings before loose ones */
const SECTION_RULES = [
  {
    id: 'datetime',
    matchers: [/^(?:📅|🗓)?\s*date\s*(?:and\s*)?time/i, /^when\b/i, /^event\s+time/i],
  },
  {
    id: 'agenda',
    matchers: [/^(?:📝|📋)?\s*agenda\b/i, /^schedule\b/i, /^program\b/i, /^talks?\b/i],
  },
  {
    id: 'location',
    matchers: [/^(?:📍)?\s*location\b/i, /^venue\b/i, /^where\b/i, /^address\b/i],
  },
  {
    id: 'parking',
    matchers: [/^(?:🅿|🚗)?\s*parking\b/i, /^where\s+to\s+park/i],
  },
  {
    id: 'rsvp',
    matchers: [
      /^(?:📌|🎯|✅)?\s*rsvp\b/i,
      /^rsvp\s+instructions/i,
      /^registration\s+instructions/i,
      /^registration\s+required\b/i,
      /^(?:📝)?\s*registration\s+instructions?\b/i,
    ],
  },
  {
    id: 'arrival',
    matchers: [
      /^(?:🔑|🚪)?\s*arrival\s+instructions?\s*:?/i,
      /^check-in\s+instructions?\s*:?/i,
      /^check-in\s*:/i,
    ],
  },
]

function matchSectionHeader(normLine) {
  const n = normLine
  for (const rule of SECTION_RULES) {
    for (const rx of rule.matchers) {
      const head = n.split(':')[0]
      if (rx.test(head.trim()) || rx.test(n)) return rule
    }
  }
  return null
}

/**
 * Step 1: split paste into labeled sections + preamble (lines before any heading).
 * @returns {{ byId: Record<string, string>, preamble: string, ordered: { id: string, body: string }[] }}
 */
export function detectSections(rawText) {
  const text = String(rawText || '').replace(/\r\n/g, '\n')
  const lines = text.split('\n').map((l) => l.replace(/\s+$/, ''))
  const normLine = (l) =>
    l
      .replace(/^#{1,6}\s+/, '')
      .replace(/^\*\*\s*|\s*\*\*$/g, '')
      .trim()

  /** @type {Record<string, string>} */
  const byId = {}
  let i = 0
  /** @type {string[]} */
  const preambleLines = []

  while (i < lines.length) {
    const rawLine = lines[i]
    const n = normLine(rawLine)
    if (!n) {
      i += 1
      continue
    }
    const rule = matchSectionHeader(n)
    if (!rule) {
      preambleLines.push(lines[i])
      i += 1
      continue
    }

    const restInline = n.includes(':') ? n.replace(/^[^:]+:\s*/, '').trim() : ''
    const buf = []
    if (restInline) buf.push(restInline)
    i += 1
    while (i < lines.length) {
      const nextRaw = lines[i]
      const nn = normLine(nextRaw)
      if (!nn) {
        i += 1
        continue
      }
      if (matchSectionHeader(nn)) break
      if (rule.id === 'arrival' && LABELED_ARRIVAL_BODY_STOP.test(nn)) break
      buf.push(lines[i])
      i += 1
    }
    const body = buf.join('\n').trim()
    if (body) {
      byId[rule.id] = byId[rule.id] ? `${byId[rule.id]}\n\n${body}` : body
      quickImportDebug({
        phase: 'section',
        line: rule.id,
        type: 'section_block',
        field: rule.id,
        detail: body.slice(0, 60),
      })
    }
  }

  const preamble = preambleLines.join('\n').trim()
  const ordered = Object.entries(byId).map(([id, body]) => ({ id, body }))
  return { byId, preamble, ordered }
}

// --- Address / venue signals -----------------------------------------------

export function hasAddressSignals(s) {
  const t = stripEmojiPrefix(String(s || ''))
  if (!t) return false
  if (/\b\d{5}(?:-\d{4})?\b/.test(t)) return true
  if (/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/.test(t)) return true
  if (
    /\d+\s+[NSEW]?\s*[\w.'\s-]+\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Plaza|Lane|Ln\.?|Court|Ct\.?|Way|Place|Pl\.?|Highway|Hwy)\b/i.test(
      t,
    )
  )
    return true
  if (/\d+(?:st|nd|rd|th)\s+floor\b/i.test(t)) return true
  if (/\b(?:suite|ste\.?|unit)\s*#?[a-z0-9-]+\b/i.test(t)) return true
  return false
}

export function rhsHasAddressIndicators(s) {
  const t = stripEmojiPrefix(String(s || ''))
  if (!t) return false
  if (/\d/.test(t)) return true
  if (/\b\d{5}(?:-\d{4})?\b/.test(t)) return true
  if (/\b[A-Z]{2}\s+\d{5}\b/.test(t)) return true
  if (
    /\b(?:St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Plaza|Lane|Ln\.?|Court|Ct\.?|Way|Place|Pl\.?|Highway|Hwy)\b/i.test(
      t,
    )
  )
    return true
  if (/\b(?:Floor|Suite|Ste\.?|Unit)\b/i.test(t)) return true
  if (/\d+(?:st|nd|rd|th)\s+floor\b/i.test(t)) return true
  return false
}

export function sanitizeAddressLine(s) {
  let t = stripEmojiPrefix(String(s || '').trim())
  if (!t) return ''
  if (isArrivalInstructionLine(t)) return ''
  return t.trim()
}

export function isAddressLine(s) {
  const t = sanitizeAddressLine(s)
  if (!t || isArrivalInstructionLine(t)) return false
  return hasAddressSignals(t)
}

export function looksLikeVenueName(s) {
  const t = stripEmojiPrefix(String(s || '').trim())
  if (!t || t.length > 100) return false
  if (isArrivalInstructionLine(t)) return false
  if (hasAddressSignals(t) && /\d{5}/.test(t)) return false
  if (/^[\d\s,.-]+$/.test(t)) return false
  return true
}

/**
 * @param {'venueSplit'|'parkingBlock'|'parkingKeywords'|'rsvpBlock'|'foodMention'|'cohostHint'} type
 * @param {Record<string, unknown>} ctx
 * @returns {'high' | 'medium' | 'low'}
 */
export function calculateConfidence(type, ctx) {
  if (type === 'venueSplit') {
    const { left, right } = ctx
    if (!looksLikeVenueName(left)) return 'low'
    if (!rhsHasAddressIndicators(right)) return 'low'
    if (!isAddressLine(right)) return 'low'
    const score =
      (/\b\d{5}\b/.test(right) ? 2 : 0) +
      (/\b(St|Ave|Rd|Blvd|Plaza|Dr)\b/i.test(right) ? 1 : 0) +
      (/\d+\s+\w/.test(right) ? 1 : 0)
    return score >= 2 ? 'high' : 'medium'
  }
  if (type === 'parkingBlock') {
    const body = String(ctx.body || '')
    if (!body.trim()) return 'low'
    if (isParkingContent(body)) return 'high'
    return 'low'
  }
  if (type === 'parkingKeywords') {
    return ctx.lineCount >= 1 ? 'medium' : 'low'
  }
  if (type === 'rsvpBlock') {
    const b = normalizeWhitespace(String(ctx.body || ''))
    if (b.length < 10) return 'low'
    let score = 0
    if (/\brsvp\b/i.test(b)) score += 2
    if (/\bregister(?:ation)?\b/i.test(b)) score += 1
    if (/\bregistration\s+required\b/i.test(b)) score += 2
    if (/\bplease\s+provide\s+your\s+email\b/i.test(b)) score += 2
    if (/\bplease\s+rsvp\b/i.test(b)) score += 2
    if (/\b(?:meetup|luma|eventbrite)\b/i.test(b)) score += 1
    return score >= 2 ? 'high' : score === 1 ? 'medium' : 'low'
  }
  if (type === 'foodMention') {
    const line = String(ctx.line || '')
    if (/\b(?:pizza|catering|refreshments|breakfast|lunch|dinner|snacks)\b/i.test(line)) return 'high'
    if (/\b(?:food|drinks?)\s+(?:will\s+be|are|provided|served)\b/i.test(line)) return 'high'
    if (/\b(?:complimentary)\s+(?:food|drinks?|refreshments)\b/i.test(line)) return 'high'
    return 'low'
  }
  if (type === 'cohostHint') {
    const line = String(ctx.line || '')
    if (/thank\s+you\s+to\s+.+\s+for\s+hosting/i.test(line)) return 'high'
    if (/\bco-?host/i.test(line)) return 'medium'
    return 'low'
  }
  return 'medium'
}

export function splitVenueAndAddress(line) {
  const trimmed = String(line || '').trim()
  let idx = trimmed.indexOf(' - ')
  let sepLen = 3
  if (idx === -1) {
    const m = trimmed.match(/\s[–—]\s/)
    if (m && m.index !== undefined) {
      idx = m.index
      sepLen = m[0].length
    }
  }
  if (idx === -1) return null
  const left = trimmed.slice(0, idx).trim()
  const right = trimmed.slice(idx + sepLen).trim()
  if (!left || !right) return null
  const conf = calculateConfidence('venueSplit', { left, right })
  if (conf !== 'high') return null
  return {
    venueName: stripEmojiPrefix(left),
    venueAddress: sanitizeAddressLine(right),
  }
}

// --- Arrival prose ---------------------------------------------------------

export function isArrivalInstructionLine(line) {
  const raw = String(line || '').trim()
  if (!raw) return false
  const probe = stripEmojiPrefix(raw)
  const t = probe.replace(/^[^:]+:\s*/, '').trim() || probe

  if (/arrival\s+instructions?\b/i.test(probe)) return true
  if (/^check-in\s+instructions?\b/i.test(probe)) return true
  if (/^check-in\s*:/i.test(probe)) return true
  if (/\bplease\s+bring\b/i.test(t) && !hasAddressSignals(raw)) return true
  if (/\bupon\s+arrival\b/i.test(t) && !hasAddressSignals(raw)) return true
  if (/\bbring\s+an\s+ID\b/i.test(t)) return true
  if (/\bcheck\s*in\b/i.test(t) && !hasAddressSignals(raw)) return true
  if (/\bcheck-in\b/i.test(t) && !hasAddressSignals(raw)) return true
  if (/\belevator\b/i.test(t)) return true
  if (/\bfront\s+desk\b/i.test(t)) return true
  return false
}

// --- Parking ---------------------------------------------------------------

const PARKING_KEYWORD_RE =
  /\b(?:spothero|parkwhiz|parkmobile|parking\s+garage|parking\s+lot|reserve\s+parking|valet|street\s+parking|metered\s+parking)\b/i

export function isParkingLine(line) {
  const s = String(line || '').trim()
  if (!s) return false
  if (PARKING_KEYWORD_RE.test(s)) return true
  return false
}

export function isParkingContent(block) {
  const s = normalizeWhitespace(String(block || ''))
  if (!s) return false
  if (PARKING_KEYWORD_RE.test(s)) return true
  if (/\b(?:park|parking|garage|lot|stall|spot)\b/i.test(s) && s.length >= 12) return true
  return false
}

// --- RSVP (high-confidence phrases) ---------------------------------------

const RSVP_INLINE_RE =
  /\b(?:please\s+provide\s+your\s+email\s+when\s+you\s+register|please\s+rsvp\s+using|registration\s+required|rsvp\s+on\s+meetup)\b/i

export function isRsvpInstructionLine(line) {
  const s = String(line || '').trim()
  if (!s) return false
  if (RSVP_INLINE_RE.test(s)) return true
  if (/^rsvp\s*:/i.test(s)) return true
  return false
}

// --- Food / drinks ---------------------------------------------------------

const DRINK_WORD_RE = /\b(?:beer|wine|coffee|soda|soft\s+drinks?|beverages)\b/i

export function extractFoodDrinkSnippet(line) {
  const raw = String(line || '').trim()
  if (!raw) return null
  const conf = calculateConfidence('foodMention', { line: raw })
  if (conf !== 'high') return null
  return normalizeWhitespace(raw.replace(/^[-*•]\s*/, ''))
}

// --- Host / co-host (metadata only + needs-review flag) --------------------

/**
 * @returns {{ hostGuess?: string, coHostGuess?: string, needsReviewCohost: boolean }}
 */
export function extractHostMetadata(text) {
  const blob = String(text || '').slice(0, 10000)
  let hostGuess
  let coHostGuess
  let needsReviewCohost = false

  const hosting = blob.match(/thank\s+you\s+to\s+(.+?)\s+for\s+hosting/i)
  if (hosting) {
    hostGuess = stripEmojiPrefix(hosting[1].trim()).replace(/\s+/g, ' ')
    if (/\s+and\s+/i.test(hostGuess)) needsReviewCohost = true
  }

  const co = blob.match(/\bco-?hosted\s+by\s+(.+?)(?:\.|$)/i)
  if (co) coHostGuess = stripEmojiPrefix(co[1].trim()).replace(/\s+/g, ' ')

  const dual = blob.match(
    /\b([A-Z][\w.&\s-]{2,60}?)\s+and\s+([A-Z][\w.&\s-]{2,60}?)\s+(?:present|host|co-host)/i,
  )
  if (dual && calculateConfidence('cohostHint', { line: dual[0] }) !== 'low') {
    needsReviewCohost = true
    if (!coHostGuess) coHostGuess = `${dual[1].trim()} / ${dual[2].trim()}`
  }

  return { hostGuess, coHostGuess, needsReviewCohost }
}

// --- Date / time extraction ------------------------------------------------

export function extractDate(text) {
  const blob = String(text || '').slice(0, 12000)
  const re =
    /\b((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)),\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,\s*\d{4})?\b/i
  const m = blob.match(re)
  if (!m) return ''
  const ord = m[0].match(/\d{1,2}(st|nd|rd|th)/i)
  const dayNum = m[3]
  const dayStr = ord ? `${dayNum}${ord[1]}` : dayNum
  return `${m[1]}, ${m[2]} ${dayStr}`.trim()
}

function formatClock(hoursMinutes, ampmRaw) {
  const ap = (ampmRaw || '').toUpperCase()
  const suffix = ap.startsWith('A') ? 'AM' : 'PM'
  return `${hoursMinutes.trim()} ${suffix}`
}

export function extractStartTime(text) {
  const blob = String(text || '').slice(0, 12000)
  let m = blob.match(/\b(\d{1,2}:\d{2})\s*[-–—]\s*\d{1,2}:\d{2}\s*(am|pm)\b/i)
  if (m) return formatClock(m[1], m[2])
  m = blob.match(/\b(\d{1,2}:\d{2})\s*[-–—]\s*\d{1,2}:\d{2}\s*(AM|PM)\b/)
  if (m) return formatClock(m[1], m[2])
  m = blob.match(/\b(\d{1,2}:\d{2})\s*(am|pm)\b/i)
  if (m) return formatClock(m[1], m[2])
  m = blob.match(/\b(\d{1,2}:\d{2})\s*(AM|PM)\b/)
  if (m) return `${m[1]} ${m[2]}`
  return ''
}

export function extractArrivalTime(text) {
  const blob = String(text || '').slice(0, 14000)
  const patterns = [
    /\b(?:speakers?|speaker)\s+arrive\s+(?:at|by)\s+(\d{1,2}:\d{2})\s*(AM|PM|am|pm)\b/i,
    /\barrive\s+(?:at|by)\s+(\d{1,2}:\d{2})\s*(AM|PM|am|pm)\b/i,
    /\bplease\s+arrive\s+(?:by\s+)?(\d{1,2}:\d{2})\s*(AM|PM|am|pm)\b/i,
    /\b(?:arrive\s+by|doors\s+open|please\s+arrive)\s*[:\s]+(\d{1,2}:\d{2})\s*(AM|PM|am|pm)\b/i,
  ]
  for (const re of patterns) {
    const match = blob.match(re)
    if (!match) continue
    const hm = match[1]
    const ap = match[2]
    if (!ap) continue
    return formatClock(hm, ap)
  }
  const relaxed = blob.match(
    /\b(?:speakers?|speaker)\s+arrive\s+(?:at|by)\s+(\d{1,2}:\d{2})\b|\barrive\s+(?:at|by)\s+(\d{1,2}:\d{2})\b/i,
  )
  if (relaxed) {
    const hm = relaxed[1] || relaxed[2]
    const idx = relaxed.index ?? blob.search(relaxed[0])
    const window = blob.slice(idx, idx + (relaxed[0]?.length || 0) + 40)
    let ampm = ''
    if (/\bpm\b/i.test(window)) ampm = 'pm'
    else if (/\bam\b/i.test(window)) ampm = 'am'
    if (ampm) return formatClock(hm, ampm)
  }
  return ''
}

/**
 * Suggest "arrive 30 minutes before start" for feedback only (caller does not merge by default).
 * @param {string} eventTimeStr e.g. "5:30 PM"
 * @returns {string | null}
 */
export function computeArrivalTimeSuggestion(eventTimeStr) {
  const s = String(eventTimeStr || '').trim()
  if (!s) return null
  let m = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!m) {
    m = s.match(/(\d{1,2}):(\d{2})\s*([ap])\.?m\.?/i)
    if (!m) return null
  }
  let hh = parseInt(m[1], 10)
  const mi = parseInt(m[2], 10)
  let ap = (m[3] || '').replace(/\./g, '').toUpperCase()
  if (ap === 'A' || ap === 'AM') ap = 'AM'
  else if (ap === 'P' || ap === 'PM') ap = 'PM'
  else if (m[3] && /pm/i.test(m[3])) ap = 'PM'
  else if (m[3] && /am/i.test(m[3])) ap = 'AM'
  else ap = hh >= 12 ? 'PM' : 'AM'

  let mins =
    ap === 'AM'
      ? hh === 12
        ? mi
        : hh * 60 + mi
      : hh === 12
        ? 12 * 60 + mi
        : (hh + 12) * 60 + mi

  mins -= 30
  if (mins < 0) mins += 24 * 60

  const h24 = Math.floor(mins / 60)
  const rem = mins % 60
  const outAp = h24 >= 12 ? 'PM' : 'AM'
  let h12 = h24 % 12
  if (h12 === 0) h12 = 12
  return `${h12}:${String(rem).padStart(2, '0')} ${outAp}`
}

// --- Venue section body ----------------------------------------------------

function parseVenueSectionBody(block, mark, meta, countAsLabeledSection = true) {
  if (countAsLabeledSection) meta.venueSectionSeen = true
  let venueName = ''
  const addressParts = []

  for (const rawLine of String(block || '').split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (isArrivalInstructionLine(line)) continue

    const split = splitVenueAndAddress(line)
    if (split) {
      if (!venueName) venueName = split.venueName
      addressParts.push(split.venueAddress)
      continue
    }

    const san = sanitizeAddressLine(line)
    if (san && isAddressLine(san)) {
      addressParts.push(san)
      continue
    }

    if (!venueName && looksLikeVenueName(line) && addressParts.length === 0) {
      venueName = stripEmojiPrefix(line)
    }
  }

  const addrStr = addressParts.filter((x) => isAddressLine(x)).join('\n').trim()

  if (venueName) {
    mark('venueName', venueName)
    meta.venueFilled = true
  }
  if (addrStr) {
    mark('venueAddress', addrStr)
    meta.venueFilled = true
  }
}

function applyDateTimeFromBlock(block, mark) {
  const d = extractDate(block)
  const t = extractStartTime(block)
  const arr = extractArrivalTime(block)
  if (d) mark('eventDate', d)
  if (t) mark('eventTime', t)
  if (arr) mark('arrivalTime', arr)
}

function applyRsvpSection(body, mark, meta) {
  meta.rsvpSectionSeen = true
  const norm = normalizeWhitespace(body)
  const conf = calculateConfidence('rsvpBlock', { body: norm })
  if (conf !== 'high') return
  if (norm) {
    mark('additionalNotes', norm)
    meta.rsvpFilled = true
  }
}

function preambleLooksLikeVenue(preamble) {
  const p = String(preamble || '').trim()
  if (!p) return false
  if (splitVenueAndAddress(p.split('\n')[0]?.trim() || '')) return true
  return p.split('\n').some((ln) => isAddressLine(ln) || looksLikeVenueName(ln))
}

/**
 * @returns {{ patch: KbygQuickImportPatch, filledLabels: string[], hints: string[], meta: QuickImportParseMeta }}
 */
export function parseKbygQuickImport(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n')
  const hints = []
  /** @type {QuickImportParseMeta} */
  const meta = {
    venueSectionSeen: false,
    venueFilled: false,
    parkingSectionSeen: false,
    parkingKeywordLinesSeen: false,
    parkingFilled: false,
    rsvpSectionSeen: false,
    rsvpFilled: false,
    foodSignalsSeen: false,
    foodFilled: false,
    needsReview: [],
    internal: {},
  }

  if (!text.trim()) {
    return { patch: {}, filledLabels: [], hints, meta }
  }

  /** @type {KbygQuickImportPatch} */
  const patch = {}

  /** @type {string[]} */
  const labels = []

  const disabled = new Set(KBYG_QUICK_IMPORT_DISABLED_KEYS)

  const mark = (key, value) => {
    if (disabled.has(key)) return
    if (key === 'kbygTldrInclude' && value && typeof value === 'object') {
      const cur = { ...(patch.kbygTldrInclude || {}) }
      for (const [k, v] of Object.entries(value)) {
        if (v === true) cur[k] = true
      }
      patch.kbygTldrInclude = cur
      return
    }
    const v = typeof value === 'string' ? value.trim() : ''
    if (!v || patch[key]) return
    patch[key] = v
    const label = KBYG_QUICK_IMPORT_FIELD_LABELS[key]
    if (label) labels.push(label)
    quickImportDebug({ phase: 'mark', field: key, detail: v.slice(0, 80) })
  }

  const markTldr = (partial) => {
    if (!partial || typeof partial !== 'object') return
    const cur = patch.kbygTldrInclude || {}
    /** @type {Record<string, boolean>} */
    const next = { ...cur }
    for (const [k, v] of Object.entries(partial)) {
      if (v === true) next[k] = true
    }
    patch.kbygTldrInclude = next
  }

  const urls = []
  let m
  const reUrl = new RegExp(URL_RE.source, URL_RE.flags)
  while ((m = reUrl.exec(text)) !== null) urls.push(m[0])

  const meetup = urls.find((u) => /meetup\.com/i.test(u))
  const luma = urls.find((u) => /(?:luma\.|lu\.ma)/i.test(u))
  if (meetup) mark('meetupLink', meetup)
  if (luma) mark('lumaLink', luma)

  const { byId: sections, preamble } = detectSections(text)

  if (sections.location) {
    parseVenueSectionBody(sections.location, mark, meta, true)
  } else if (preambleLooksLikeVenue(preamble)) {
    parseVenueSectionBody(preamble, mark, meta, false)
  }

  if (sections.datetime) applyDateTimeFromBlock(sections.datetime, mark)

  if (sections.parking) {
    meta.parkingSectionSeen = true
    const norm = normalizeParkingBlock(sections.parking)
    const conf = calculateConfidence('parkingBlock', { body: norm })
    if (conf === 'high') {
      mark('parkingNotes', norm)
      meta.parkingFilled = true
      markTldr({ parking: true })
    }
  }

  if (sections.arrival) {
    const prose = normalizeWhitespace(
      sections.arrival
        .split('\n')
        .map((ln) => stripEmojiPrefix(ln.trim()))
        .filter(Boolean)
        .join('\n'),
    )
    if (prose) mark('speakerArrivalNote', prose)
  }

  if (sections.agenda) {
    mark('internalAgenda', normalizeAgenda(sections.agenda))
    applyFoodSignalsFromBlock(sections.agenda, mark, meta, patch, markTldr)
  }

  if (sections.rsvp) {
    applyRsvpSection(sections.rsvp, mark, meta)
  }

  const lines = text.split('\n').map((l) => l.replace(/\s+$/, ''))
  const normLine = (l) =>
    l
      .replace(/^#{1,6}\s+/, '')
      .replace(/^\*\*\s*|\s*\*\*$/g, '')
      .trim()

  const keywordParkingLines = lines
    .map((l) => normLine(l))
    .filter((l) => l && isParkingLine(l))
  if (keywordParkingLines.length > 0) {
    meta.parkingKeywordLinesSeen = true
    const conf = calculateConfidence('parkingKeywords', { lineCount: keywordParkingLines.length })
    if (!patch.parkingNotes && (conf === 'high' || conf === 'medium')) {
      mark('parkingNotes', normalizeParkingBlock(keywordParkingLines.join('\n')))
      meta.parkingFilled = true
      markTldr({ parking: true })
    }
  }

  const hostMeta = extractHostMetadata(text)
  if (hostMeta.hostGuess || hostMeta.coHostGuess) {
    meta.internal = { hostGuess: hostMeta.hostGuess, coHostGuess: hostMeta.coHostGuess }
  }
  if (hostMeta.needsReviewCohost) meta.needsReview.push('cohost')

  if (!patch.arrivalTime) {
    const fromAgenda = sections.agenda ? extractArrivalTime(sections.agenda) : ''
    const fromBlob = extractArrivalTime(text)
    const pick = fromAgenda || fromBlob
    if (pick) mark('arrivalTime', pick)
  }

  const blob = text.slice(0, 12000)

  if (!patch.eventDate) {
    const fromSection = sections.datetime ? extractDate(sections.datetime) : ''
    const d = fromSection || extractDate(blob)
    if (d && d.length < 120) mark('eventDate', d)
  }

  if (!patch.eventTime) {
    const fromSection = sections.datetime ? extractStartTime(sections.datetime) : ''
    const t = fromSection || extractStartTime(blob)
    if (t) mark('eventTime', t)
  }

  if (!patch.internalAgenda) {
    const agendaLines = lines.filter((l) => {
      const s = l.trim()
      if (!s) return false
      return (
        /^\d{1,2}:\d{2}\s*(?:AM|PM)?\s*[-–—]\s*\d{1,2}:\d{2}/i.test(s) ||
        /^\d{1,2}:\d{2}\s*(?:AM|PM)\s+[^–—-]+$/i.test(s) ||
        /^\d{1,2}:\d{2}\s*(?:AM|PM)\s*[-–—]\s*.+/i.test(s)
      )
    })
    if (agendaLines.length >= 3) {
      mark('internalAgenda', normalizeAgenda(agendaLines.join('\n')))
      hints.push('Agenda detected from time-stamped lines')
    }
  }

  if (!sections.agenda && preamble) {
    applyFoodSignalsFromBlock(preamble, mark, meta, patch, markTldr)
  }

  if (!patch.additionalNotes && !sections.rsvp) {
    const rsvpLines = lines
      .map((l) => normLine(l))
      .filter((l) => l && isRsvpInstructionLine(l))
    if (rsvpLines.length) {
      meta.rsvpSectionSeen = true
      const joined = normalizeWhitespace(rsvpLines.join('\n'))
      if (calculateConfidence('rsvpBlock', { body: joined }) === 'high') {
        mark('additionalNotes', joined)
        meta.rsvpFilled = true
      }
    }
  }

  if (meta.venueSectionSeen && !meta.venueFilled) meta.needsReview.push('venue_address')
  if ((meta.parkingSectionSeen || meta.parkingKeywordLinesSeen) && !meta.parkingFilled) {
    meta.needsReview.push('parking')
  }
  if (meta.rsvpSectionSeen && !meta.rsvpFilled) meta.needsReview.push('rsvp')

  const dedupe = new Set(meta.needsReview)
  meta.needsReview = [...dedupe]

  const seen = new Set()
  const filledLabels = labels.filter((l) => {
    if (seen.has(l)) return false
    seen.add(l)
    return true
  })

  return { patch, filledLabels, hints, meta }
}

/**
 * @param {KbygQuickImportPatch} patchRef
 * @param {(p: Record<string, boolean>) => void} markTldr
 */
function applyFoodSignalsFromBlock(block, mark, meta, patchRef, markTldr) {
  const lines = String(block || '').split('\n')
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    meta.foodSignalsSeen = true
    const snippet = extractFoodDrinkSnippet(line)
    if (!snippet) continue
    if (DRINK_WORD_RE.test(line) && !/\b(?:pizza|food|lunch|dinner|snacks|catering|refreshments)\b/i.test(line)) {
      if (!patchRef.drinkDetails) {
        mark('drinkDetails', snippet)
        meta.foodFilled = true
      }
    } else if (!patchRef.foodDetails) {
      mark('foodDetails', snippet)
      meta.foodFilled = true
    }
  }
  if (meta.foodFilled) markTldr({ food_drinks: true })
}

export function mergeKbygQuickImportPatch(prev, patch) {
  /** @type {Record<string, unknown>} */
  const next = { ...prev }
  /** @type {string[]} */
  const appliedKeys = []
  const disabled = new Set(KBYG_QUICK_IMPORT_DISABLED_KEYS)
  for (const [key, value] of Object.entries(patch)) {
    if (disabled.has(key)) continue
    if (value == null || value === '') continue
    if (key === 'contacts') continue
    if (key === 'kbygTldrInclude' && value && typeof value === 'object') {
      const cur = { ...getInitialKbygTldrInclude(), ...(next.kbygTldrInclude || {}) }
      let touched = false
      for (const [k, v] of Object.entries(value)) {
        if (v === true && !cur[k]) {
          cur[k] = true
          touched = true
        }
      }
      if (touched) {
        next.kbygTldrInclude = cur
        appliedKeys.push('kbygTldrInclude')
      }
      continue
    }
    const cur = next[key]
    if (typeof cur === 'string' && cur.trim() !== '') continue
    next[key] = value
    if (KBYG_QUICK_IMPORT_FIELD_LABELS[key]) appliedKeys.push(key)
  }
  const seen = new Set()
  const deduped = appliedKeys.filter((k) => {
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return { next, appliedKeys: deduped }
}

/**
 * @param {string[]} appliedKeys
 * @param {Record<string, string>} t
 * @param {QuickImportParseMeta} [meta]
 * @param {{ arrivalTimeSuggestion?: string }} [suggestions]
 */
export function formatQuickImportFeedback(appliedKeys, t, meta, suggestions) {
  const sug = suggestions?.arrivalTimeSuggestion

  const warn = t.kbyg_quickImportFeedbackWarn || '⚠'
  const parsedLines = buildParsedLines(appliedKeys, t)
  const needsReviewLines = buildNeedsReviewLines(meta, t, warn)

  const skippedLines = [`- ${t.kbyg_quickImportFb_eventTitle}: ${t.kbyg_quickImportReason_manualOnly}`]
  if (meta) {
    if (meta.venueSectionSeen && !meta.venueFilled) {
      skippedLines.push(`- ${t.kbyg_quickImportFb_venue}: ${t.kbyg_quickImportReason_lowConfidence}`)
    }
    if ((meta.parkingSectionSeen || meta.parkingKeywordLinesSeen) && !meta.parkingFilled) {
      skippedLines.push(`- ${t.kbyg_quickImportFb_parking}: ${t.kbyg_quickImportReason_lowConfidence}`)
    }
  }

  /** @type {string[]} */
  const blocks = []
  const nothingElse =
    (!appliedKeys || appliedKeys.length === 0) &&
    !parsedLines.length &&
    (!needsReviewLines || needsReviewLines.length === 0) &&
    !sug
  if (nothingElse) {
    blocks.push(t.kbyg_quickImportNothing)
  } else if (parsedLines.length) {
    blocks.push(`${t.kbyg_quickImportFeedbackSuccessHeader}\n${parsedLines.join('\n')}`)
  }
  if (needsReviewLines.length) {
    blocks.push(`${t.kbyg_quickImportFeedbackNeedsReviewHeader}\n${needsReviewLines.join('\n')}`)
  }
  if (sug) {
    const sugLine = t.kbyg_quickImportSuggestionArrival.replace('{{time}}', sug)
    blocks.push(`${t.kbyg_quickImportSuggestionHeader}\n${warn} ${sugLine}`)
  }
  blocks.push(`${t.kbyg_quickImportFeedbackSkippedHeader}\n${skippedLines.join('\n')}`)
  return blocks.filter(Boolean).join('\n\n')
}

/**
 * @param {string[]} appliedKeys
 * @param {Record<string, string>} t
 */
function buildParsedLines(appliedKeys, t) {
  const set = new Set(appliedKeys || [])
  const check = t.kbyg_quickImportFeedbackCheck
  /** @type {string[]} */
  const parsedLines = []
  if (set.has('eventDate')) parsedLines.push(`${check} ${t.kbyg_quickImportFb_date}`)
  if (set.has('eventTime')) parsedLines.push(`${check} ${t.kbyg_quickImportFb_time}`)
  if (set.has('venueName') || set.has('venueAddress')) parsedLines.push(`${check} ${t.kbyg_quickImportFb_venue}`)
  if (set.has('internalAgenda')) parsedLines.push(`${check} ${t.kbyg_quickImportFb_agenda}`)
  const hasLinks = set.has('meetupLink') || set.has('lumaLink')
  if (hasLinks) parsedLines.push(`${check} ${t.kbyg_quickImportFb_eventLinks}`)
  if (set.has('parkingNotes')) parsedLines.push(`${check} ${t.kbyg_quickImportFb_parking}`)
  if (set.has('speakerArrivalNote')) parsedLines.push(`${check} ${t.kbyg_quickImportFb_arrivalInstructions}`)
  if (set.has('arrivalTime')) parsedLines.push(`${check} ${t.kbyg_quickImportFb_arrivalTime}`)
  if (set.has('additionalNotes')) parsedLines.push(`${check} ${t.kbyg_quickImportFb_rsvpNotes}`)
  if (set.has('foodDetails') || set.has('drinkDetails')) parsedLines.push(`${check} ${t.kbyg_quickImportFb_foodDrinks}`)
  if (set.has('kbygTldrInclude')) parsedLines.push(`${check} ${t.kbyg_quickImportFb_tldrCallouts}`)
  return parsedLines
}

/**
 * @param {QuickImportParseMeta | undefined} meta
 * @param {Record<string, string>} t
 */
function buildNeedsReviewLines(meta, t, warn) {
  if (!meta) return []
  if (!meta.needsReview?.length) return []
  /** @type {string[]} */
  const out = []
  const nr = new Set(meta.needsReview || [])
  if (nr.has('venue_address')) out.push(`${warn} ${t.kbyg_quickImportNr_venue}`)
  if (nr.has('parking')) out.push(`${warn} ${t.kbyg_quickImportNr_parking}`)
  if (nr.has('rsvp')) out.push(`${warn} ${t.kbyg_quickImportNr_rsvp}`)
  if (nr.has('cohost')) out.push(`${warn} ${t.kbyg_quickImportNr_cohost}`)
  return out
}