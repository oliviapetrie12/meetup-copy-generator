/**
 * Enhance structured Know Before You Go: merge with optional updates, format for Slack / Email / Doc.
 */

import { processOrganizerImport } from './conferenceOrganizerImport.js'

function trim(s) {
  return typeof s === 'string' ? s.trim() : ''
}

/** Canonical section order and emoji headers (must match parser output). */
export const KBYG_SECTION_DEFS = [
  { id: 'keyContacts', emoji: '🔑', title: 'Key Contacts' },
  { id: 'eventVenue', emoji: '📍', title: 'Event & Venue' },
  { id: 'boothHours', emoji: '🕒', title: 'Booth Hours' },
  { id: 'setupMoveIn', emoji: '🛠️', title: 'Setup & Move-in' },
  { id: 'teardownMoveOut', emoji: '📦', title: 'Teardown / Move-out' },
  { id: 'parkingTransportation', emoji: '🚗', title: 'Parking & Transportation' },
  { id: 'logisticsBoothInfo', emoji: '📋', title: 'Logistics / Booth Info' },
  { id: 'tickets', emoji: '🎟️', title: 'Tickets' },
  { id: 'leadCapture', emoji: '📱', title: 'Lead Capture' },
  { id: 'additionalNotes', emoji: '📎', title: 'Additional Notes' },
]

const EMOJI_TO_ID = Object.fromEntries(KBYG_SECTION_DEFS.map((d) => [d.emoji, d.id]))
const KNOWN_HEADER_RE = /^([🔑📍🕒🛠️📦🚗📋🎟️📱📎])\s+(.+)$/
const KNOWN_ID_SET = new Set(KBYG_SECTION_DEFS.map((d) => d.id))

/** @typedef {{ sections: Record<string, string>, order: string[], dynMeta: Record<string, { emoji: string, title: string }> }} ParsedKbyg */

function stripParsingDebugBlock(text) {
  const t = trim(text)
  const idx = t.search(/\n\s*Parsing Debug Info\s*\n/i)
  if (idx === -1) return t
  return trim(t.slice(0, idx))
}

function emptyParsed() {
  return { sections: {}, order: [], dynMeta: {} }
}

function slugTitle(title) {
  const s = trim(title)
    .toLowerCase()
    .replace(/[^\w\d]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return s || 'section'
}

/**
 * Known emoji header first; otherwise any single extended pictographic + title → dynamic section.
 */
function parseHeaderLine(line) {
  const t = trim(line)
  const known = t.match(KNOWN_HEADER_RE)
  if (known && EMOJI_TO_ID[known[1]]) {
    return { kind: 'known', id: EMOJI_TO_ID[known[1]] }
  }

  const dyn = t.match(/^(\p{Extended_Pictographic})\uFE0F?\s+(.+)$/u)
  if (!dyn) return null
  const emoji = dyn[1]
  const title = trim(dyn[2])
  if (!title) return null
  if (EMOJI_TO_ID[emoji]) return { kind: 'known', id: EMOJI_TO_ID[emoji] }

  return { kind: 'dynamic', emoji, title }
}

function nextDynamicKey(seq, emoji, title) {
  return `__dyn:${seq}:${emoji}:${slugTitle(title)}`
}

/**
 * Parse structured KBYG plain text into sections, preserving order (known + unknown emoji sections).
 * Unknown headers (e.g. 🎉 Raffle) become dynamic keys with metadata for rendering.
 * @returns {ParsedKbyg}
 */
export function parseStructuredKbygToSections(text) {
  const raw = stripParsingDebugBlock(text)
  return parseStructuredKbygFromRaw(raw)
}

function parseStructuredKbygFromRaw(raw) {
  if (!trim(raw)) return emptyParsed()

  const lines = raw.split(/\n/)
  /** @type {ParsedKbyg} */
  const result = { sections: {}, order: [], dynMeta: {} }
  const seenOrder = new Set()

  let seq = 0
  let currentKey = null
  /** @type {string[]} */
  let buf = []

  const addOrder = (key) => {
    if (!seenOrder.has(key)) {
      seenOrder.add(key)
      result.order.push(key)
    }
  }

  const flush = () => {
    if (!currentKey || buf.length === 0) return
    const body = buf.join('\n').trim()
    buf = []
    if (!body) return
    if (result.sections[currentKey]) {
      result.sections[currentKey] = `${result.sections[currentKey]}\n\n${body}`
    } else {
      result.sections[currentKey] = body
    }
  }

  for (const line of lines) {
    const hdr = parseHeaderLine(line)
    if (hdr) {
      flush()
      if (!currentKey && buf.length > 0) {
        const orphan = buf.join('\n').trim()
        buf = []
        if (orphan) {
          seq += 1
          const introKey = nextDynamicKey(seq, '📝', 'Notes')
          result.sections[introKey] = orphan
          result.dynMeta[introKey] = { emoji: '📝', title: 'Notes' }
          addOrder(introKey)
        }
      }

      if (hdr.kind === 'known') {
        currentKey = hdr.id
      } else {
        seq += 1
        currentKey = nextDynamicKey(seq, hdr.emoji, hdr.title)
        result.dynMeta[currentKey] = { emoji: hdr.emoji, title: hdr.title }
      }
      addOrder(currentKey)
      continue
    }

    buf.push(line)
  }

  flush()

  if (!currentKey && buf.length > 0) {
    const orphan = buf.join('\n').trim()
    if (orphan) {
      seq += 1
      const k = nextDynamicKey(seq, '📎', 'Content')
      result.sections[k] = orphan
      result.dynMeta[k] = { emoji: '📎', title: 'Content' }
      addOrder(k)
    }
  }

  if (result.order.length === 0 && trim(raw)) {
    const k = `__dyn:${++seq}:📎:full-text`
    result.sections[k] = trim(raw)
    result.dynMeta[k] = { emoji: '📎', title: 'Content' }
    result.order.push(k)
  }

  return result
}

function wrapFullTextFallback(text, title = 'Updates') {
  const k = '__dyn:0:📎:pasted-update'
  return {
    sections: { [k]: trim(text) },
    order: [k],
    dynMeta: { [k]: { emoji: '📎', title } },
  }
}

function parsedHasContent(p) {
  return Object.keys(p.sections).some((key) => trim(p.sections[key] || ''))
}

/**
 * Optional paste → sections. Prefer parsing the raw text first so emoji headers (e.g. 🎉 Raffle)
 * are preserved; the organizer import pipeline can fold unknown chunks into Additional Notes.
 * Falls back to importer output, then a single section so nothing is dropped.
 */
export function parseOptionalDetailsToSections(optionalDetailsRaw) {
  const t = trim(optionalDetailsRaw)
  if (!t) return emptyParsed()

  const rawParsed = parseStructuredKbygFromRaw(t)
  if (parsedHasContent(rawParsed)) return rawParsed

  const { structuredKbygPlain } = processOrganizerImport(t)
  const fromStructured = parseStructuredKbygFromRaw(structuredKbygPlain || '')
  if (parsedHasContent(fromStructured)) return fromStructured

  return wrapFullTextFallback(t)
}

function ensureParsed(v) {
  if (v && typeof v === 'object' && Array.isArray(v.order) && v.sections) {
    return {
      sections: { ...v.sections },
      order: [...v.order],
      dynMeta: { ...(v.dynMeta || {}) },
    }
  }
  if (v && typeof v === 'object' && !Array.isArray(v) && v !== null) {
    const sections = /** @type {Record<string, string>} */ ({ ...v })
    const order = inferOrderFromLegacySections(sections)
    return { sections, order, dynMeta: {} }
  }
  return emptyParsed()
}

function inferOrderFromLegacySections(sections) {
  const order = []
  const seen = new Set()
  for (const { id } of KBYG_SECTION_DEFS) {
    if (trim(sections[id] || '')) {
      order.push(id)
      seen.add(id)
    }
  }
  for (const k of Object.keys(sections)) {
    if (!seen.has(k) && trim(sections[k] || '')) {
      order.push(k)
      seen.add(k)
    }
  }
  return order
}

/**
 * Merge parsed KBYG: all section keys (known + dynamic). Newer non-empty updates replace by default.
 * @param {ParsedKbyg | Record<string, string>} existingInput
 * @param {ParsedKbyg | Record<string, string>} updatesInput
 */
export function mergeKbygSections(existingInput, updatesInput, preferNewer = true) {
  const a = ensureParsed(existingInput)
  const b = ensureParsed(updatesInput)

  /** @type {ParsedKbyg} */
  const out = {
    sections: { ...a.sections },
    order: [...a.order],
    dynMeta: { ...a.dynMeta, ...b.dynMeta },
  }

  const seen = new Set(out.order)

  const applyKey = (key, uRaw) => {
    const u = trim(uRaw)
    if (!u) return
    const e = trim(out.sections[key] || '')
    out.sections[key] = !preferNewer && e ? `${e}\n\n${u}` : u
    if (!seen.has(key)) {
      seen.add(key)
      out.order.push(key)
    }
  }

  for (const key of b.order) {
    const u = b.sections[key]
    if (trim(u || '')) applyKey(key, u)
  }

  for (const key of Object.keys(b.sections)) {
    if (b.order.includes(key)) continue
    const u = b.sections[key]
    if (trim(u || '')) applyKey(key, u)
  }

  return out
}

function bulletsToLines(body) {
  const lines = body.split('\n').map((l) => trim(l)).filter(Boolean)
  return lines.map((l) => {
    const stripped = l.replace(/^[\s•\-–—*]+\s*/, '')
    return `• ${stripped}`
  })
}

function formatSectionSlack(def, body) {
  const lines = bulletsToLines(body)
  return [`${def.emoji} *${def.title}*`, ...lines].join('\n')
}

function formatSectionEmail(def, body) {
  const lines = bulletsToLines(body)
  return [`${def.emoji} ${def.title}`, '', ...lines].join('\n')
}

function formatSectionDoc(def, body) {
  const lines = bulletsToLines(body)
  return [`${def.title}`, '', ...lines].join('\n')
}

function formatDynamicSection(mode, body, meta) {
  const emoji = meta.emoji || '📎'
  const title = meta.title || 'Section'
  const lines = bulletsToLines(body)
  if (mode === 'slack') return [`${emoji} *${title}*`, ...lines].join('\n')
  if (mode === 'email') return [`${emoji} ${title}`, '', ...lines].join('\n')
  return [`${title}`, '', ...lines].join('\n')
}

/** Render merged sections: canonical known order first, then dynamic sections in encounter order. */
function renderByMode(parsed, mode, eventName) {
  const { sections, order, dynMeta } = parsed
  const blocks = []
  const knownIds = KNOWN_ID_SET
  const used = new Set()

  for (const def of KBYG_SECTION_DEFS) {
    const body = trim(sections[def.id] || '')
    if (!body) continue
    if (mode === 'slack') blocks.push(formatSectionSlack(def, body))
    else if (mode === 'email') blocks.push(formatSectionEmail(def, body))
    else blocks.push(formatSectionDoc(def, body))
    used.add(def.id)
  }

  const seenDyn = new Set()
  for (const key of order) {
    if (knownIds.has(key)) continue
    const body = trim(sections[key] || '')
    if (!body || seenDyn.has(key)) continue
    seenDyn.add(key)
    const meta = dynMeta[key] || { emoji: '📎', title: 'Section' }
    blocks.push(formatDynamicSection(mode, body, meta))
    used.add(key)
  }

  for (const key of Object.keys(sections)) {
    if (used.has(key)) continue
    const body = trim(sections[key] || '')
    if (!body) continue
    const meta = dynMeta[key] || { emoji: '📎', title: 'Section' }
    blocks.push(formatDynamicSection(mode, body, meta))
  }

  if (blocks.length === 0) {
    return ''
  }

  const sep = mode === 'slack' ? '\n' : '\n\n'
  let core = blocks.join(sep)

  if (mode === 'email') {
    const name = trim(eventName) || 'this event'
    core = `Hi team, here's the Know Before You Go for ${name}:\n\n${core}`
  }

  return core.trim()
}

/** Email body without the standard intro line (used to detect intro-only output). */
function stripEmailIntro(text, mode) {
  if (mode !== 'email' || !trim(text)) return trim(text || '')
  return trim(
    text.replace(/^Hi team, here's the Know Before You Go for [^:\n]+:\s*\n*/is, ''),
  )
}

function isEffectivelyEmptyOutput(output, mode) {
  return !trim(stripEmailIntro(output, mode))
}

/**
 * Full enhance pipeline.
 * @param {{ existingStructuredKbyg: string, optionalNewDetails?: string, mode: 'slack'|'email'|'doc', eventName?: string }} input
 * @returns {{ output: string, mergedSections: Record<string, string> }}
 * mergedSections includes known ids and dynamic keys (__dyn:…).
 */
export function enhanceKbygOutput(input) {
  const mode = input.mode || 'email'
  const eventName = input.eventName || ''

  const rawExisting = stripParsingDebugBlock(input.existingStructuredKbyg || '')
  let existingParsed = parseStructuredKbygFromRaw(rawExisting)
  if (!parsedHasContent(existingParsed) && trim(rawExisting)) {
    existingParsed = wrapFullTextFallback(rawExisting, 'Know Before You Go')
  }

  const optRaw = trim(input.optionalNewDetails || '')

  /** Always base merge on existing sections; skip updates entirely when none pasted. */
  let mergedParsed
  if (!optRaw) {
    mergedParsed = ensureParsed(existingParsed)
  } else {
    const updatesParsed = parseOptionalDetailsToSections(optRaw)
    mergedParsed = mergeKbygSections(existingParsed, updatesParsed, true)
  }

  let output = renderByMode(mergedParsed, mode, eventName)

  if (isEffectivelyEmptyOutput(output, mode)) {
    output = renderByMode(ensureParsed(existingParsed), mode, eventName)
  }
  if (isEffectivelyEmptyOutput(output, mode) && trim(rawExisting)) {
    output = renderByMode(wrapFullTextFallback(rawExisting, 'Know Before You Go'), mode, eventName)
  }

  return { output: trim(output), mergedSections: mergedParsed.sections }
}
