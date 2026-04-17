/**
 * Enhance structured Know Before You Go: merge with optional updates, detect gaps, format for Slack / Email / Doc.
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

/** Logistics checklist — must not invent content; only list absent sections. */
const LOGISTICS_REQUIRED_IDS = ['boothHours', 'setupMoveIn', 'teardownMoveOut', 'parkingTransportation', 'keyContacts']

const MISSING_LABELS = {
  boothHours: 'Booth Hours',
  setupMoveIn: 'Setup / Move-in time',
  teardownMoveOut: 'Teardown / Move-out time',
  parkingTransportation: 'Parking / Transportation details',
  keyContacts: 'Key Contact(s)',
}

function stripParsingDebugBlock(text) {
  const t = trim(text)
  const idx = t.search(/\n\s*Parsing Debug Info\s*\n/i)
  if (idx === -1) return t
  return trim(t.slice(0, idx))
}

/**
 * Parse structured KBYG plain text (emoji section headers) into a map of section id → body (no header line).
 * @returns {Record<string, string>}
 */
export function parseStructuredKbygToSections(text) {
  const raw = stripParsingDebugBlock(text)
  if (!raw) return {}

  const lines = raw.split(/\n/)
  /** @type {Record<string, string>} */
  const sections = {}
  let currentId = null
  const buf = []

  const flush = () => {
    if (currentId && buf.length) {
      const body = buf.join('\n').trim()
      if (body) sections[currentId] = body
    }
    buf.length = 0
  }

  const headerRe = /^([🔑📍🕒🛠️📦🚗📋🎟️📱📎])\s+(.+)$/

  for (const line of lines) {
    const m = line.match(headerRe)
    if (m && EMOJI_TO_ID[m[1]]) {
      flush()
      currentId = EMOJI_TO_ID[m[1]]
    } else if (currentId) {
      buf.push(line)
    }
  }
  flush()
  return sections
}

/**
 * STEP 1: Merge — keep existing; where updates provide non-empty text for a section, prefer newer (replace).
 * @param {Record<string, string>} existing
 * @param {Record<string, string>} updates
 */
export function mergeKbygSections(existing, updates, preferNewer = true) {
  /** @type {Record<string, string>} */
  const out = { ...existing }
  for (const { id } of KBYG_SECTION_DEFS) {
    const u = trim(updates[id] || '')
    const e = trim(existing[id] || '')
    if (!u) continue
    if (!preferNewer && e) out[id] = `${e}\n\n${u}`
    else out[id] = u
  }
  return out
}

/**
 * Optional paste → structured sections via organizer import pipeline.
 */
export function parseOptionalDetailsToSections(optionalDetailsRaw) {
  const t = trim(optionalDetailsRaw)
  if (!t) return {}
  const { structuredKbygPlain } = processOrganizerImport(t, { debug: false })
  return parseStructuredKbygToSections(structuredKbygPlain || '')
}

function sectionLooksEmptyOrUnclear(body) {
  const b = trim(body)
  if (!b) return true
  if (b.length < 4) return true
  if (/^(tbd|n\/a|tba|unknown|none)\.?$/i.test(b)) return true
  return false
}

/**
 * STEP 2: List missing logistics fields (no fabrication).
 * @param {Record<string, string>} sections
 * @returns {string[]}
 */
export function detectMissingLogistics(sections) {
  const missing = []
  for (const id of LOGISTICS_REQUIRED_IDS) {
    if (sectionLooksEmptyOrUnclear(sections[id])) {
      missing.push(MISSING_LABELS[id] || id)
    }
  }
  return missing
}

function bulletsToLines(body) {
  const lines = body.split(/\n/).map((l) => trim(l)).filter(Boolean)
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

/**
 * STEP 3–4: Render merged sections in order; omit empty.
 */
function renderByMode(sections, mode, eventName, missingItems) {
  const blocks = []
  for (const def of KBYG_SECTION_DEFS) {
    const body = trim(sections[def.id] || '')
    if (!body) continue
    if (mode === 'slack') blocks.push(formatSectionSlack(def, body))
    else if (mode === 'email') blocks.push(formatSectionEmail(def, body))
    else blocks.push(formatSectionDoc(def, body))
  }

  if (missingItems.length) {
    const missLines = missingItems.map((m) => `• ${m}`)
    if (mode === 'slack') {
      blocks.push(['⚠️ *Missing or Unclear Information*', ...missLines].join('\n'))
    } else if (mode === 'email') {
      blocks.push(['⚠️ Missing or Unclear Information', '', ...missLines].join('\n'))
    } else {
      blocks.push(['Missing or Unclear Information', '', ...missLines].join('\n'))
    }
  }

  const sep = mode === 'slack' ? '\n' : '\n\n'
  let core = blocks.join(sep)

  if (mode === 'email') {
    const name = trim(eventName) || 'this event'
    core = `Hi team, here's the Know Before You Go for ${name}:\n\n${core}`
  }

  return core.trim()
}

/**
 * Full enhance pipeline.
 * @param {{ existingStructuredKbyg: string, optionalNewDetails?: string, mode: 'slack'|'email'|'doc', eventName?: string }} input
 * @returns {{ output: string, mergedSections: Record<string, string>, missingItems: string[] }}
 */
export function enhanceKbygOutput(input) {
  const existing = parseStructuredKbygToSections(input.existingStructuredKbyg || '')
  const updates = parseOptionalDetailsToSections(input.optionalNewDetails || '')
  const merged = mergeKbygSections(existing, updates, true)
  const missingItems = detectMissingLogistics(merged)
  const output = renderByMode(merged, input.mode || 'email', input.eventName || '', missingItems)
  return { output, mergedSections: merged, missingItems }
}
