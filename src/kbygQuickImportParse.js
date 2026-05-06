/**
 * Heuristic paste parser for Meetup / Luma / messy event text → KBYG form patches.
 * Fills only extracted fields; callers merge into existing form (typically fill-empty-only).
 *
 * Mapping rules (conservative):
 * - Never emit eventTitle (manual entry only).
 * - Venue address: only lines that look like postal addresses; never arrival/check-in prose.
 * - Arrival/check-in prose → speaker arrival note (and/or additional notes via sections).
 * - Date/time/arrival clock values only when a regex matches confidently (no guessing AM/PM alone).
 */

const URL_RE = /https?:\/\/[^\s\]<)"',]+/gi

/** Maps patch keys → `getGeneratorUiTranslations` keys for success messages (same labels as form fields). */
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

/** English labels for parsed keys (tests / debugging). */
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
 * Parser patch keys (`eventTitle` intentionally omitted — never auto-filled).
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
 * Fix glued sentences (e.g. missing space after period; "advanceImproving" → "advance. Improving").
 * Used on parking and other prose blobs where HTML paste drops spaces.
 */
export function normalizeWhitespace(s) {
  if (s == null || typeof s !== 'string') return ''
  let t = s.replace(/\r\n/g, '\n')
  t = t.replace(/([.!?])([A-Za-z])/g, '$1 $2')
  t = t.replace(/\b([a-z]{3,})([A-Z][a-z]{2,})\b/g, '$1. $2')
  t = t
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
  t = t.replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

/**
 * Weekday + month + day, optional ordinal (May 13th), optional year.
 * Conservative: must start with a full weekday name.
 */
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

/** Normalize "5:30" + am/pm → "5:30 PM" */
function formatClock(hoursMinutes, ampmRaw) {
  const ap = (ampmRaw || '').toUpperCase()
  const suffix = ap.startsWith('A') ? 'AM' : 'PM'
  return `${hoursMinutes.trim()} ${suffix}`
}

/**
 * Prefer event start from a time range: "5:30-8:00 pm" → "5:30 PM".
 * Otherwise first "h:mm am/pm" in the blob.
 */
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

/**
 * Speakers arrive at / Arrive by / Please arrive by — only when meridiem is present or clearly adjacent.
 */
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
    let ap = match[2]
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

/** Street / ZIP signals only (no instruction detection); avoids recursion with isArrivalInstructionLine. */
export function hasAddressSignals(s) {
  const t = (s || '').trim()
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

/**
 * True only for lines that look like a postal/street address (conservative).
 * Arrival prose must fail this check.
 */
export function isAddressLine(s) {
  const t = (s || '').trim()
  if (!t || isArrivalInstructionLine(t)) return false
  return hasAddressSignals(t)
}

/**
 * Arrival / check-in / building access prose — never mapped to venue address.
 */
export function isArrivalInstructionLine(line) {
  const raw = (line || '').trim()
  if (!raw) return false
  const t = raw.replace(/^[^:]+:\s*/, '').trim() || raw

  if (/arrival\s+instructions?\b/i.test(raw)) return true
  if (/^(?:arrival|check[\s-]?in)\s+instructions?\b/i.test(raw)) return true
  if (/^getting\s+there\b/i.test(raw)) return true
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

/** Suite/floor line that continues an address block (must follow a real address line). */
function isAddressContinuationLine(s) {
  const t = (s || '').trim()
  if (!t || isArrivalInstructionLine(t)) return false
  return /\b(?:suite|ste\.?|floor|fl\.?|bldg|building)\b/i.test(t) || /\d+(?:st|nd|rd|th)\s+floor/i.test(t)
}

/**
 * Split one line "Venue Name - 222 Street …" when RHS passes isAddressLine.
 * @returns {{ venueName: string, venueAddress: string } | null}
 */
export function splitVenueAndAddress(line) {
  const m = line.trim().match(/^(.+?)\s*[-–—]\s+(.+)$/)
  if (!m) return null
  const left = m[1].trim()
  const right = m[2].trim()
  if (!left || !right) return null
  if (!isAddressLine(right)) return null
  if (left.length > 120) return null
  return { venueName: left, venueAddress: right }
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
    const v = typeof value === 'string' ? value.trim() : ''
    if (!v || patch[key]) return
    patch[key] = v
    const label = KBYG_QUICK_IMPORT_FIELD_LABELS[key]
    if (label) labels.push(label)
  }

  const urls = []
  let m
  const re = new RegExp(URL_RE.source, URL_RE.flags)
  while ((m = re.exec(text)) !== null) urls.push(m[0])

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
    mark('parkingNotes', normalizeWhitespace(sections.parking))
  }

  const arrivalMerged = [sections.arrival, arrivalFromVenue].filter(Boolean).join('\n\n').trim()
  if (arrivalMerged) {
    mark('speakerArrivalNote', normalizeWhitespace(arrivalMerged))
  }
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

/**
 * Merge parser patch into prior form state (does not overwrite non-empty string fields).
 * eventTitle is never applied from the parser.
 * @returns {{ next: typeof prev, appliedKeys: string[] }}
 */
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

/** Apply date/time/arrival from a Date & time section block. */
function applyDateTimeFromBlock(block, mark) {
  const d = extractDate(block)
  const t = extractStartTime(block)
  const arr = extractArrivalTime(block)
  if (d) mark('eventDate', d)
  if (t) mark('eventTime', t)
  if (arr) mark('arrivalTime', arr)
}

/**
 * Split location section into venue name, address-only lines, and instruction lines.
 */
function parseVenueLocationBlock(block) {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)

  const instructionLines = []
  const remaining = []
  for (const line of lines) {
    if (isArrivalInstructionLine(line)) instructionLines.push(line)
    else remaining.push(line)
  }

  if (remaining.length === 0) {
    return { name: '', address: '', instructions: instructionLines.join('\n').trim() }
  }

  let name = ''
  /** @type {string[]} */
  let addressParts = []

  if (remaining.length === 1) {
    const only = remaining[0]
    const split = splitVenueAndAddress(only)
    if (split) {
      name = split.venueName
      addressParts.push(split.venueAddress)
    } else {
      const commaIdx = only.indexOf(',')
      const tail = commaIdx > 0 ? only.slice(commaIdx + 1).trim() : ''
      if (commaIdx > 0 && tail && isAddressLine(tail)) {
        const head = only.slice(0, commaIdx).trim()
        if (head.length <= 100 && !isArrivalInstructionLine(head)) {
          name = head
          addressParts.push(tail)
        }
      } else if (isAddressLine(only)) {
        addressParts.push(only)
      } else if (!isArrivalInstructionLine(only)) {
        name = only.length <= 120 ? only : ''
      }
    }
  } else {
    const first = remaining[0]
    const split = splitVenueAndAddress(first)
    if (split) {
      name = split.venueName
      addressParts.push(split.venueAddress)
      for (let i = 1; i < remaining.length; i++) {
        const L = remaining[i]
        if (isAddressLine(L) || (addressParts.length > 0 && isAddressContinuationLine(L))) addressParts.push(L)
        else instructionLines.push(L)
      }
    } else {
      const head = first
      if (!isAddressLine(head) && head.length <= 120) name = head
      const tailLines = remaining.slice(1)
      const tailJoined = tailLines.join('\n')
      if (isAddressLine(tailJoined)) {
        addressParts.push(tailJoined)
      } else {
        for (const L of tailLines) {
          if (isAddressLine(L) || (addressParts.length > 0 && isAddressContinuationLine(L))) addressParts.push(L)
          else instructionLines.push(L)
        }
      }
    }
  }

  addressParts = filterAddressLines(addressParts)

  const address = addressParts.join('\n').trim()
  const instructions = instructionLines.join('\n').trim()
  return { name: name.trim(), address, instructions }
}

/** Drop any line that is not a confident address (or valid continuation). */
function filterAddressLines(parts) {
  const out = []
  for (const line of parts) {
    const L = line.trim()
    if (!L) continue
    if (isArrivalInstructionLine(L)) continue
    if (isAddressLine(L)) {
      out.push(L)
      continue
    }
    if (out.length > 0 && isAddressContinuationLine(L)) out.push(L)
  }
  return out
}

function normalizeAgendaText(s) {
  return normalizeWhitespace(s)
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
