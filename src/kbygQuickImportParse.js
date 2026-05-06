/**
 * Narrow Quick Import parser — only high-confidence fields.
 * Disabled (manual-only for now): event title, venue name, venue address, parking.
 * Arrival prose only from explicitly labeled sections (see LABELED_ARRIVAL_MATCHERS).
 */

const URL_RE = /https?:\/\/[^\s\]<)"',]+/gi

/** Keys the parser must never write (belt-and-suspenders with mark + merge). */
export const KBYG_QUICK_IMPORT_DISABLED_KEYS = ['eventTitle', 'venueName', 'venueAddress', 'parkingNotes']

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
  speakerArrivalNote: 'kbyg_speakerArrival',
  internalAgenda: 'kbyg_internalAgenda',
}

export const KBYG_QUICK_IMPORT_FIELD_LABELS = {
  meetupLink: 'Meetup link',
  lumaLink: 'Luma link',
  eventDate: 'Event date',
  eventTime: 'Event time',
  arrivalTime: 'Arrival time',
  speakerArrivalNote: 'Speaker arrival',
  internalAgenda: 'Agenda',
}

/**
 * @typedef {{
 *   eventDate?: string
 *   eventTime?: string
 *   arrivalTime?: string
 *   speakerArrivalNote?: string
 *   internalAgenda?: string
 *   meetupLink?: string
 *   lumaLink?: string
 * }} KbygQuickImportPatch */

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
 * User-visible feedback: ordered list + fixed note about location/parking.
 * @param {string[]} appliedKeys keys actually merged into empty fields
 * @param {Record<string, string>} t generator UI strings (meetup KBYG language)
 */
export function formatQuickImportFeedback(appliedKeys, t) {
  if (!appliedKeys || appliedKeys.length === 0) return t.kbyg_quickImportNothing
  const set = new Set(appliedKeys)
  const hasLinks = set.has('meetupLink') || set.has('lumaLink')
  /** @type {string[]} */
  const parts = []
  if (set.has('eventDate')) parts.push(t.kbyg_quickImportFb_date)
  if (set.has('eventTime')) parts.push(t.kbyg_quickImportFb_time)
  if (set.has('internalAgenda')) parts.push(t.kbyg_quickImportFb_agenda)
  if (hasLinks) parts.push(t.kbyg_quickImportFb_eventLinks)
  if (set.has('speakerArrivalNote')) parts.push(t.kbyg_quickImportFb_arrivalInstructions)
  if (set.has('arrivalTime')) parts.push(t.kbyg_quickImportFb_arrivalTime)
  const list = parts.join(', ')
  return `${t.kbyg_quickImportParsedPrefix} ${list}. ${t.kbyg_quickImportManualReviewSuffix}`
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

  const disabled = new Set(KBYG_QUICK_IMPORT_DISABLED_KEYS)

  const mark = (key, value) => {
    if (disabled.has(key) || key === 'eventTitle') return
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

  /** Stop collecting a labeled “Arrival instructions” body when another obvious section starts. */
  const LABELED_ARRIVAL_BODY_STOP =
    /^(?:📍|🅿|🗓|📅|📝|📋)?\s*(location|venue|parking|address|where\b|date\s*(?:and\s*)?time|when\b|agenda|schedule|program|meetup|food|drinks|notes?)\b/i

  /** Date/time, agenda, and strictly labeled arrival only (no location/parking/food/notes). */
  const headerMatchers = [
    {
      keys: [/^(?:📅|🗓)?\s*date\s*(?:and\s*)?time/i, /^when\b/i, /^event\s+time/i],
      assign: 'datetime',
    },
    { keys: [/^(?:📝|📋)?\s*agenda\b/i, /^schedule\b/i, /^program\b/i, /^talks?\b/i], assign: 'agenda' },
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

  if (sections.datetime) {
    applyDateTimeFromBlock(sections.datetime, mark)
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

  if (sections.agenda) {
    mark('internalAgenda', normalizeAgendaText(sections.agenda))
  }

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
  const disabled = new Set(KBYG_QUICK_IMPORT_DISABLED_KEYS)
  for (const [key, value] of Object.entries(patch)) {
    if (disabled.has(key) || key === 'eventTitle') continue
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
