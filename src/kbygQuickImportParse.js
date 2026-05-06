/**
 * Confidence-based Quick Import parser for KBYG forms.
 * Helpers: address/venue signals, splitVenueAndAddress (high-confidence only),
 * isParkingLine / isParkingContent, isArrivalInstructionLine, calculateConfidence,
 * normalizeWhitespace, extractDate / extractStartTime / extractArrivalTime.
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
 * }} KbygQuickImportPatch */

/**
 * @typedef {{
 *   venueSectionSeen: boolean
 *   venueFilled: boolean
 *   parkingSectionSeen: boolean
 *   parkingKeywordLinesSeen: boolean
 *   parkingFilled: boolean
 * }} QuickImportParseMeta
 */

// --- Normalization & emoji -------------------------------------------------

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

export function stripEmojiPrefix(s) {
  return String(s || '')
    .replace(/^[\s\uFE0F\u200d]*([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+[\s\uFE0F]*)+/gu, '')
    .trim()
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

/** RHS of "Name - …" must show address-like signals (looser than full line). */
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

/** Short label suitable for venue name (not an address line). */
export function looksLikeVenueName(s) {
  const t = stripEmojiPrefix(String(s || '').trim())
  if (!t || t.length > 100) return false
  if (isArrivalInstructionLine(t)) return false
  if (hasAddressSignals(t) && /\d{5}/.test(t)) return false
  if (/^[\d\s,.-]+$/.test(t)) return false
  return true
}

/**
 * Confidence for venue split: high → safe to fill; medium/low → skip auto-fill.
 * @param {'venueSplit'} type
 * @param {{ left: string, right: string }} ctx
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
  return 'medium'
}

/**
 * Split "Venue - address" on first spaced hyphen (ASCII or en/em dash).
 * Returns null unless confidence is high.
 */
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

// --- Arrival prose (never goes to address) ---------------------------------

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

// --- Section bodies --------------------------------------------------------

const LABELED_ARRIVAL_BODY_STOP =
  /^(?:📍|🅿|🗓|📅|📝|📋)?\s*(location|venue|parking|address|where\b|date\s*(?:and\s*)?time|when\b|agenda|schedule|program|meetup|food|drinks|notes?)\b/i

function parseVenueSectionBody(block, mark, meta) {
  meta.venueSectionSeen = true
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

function normalizeAgendaText(s) {
  return normalizeWhitespace(s)
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function applyDateTimeFromBlock(block, mark) {
  const d = extractDate(block)
  const t = extractStartTime(block)
  const arr = extractArrivalTime(block)
  if (d) mark('eventDate', d)
  if (t) mark('eventTime', t)
  if (arr) mark('arrivalTime', arr)
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
    const v = typeof value === 'string' ? value.trim() : ''
    if (!v || patch[key]) return
    patch[key] = v
    const label = KBYG_QUICK_IMPORT_FIELD_LABELS[key]
    if (label) labels.push(label)
    quickImportDebug({ phase: 'mark', field: key, detail: v.slice(0, 80) })
  }

  const urls = []
  let m
  const reUrl = new RegExp(URL_RE.source, URL_RE.flags)
  while ((m = reUrl.exec(text)) !== null) urls.push(m[0])

  const meetup = urls.find((u) => /meetup\.com/i.test(u))
  const luma = urls.find((u) => /(?:luma\.|lu\.ma)/i.test(u))
  if (meetup) mark('meetupLink', meetup)
  if (luma) mark('lumaLink', luma)

  const lines = text.split('\n').map((l) => l.replace(/\s+$/, ''))
  const normLine = (l) =>
    l
      .replace(/^#{1,3}\s+/, '')
      .replace(/^\*\*\s*|\s*\*\*$/g, '')
      .trim()

  const headerMatchers = [
    {
      keys: [/^(?:📅|🗓)?\s*date\s*(?:and\s*)?time/i, /^when\b/i, /^event\s+time/i],
      assign: 'datetime',
    },
    { keys: [/^(?:📝|📋)?\s*agenda\b/i, /^schedule\b/i, /^program\b/i, /^talks?\b/i], assign: 'agenda' },
    {
      keys: [/^(?:📍)?\s*location\b/i, /^venue\b/i, /^where\b/i, /^address\b/i],
      assign: 'venue',
    },
    { keys: [/^(?:🅿|🚗)?\s*parking\b/i, /^where\s+to\s+park/i], assign: 'parking' },
    {
      keys: [
        /^arrival\s+instructions?\s*:?/i,
        /^check-in\s+instructions?\s*:?/i,
        /^check-in\s*:/i,
      ],
      assign: 'arrivalLabeled',
    },
  ]

  /** @type {Record<string, string>} */
  const sections = {}
  let i = 0
  while (i < lines.length) {
    const rawLine = lines[i]
    const line = normLine(rawLine)
    if (!line) {
      i += 1
      continue
    }

    let matched = false
    for (const hm of headerMatchers) {
      const hit = hm.keys.some((rx) => {
        const head = line.split(':')[0]
        return rx.test(head.trim()) || rx.test(line)
      })
      if (!hit) continue
      matched = true
      const restInline = line.includes(':') ? line.replace(/^[^:]+:\s*/, '').trim() : ''
      const buf = []
      if (restInline) buf.push(restInline)
      i += 1
      while (i < lines.length) {
        const next = lines[i]
        const n = normLine(next)
        if (!n) {
          i += 1
          continue
        }
        const isNextHeader = headerMatchers.some((h) =>
          h.keys.some((rx) => {
            const head = n.split(':')[0]
            return rx.test(head.trim()) || rx.test(n)
          }),
        )
        if (isNextHeader) break
        if (hm.assign === 'arrivalLabeled' && LABELED_ARRIVAL_BODY_STOP.test(n)) break
        buf.push(lines[i])
        i += 1
      }
      const body = buf.join('\n').trim()
      if (body) sections[hm.assign] = sections[hm.assign] ? `${sections[hm.assign]}\n\n${body}` : body
      quickImportDebug({
        phase: 'section',
        line: hm.assign,
        type: 'section_block',
        field: hm.assign,
        detail: body.slice(0, 60),
      })
      break
    }
    if (!matched) i += 1
  }

  if (sections.datetime) applyDateTimeFromBlock(sections.datetime, mark)

  if (sections.venue) {
    parseVenueSectionBody(sections.venue, mark, meta)
  }

  if (sections.parking) {
    meta.parkingSectionSeen = true
    const norm = normalizeWhitespace(sections.parking)
    const conf = calculateConfidence('parkingBlock', { body: norm })
    if (conf === 'high' || conf === 'medium') {
      mark('parkingNotes', norm)
      meta.parkingFilled = true
    }
  }

  const keywordParkingLines = lines
    .map((l) => normLine(l))
    .filter((l) => l && isParkingLine(l))
  if (keywordParkingLines.length > 0) {
    meta.parkingKeywordLinesSeen = true
    const conf = calculateConfidence('parkingKeywords', { lineCount: keywordParkingLines.length })
    if (!patch.parkingNotes && (conf === 'high' || conf === 'medium')) {
      mark('parkingNotes', normalizeWhitespace(keywordParkingLines.join('\n')))
      meta.parkingFilled = true
    }
  }

  if (sections.arrivalLabeled) {
    const prose = normalizeWhitespace(
      sections.arrivalLabeled
        .split('\n')
        .map((ln) => stripEmojiPrefix(ln.trim()))
        .filter(Boolean)
        .join('\n'),
    )
    if (prose) mark('speakerArrivalNote', prose)
  }

  if (sections.agenda) mark('internalAgenda', normalizeAgendaText(sections.agenda))

  if (!patch.arrivalTime) {
    const fromAgenda = sections.agenda ? extractArrivalTime(sections.agenda) : ''
    const fromBlob = extractArrivalTime(text)
    const pick = fromBlob || fromAgenda
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
      mark('internalAgenda', agendaLines.join('\n'))
      hints.push('Agenda detected from time-stamped lines')
    }
  }

  const seen = new Set()
  const filledLabels = labels.filter((l) => {
    if (seen.has(l)) return false
    seen.add(l)
    return true
  })

  return { patch, filledLabels, hints, meta }
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
 */
export function formatQuickImportFeedback(appliedKeys, t, meta) {
  if (!appliedKeys || appliedKeys.length === 0) return t.kbyg_quickImportNothing

  const check = t.kbyg_quickImportFeedbackCheck
  const set = new Set(appliedKeys)
  const hasLinks = set.has('meetupLink') || set.has('lumaLink')

  /** @type {string[]} */
  const parsedLines = []
  if (set.has('eventDate')) parsedLines.push(`${check} ${t.kbyg_quickImportFb_date}`)
  if (set.has('eventTime')) parsedLines.push(`${check} ${t.kbyg_quickImportFb_time}`)
  if (set.has('venueName') || set.has('venueAddress')) parsedLines.push(`${check} ${t.kbyg_quickImportFb_venue}`)
  if (set.has('internalAgenda')) parsedLines.push(`${check} ${t.kbyg_quickImportFb_agenda}`)
  if (hasLinks) parsedLines.push(`${check} ${t.kbyg_quickImportFb_eventLinks}`)
  if (set.has('parkingNotes')) parsedLines.push(`${check} ${t.kbyg_quickImportFb_parking}`)
  if (set.has('speakerArrivalNote')) parsedLines.push(`${check} ${t.kbyg_quickImportFb_arrivalInstructions}`)
  if (set.has('arrivalTime')) parsedLines.push(`${check} ${t.kbyg_quickImportFb_arrivalTime}`)

  /** @type {string[]} */
  const skippedLines = []
  skippedLines.push(`- ${t.kbyg_quickImportFb_eventTitle}: ${t.kbyg_quickImportReason_manualOnly}`)

  if (meta) {
    if (meta.venueSectionSeen && !meta.venueFilled) {
      skippedLines.push(`- ${t.kbyg_quickImportFb_venue}: ${t.kbyg_quickImportReason_lowConfidence}`)
    }
    if ((meta.parkingSectionSeen || meta.parkingKeywordLinesSeen) && !meta.parkingFilled) {
      skippedLines.push(`- ${t.kbyg_quickImportFb_parking}: ${t.kbyg_quickImportReason_lowConfidence}`)
    }
  }

  const parsedBlock = `${t.kbyg_quickImportFeedbackParsedHeader}\n${parsedLines.join('\n')}`
  const skippedBlock = `${t.kbyg_quickImportFeedbackSkippedHeader}\n${skippedLines.join('\n')}`
  return `${parsedBlock}\n\n${skippedBlock}`
}
