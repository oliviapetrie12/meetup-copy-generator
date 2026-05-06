/**
 * @typedef {{ time: string, title: string, speaker: string, timePlain?: boolean }} AgendaItem
 */

/**
 * Parse KBYG-style internal agenda: time range lines with optional speaker on next line.
 * @returns {Array<{ type: 'slot'|'raw', timeRange?: string, title?: string, speaker?: string, text?: string }>}
 */
export function parseKbygAgendaBlocks(raw) {
  const lines = String(raw || '')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const m = line.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–—]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*(.*)$/i)
    if (m) {
      const timeRange = `${m[1].replace(/\s+/g, ' ')} – ${m[2].replace(/\s+/g, ' ')}`
      const title = (m[3] || '').trim()
      let speaker = ''
      if (i + 1 < lines.length && !/^\d{1,2}:\d{2}/.test(lines[i + 1])) {
        speaker = lines[i + 1]
        i += 2
      } else {
        i += 1
      }
      blocks.push({ type: 'slot', timeRange, title, speaker })
    } else {
      blocks.push({ type: 'raw', text: line })
      i += 1
    }
  }
  return blocks
}

/** @param {ReturnType<typeof parseKbygAgendaBlocks>} blocks */
export function kbygBlocksToAgendaItems(blocks) {
  const out = []
  for (const b of blocks) {
    if (b.type === 'raw') {
      out.push({ time: '', title: b.text || '', speaker: '' })
    } else {
      out.push({
        time: b.timeRange || '',
        title: b.title || '',
        speaker: b.speaker || '',
      })
    }
  }
  return out
}

/**
 * Turn freeform agenda text into structured items (time / title / speaker).
 * Uses KBYG slot parsing when present; otherwise line-by-line heuristics.
 * @param {string} text
 * @returns {AgendaItem[]}
 */
export function agendaPlainTextToAgendaItems(text) {
  const raw = String(text || '').trim()
  if (!raw) return []
  const blocks = parseKbygAgendaBlocks(raw)
  if (blocks.some((b) => b.type === 'slot')) {
    return kbygBlocksToAgendaItems(blocks)
  }
  const lines = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean)
  /** @type {AgendaItem[]} */
  const items = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const range = line.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–—]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(.*)$/i)
    if (range) {
      const time = `${range[1].replace(/\s+/g, ' ')} – ${range[2].replace(/\s+/g, ' ')}`
      const title = (range[3] || '').trim()
      let speaker = ''
      if (i + 1 < lines.length && !/^\d/.test(lines[i + 1])) {
        speaker = lines[i + 1]
        i += 2
      } else {
        i += 1
      }
      items.push({ time, title, speaker })
      continue
    }
    const clockRest = line.match(/^(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s+(.+)$/i)
    if (clockRest) {
      items.push({ time: clockRest[1].replace(/\s+/g, ' '), title: clockRest[2].trim(), speaker: '' })
      i += 1
      continue
    }
    items.push({ time: '', title: line, speaker: '' })
    i += 1
  }
  return items
}
