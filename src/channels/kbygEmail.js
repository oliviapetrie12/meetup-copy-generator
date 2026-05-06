/**
 * KBYG email channel: HTML (Gmail) and plain text from SharedEventData + KBYG form chrome.
 */

import { escapeHtml, escapeHtmlAttr } from '../htmlEscape.js'
import { getMeetupKbygStrings, normalizeLanguage } from '../generationLanguage.js'
import { getMeetupKbygPhotoLines } from '../generationLanguage.js'
import { buildKbygTldrBulletsLean } from '../kbygTldr.js'
import { formatKbygPlainSectionHeading, formatSectionHeader } from '../kbygSectionHeaders.js'

/** @param {object} form @param {object} opts */
function kbygEmojisEnabled(form, opts) {
  if (typeof opts.emojisEnabled === 'boolean') return opts.emojisEnabled
  return form?.kbygEmojiHeaders !== false
}

/** @param {import('../shared/eventData.js').SharedEventData} eventData */
function buildKbygIntroParagraphText(S, eventData, trim) {
  const whenLine = trim(eventData.date)
  const t = trim(eventData.title)
  if (!t && !whenLine) {
    let s = S.thanksLeanGeneric
    const arr = trim(eventData.arrivalTime)
    if (arr) s = `${s} ${S.htmlArriveBy(arr)}.`
    return s
  }
  let s = S.kbygIntroLead(t, whenLine, S.meetupFallbackTitle)
  const arr = trim(eventData.arrivalTime)
  if (arr) s = `${s} ${S.htmlArriveBy(arr)}.`
  return s
}

function kbygHtmlUl(items) {
  if (!items.length) return ''
  const lis = items
    .map((t) => `<li style="margin:0 0 6px;line-height:1.5;">${t}</li>`)
    .join('')
  return `<ul style="margin:8px 0 0;padding-left:24px;list-style-type:disc;">${lis}</ul>`
}

/** @param {import('../shared/agendaItems.js').AgendaItem[]} items */
function buildKbygAgendaHtmlFromItems(items) {
  if (!items.length) return ''
  const lis = items
    .map((it) => {
      const hasSlot = it.time && (it.title || it.speaker)
      if (hasSlot) {
        let inner = `<p style="margin:0 0 6px;line-height:1.45;"><strong>${escapeHtml(it.time)}</strong>`
        if (it.title) inner += ` ${escapeHtml(it.title)}`
        inner += '</p>'
        if (it.speaker) {
          inner += `<p style="margin:0;line-height:1.45;font-style:italic;color:#374151;">${escapeHtml(it.speaker)}</p>`
        }
        return `<li style="margin:0 0 14px;">${inner}</li>`
      }
      const text = [it.title, it.speaker].filter(Boolean).join(' — ')
      if (!text) return ''
      return `<li style="margin:0 0 10px;"><p style="margin:0;line-height:1.45;">${escapeHtml(text)}</p></li>`
    })
    .filter(Boolean)
    .join('')
  if (!lis) return ''
  return `<ul style="margin:8px 0 0;padding-left:24px;list-style-type:disc;">${lis}</ul>`
}

/**
 * Standalone logistics-related blocks (no parent "Logistics" section).
 * Order: venue → parking → food & beverage → AV.
 * @param {import('../shared/eventData.js').SharedEventData} data
 * @param {(s: string) => string} trim
 * @returns {ReadonlyArray<{ sectionKey: string, title: string, body: string }>}
 */
function kbygLogisticsStandaloneBlocks(data, trim, S) {
  /** @type {{ sectionKey: string, title: string, body: string }[]} */
  const blocks = []
  const push = (sectionKey, title, raw) => {
    const body = trim(raw)
    if (!body) return
    blocks.push({ sectionKey, title, body })
  }
  push('location', S.location, data.venue)
  push('parking', S.parking, data.parking)
  push('foodDrinks', S.foodBeverage, data.food)
  push('avPresentation', S.avSetup, data.av)
  return blocks
}

/** One KBYG section: bold header + body paragraph(s); matches spacing of other sections. */
function kbygStandaloneSectionHtml(sectionKey, titlePlain, bodyText, emojisEnabled) {
  const title = formatSectionHeader(sectionKey, titlePlain, emojisEnabled)
  const inner = `<p style="margin:0;line-height:1.5;">${escapeHtml(bodyText).replace(/\n/g, '<br>')}</p>`
  return `<div style="margin:0 0 16px;"><p style="margin:0 0 8px;line-height:1.5;"><strong>${escapeHtml(title)}</strong></p>${inner}</div>`
}

/** Append plain lines for one standalone block (header + body, trailing blank line). */
function appendKbygStandalonePlainSection(lines, headingFn, sectionKey, titlePlain, bodyText) {
  lines.push(headingFn(sectionKey, titlePlain))
  const raw = typeof bodyText === 'string' ? bodyText : ''
  raw.split('\n').forEach((ln) => lines.push(ln.trimEnd()))
  lines.push('')
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

  chunks.push(`<p style="margin:0 0 16px;line-height:1.5;">Hi ${escapeHtml(names)},</p>`)

  chunks.push(
    `<p style="margin:0 0 16px;line-height:1.5;">${escapeHtml(buildKbygIntroParagraphText(S, eventData, trim))}</p>`,
  )

  const tldrBullets = buildKbygTldrBulletsLean(form, opts)
  if (tldrBullets.length > 0) {
    const tldrItems = tldrBullets.map((i) => escapeHtml(i))
    const tldrTitle = formatSectionHeader('reminder', S.tldrHeading, emojisEnabled)
    chunks.push(
      `<div style="margin:0 0 16px;"><p style="margin:0 0 12px;line-height:1.5;"><span style="background-color:#fff3cd;padding:2px 6px;font-weight:bold;border-radius:3px;">${escapeHtml(tldrTitle)}</span></p>${kbygHtmlUl(tldrItems)}</div>`,
    )
  }

  for (const block of kbygLogisticsStandaloneBlocks(eventData, trim, S)) {
    chunks.push(kbygStandaloneSectionHtml(block.sectionKey, block.title, block.body, emojisEnabled))
  }

  if (eventData.agenda.length > 0) {
    const agendaHtml = buildKbygAgendaHtmlFromItems(eventData.agenda)
    if (agendaHtml) {
      const agendaTitle = formatSectionHeader('agenda', S.htmlAgendaStrong, emojisEnabled)
      chunks.push(
        `<div style="margin:0 0 16px;"><p style="margin:0 0 8px;line-height:1.5;"><strong>${escapeHtml(agendaTitle)}</strong></p>${agendaHtml}</div>`,
      )
    }
  }

  const speakerItems = []
  if (has(form.speaker1Name) || has(form.speaker1Title) || has(form.speaker1TalkTitle)) {
    let t = trim(form.speaker1Name) || S.speaker1Default
    if (has(form.speaker1Title)) t += `, ${trim(form.speaker1Title)}`
    if (has(form.speaker1TalkTitle)) t += ` — ${trim(form.speaker1TalkTitle)}`
    speakerItems.push(escapeHtml(t))
  }
  if (has(form.speaker2Name) || has(form.speaker2Title) || has(form.speaker2TalkTitle)) {
    let t = trim(form.speaker2Name) || S.speaker2Default
    if (has(form.speaker2Title)) t += `, ${trim(form.speaker2Title)}`
    if (has(form.speaker2TalkTitle)) t += ` — ${trim(form.speaker2TalkTitle)}`
    speakerItems.push(escapeHtml(t))
  }
  if (speakerItems.length) {
    const speakerTitle = formatSectionHeader('speaker', S.htmlSpeakerStrong, emojisEnabled)
    chunks.push(
      `<div style="margin:0 0 16px;"><p style="margin:0 0 8px;line-height:1.5;"><strong>${escapeHtml(speakerTitle)}</strong></p>${kbygHtmlUl(speakerItems)}</div>`,
    )
  }

  if (has(form.speakerArrivalNote)) {
    const arrivalTitle = formatSectionHeader('arrivalInstructions', S.htmlSpeakerArrivalStrong, emojisEnabled)
    chunks.push(
      `<div style="margin:0 0 16px;"><p style="margin:0 0 8px;line-height:1.5;"><strong>${escapeHtml(arrivalTitle)}</strong></p><p style="margin:0;line-height:1.5;">${escapeHtml(trim(form.speakerArrivalNote)).replace(/\n/g, '<br>')}</p></div>`,
    )
  }

  if (has(form.meetupLink) || has(form.lumaLink)) {
    const linkItems = []
    if (has(form.meetupLink)) {
      const u = trim(form.meetupLink)
      linkItems.push(
        `${escapeHtml(S.htmlMeetupLink)}: <a href="${escapeHtmlAttr(u)}" style="color:#1D4ED8;text-decoration:underline;">${escapeHtml(u)}</a>`,
      )
    }
    if (has(form.lumaLink)) {
      const u = trim(form.lumaLink)
      linkItems.push(
        `${escapeHtml(S.htmlLumaLink)}: <a href="${escapeHtmlAttr(u)}" style="color:#1D4ED8;text-decoration:underline;">${escapeHtml(u)}</a>`,
      )
    }
    const eventPageTitle = formatSectionHeader('registration', S.htmlEventPageStrong, emojisEnabled)
    chunks.push(
      `<div style="margin:0 0 16px;"><p style="margin:0 0 8px;line-height:1.5;"><strong>${escapeHtml(eventPageTitle)}</strong></p>${kbygHtmlUl(linkItems)}</div>`,
    )
  }

  const contactEntries = (form.contacts || []).filter((c) => has(c.name) || has(c.role) || has(c.contactInfo))
  if (contactEntries.length > 0) {
    const contactItems = contactEntries.map((c) => {
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
    const contactsTitle = formatSectionHeader('contact', S.htmlHelpfulContactsStrong, emojisEnabled)
    chunks.push(
      `<div style="margin:0 0 16px;"><p style="margin:0 0 8px;line-height:1.5;"><strong>${escapeHtml(contactsTitle)}</strong></p>${kbygHtmlUl(contactItems)}</div>`,
    )
  }

  if (has(form.setupNotes) || has(form.swagNotes)) {
    const su = []
    if (has(form.setupNotes)) su.push(escapeHtml(trim(form.setupNotes)))
    if (has(form.swagNotes)) su.push(escapeHtml(trim(form.swagNotes)))
    const setupTitle = formatSectionHeader('swag', S.htmlSetupStrong, emojisEnabled)
    chunks.push(
      `<div style="margin:0 0 16px;"><p style="margin:0 0 8px;line-height:1.5;"><strong>${escapeHtml(setupTitle)}</strong></p>${kbygHtmlUl(su)}</div>`,
    )
  }

  if (form.includePhotos !== false) {
    const photoLines = getMeetupKbygPhotoLines(opts.language)
    const photoItems = photoLines.map((line) => escapeHtml(line))
    const photosTitle = formatSectionHeader('photos', S.htmlTakePhotosStrong, emojisEnabled)
    chunks.push(
      `<div style="margin:0 0 16px;"><p style="margin:0 0 8px;line-height:1.5;"><strong>${escapeHtml(photosTitle)}</strong></p>${kbygHtmlUl(photoItems)}</div>`,
    )
  }

  if (has(form.additionalNotes)) {
    const noteLines = trim(form.additionalNotes).split(/\n/).map((s) => s.trim()).filter(Boolean)
    if (noteLines.length > 0) {
      const notesBlocks = noteLines
        .map((line) => `<p style="margin:0 0 8px;line-height:1.5;">${escapeHtml(line)}</p>`)
        .join('')
      const additionalTitle = formatSectionHeader(null, S.htmlAdditionalStrong, emojisEnabled)
      chunks.push(
        `<div style="margin:0 0 16px;"><p style="margin:0 0 8px;line-height:1.5;"><strong>${escapeHtml(additionalTitle)}</strong></p>${notesBlocks}</div>`,
      )
    }
  }

  chunks.push(`<p style="margin:0 0 12px;line-height:1.5;">${escapeHtml(S.closingQuestion)}</p>`)
  chunks.push(`<p style="margin:0 0 12px;line-height:1.5;">${escapeHtml(S.kbygLookingForward)}</p>`)
  chunks.push(`<p style="margin:0;line-height:1.5;">${escapeHtml(S.kbygSignature)}</p>`)

  const body = chunks.join('')
  return `<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#202124;">${body}</div>`
}

/** @param {import('../shared/agendaItems.js').AgendaItem[]} items */
function agendaPlainLinesFromItems(items) {
  const lines = []
  for (const it of items) {
    if (it.time && (it.title || it.speaker)) {
      lines.push(`- **${it.time}**${it.title ? ` ${it.title}` : ''}`)
      if (it.speaker) lines.push(`  ${it.speaker}`)
    } else if (it.title || it.speaker) {
      lines.push(`- ${[it.title, it.speaker].filter(Boolean).join(' — ')}`)
    }
  }
  return lines
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
  if (tldrBulletsPlain.length > 0) {
    lines.push(heading('reminder', S.tldrHeading))
    tldrBulletsPlain.forEach((b) => lines.push(`- ${b}`))
    lines.push('')
  }

  for (const block of kbygLogisticsStandaloneBlocks(eventData, trim, S)) {
    appendKbygStandalonePlainSection(lines, heading, block.sectionKey, block.title, block.body)
  }

  if (eventData.agenda.length > 0) {
    lines.push(heading('agenda', S.agenda))
    agendaPlainLinesFromItems(eventData.agenda).forEach((l) => lines.push(l))
    lines.push('')
  }

  const sp1 = has(form.speaker1Name) || has(form.speaker1Title) || has(form.speaker1TalkTitle)
  const sp2 = has(form.speaker2Name) || has(form.speaker2Title) || has(form.speaker2TalkTitle)
  if (sp1 || sp2) {
    lines.push(heading('speaker', S.speaker))
    if (sp1) {
      let t = trim(form.speaker1Name) || S.speaker1Default
      if (has(form.speaker1Title)) t += `, ${trim(form.speaker1Title)}`
      if (has(form.speaker1TalkTitle)) t += ` — ${trim(form.speaker1TalkTitle)}`
      lines.push(`- ${t}`)
    }
    if (sp2) {
      let t = trim(form.speaker2Name) || S.speaker2Default
      if (has(form.speaker2Title)) t += `, ${trim(form.speaker2Title)}`
      if (has(form.speaker2TalkTitle)) t += ` — ${trim(form.speaker2TalkTitle)}`
      lines.push(`- ${t}`)
    }
    lines.push('')
  }

  if (has(form.speakerArrivalNote)) {
    lines.push(heading('arrivalInstructions', S.speakerArrival))
    lines.push(trim(form.speakerArrivalNote))
    lines.push('')
  }

  if (has(form.meetupLink) || has(form.lumaLink)) {
    lines.push(heading('registration', S.eventPage))
    if (has(form.meetupLink)) lines.push(`- ${S.meetupLabel}: ${trim(form.meetupLink)}`)
    if (has(form.lumaLink)) lines.push(`- ${S.lumaLabel}: ${trim(form.lumaLink)}`)
    lines.push('')
  }

  const contactEntries = (form.contacts || []).filter((c) => has(c.name) || has(c.role) || has(c.contactInfo))
  if (contactEntries.length > 0) {
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
  }

  if (has(form.setupNotes) || has(form.swagNotes)) {
    lines.push(heading('swag', S.setup))
    if (has(form.setupNotes)) lines.push(`- ${trim(form.setupNotes)}`)
    if (has(form.swagNotes)) lines.push(`- ${trim(form.swagNotes)}`)
    lines.push('')
  }

  if (form.includePhotos !== false) {
    lines.push(heading('photos', S.takePhotos))
    getMeetupKbygPhotoLines(opts.language).forEach((line) => lines.push(`- ${line}`))
    lines.push('')
  }

  if (has(form.additionalNotes)) {
    const noteLines = trim(form.additionalNotes).split(/\n/).map((s) => s.trim()).filter(Boolean)
    if (noteLines.length > 0) {
      lines.push(heading(null, S.additionalNotes))
      noteLines.forEach((line) => lines.push(line))
      lines.push('')
    }
  }

  lines.push(S.closingQuestion)
  lines.push('')
  lines.push(S.kbygLookingForward)
  lines.push('')
  lines.push(S.kbygSignature)
  return lines.join('\n')
}
