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
const KNOWN_ID_SET = new Set(KBYG_SECTION_DEFS.map((d) => d.id))

/** Escape a string for safe use inside RegExp (including surrogate pairs). */
function escapeRegExpString(s) {
  return s.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&')
}

const KNOWN_HEADER_RE = new RegExp(
  `^(${Object.keys(EMOJI_TO_ID)
    .map((e) => escapeRegExpString(e))
    .join('|')})\\s+(.+)$`,
)

/**
 * Emoji cluster at line start (supports compound sequences like 🏳️‍🌈, flags, skin tones).
 * Group 1 = full emoji run, Group 2 = title text.
 */
const EMOJI_HEADER_RE =
  /^((?:\p{Extended_Pictographic}(?:\u200D\p{Extended_Pictographic})*(?:\uFE0F)?)+)\s+(.+)$/u

/**
 * Map plain-language / alternate titles to canonical section ids (updates & text-only headers).
 */
const TITLE_TO_CANONICAL = [
  { re: /^(key\s+)?contacts?$/i, id: 'keyContacts' },
  { re: /^event\s*&?\s*venue$/i, id: 'eventVenue' },
  { re: /^(booth|exhibit|hall|demo)\s+hours?$/i, id: 'boothHours' },
  { re: /^hours?$/i, id: 'boothHours' },
  { re: /^setup\s*&?\s*move[-\s]?in$/i, id: 'setupMoveIn' },
  { re: /^move[-\s]?in$/i, id: 'setupMoveIn' },
  { re: /^teardown\s*[\/]\s*move[-\s]?out$/i, id: 'teardownMoveOut' },
  { re: /^move[-\s]?out$/i, id: 'teardownMoveOut' },
  { re: /^parking\s*[&+]?\s*transportation$/i, id: 'parkingTransportation' },
  { re: /^parking$/i, id: 'parkingTransportation' },
  { re: /^transportation$/i, id: 'parkingTransportation' },
  {
    re: /^(logistics(\s|[\/]|$)|booth\s+info\b|wi-?fi\b|wifi\b|wi\s*fi\b|network\b|internet\b)/i,
    id: 'logisticsBoothInfo',
  },
  { re: /^tickets?$/i, id: 'tickets' },
  { re: /^lead\s+capture$/i, id: 'leadCapture' },
  { re: /^additional\s+notes?$/i, id: 'additionalNotes' },
]

function matchCanonicalTitle(line) {
  const t = trim(line)
  if (!t) return null
  const md = t.match(/^#{1,3}\s*(.+)$/)
  const candidate = md ? trim(md[1]) : t
  for (const { re, id } of TITLE_TO_CANONICAL) {
    if (re.test(candidate)) return id
  }
  const bold = candidate.match(/^\*{1,2}([^*]+)\*{1,2}$/)
  if (bold) {
    const inner = trim(bold[1])
    for (const { re, id } of TITLE_TO_CANONICAL) {
      if (re.test(inner)) return id
    }
  }
  return null
}

function normalizeTitleKey(title) {
  return trim(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

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

function nextDynamicKey(seq, emoji, title) {
  return `__dyn:${seq}:${emoji}:${slugTitle(title)}`
}

function nextTextDynamicKey(seq, title) {
  return `__dynTxt:${seq}:${slugTitle(title)}`
}

/**
 * Known emoji header first; any emoji cluster + title → known id or dynamic;
 * plain-language titles → canonical id.
 * Optional plain standalone titles (e.g. "Raffle") only when allowPlainTitle (block fallback).
 */
function parseHeaderLine(line, opts = {}) {
  const allowPlainTitle = opts.allowPlainTitle === true
  const t = trim(line)
  const known = t.match(KNOWN_HEADER_RE)
  if (known && EMOJI_TO_ID[known[1]]) {
    return { kind: 'known', id: EMOJI_TO_ID[known[1]] }
  }

  const emojiMatch = t.match(EMOJI_HEADER_RE)
  if (emojiMatch) {
    const emoji = emojiMatch[1]
    const title = trim(emojiMatch[2])
    if (!title) return null
    if (EMOJI_TO_ID[emoji]) return { kind: 'known', id: EMOJI_TO_ID[emoji] }

    const canon = matchCanonicalTitle(title)
    if (canon) return { kind: 'known', id: canon }

    return { kind: 'dynamic', emoji, title }
  }

  const canonOnly = matchCanonicalTitle(t)
  if (canonOnly) return { kind: 'known', id: canonOnly }

  if (allowPlainTitle) {
    const plain = looksLikePlainSectionTitle(t)
    if (plain) return { kind: 'dynamicText', title: plain }
  }

  return null
}

/** Short title-only line for block-first-line detection (e.g. "Raffle", "Speaker Lineup"). */
function looksLikePlainSectionTitle(line) {
  const t = trim(line)
  if (t.length < 2 || t.length > 72) return null
  if (/^#{1,3}\s/.test(t)) return null
  if (EMOJI_HEADER_RE.test(t)) return null
  if (/^[•\-–—*]\s/.test(t)) return null
  if (/^\d+\.\s/.test(t)) return null
  if (/[\d:]/.test(t)) return null
  const oneLine = !/[\r\n]/.test(t)
  if (!oneLine) return null
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length > 10) return null
  if (/[.!?]\s*$/.test(t) && words.length > 6) return null

  const particles = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'in', 'on', 'at', 'for', 'to', 'vs'])
  if (words.length >= 2) {
    const ok = words.every((w, i) => {
      if (particles.has(w.toLowerCase()) && i > 0) return true
      return /^[A-Z][a-zA-Z'-]*$/.test(w) || /^[A-Z]{2,}$/.test(w)
    })
    if (!ok) return null
  } else if (!/^[A-Za-z][a-zA-Z'-]{1,39}$/.test(t)) {
    return null
  }

  return t
}

function assignHeader(result, hdr, seqRef, addOrder) {
  if (hdr.kind === 'known') {
    return hdr.id
  }
  if (hdr.kind === 'dynamicText') {
    seqRef[0] += 1
    const key = nextTextDynamicKey(seqRef[0], hdr.title)
    result.dynMeta[key] = { emoji: '📌', title: hdr.title }
    addOrder(key)
    return key
  }
  seqRef[0] += 1
  const key = nextDynamicKey(seqRef[0], hdr.emoji, hdr.title)
  result.dynMeta[key] = { emoji: hdr.emoji, title: hdr.title }
  addOrder(key)
  return key
}

function parseStructuredKbygFromLines(lines) {
  /** @type {ParsedKbyg} */
  const result = { sections: {}, order: [], dynMeta: {} }
  const seenOrder = new Set()
  const seqRef = [0]

  let currentKey = null
  /** @type {string[]} */
  let buf = []

  const addOrder = (key) => {
    if (!seenOrder.has(key)) {
      seenOrder.add(key)
      result.order.push(key)
    }
  }

  const flushOrphanAsPreamble = (orphan) => {
    seqRef[0] += 1
    const introKey = nextDynamicKey(seqRef[0], '📌', 'Details')
    result.sections[introKey] = orphan
    result.dynMeta[introKey] = { emoji: '📌', title: 'Details' }
    addOrder(introKey)
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
    const trimmedLine = trim(line)
    const plainTitle = looksLikePlainSectionTitle(trimmedLine)
    if (plainTitle && currentKey && buf.length > 0 && buf[buf.length - 1] === '') {
      while (buf.length && buf[buf.length - 1] === '') buf.pop()
      flush()
      currentKey = assignHeader(
        result,
        { kind: 'dynamicText', title: plainTitle },
        seqRef,
        addOrder,
      )
      continue
    }

    const hdr = parseHeaderLine(line)
    if (hdr) {
      flush()
      if (!currentKey && buf.length > 0) {
        const orphan = buf.join('\n').trim()
        buf = []
        if (orphan) flushOrphanAsPreamble(orphan)
      }

      currentKey = assignHeader(result, hdr, seqRef, addOrder)
      if (hdr.kind === 'known') addOrder(currentKey)
      continue
    }

    buf.push(line)
  }

  flush()

  if (!currentKey && buf.length > 0) {
    const orphan = buf.join('\n').trim()
    if (orphan) {
      seqRef[0] += 1
      const k = nextDynamicKey(seqRef[0], '📌', 'Details')
      result.sections[k] = orphan
      result.dynMeta[k] = { emoji: '📌', title: 'Details' }
      addOrder(k)
    }
  }

  return result
}

/**
 * When no headers were found, split on blank lines and treat each block as a section if
 * the first line looks like a header; otherwise keep one blob for last-resort handling.
 */
function parseFallbackBlocks(raw) {
  const trimmed = trim(raw)
  if (!trimmed) return emptyParsed()

  const blocks = trimmed.split(/\n\s*\n+/).map((b) => trim(b)).filter(Boolean)
  if (blocks.length === 0) return emptyParsed()

  /** @type {ParsedKbyg} */
  const result = { sections: {}, order: [], dynMeta: {} }
  const seqRef = [0]
  const seenOrder = new Set()
  const addOrder = (key) => {
    if (!seenOrder.has(key)) {
      seenOrder.add(key)
      result.order.push(key)
    }
  }

  for (const block of blocks) {
    const lines = block.split('\n')
    const first = lines[0]
    const rest = lines.slice(1)
    const hdr = parseHeaderLine(first, { allowPlainTitle: true })
    if (hdr) {
      const key = assignHeader(result, hdr, seqRef, addOrder)
      if (hdr.kind === 'known') addOrder(key)
      const body = rest.join('\n').trim()
      if (body) {
        if (result.sections[key]) result.sections[key] += `\n\n${body}`
        else result.sections[key] = body
      }
      continue
    }

    seqRef[0] += 1
    const titleFromFirst = looksLikePlainSectionTitle(first)
    if (titleFromFirst && rest.length > 0) {
      const key = nextTextDynamicKey(seqRef[0], titleFromFirst)
      result.dynMeta[key] = { emoji: '📌', title: titleFromFirst }
      result.sections[key] = rest.join('\n').trim()
      addOrder(key)
    } else {
      const key = nextDynamicKey(seqRef[0], '📌', `block-${seqRef[0]}`)
      result.dynMeta[key] = { emoji: '📌', title: 'Details' }
      result.sections[key] = block
      addOrder(key)
    }
  }

  return result
}

function parseStructuredKbygFromRaw(raw) {
  if (!trim(raw)) return emptyParsed()

  const lines = raw.split(/\n/)
  let result = parseStructuredKbygFromLines(lines)

  if (result.order.length === 0 && trim(raw)) {
    result = parseFallbackBlocks(raw)
  }

  if (result.order.length === 0 && trim(raw)) {
    const k = '__lastResort:notes'
    result.sections[k] = trim(raw)
    result.dynMeta[k] = { emoji: '📝', title: 'Notes' }
    result.order.push(k)
  }

  return result
}

function wrapFullTextFallback(text, title = 'Know Before You Go') {
  const k = '__lastResort:wrapped'
  return {
    sections: { [k]: trim(text) },
    order: [k],
    dynMeta: { [k]: { emoji: '📝', title } },
  }
}

function parsedHasContent(p) {
  return Object.keys(p.sections).some((key) => trim(p.sections[key] || ''))
}

/**
 * Optional paste → sections. Prefer parsing the raw text first so emoji headers (e.g. 🎉 Raffle)
 * are preserved; the organizer import pipeline can fold unknown chunks into Additional Notes.
 * Falls back to importer output, then a single section only when nothing else works.
 */
export function parseOptionalDetailsToSections(optionalDetailsRaw) {
  const t = trim(optionalDetailsRaw)
  if (!t) return emptyParsed()

  const rawParsed = parseStructuredKbygFromRaw(t)
  if (parsedHasContent(rawParsed) && !isOnlyLastResortNotes(rawParsed)) return rawParsed

  const { structuredKbygPlain } = processOrganizerImport(t)
  const fromStructured = parseStructuredKbygFromRaw(structuredKbygPlain || '')
  if (parsedHasContent(fromStructured) && !isOnlyLastResortNotes(fromStructured)) return fromStructured

  const wrapped = wrapFullTextFallback(t)
  return wrapped
}

function isOnlyLastResortNotes(p) {
  return p.order.length === 1 && p.order[0] === '__lastResort:notes'
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

function canonicalIdForMeta(meta) {
  if (!meta || !meta.title) return null
  const id = matchCanonicalTitle(meta.title)
  return id
}

function findExistingKeyByTitle(normalized, out) {
  for (const def of KBYG_SECTION_DEFS) {
    if (normalizeTitleKey(def.title) === normalized) return def.id
  }
  for (const key of out.order) {
    const m = out.dynMeta[key]
    if (m && normalizeTitleKey(m.title) === normalized) return key
  }
  for (const key of Object.keys(out.dynMeta)) {
    const m = out.dynMeta[key]
    if (m && normalizeTitleKey(m.title) === normalized) return key
  }
  return null
}

/**
 * Merge parsed KBYG: all section keys (known + dynamic). Newer non-empty updates replace by default.
 * Maps duplicate titles / synonyms onto a single section key when possible.
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

  const resolveTargetKey = (key, meta) => {
    const canon = canonicalIdForMeta(meta)
    if (canon && KNOWN_ID_SET.has(canon)) return canon
    const titleNorm = meta && meta.title ? normalizeTitleKey(meta.title) : ''
    if (titleNorm) {
      const hit = findExistingKeyByTitle(titleNorm, out)
      if (hit) return hit
    }
    if (EMOJI_TO_ID[meta?.emoji]) return EMOJI_TO_ID[meta.emoji]
    return key
  }

  const applyKey = (rawKey, uRaw, meta) => {
    const u = trim(uRaw)
    if (!u) return
    const key = resolveTargetKey(rawKey, meta)
    const e = trim(out.sections[key] || '')
    out.sections[key] = !preferNewer && e ? `${e}\n\n${u}` : u
    if (meta && !out.dynMeta[key] && !KNOWN_ID_SET.has(key)) {
      out.dynMeta[key] = meta
    }
    if (!seen.has(key)) {
      seen.add(key)
      out.order.push(key)
    }
  }

  for (const key of b.order) {
    const u = b.sections[key]
    const meta = b.dynMeta[key]
    if (trim(u || '')) applyKey(key, u, meta)
  }

  for (const key of Object.keys(b.sections)) {
    if (b.order.includes(key)) continue
    const u = b.sections[key]
    const meta = b.dynMeta[key]
    if (trim(u || '')) applyKey(key, u, meta)
  }

  return out
}

/** Preserve line breaks and existing bullets / numbering; light trim per line only. */
function formatBodyLines(body) {
  return trim(body)
    .split('\n')
    .map((l) => trim(l))
    .join('\n')
}

function formatSectionSlack(def, body) {
  const formatted = formatBodyLines(body)
  const lines = formatted.split('\n').filter((l) => trim(l))
  const rendered = lines.map((l) => {
    const t = trim(l)
    if (!t) return ''
    if (/^[•\-–—*]\s/.test(t) || /^\d+\.\s/.test(t)) return t
    const stripped = t.replace(/^[\s•\-–—*]+\s*/, '')
    return `• ${stripped}`
  }).filter(Boolean)
  return [`${def.emoji} *${def.title}*`, ...rendered].join('\n')
}

function formatSectionEmail(def, body) {
  const formatted = formatBodyLines(body)
  return [`${def.emoji} ${def.title}`, '', formatted].join('\n')
}

function formatSectionDoc(def, body) {
  const formatted = formatBodyLines(body)
  return [`${def.title}`, '', formatted].join('\n')
}

function formatDynamicSection(mode, body, meta) {
  const emoji = meta.emoji || '📌'
  const title = meta.title || 'Section'
  const formatted = formatBodyLines(body)
  if (mode === 'slack') {
    const lines = formatted.split('\n').filter((l) => trim(l))
    const rendered = lines.map((l) => {
      const t = trim(l)
      if (!t) return ''
      if (/^[•\-–—*]\s/.test(t) || /^\d+\.\s/.test(t)) return t
      const stripped = t.replace(/^[\s•\-–—*]+\s*/, '')
      return `• ${stripped}`
    }).filter(Boolean)
    return [`${emoji} *${title}*`, ...rendered].join('\n')
  }
  if (mode === 'email') return [`${emoji} ${title}`, '', formatted].join('\n')
  return [`${title}`, '', formatted].join('\n')
}

const DEF_BY_ID = Object.fromEntries(KBYG_SECTION_DEFS.map((d) => [d.id, d]))

/** Render merged sections in encounter order (preserves pasted / merged structure). */
function renderByMode(parsed, mode, eventName) {
  const { sections, order, dynMeta } = parsed
  const blocks = []
  const used = new Set()

  const pushKey = (key) => {
    const body = trim(sections[key] || '')
    if (!body || used.has(key)) return
    used.add(key)
    if (KNOWN_ID_SET.has(key)) {
      const def = DEF_BY_ID[key]
      if (mode === 'slack') blocks.push(formatSectionSlack(def, body))
      else if (mode === 'email') blocks.push(formatSectionEmail(def, body))
      else blocks.push(formatSectionDoc(def, body))
      return
    }
    const meta = dynMeta[key] || { emoji: '📌', title: 'Section' }
    blocks.push(formatDynamicSection(mode, body, meta))
  }

  for (const key of order) {
    pushKey(key)
  }

  for (const key of Object.keys(sections)) {
    pushKey(key)
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

function shouldUseRawWrapFallback(parsed, raw) {
  if (!trim(raw)) return false
  if (!parsedHasContent(parsed)) return true
  if (parsed.order.length === 1 && parsed.order[0] === '__lastResort:notes') return true
  return false
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
  if (shouldUseRawWrapFallback(existingParsed, rawExisting)) {
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

/**
 * Parse structured KBYG plain text into sections, preserving order (known + unknown emoji sections).
 * Unknown headers (e.g. 🎉 Raffle) become dynamic keys with metadata for rendering.
 * @returns {ParsedKbyg}
 */
export function parseStructuredKbygToSections(text) {
  const raw = stripParsingDebugBlock(text)
  return parseStructuredKbygFromRaw(raw)
}
