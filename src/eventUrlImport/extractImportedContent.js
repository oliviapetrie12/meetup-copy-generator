/**
 * Extract plain-text event signal from fetched HTML (JSON-LD first, then visible text).
 * Runs in the browser only — uses DOMParser (no script execution for imported markup).
 */

/** @typedef {{ text: string, partial: boolean, notes: string[] }} ExtractResult */

/**
 * @param {string} html
 * @param {{ pageUrl: string }} ctx
 * @returns {ExtractResult}
 */
export function extractImportedContent(html, ctx) {
  const notes = []
  const ldChunks = extractJsonLdChunks(html)
  const events = []
  for (const raw of ldChunks) {
    try {
      const data = JSON.parse(raw)
      collectSchemaEvents(data, events)
    } catch {
      /* skip malformed */
    }
  }

  const primary = events[0]
  const structuredParts = []
  if (primary) {
    structuredParts.push(formatSchemaOrgEvent(primary, ctx.pageUrl))
    notes.push('structured_data')
  } else {
    notes.push('no_json_ld_event')
  }

  const og = extractOpenGraph(html)
  if (!primary && og.description) {
    structuredParts.push(`Agenda\n${stripTagsToText(og.description)}`)
    notes.push('open_graph_description')
  }

  const visible = extractVisiblePlainText(html)
  const visTrim = visible.replace(/\s+/g, ' ').trim()
  if (visTrim.length > 400) {
    structuredParts.push(`\n---\n${visible.slice(0, 24000)}`)
    notes.push('visible_text')
  } else if (!primary && visTrim.length > 80) {
    structuredParts.push(`\n---\n${visible}`)
    notes.push('visible_text_fallback')
  }

  let text = structuredParts.filter(Boolean).join('\n\n')
  text = normalizeExtractedBlob(text)

  const partial =
    notes.includes('no_json_ld_event') &&
    !notes.includes('open_graph_description') &&
    visTrim.length < 200

  return {
    text,
    partial,
    notes,
  }
}

/**
 * @param {string} html
 */
function extractJsonLdChunks(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  /** @type {string[]} */
  const out = []
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
    const t = el.textContent?.trim()
    if (t) out.push(t)
  })
  return out
}

/**
 * @param {unknown} obj
 * @param {Record<string, unknown>[]} events
 */
function collectSchemaEvents(obj, events) {
  if (obj == null) return
  if (Array.isArray(obj)) {
    obj.forEach((x) => collectSchemaEvents(x, events))
    return
  }
  if (typeof obj !== 'object') return

  const o = /** @type {Record<string, unknown>} */ (obj)
  const type = o['@type']
  const types = Array.isArray(type) ? type : [type]
  if (types.some((t) => t === 'Event')) {
    events.push(o)
  }

  if (o['@graph']) collectSchemaEvents(o['@graph'], events)

  for (const v of Object.values(o)) {
    if (v && typeof v === 'object') collectSchemaEvents(v, events)
  }
}

/**
 * @param {Record<string, unknown>} ev
 * @param {string} pageUrl
 */
function formatSchemaOrgEvent(ev, pageUrl) {
  /** @type {string[]} */
  const lines = []

  lines.push('Date and Time')
  const start = typeof ev.startDate === 'string' ? ev.startDate : ''
  const end = typeof ev.endDate === 'string' ? ev.endDate : ''
  if (start) {
    lines.push(formatIsoRangeLine(start, end))
  }

  const loc = ev.location
  const locText = formatLocationBlock(loc)
  if (locText) {
    lines.push('')
    lines.push('Location')
    lines.push(locText)
  }

  const name = typeof ev.name === 'string' ? ev.name.trim() : ''
  if (name) {
    lines.push('')
    lines.push(`Event name (reference — fill title manually)`)
    lines.push(name)
  }

  const desc = typeof ev.description === 'string' ? ev.description : ''
  if (desc && desc.length > 20) {
    lines.push('')
    lines.push('Agenda')
    lines.push(stripTagsToText(desc).slice(0, 12000))
  }

  const eventUrl =
    (typeof ev.url === 'string' && ev.url) ||
    pageUrl ||
    (typeof ev.offers === 'object' && ev.offers && typeof /** @type {{ url?: string }} */ (ev.offers).url === 'string'
      ? /** @type {{ url?: string }} */ (ev.offers).url
      : '')
  if (eventUrl) {
    lines.push('')
    lines.push('Event links')
    lines.push(eventUrl)
  }

  return lines.join('\n')
}

/**
 * @param {unknown} loc
 */
function formatLocationBlock(loc) {
  if (!loc) return ''
  if (typeof loc === 'string') return loc.trim()

  if (typeof loc === 'object' && loc !== null) {
    const o = /** @type {Record<string, unknown>} */ (loc)
    const name = typeof o.name === 'string' ? o.name.trim() : ''

    const addr = o.address
    let addrStr = ''
    if (typeof addr === 'string') addrStr = addr.trim()
    else if (addr && typeof addr === 'object') {
      const a = /** @type {Record<string, unknown>} */ (addr)
      addrStr = [
        a.streetAddress,
        [a.addressLocality, a.addressRegion].filter(Boolean).join(', '),
        a.postalCode,
      ]
        .filter(Boolean)
        .map((x) => String(x).trim())
        .join(', ')
    }

    if (name && addrStr) return `${name}\n${addrStr}`
    return name || addrStr || ''
  }
  return ''
}

/**
 * @param {string} startIso
 * @param {string} endIso
 */
function formatIsoRangeLine(startIso, endIso) {
  const s = parseIso(startIso)
  const e = endIso ? parseIso(endIso) : null
  if (!s) return startIso

  const dateLine = s.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const optsTime = { hour: 'numeric', minute: '2-digit' }
  const t0 = s.toLocaleTimeString('en-US', { ...optsTime, hour12: true })
  if (e) {
    const t1 = e.toLocaleTimeString('en-US', { ...optsTime, hour12: true })
    return `${dateLine}\n${t0} – ${t1}`
  }
  return `${dateLine}\n${t0}`
}

/**
 * @param {string} iso
 */
function parseIso(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * @param {string} html
 */
function extractOpenGraph(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const getMeta = (prop) =>
    doc.querySelector(`meta[property="${prop}"]`)?.getAttribute('content')?.trim() ||
    doc.querySelector(`meta[name="${prop}"]`)?.getAttribute('content')?.trim() ||
    ''

  return {
    description: getMeta('og:description') || getMeta('description'),
    url: getMeta('og:url'),
  }
}

/**
 * Strip tags for safe plain text (DOMParser textContent).
 * @param {string} htmlish
 */
function stripTagsToText(htmlish) {
  const d = new DOMParser().parseFromString(`<div>${htmlish}</div>`, 'text/html')
  return (d.body.textContent || '').replace(/\s+/g, ' ').trim()
}

/**
 * Visible text fallback — removes script/style trees only.
 * @param {string} html
 */
function extractVisiblePlainText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, noscript, iframe, svg').forEach((el) => el.remove())
  const t = doc.body?.innerText || ''
  return t.replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * @param {string} s
 */
function normalizeExtractedBlob(s) {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}
