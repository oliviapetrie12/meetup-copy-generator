/**
 * Heuristic paste parser for Meetup / Luma / messy event text → KBYG form patches.
 * Fills only extracted fields; callers merge into existing form (typically fill-empty-only).
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
 * Parser patch keys (`eventTitle` excluded — manual entry; optional title parsing could be added later).
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

  // --- URLs (assign first of each host type)
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

  // --- Section headers (emoji / English / markdown)
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
    const dt = parseDateTimeSection(sections.datetime)
    if (dt.date) mark('eventDate', dt.date)
    if (dt.time) mark('eventTime', dt.time)
    if (dt.arrival) mark('arrivalTime', dt.arrival)
  }

  if (sections.venue) {
    const { name, address } = splitVenue(sections.venue)
    if (name) mark('venueName', name)
    if (address) mark('venueAddress', address)
  }

  if (sections.parking) mark('parkingNotes', sections.parking)
  if (sections.arrival) mark('speakerArrivalNote', sections.arrival)
  if (sections.agenda) mark('internalAgenda', normalizeAgendaText(sections.agenda))
  if (sections.food) mark('foodDetails', sections.food)
  if (sections.drinks) mark('drinkDetails', sections.drinks)
  if (sections.notes) mark('additionalNotes', sections.notes)

  // --- Inline arrival phrases (whole text)
  const arriveM = text.match(
    /(?:arrive\s+by|arrival|doors\s+open|please\s+arrive)\s*[:\s]+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i,
  )
  if (arriveM && !patch.arrivalTime) {
    mark('arrivalTime', arriveM[1].trim())
  }

  // --- Date/time from any line if sections missed
  if (!patch.eventDate || !patch.eventTime) {
    const blob = text.slice(0, 4000)
    const joint = blob.match(
      /((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d{1,2},?\s+\d{4})\s+(?:at|·|@)\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i,
    )
    if (joint) {
      if (!patch.eventDate) mark('eventDate', joint[1].trim())
      if (!patch.eventTime) mark('eventTime', joint[2].trim())
    } else {
      const dateOnly = blob.match(
        /((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d{1,2},?\s+\d{4})/i,
      )
      if (dateOnly && !patch.eventDate) mark('eventDate', dateOnly[1].trim())
      const timeOnly = blob.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM))\b/)
      if (timeOnly && !patch.eventTime) mark('eventTime', timeOnly[1].trim())
    }
  }

  // --- Agenda fallback: lines that look like timed slots
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
    if (agendaLines.length >= 2) {
      mark('internalAgenda', agendaLines.join('\n'))
      hints.push('Agenda detected from time-stamped lines')
    }
  }

  // Dedupe labels for UI
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
 * @returns {{ next: typeof prev, appliedKeys: string[] }}
 */
export function mergeKbygQuickImportPatch(prev, patch) {
  /** @type {Record<string, unknown>} */
  const next = { ...prev }
  /** @type {string[]} */
  const appliedKeys = []
  for (const [key, value] of Object.entries(patch)) {
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

function parseDateTimeSection(block) {
  const out = { date: '', time: '', arrival: '' }
  const arrive = block.match(/(?:arrive|arrival)\s*[:\s]+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)
  if (arrive) out.arrival = arrive[1].trim()

  const joint = block.match(
    /((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d{1,2},?\s+\d{4})\s+(?:at|·)\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i,
  )
  if (joint) {
    out.date = joint[1].trim()
    out.time = joint[2].trim()
    return out
  }

  const atSplit = block.split(/\s+at\s+/i)
  if (atSplit.length >= 2) {
    const left = atSplit[0].trim()
    const right = atSplit.slice(1).join(' at ').trim()
    if (/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i.test(left)) out.date = left
    const tm = right.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i)
    if (tm) out.time = tm[1].trim()
  }

  if (!out.date && /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i.test(block)) {
    const dm = block.match(/((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d{1,2},?\s+\d{4})/i)
    if (dm) out.date = dm[1].trim()
  }
  if (!out.time) {
    const tm = block.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM))\b/)
    if (tm) out.time = tm[1].trim()
  }

  return out
}

function splitVenue(block) {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length >= 2) {
    return { name: lines[0], address: lines.slice(1).join('\n') }
  }
  const comma = block.indexOf(',')
  if (comma > 0 && comma < block.length - 3) {
    return {
      name: block.slice(0, comma).trim(),
      address: block.slice(comma + 1).trim(),
    }
  }
  return { name: block, address: '' }
}

function normalizeAgendaText(s) {
  return s
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
