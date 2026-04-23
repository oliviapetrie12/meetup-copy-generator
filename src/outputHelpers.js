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

const NOISY_STYLE_PROPS = new Set([
  'font-family',
  'font-size',
  'font-variant',
  '-webkit-font-smoothing',
])

/**
 * Strip noisy inline styles (font stacks, sizes) and wrap major blocks in &lt;p&gt;
 * so clipboard consumers (Gmail, Docs) get structured HTML instead of raw tags.
 * @param {string} fullHtml Full HTML from buildConferenceEmailHtml (wrapped &lt;div&gt;…)
 * @returns {{ html: string }}
 */
export function prepareConferenceEmailClipboardHtml(fullHtml) {
  if (!fullHtml || typeof fullHtml !== 'string') return { html: '' }

  const doc = new DOMParser().parseFromString(fullHtml, 'text/html')
  const wrapper = doc.body.querySelector('div')
  if (!wrapper) {
    return { html: fullHtml }
  }

  wrapper.querySelectorAll('[style]').forEach((el) => {
    const raw = el.getAttribute('style')
    if (!raw) return
    const kept = []
    for (const part of raw.split(';')) {
      const idx = part.indexOf(':')
      if (idx === -1) continue
      const key = part.slice(0, idx).trim().toLowerCase()
      const val = part.slice(idx + 1).trim()
      if (!key || !val) continue
      if (NOISY_STYLE_PROPS.has(key)) continue
      if (key.startsWith('-webkit-')) continue
      kept.push(`${key}: ${val}`)
    }
    if (kept.length) el.setAttribute('style', kept.join('; '))
    else el.removeAttribute('style')
  })

  wrapper.setAttribute('style', 'line-height:1.5;color:#202124;')

  let inner = wrapper.innerHTML
  const segments = inner
    .split(/(?:<br\s*\/?>(?:\s|&nbsp;|\u00A0)*){2,}/gi)
    .map((s) => s.trim())
    .filter(Boolean)

  if (segments.length === 0) {
    return { html: wrapper.outerHTML }
  }

  const body = segments.map((seg) => `<p style="margin:0 0 14px 0;">${seg}</p>`).join('')
  wrapper.innerHTML = body

  return { html: wrapper.outerHTML }
}
