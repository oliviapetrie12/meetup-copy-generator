/**
 * Classification-based Quick Import parser (Meetup / Luma / pasted notes → KBYG patch).
 *
 * Rules:
 * - Never writes eventTitle (manual only; merge also ignores it).
 * - Each logical line is classified before mapping; no blind sequential filling.
 * - Venue address: only lines passing isAddressLine after sanitization; never arrival prose.
 * - Low confidence → omit field (no guessing).
 */

const URL_RE = /https?:\/\/[^\s\]<)"',]+/gi

/** Dev-only: line → type → field (toggle via Vite import.meta.env.DEV). */
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

/** Maps patch keys → `getGeneratorUiTranslations` keys for success messages. */
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
  foodDetails: 'kbyg_food',
  drinkDetails: 'kbyg_drink',
  additionalNotes: 'kbyg_additionalNotes',
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
  foodDetails: 'Food',
  drinkDetails: 'Drinks',
  additionalNotes: 'Additional notes',
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
 *   foodDetails?: string
 *   drinkDetails?: string
 *   additionalNotes?: string
 * }} KbygQuickImportPatch */

/**
 * Restore spacing after punctuation, fix glued words/sentences, collapse duplicate spaces.
 * Parking / prose blobs often lose spaces when pasted from HTML/PDF.
 */
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

/** Leading emoji / pictographs (venue lines often include 📍🔑). */
export function stripEmojiPrefix(s) {
  return String(s || '')
    .replace(/^[\s\uFE0F\u200d]*([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+[\s\uFE0F]*)+/gu, '')
    .trim()
}

/**
 * RHS of "Name - …" must show address indicators (digits, street types, zip, floor, etc.).
 * Looser than full-line isAddressLine — used only for split decision.
 */
export function rhsHasAddressIndicators(s) {
  const t = stripEmojiPrefix(String(s || ''))
  if (!t) return false
  if (/\d/.test(t)) return true
  if (/\b\d{5}(?:-\d{4})?\b/.test(t)) return true
  if (/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/.test(t)) return true
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

export function isArrivalInstructionLine(line) {
  const raw = String(line || '').trim()
  if (!raw) return false
  const probe = stripEmojiPrefix(raw)
  const t = probe.replace(/^[^:]+:\s*/, '').trim() || probe

  if (/arrival\s+instructions?\b/i.test(probe)) return true
  if (/^(?:arrival|check[\s-]?in)\s+instructions?\b/i.test(probe)) return true
  if (/^getting\s+there\b/i.test(probe)) return true
  if (/\bcheck\s*in\b/i.test(t) && !hasAddressSignals(raw)) return true
  if (/\bcheck-in\b/i.test(t) && !hasAddressSignals(raw)) return true
  if (/^upon\s+arrival\b/i.test(t)) return true
  if (/\bbring\s+an\s+ID\b/i.test(t)) return true
  if (/\bplease\s+bring\b/i.test(t)) return true
  if (/\bbring\s+(?:your|an)\s+ID\b/i.test(t)) return true
  if (/\belevator\b/i.test(t)) return true
  if (/\bfront\s+desk\b/i.test(t)) return true
  if (/\benter\s+through\b/i.test(t)) return true
  if (/^please\b/i.test(t) && !hasAddressSignals(raw)) return true
  if (/\bsecurity\b/i.test(t) && /\b(?:desk|check|badge)\b/i.test(t)) return true
  return false
}

/** Address-only content for venue field: strip leading emoji; drop if instruction prose. */
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
  if (!rhsHasAddressIndicators(right)) return null
  const venueName = stripEmojiPrefix(left)
  if (!venueName || venueName.length > 120) return null
  const venueAddress = sanitizeAddressLine(right)
  if (!venueAddress || !isAddressLine(venueAddress)) return null
  return { venueName, venueAddress }
}

function isAddressContinuationLine(s) {
  const t = sanitizeAddressLine(s)
  if (!t || isArrivalInstructionLine(t)) return false
  return /\b(?:suite|ste\.?|floor|fl\.?|bldg|building)\b/i.test(t) || /\d+(?:st|nd|rd|th)\s+floor/i.test(t)
}

/**
 * Classify each non-empty line in a Location section; collect name, address lines, instructions.
 */
function parseVenueLocationBlock(block) {
  const rawLines = String(block || '').split('\n')
  let venueName = ''
  const addressLines = []
  const instructionLines = []

  for (const rawLine of rawLines) {
    const line = rawLine.trim()
    if (!line) continue

    quickImportDebug({ phase: 'venue-line', line, type: 'raw', detail: 'classify' })

    if (isArrivalInstructionLine(line)) {
      instructionLines.push(line)
      quickImportDebug({ phase: 'venue-line', line, type: 'arrival_instruction', field: 'speakerArrivalNote' })
      continue
    }

    const split = splitVenueAndAddress(line)
    if (split) {
      if (!venueName) venueName = split.venueName
      addressLines.push(split.venueAddress)
      quickImportDebug({
        phase: 'venue-line',
        line,
        type: 'venue_dash_address',
        field: 'venueName + venueAddress',
        detail: { name: split.venueName, addr: split.venueAddress },
      })
      continue
    }

    const sanitized = sanitizeAddressLine(line)
    if (sanitized && isAddressLine(sanitized)) {
      addressLines.push(sanitized)
      quickImportDebug({ phase: 'venue-line', line: sanitized, type: 'address', field: 'venueAddress' })
      continue
    }

    if (addressLines.length > 0 && isAddressContinuationLine(line)) {
      const cont = sanitizeAddressLine(line)
      if (cont) {
        addressLines.push(cont)
        quickImportDebug({ phase: 'venue-line', line: cont, type: 'address_continuation', field: 'venueAddress' })
      }
      continue
    }

    if (
      !venueName &&
      line.length <= 100 &&
      !rhsHasAddressIndicators(line) &&
      !/\d{5}/.test(line) &&
      !isArrivalInstructionLine(line)
    ) {
      venueName = stripEmojiPrefix(line)
      quickImportDebug({ phase: 'venue-line', line, type: 'venue_name_only', field: 'venueName' })
      continue
    }

    if (/\b(?:please|bring|arrival|check|elevator|desk|register)\b/i.test(stripEmojiPrefix(line))) {
      instructionLines.push(line)
      quickImportDebug({ phase: 'venue-line', line, type: 'arrival_instruction_fallback', field: 'speakerArrivalNote' })
      continue
    }

    quickImportDebug({ phase: 'venue-line', line, type: 'skipped_low_confidence', detail: 'omit' })
  }

  const filteredAddr = []
  for (const L of addressLines) {
    const x = sanitizeAddressLine(L)
    if (x && isAddressLine(x)) filteredAddr.push(x)
  }

  return {
    name: venueName.trim(),
    address: filteredAddr.join('\n').trim(),
    instructions: instructionLines.join('\n').trim(),
  }
}

/**
 * @param {string} raw
 * @returns {{ patch: KbygQuickImportPatch, filledLabels: string[], hints: string[] }}
 */
export function parseKbygQuickImport(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n')
  const hints = []
  if (!text.trim()) {
    return { patch: {}, filledLabels: [], hints }
  }

  /** @type {KbygQuickImportPatch} */
  const patch = {}
  /** @type {string[]} */
  const labels = []

  const mark = (key, value) => {
    if (key === 'eventTitle') return
    const v = typeof value === 'string' ? value.trim() : ''
    if (!v || patch[key]) return
    patch[key] = v
    const label = KBYG_QUICK_IMPORT_FIELD_LABELS[key]
    if (label) labels.push(label)
    quickImportDebug({ phase: 'mark', field: key, detail: v.slice(0, 80) })
  }

  const urls = []
  let m
  const re = new RegExp(URL_RE.source, URL_RE.flags)
  while ((m = re.exec(text)) !== null) urls.push(m[0])

  const meetup = urls.find((u) => /meetup\.com/i.test(u))
  const luma = urls.find((u) => /(?:luma\.|lu\.ma)/i.test(u))
  if (meetup) {
    quickImportDebug({ phase: 'url', line: meetup, type: 'meetup', field: 'meetupLink' })
    mark('meetupLink', meetup)
  }
  if (luma) {
    quickImportDebug({ phase: 'url', line: luma, type: 'luma', field: 'lumaLink' })
    mark('lumaLink', luma)
  }

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
    { keys: [/^(?:📍)?\s*location\b/i, /^venue\b/i, /^where\b/i, /^address\b/i], assign: 'venue' },
    { keys: [/^(?:🅿|🚗)?\s*parking\b/i, /^where\s+to\s+park/i], assign: 'parking' },
    { keys: [/^(?:🚪)?\s*arrival\b/i, /^speaker\s+arrival/i, /^doors\b/i, /^check[\s-]?in\b/i], assign: 'arrival' },
    { keys: [/^(?:📝|📋)?\s*agenda\b/i, /^schedule\b/i, /^program\b/i, /^talks?\b/i], assign: 'agenda' },
    {
      keys: [/^(?:🍕|🥤)?\s*food\s*(?:and|&)\s*drinks?\b/i],
      assign: 'food',
    },
    { keys: [/^(?:🍕|🥤)?\s*food\b/i, /^catering\b/i], assign: 'food' },
    { keys: [/^refreshments?\b/i], assign: 'food' },
    { keys: [/^drinks?\b/i, /^beverages?\b/i], assign: 'drinks' },
    { keys: [/^(?:ℹ|📝)?\s*notes?\b/i, /^additional\b/i, /^misc\b/i], assign: 'notes' },
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
        return rx.test(head) || rx.test(line)
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
            return rx.test(head) || rx.test(n)
          }),
        )
        if (isNextHeader) break
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

  if (sections.datetime) {
    applyDateTimeFromBlock(sections.datetime, mark)
  }

  let arrivalFromVenue = ''
  if (sections.venue) {
    const pv = parseVenueLocationBlock(sections.venue)
    if (pv.name) mark('venueName', pv.name)
    if (pv.address) mark('venueAddress', pv.address)
    arrivalFromVenue = pv.instructions || ''
  }

  if (sections.parking) {
    const pk = normalizeWhitespace(sections.parking)
    quickImportDebug({ phase: 'parking', type: 'normalized', field: 'parkingNotes', detail: pk.slice(0, 80) })
    mark('parkingNotes', pk)
  }

  const arrivalMerged = [sections.arrival, arrivalFromVenue]
    .filter(Boolean)
    .map((block) =>
      block
        .split('\n')
        .map((ln) => stripEmojiPrefix(ln.trim()))
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n')
    .trim()
  if (arrivalMerged) mark('speakerArrivalNote', normalizeWhitespace(arrivalMerged))
  if (sections.agenda) mark('internalAgenda', normalizeAgendaText(sections.agenda))
  if (sections.food) mark('foodDetails', normalizeWhitespace(sections.food))
  if (sections.drinks) mark('drinkDetails', normalizeWhitespace(sections.drinks))
  if (sections.notes) mark('additionalNotes', normalizeWhitespace(sections.notes))

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

  return { patch, filledLabels, hints }
}

export function mergeKbygQuickImportPatch(prev, patch) {
  /** @type {Record<string, unknown>} */
  const next = { ...prev }
  /** @type {string[]} */
  const appliedKeys = []
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'eventTitle') continue
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

function applyDateTimeFromBlock(block, mark) {
  const d = extractDate(block)
  const t = extractStartTime(block)
  const arr = extractArrivalTime(block)
  if (d) mark('eventDate', d)
  if (t) mark('eventTime', t)
  if (arr) mark('arrivalTime', arr)
}

function normalizeAgendaText(s) {
  return normalizeWhitespace(s)
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
