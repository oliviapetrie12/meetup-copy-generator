/**
 * KBYG email channel: HTML (Gmail) and plain text from SharedEventData + KBYG form chrome.
 */

import { escapeHtml, escapeHtmlAttr } from '../htmlEscape.js'
import { getMeetupKbygStrings, normalizeLanguage } from '../generationLanguage.js'
import { getMeetupKbygPhotoLines } from '../generationLanguage.js'
import { buildKbygTldrBulletsLean } from '../kbygTldr.js'
import { formatKbygPlainSectionHeading, formatSectionHeader } from '../kbygSectionHeaders.js'
import { KBYG_EMAIL_BODY_SECTION_IDS } from '../kbygEmailSectionOrder.js'
import { augmentKbygAgendaForEmail } from '../kbygAgendaAugment.js'

/** @param {object} form @param {object} opts */
function kbygEmojisEnabled(form, opts) {
  if (typeof opts.emojisEnabled === 'boolean') return opts.emojisEnabled
  return form?.kbygEmojiHeaders !== false
}

/** Clickable label only (no raw URL in the visible HTML). Omit inline font/size styles so Gmail paste stays Normal / Sans Serif. */
function kbygExternalLinkHtml(url, labelText) {
  return `<a href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(labelText)}</a>`
}

/** Ensures pasted/bookmarked links resolve (SpotHero, venue pages, etc.). */
function normalizeKbygHttpUrl(url) {
  const t = typeof url === 'string' ? url.trim() : ''
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

/**
 * Meetup + Luma rows for Event page section (HTML list cells are anchors only).
 * @returns {string[]} inner HTML fragments for each &lt;li&gt;
 */
function kbygEventPageLinkItemsHtml(form, trim, has, S) {
  /** @type {string[]} */
  const items = []
  if (has(form.meetupLink)) items.push(kbygExternalLinkHtml(trim(form.meetupLink), S.meetupEventLinkLabel))
  if (has(form.lumaLink)) items.push(kbygExternalLinkHtml(trim(form.lumaLink), S.lumaRegistrationLinkLabel))
  return items
}

/**
 * Plain-text bullets: markdown links so Paste retains clickable destinations where supported; avoids naked long URLs in the body lines.
 */
function appendKbygEventPagePlain(lines, headingFn, form, S, trim, has) {
  /** @type {string[]} */
  const bullets = []
  if (has(form.meetupLink)) bullets.push(`- [${S.meetupEventLinkLabel}](${trim(form.meetupLink)})`)
  if (has(form.lumaLink)) bullets.push(`- [${S.lumaRegistrationLinkLabel}](${trim(form.lumaLink)})`)
  if (!bullets.length) return
  lines.push(headingFn('registration', S.eventPage))
  bullets.forEach((b) => lines.push(b))
  lines.push('')
}

/** @param {import('../shared/eventData.js').SharedEventData} eventData */
function buildKbygIntroParagraphText(S, eventData, trim) {
  const whenLine = trim(eventData.date)
  const t = trim(eventData.title)
  if (!t && !whenLine) {
    return S.thanksLeanGeneric
  }
  return S.kbygIntroLead(t, whenLine, S.meetupFallbackTitle)
}

/** Semantic list only — no inline font-size/line-height so pasted HTML adopts Gmail “Normal” formatting. */
function kbygHtmlUl(items) {
  if (!items.length) return ''
  const lis = items.map((t) => `<li>${t}</li>`).join('')
  return `<ul>${lis}</ul>`
}

/** @param {import('../shared/agendaItems.js').AgendaItem[]} items */
function buildKbygAgendaHtmlFromItems(items) {
  if (!items.length) return ''
  const lis = items
    .map((it) => {
      const hasSlot = it.time && (it.title || it.speaker)
      if (hasSlot) {
        let inner = `<strong>${escapeHtml(it.time)}</strong>`
        if (it.title) inner += ` – ${escapeHtml(it.title)}`
        if (it.speaker) {
          inner += ` — <em>${escapeHtml(it.speaker)}</em>`
        }
        return `<li>${inner}</li>`
      }
      const text = [it.title, it.speaker].filter(Boolean).join(' — ')
      if (!text) return ''
      return `<li>${escapeHtml(text)}</li>`
    })
    .filter(Boolean)
    .join('')
  if (!lis) return ''
  return `<ul>${lis}</ul>`
}

/**
 * Standalone logistics-related blocks (no parent "Logistics" section).
 * Order: venue → parking → food & beverage → AV.
 * @param {import('../shared/eventData.js').SharedEventData} data
 * @param {(s: string) => string} trim
 * @returns {ReadonlyArray<{ sectionKey: string, title: string, body: string, bulletLines?: string[], parkingBooking?: { url: string, label: string } }>}
 */
function kbygLogisticsStandaloneBlocks(data, trim, S) {
  /** @type {{ sectionKey: string, title: string, body: string, bulletLines?: string[], parkingBooking?: { url: string, label: string } }[]} */
  const blocks = []
  const pushPara = (sectionKey, title, raw) => {
    const body = trim(raw)
    if (!body) return
    blocks.push({ sectionKey, title, body })
  }
  const pushBullets = (sectionKey, title, rawLines) => {
    const cleaned = (Array.isArray(rawLines) ? rawLines : []).map(trim).filter(Boolean)
    if (!cleaned.length) return
    blocks.push({ sectionKey, title, body: '', bulletLines: cleaned })
  }

  pushPara('location', S.location, data.venue)
  {
    const parkingBody = trim(data.parking)
    const bookingRaw = trim(data.parkingBookingUrl || '')
    const bookingUrl = bookingRaw ? normalizeKbygHttpUrl(bookingRaw) : ''
    const bookingLabel = trim(data.parkingBookingLabel || '') || S.parkingBookLinkDefaultLabel
    if (parkingBody || bookingUrl) {
      blocks.push({
        sectionKey: 'parking',
        title: S.parking,
        body: parkingBody,
        parkingBooking: bookingUrl ? { url: bookingUrl, label: bookingLabel } : undefined,
      })
    }
  }
  if (Array.isArray(data.foodLines) && data.foodLines.length > 0) {
    pushBullets('foodDrinks', S.foodBeverage, data.foodLines)
  } else {
    pushPara('foodDrinks', S.foodBeverage, data.food)
  }
  pushPara('avPresentation', S.avSetup, data.av)
  return blocks
}

/** One KBYG section: bold header + body paragraph(s). */
function kbygStandaloneSectionHtml(sectionKey, titlePlain, bodyText, emojisEnabled) {
  const title = formatSectionHeader(sectionKey, titlePlain, emojisEnabled)
  const inner = escapeHtml(bodyText).replace(/\n/g, '<br>')
  return `<p><strong>${escapeHtml(title)}</strong></p><p>${inner}</p>`
}

/**
 * Logistics block: paragraph body, or bullet list (e.g. food vs drink lines from KBYG form).
 * @param {{ sectionKey: string, title: string, body: string, bulletLines?: string[], parkingBooking?: { url: string, label: string } }} block
 */
function kbygStandaloneBlockHtml(block, emojisEnabled, S) {
  const title = formatSectionHeader(block.sectionKey, block.title, emojisEnabled)
  if (block.sectionKey === 'parking' && block.parkingBooking?.url) {
    const linkHtml = kbygExternalLinkHtml(block.parkingBooking.url, block.parkingBooking.label)
    let html = `<p><strong>${escapeHtml(title)}</strong></p>`
    html += `<p>${escapeHtml(S.parkingBookingIntro)}<br>${linkHtml}</p>`
    const bodyText = typeof block.body === 'string' ? block.body.trim() : ''
    if (bodyText) {
      html += `<p>${escapeHtml(bodyText).replace(/\n/g, '<br>')}</p>`
    }
    return html
  }
  if (block.bulletLines && block.bulletLines.length) {
    const items = block.bulletLines.map((line) => escapeHtml(line))
    return `<p><strong>${escapeHtml(title)}</strong></p>${kbygHtmlUl(items)}`
  }
  return kbygStandaloneSectionHtml(block.sectionKey, block.title, block.body, emojisEnabled)
}

/** Append plain lines for one logistics block (heading, optional bullets, trailing blank line). */
function appendKbygStandaloneBlockPlain(lines, headingFn, block, S) {
  lines.push(headingFn(block.sectionKey, block.title))
  if (block.sectionKey === 'parking' && block.parkingBooking?.url) {
    lines.push(S.parkingBookingIntro)
    const label = block.parkingBooking.label || S.parkingBookLinkDefaultLabel
    lines.push(`[${label}](${block.parkingBooking.url})`)
  }
  if (block.bulletLines && block.bulletLines.length) {
    block.bulletLines.forEach((ln) => lines.push(`- ${ln.trimEnd()}`))
  } else {
    const raw = typeof block.body === 'string' ? block.body : ''
    if (raw.trim()) {
      raw.split('\n').forEach((ln) => lines.push(ln.trimEnd()))
    }
  }
  lines.push('')
}

function filterKbygContactEntries(form, has, trim) {
  return (form.contacts || []).filter((c) => has(c.name) || has(c.role) || has(c.contactInfo))
}

function mapKbygContactLines(contactEntries, trim) {
  return contactEntries.map((c) => {
    const name = trim(c.name)
    const role = trim(c.role)
    const info = trim(c.contactInfo)
    let main = ''
    if (name && info) main = `${name} (${info})`
    else if (name) main = name
    else if (info) main = info
    let line = ''
    if (main && role) line = `${main} – ${role}`
    else if (main) line = main
    else line = role
    return escapeHtml(line)
  })
}

/**
 * Body after greeting + intro. Section sequence MUST match {@link KBYG_EMAIL_BODY_SECTION_IDS}.
 * @param {string[]} chunks
 * @param {object} ctx
 */
function appendKbygEmailHtmlBody(chunks, ctx) {
  const { eventData, form, opts, S, trim, has, emojisEnabled, tldrBullets } = ctx

  const steps = [
    () => {
      if (tldrBullets.length === 0) return
      const tldrItems = tldrBullets.map((i) => escapeHtml(i))
      const tldrTitle = formatSectionHeader('reminder', S.tldrHeading, emojisEnabled)
      chunks.push(`<p><strong>${escapeHtml(tldrTitle)}</strong></p>${kbygHtmlUl(tldrItems)}`)
    },
    () => {
      const eventLinkItems = kbygEventPageLinkItemsHtml(form, trim, has, S)
      if (eventLinkItems.length === 0) return
      const eventPageTitle = formatSectionHeader('registration', S.eventPage, emojisEnabled)
      chunks.push(`<p><strong>${escapeHtml(eventPageTitle)}</strong></p>${kbygHtmlUl(eventLinkItems)}`)
    },
    () => {
      const contactEntries = filterKbygContactEntries(form, has, trim)
      if (contactEntries.length === 0) return
      const contactItems = mapKbygContactLines(contactEntries, trim)
      const contactsTitle = formatSectionHeader('contact', S.htmlHelpfulContactsStrong, emojisEnabled)
      chunks.push(`<p><strong>${escapeHtml(contactsTitle)}</strong></p>${kbygHtmlUl(contactItems)}`)
    },
    () => {
      for (const block of kbygLogisticsStandaloneBlocks(eventData, trim, S)) {
        chunks.push(kbygStandaloneBlockHtml(block, emojisEnabled, S))
      }
    },
    () => {
      if (!has(form.speakerArrivalNote)) return
      const arrivalTitle = formatSectionHeader('arrivalInstructions', S.htmlSpeakerArrivalStrong, emojisEnabled)
      chunks.push(
        `<p><strong>${escapeHtml(arrivalTitle)}</strong></p><p>${escapeHtml(trim(form.speakerArrivalNote)).replace(/\n/g, '<br>')}</p>`,
      )
    },
    () => {
      if (form.includePhotos === false) return
      const photoLines = getMeetupKbygPhotoLines(opts.language)
      const photoItems = photoLines.map((line) => escapeHtml(line))
      const photosTitle = formatSectionHeader('photos', S.htmlTakePhotosStrong, emojisEnabled)
      chunks.push(`<p><strong>${escapeHtml(photosTitle)}</strong></p>${kbygHtmlUl(photoItems)}`)
    },
    () => {
      const agendaItems = augmentKbygAgendaForEmail(eventData.agenda, form, S, trim)
      if (agendaItems.length === 0) return
      const agendaHtml = buildKbygAgendaHtmlFromItems(agendaItems)
      if (!agendaHtml) return
      const agendaTitle = formatSectionHeader('agenda', S.htmlAgendaStrong, emojisEnabled)
      chunks.push(`<p><strong>${escapeHtml(agendaTitle)}</strong></p>${agendaHtml}`)
    },
    () => {
      if (!has(form.setupNotes) && !has(form.swagNotes)) return
      const su = []
      if (has(form.setupNotes)) su.push(escapeHtml(trim(form.setupNotes)))
      if (has(form.swagNotes)) su.push(escapeHtml(trim(form.swagNotes)))
      const setupTitle = formatSectionHeader('swag', S.htmlSetupStrong, emojisEnabled)
      chunks.push(`<p><strong>${escapeHtml(setupTitle)}</strong></p>${kbygHtmlUl(su)}`)
    },
    () => {
      if (!has(form.additionalNotes)) return
      const noteLines = trim(form.additionalNotes).split(/\n/).map((s) => s.trim()).filter(Boolean)
      if (noteLines.length === 0) return
      const notesBlocks = noteLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')
      const additionalTitle = formatSectionHeader(null, S.htmlAdditionalStrong, emojisEnabled)
      chunks.push(`<p><strong>${escapeHtml(additionalTitle)}</strong></p>${notesBlocks}`)
    },
  ]

  if (import.meta.env.DEV && steps.length !== KBYG_EMAIL_BODY_SECTION_IDS.length) {
    throw new Error(
      `kbygEmail HTML: pipeline has ${steps.length} steps but KBYG_EMAIL_BODY_SECTION_IDS has ${KBYG_EMAIL_BODY_SECTION_IDS.length}`,
    )
  }

  steps.forEach((fn) => fn())
}

/** @param {import('../shared/agendaItems.js').AgendaItem[]} items */
function agendaPlainLinesFromItems(items) {
  const lines = []
  for (const it of items) {
    if (it.time && (it.title || it.speaker)) {
      let line = `- **${it.time}**`
      if (it.title) line += ` – ${it.title}`
      if (it.speaker) line += ` — ${it.speaker}`
      lines.push(line)
    } else if (it.title || it.speaker) {
      lines.push(`- ${[it.title, it.speaker].filter(Boolean).join(' — ')}`)
    }
  }
  return lines
}

/**
 * Plain body after intro — same section order as HTML ({@link KBYG_EMAIL_BODY_SECTION_IDS}).
 */
function appendKbygEmailPlainBody(lines, ctx) {
  const { eventData, form, opts, S, trim, has, heading, tldrBulletsPlain } = ctx

  const steps = [
    () => {
      if (tldrBulletsPlain.length === 0) return
      lines.push(heading('reminder', S.tldrHeading))
      tldrBulletsPlain.forEach((b) => lines.push(`- ${b}`))
      lines.push('')
    },
    () => appendKbygEventPagePlain(lines, heading, form, S, trim, has),
    () => {
      const contactEntries = filterKbygContactEntries(form, has, trim)
      if (contactEntries.length === 0) return
      lines.push(heading('contact', S.helpfulContacts))
      contactEntries.forEach((c) => {
        const name = trim(c.name)
        const role = trim(c.role)
        const info = trim(c.contactInfo)
        let main = ''
        if (name && info) main = `${name} (${info})`
        else if (name) main = name
        else if (info) main = info
        if (main && role) lines.push(`- ${main} – ${role}`)
        else if (main) lines.push(`- ${main}`)
        else if (role) lines.push(`- ${role}`)
      })
      lines.push('')
    },
    () => {
      for (const block of kbygLogisticsStandaloneBlocks(eventData, trim, S)) {
        appendKbygStandaloneBlockPlain(lines, heading, block, S)
      }
    },
    () => {
      if (!has(form.speakerArrivalNote)) return
      lines.push(heading('arrivalInstructions', S.speakerArrival))
      lines.push(trim(form.speakerArrivalNote))
      lines.push('')
    },
    () => {
      if (form.includePhotos === false) return
      lines.push(heading('photos', S.takePhotos))
      getMeetupKbygPhotoLines(opts.language).forEach((line) => lines.push(`- ${line}`))
      lines.push('')
    },
    () => {
      const agendaItems = augmentKbygAgendaForEmail(eventData.agenda, form, S, trim)
      if (agendaItems.length === 0) return
      lines.push(heading('agenda', S.agenda))
      agendaPlainLinesFromItems(agendaItems).forEach((l) => lines.push(l))
      lines.push('')
    },
    () => {
      if (!has(form.setupNotes) && !has(form.swagNotes)) return
      lines.push(heading('swag', S.setup))
      if (has(form.setupNotes)) lines.push(`- ${trim(form.setupNotes)}`)
      if (has(form.swagNotes)) lines.push(`- ${trim(form.swagNotes)}`)
      lines.push('')
    },
    () => {
      if (!has(form.additionalNotes)) return
      const noteLines = trim(form.additionalNotes).split(/\n/).map((s) => s.trim()).filter(Boolean)
      if (noteLines.length === 0) return
      lines.push(heading(null, S.additionalNotes))
      noteLines.forEach((line) => lines.push(line))
      lines.push('')
    },
  ]

  if (import.meta.env.DEV && steps.length !== KBYG_EMAIL_BODY_SECTION_IDS.length) {
    throw new Error(
      `kbygEmail plain: pipeline has ${steps.length} steps but KBYG_EMAIL_BODY_SECTION_IDS has ${KBYG_EMAIL_BODY_SECTION_IDS.length}`,
    )
  }

  steps.forEach((fn) => fn())
}

/**
 * @param {import('../shared/eventData.js').SharedEventData} eventData
 * @param {object} form - full KBYG form (greeting, speakers, links, TL;DR toggles)
 * @param {object} [opts]
 */
export function renderKbygEmailHtml(eventData, form, opts = {}) {
  const S = getMeetupKbygStrings(normalizeLanguage(opts.language))
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const has = (s) => trim(s).length > 0
  const names = trim(form.greetingNames) || 'everyone'
  const emojisEnabled = kbygEmojisEnabled(form, opts)

  const chunks = []

  chunks.push(`<p>Hi ${escapeHtml(names)},</p>`)

  chunks.push(`<p>${escapeHtml(buildKbygIntroParagraphText(S, eventData, trim))}</p>`)

  const tldrBullets = buildKbygTldrBulletsLean(form, opts)
  appendKbygEmailHtmlBody(chunks, {
    eventData,
    form,
    opts,
    S,
    trim,
    has,
    emojisEnabled,
    tldrBullets,
  })

  // Optional custom sign-off can be added later; no default "looking forward" / name block.
  chunks.push(`<p>${escapeHtml(S.closingQuestion)}</p>`)

  const body = chunks.join('')
  /** Wrapper only — no inline font-size/font-family so Gmail treats pasted content as default Normal / Sans Serif. */
  return `<div>${body}</div>`
}

/**
 * @param {import('../shared/eventData.js').SharedEventData} eventData
 */
export function renderKbygEmailPlain(eventData, form, opts = {}) {
  const S = getMeetupKbygStrings(normalizeLanguage(opts.language))
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const has = (s) => trim(s).length > 0
  const emojisEnabled = kbygEmojisEnabled(form, opts)
  const heading = (sectionKey, title) => formatKbygPlainSectionHeading(sectionKey, title, emojisEnabled)

  const lines = []
  const names = trim(form.greetingNames) || 'everyone'
  lines.push(`Hi ${names},`)
  lines.push('')

  lines.push(buildKbygIntroParagraphText(S, eventData, trim))
  lines.push('')

  const tldrBulletsPlain = buildKbygTldrBulletsLean(form, opts)
  appendKbygEmailPlainBody(lines, {
    eventData,
    form,
    opts,
    S,
    trim,
    has,
    heading,
    tldrBulletsPlain,
  })

  lines.push(S.closingQuestion)
  return lines.join('\n')
}
