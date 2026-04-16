/**
 * Shorten plain text for faster scanning (deterministic, no LLM).
 * Preserves line breaks between bullets where possible.
 */
export function makeMoreConcise(text) {
  if (text == null || typeof text !== 'string') return ''
  const raw = text.replace(/\r\n/g, '\n').trim()
  if (!raw) return ''

  const fillers = [
    /\bplease note that\b/gi,
    /\bin order to\b/gi,
    /\bthat being said\b/gi,
    /\bjust wanted to\b/gi,
    /\bkind of\b/gi,
    /\bvery\b/g,
    /\breally\b/g,
  ]
  let t = raw
  for (const re of fillers) t = t.replace(re, ' ')
  t = t.replace(/[ \t]+/g, ' ')

  const lines = t.split('\n')
  const out = lines.map((line) => {
    let s = line.trim()
    if (!s) return ''
    const bullet = /^([•\-*]|\d+\.)\s*/.exec(s)
    const prefix = bullet ? bullet[0] : ''
    const rest = bullet ? s.slice(bullet[0].length).trim() : s
    let chunk = rest
    if (chunk.length > 100) {
      const sentences = chunk.split(/(?<=[.!?])\s+/)
      chunk = sentences.slice(0, 2).join(' ')
      if (chunk.length > 180) chunk = `${chunk.slice(0, 177).trim()}…`
    }
    return prefix ? `${prefix}${chunk}` : chunk
  })

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** @typedef {{ key: string, label: string, body: string }} KbygSection */

export function parseKbygPlainSections(plain) {
  if (!plain || typeof plain !== 'string') return []
  const lines = plain.replace(/\r\n/g, '\n').split('\n')
  /** @type {KbygSection[]} */
  const sections = []
  let bucket = []
  let pendingLabel = 'Opening'

  const flush = () => {
    const body = bucket.join('\n').replace(/\n+$/, '').trimEnd()
    if (body || pendingLabel !== 'Opening') {
      sections.push({ key: `sec-${sections.length}`, label: pendingLabel, body })
    }
    bucket = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const m = /^\*\*(.+)\*\*$/.exec(trimmed)
    if (m) {
      flush()
      pendingLabel = m[1].trim()
    } else {
      bucket.push(line)
    }
  }
  flush()
  return sections
}

export function rebuildKbygPlainFromSections(sections) {
  if (!sections.length) return ''
  const parts = []
  for (const s of sections) {
    if (s.label === 'Opening') {
      if (s.body) parts.push(s.body)
    } else {
      parts.push(`**${s.label}**\n${s.body}`)
    }
  }
  return parts.join('\n\n').trim()
}

export function replaceKbygSectionBody(sections, sectionKey, newBody) {
  return sections.map((s) => (s.key === sectionKey ? { ...s, body: newBody } : s))
}
