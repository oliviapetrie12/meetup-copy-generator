import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { getGeneratorUiTranslations, getDefaultConferenceSwagText } from './formTranslations.js'
import { makeMoreConcise, prepareConferenceEmailClipboardHtml } from './outputHelpers.js'
import { mergeOrganizerParsedIntoForm, processOrganizerImport } from './conferenceOrganizerImport.js'
import { enhanceKbygOutput } from './kbygEnhanceOutput.js'
import {
  getConferenceStrings,
  getConferenceTldrIncludeLabels,
  normalizeLanguage,
  LANGUAGE_OPTIONS,
} from './generationLanguage.js'
import { tryRemoteGenerate, applyRemoteKbygResult, tryRemoteTranslate } from './generateApi.js'

function escapeHtml(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeHtmlAttr(s) {
  if (s == null) return ''
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

/**
 * Plain text for Google Docs / paste targets: <br> → newline, strip tags, keep emojis and • bullets.
 * Section gaps from <br><br> become \n\n.
 */
function conferenceHtmlToGoogleDocPlain(htmlString) {
  if (!htmlString || typeof htmlString !== 'string') return ''
  const withBreaks = htmlString.replace(/<br\s*\/?>/gi, '\n')
  try {
    const doc = new DOMParser().parseFromString(withBreaks, 'text/html')
    let text = doc.body?.textContent ?? ''
    text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    return text.trim()
  } catch {
    return withBreaks.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim()
  }
}

const INITIAL_CONTACT = { name: '', role: '', email: '', phone: '', group: '' }

const CONTACT_GROUP_OPTIONS = [
  { value: '', label: 'No group' },
  { value: 'devrel_onsite', label: 'DevRel Onsite Support' },
  { value: 'devrel_remote', label: 'DevRel Remote Support' },
  { value: 'conference_organizer', label: 'Conference Organizer' },
]

const CONTACT_GROUP_ORDER = ['devrel_onsite', 'devrel_remote', 'conference_organizer']

const BOOTH_DELIVERY_METHOD_ORDER = ['shipped_to_individual', 'shipped_to_venue', 'minimal_setup']

function normalizeBoothDeliveryMethodKey(raw) {
  const k = trim(raw)
  if (k === 'shipped_to_me') return 'shipped_to_individual'
  return k
}

/** Intro line for "Shipped to individual" (name optional). */
function shippedToIndividualIntroPlain(form, strings) {
  const name = trim(form.boothMaterialsShippedToName)
  if (name) {
    return strings.shippedToIndividualIntroNamed(name)
  }
  return strings.shippedToIndividualIntroGeneric
}

function shippedToIndividualIntroHtml(form, strings) {
  return escapeHtml(shippedToIndividualIntroPlain(form, strings))
}

function buildBoothSetupLogisticsSectionHtml(form, strings) {
  const key = normalizeBoothDeliveryMethodKey(form.boothMaterialsDeliveryMethod)
  const scenario = strings.boothDelivery[key]
  if (!scenario) return ''

  const fixedBulletsHtml = strings.boothFixedBullets
    .map((l) => `• ${escapeHtml(l)}`)
    .join('<br>')
  const titleStrong = `<strong>${escapeHtml(strings.boothSetupLogisticsTitle)}</strong>`

  if (key === 'shipped_to_individual') {
    const intro = shippedToIndividualIntroHtml(form, strings)
    const scenarioBullets = scenario.bullets.map((l) => `• ${escapeHtml(l)}`).join('<br>')
    const body = `${intro}<br><br>${scenarioBullets}<br><br>${fixedBulletsHtml}`
    return `${titleStrong}<br><br>${body}`
  }

  const scenarioBullets = scenario.bullets.map((l) => `• ${escapeHtml(l)}`).join('<br>')
  const body = `${scenarioBullets}<br><br>${fixedBulletsHtml}`
  return `${titleStrong}<br><br>${body}`
}

function appendBoothSetupLogisticsPlain(lines, form, strings) {
  const key = normalizeBoothDeliveryMethodKey(form.boothMaterialsDeliveryMethod)
  const scenario = strings.boothDelivery[key]
  if (!scenario) return
  lines.push(strings.boothSetupLogisticsTitle)
  if (key === 'shipped_to_individual') {
    lines.push(shippedToIndividualIntroPlain(form, strings))
    scenario.bullets.forEach((l) => lines.push(`• ${l}`))
  } else {
    scenario.bullets.forEach((l) => lines.push(`• ${l}`))
  }
  strings.boothFixedBullets.forEach((l) => lines.push(`• ${l}`))
  lines.push('')
}

function getInitialForm(lang = 'en') {
  return {
    conferenceName: '',
    knowBeforeYouGoDeckUrl: '',
    generateTldr: true,
    tldrInclude: getInitialTldrInclude(),
    leadCaptureText: '',
    customTldrNotes: '',
    eventDatesBoothSetup: '',
    eventDatesBoothHours: '',
    eventDatesBoothCleanup: '',
    eventDatesNotes: '',
    staffingScheduleLink: '',
    staffingScheduleNotes: '',
    ticketsText: '',
    locationVenue: '',
    locationAddress: '',
    contacts: [{ ...INITIAL_CONTACT }],
    boothMaterialsDeliveryMethod: 'shipped_to_individual',
    boothMaterialsShippedToName: '',
    avSetupRequirements: '',
    swagText: getDefaultConferenceSwagText(lang),
    parkingText: '',
    foodBeverageText: '',
    engagementType: 'none',
    engagementDetails: '',
    engagementPrize: '',
    additionalSections: [],
  }
}

function engagementShowsInEmailOutput(form) {
  const t = trim(form.engagementType || 'none')
  return t === 'kahoot' || t === 'raffle'
}

/** HTML block for Kahoot/Raffle engagement (matches KBYG spacing). */
function buildEngagementSectionHtml(form, strings) {
  if (!engagementShowsInEmailOutput(form)) return ''
  const t = trim(form.engagementType)
  const detailsRaw = trim(form.engagementDetails || '')
  const prizeRaw = trim(form.engagementPrize || '')
  const detailLines = detailsRaw
    .split('\n')
    .map((l) => trim(l))
    .filter(Boolean)

  const bulletsHtml =
    detailLines.length > 0 ? '<br><br>' + detailLines.map((l) => `• ${escapeHtml(l)}`).join('<br>') : ''

  const prizeHtml =
    prizeRaw.length > 0 ? `<br><br>${escapeHtml(strings.engagementPrize)}<br>${escapeHtml(prizeRaw)}` : ''

  if (t === 'kahoot') {
    return `<strong>${escapeHtml(strings.engagement)}</strong><br><br><strong>${escapeHtml(strings.kahoot)}</strong>${bulletsHtml}${prizeHtml}`
  }
  return `<strong>${escapeHtml(strings.raffle)}</strong>${bulletsHtml}${prizeHtml}`
}

/** Plain-text engagement block. */
function appendEngagementPlain(lines, form, strings) {
  if (!engagementShowsInEmailOutput(form)) return

  const detailsRaw = trim(form.engagementDetails || '')
  const prizeRaw = trim(form.engagementPrize || '')
  const detailLines = detailsRaw
    .split('\n')
    .map((l) => trim(l))
    .filter(Boolean)

  const pushPrize = () => {
    if (!has(prizeRaw)) return
    lines.push('')
    lines.push(`${strings.prizeLabel}`)
    lines.push(prizeRaw)
  }

  if (trim(form.engagementType) === 'kahoot') {
    lines.push(strings.engagement)
    lines.push('')
    lines.push(strings.kahoot)
    detailLines.forEach((l) => lines.push(`- ${l}`))
    pushPrize()
    lines.push('')
    return
  }

  lines.push(strings.raffle)
  lines.push('')
  detailLines.forEach((l) => lines.push(`- ${l}`))
  pushPrize()
  lines.push('')
}

function trim(s) {
  return typeof s === 'string' ? s.trim() : ''
}

function has(s) {
  return trim(s).length > 0
}

function textToHtmlParagraphs(text) {
  return escapeHtml(trim(text)).replace(/\n/g, '<br>')
}

/** Non-TL;DR body: one line per paragraph block, joined with &lt;br&gt; */
function textToHtmlLines(text) {
  return escapeHtml(trim(text))
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join('<br>')
}

/** Preserve newlines; each line escaped. */
function linesToHtmlPreserve(text) {
  return String(text ?? '')
    .split(/\n/)
    .map((line) => escapeHtml(line))
    .join('<br>')
}

const TLDR_ITEM_ORDER = [
  'arrival_time',
  'badge_pickup',
  'booth_materials',
  'staffing_note',
  'lead_capture',
  'swag_materials',
  'return_shipping',
  'key_contact',
  'important_links',
  'custom_note',
]

function getInitialTldrInclude() {
  return {
    arrival_time: true,
    badge_pickup: false,
    booth_materials: true,
    staffing_note: false,
    lead_capture: true,
    swag_materials: false,
    return_shipping: true,
    key_contact: true,
    important_links: false,
    custom_note: false,
  }
}

const MAX_TLDR_LINE = 120

function truncateTldrLine(s, max = MAX_TLDR_LINE) {
  const t = trim(s).replace(/\s+/g, ' ')
  if (!t) return ''
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

function tldrBoothMaterialsSummary(form, strings) {
  const key = normalizeBoothDeliveryMethodKey(form.boothMaterialsDeliveryMethod)
  const scenario = strings.boothDelivery[key]
  if (!scenario) return null
  let s = scenario.label
  if (key === 'shipped_to_individual' && has(form.boothMaterialsShippedToName)) {
    s += ` — ${truncateTldrLine(form.boothMaterialsShippedToName, 48)}`
  }
  return `${strings.tldr.materialsPrefix}: ${s}`
}

/** Plain-text bullet lines (with leading •). Respects generateTldr + tldrInclude + non-empty sources. */
function getTldrBullets(form, strings) {
  if (form.generateTldr === false) return []
  const inc = { ...getInitialTldrInclude(), ...(form.tldrInclude || {}) }
  const out = []
  const T = strings.tldr

  for (const id of TLDR_ITEM_ORDER) {
    if (!inc[id]) continue
    switch (id) {
      case 'arrival_time':
        if (has(form.eventDatesBoothSetup)) {
          out.push(`• ${T.arriveBuild}: ${truncateTldrLine(form.eventDatesBoothSetup)}`)
        }
        break
      case 'badge_pickup':
        if (has(form.ticketsText)) {
          out.push(`• ${T.badges}: ${truncateTldrLine(form.ticketsText)}`)
        }
        break
      case 'booth_materials': {
        const mat = tldrBoothMaterialsSummary(form, strings)
        if (mat) out.push(`• ${mat}`)
        break
      }
      case 'staffing_note':
        if (has(form.staffingScheduleNotes)) {
          out.push(`• ${T.staffing}: ${truncateTldrLine(form.staffingScheduleNotes.split(/\n/)[0])}`)
        } else if (has(form.staffingScheduleLink)) {
          out.push(`• ${T.staffing}: ${truncateTldrLine(form.staffingScheduleLink, 100)}`)
        }
        break
      case 'lead_capture':
        if (has(form.leadCaptureText)) {
          out.push(`• ${T.leadCapture}: ${truncateTldrLine(form.leadCaptureText)}`)
        }
        break
      case 'swag_materials':
        if (has(form.swagText)) {
          out.push(`• ${T.swag}: ${truncateTldrLine(form.swagText)}`)
        }
        break
      case 'return_shipping':
        if (has(form.eventDatesBoothCleanup)) {
          out.push(`• ${T.returnStrike}: ${truncateTldrLine(form.eventDatesBoothCleanup)}`)
        }
        break
      case 'key_contact': {
        const c = (form.contacts || []).find((x) => has(x.name))
        if (c) {
          const bits = [trim(c.name)]
          if (has(c.role)) bits.push(trim(c.role))
          if (has(c.email)) bits.push(trim(c.email))
          out.push(`• ${T.keyContact}: ${truncateTldrLine(bits.join(' · '))}`)
        }
        break
      }
      case 'important_links': {
        const parts = []
        if (has(form.knowBeforeYouGoDeckUrl)) {
          parts.push(`${T.deckShort}: ${truncateTldrLine(form.knowBeforeYouGoDeckUrl, 72)}`)
        }
        if (has(form.staffingScheduleLink)) {
          parts.push(`${T.staffingShort}: ${truncateTldrLine(form.staffingScheduleLink, 72)}`)
        }
        if (parts.length) out.push(`• ${T.links}: ${parts.join(' · ')}`)
        break
      }
      case 'custom_note':
        if (has(form.customTldrNotes)) {
          trim(form.customTldrNotes)
            .split(/\n/)
            .map((l) => l.trim())
            .filter(Boolean)
            .forEach((line) => {
              out.push(`• ${truncateTldrLine(line)}`)
            })
        }
        break
      default:
        break
    }
  }

  return out
}

function hasConferenceTldrSection(form, strings) {
  return form.generateTldr !== false && getTldrBullets(form, strings).length > 0
}

function buildConferenceTldrBodyHtml(form, strings) {
  return getTldrBullets(form, strings)
    .map((line) => escapeHtml(line))
    .join('<br>')
}

function appendConferenceTldrPlain(lines, form, strings) {
  if (!hasConferenceTldrSection(form, strings)) return

  lines.push(strings.tldrHeadingPlain)
  getTldrBullets(form, strings).forEach((b) => lines.push(b))
  lines.push('')
}

/** Name + optional role on first line; email and phone on following lines only if set. */
function formatContactBlockHtml(c) {
  const name = escapeHtml(trim(c.name))
  const firstLine = has(c.role) ? `${name} – ${escapeHtml(trim(c.role))}` : name
  const lines = [firstLine]
  if (has(c.email)) lines.push(escapeHtml(trim(c.email)))
  if (has(c.phone)) lines.push(escapeHtml(trim(c.phone)))
  return lines.join('<br>')
}

function formatContactBlockPlain(c) {
  const name = trim(c.name)
  const firstLine = has(c.role) ? `${name} – ${trim(c.role)}` : name
  const lines = [firstLine]
  if (has(c.email)) lines.push(trim(c.email))
  if (has(c.phone)) lines.push(trim(c.phone))
  return lines.join('\n')
}

function buildContactsSectionHtml(form, strings) {
  const withName = (form.contacts || []).filter((c) => has(c.name))
  if (withName.length === 0) return ''

  const byGroup = new Map()
  for (const c of withName) {
    const g = trim(c.group)
    const key = CONTACT_GROUP_ORDER.includes(g) ? g : '_other'
    if (!byGroup.has(key)) byGroup.set(key, [])
    byGroup.get(key).push(c)
  }

  const chunks = []
  const gl = strings.contactGroups
  for (const key of CONTACT_GROUP_ORDER) {
    const list = byGroup.get(key)
    if (!list?.length) continue
    chunks.push(
      `<strong>${escapeHtml(gl[key])}</strong><br><br>${list.map(formatContactBlockHtml).join('<br><br>')}`,
    )
  }

  const other = byGroup.get('_other') || []
  if (other.length) {
    const block = other.map(formatContactBlockHtml).join('<br><br>')
    if (chunks.length) {
      chunks.push(`<strong>${escapeHtml(strings.otherContacts)}</strong><br><br>${block}`)
    } else {
      chunks.push(block)
    }
  }

  return `<strong>${escapeHtml(strings.contactsHeading)}</strong><br><br>${chunks.join('<br><br>')}`
}

function buildContactsSectionPlain(form, strings) {
  const withName = (form.contacts || []).filter((c) => has(c.name))
  if (withName.length === 0) return ''

  const byGroup = new Map()
  for (const c of withName) {
    const g = trim(c.group)
    const key = CONTACT_GROUP_ORDER.includes(g) ? g : '_other'
    if (!byGroup.has(key)) byGroup.set(key, [])
    byGroup.get(key).push(c)
  }

  const hasGrouped = CONTACT_GROUP_ORDER.some((k) => (byGroup.get(k) || []).length > 0)

  const gl = strings.contactGroups
  const parts = [strings.contactsHeading, '']
  for (const key of CONTACT_GROUP_ORDER) {
    const list = byGroup.get(key)
    if (!list?.length) continue
    parts.push(gl[key], '')
    list.forEach((c) => {
      parts.push(formatContactBlockPlain(c))
      parts.push('')
    })
  }

  const other = byGroup.get('_other') || []
  if (other.length) {
    if (hasGrouped) {
      parts.push(strings.otherContacts, '')
    }
    other.forEach((c) => {
      parts.push(formatContactBlockPlain(c))
      parts.push('')
    })
  }

  return parts.join('\n').replace(/\n+$/, '\n')
}

/** Auto subject: "[Event Name] Know Before You Go + [booth info]" (venue, else first line of address). */
function generateAutoSubjectLine(form, lang = 'en') {
  const strings = getConferenceStrings(lang)
  const name = trim(form.conferenceName)
  const venue = trim(form.locationVenue)
  const addrFirst = trim(form.locationAddress).split('\n')[0]?.trim() || ''
  const boothInfo = venue || addrFirst
  const base = name ? `${name} ${strings.subjectKbyg}` : strings.subjectKbyg
  return boothInfo ? `${base} + ${boothInfo}` : base
}

function hasEventDatesAndHoursContent(form) {
  return (
    has(form.eventDatesBoothSetup) ||
    has(form.eventDatesBoothHours) ||
    has(form.eventDatesBoothCleanup) ||
    has(form.eventDatesNotes) ||
    has(form.staffingScheduleLink) ||
    has(form.staffingScheduleNotes)
  )
}

function hasStaffingScheduleContent(form) {
  return has(form.staffingScheduleLink) || has(form.staffingScheduleNotes)
}

function buildStaffingScheduleSectionHtml(form, strings) {
  if (!hasStaffingScheduleContent(form)) return ''
  const linkRaw = trim(form.staffingScheduleLink)
  const notesRaw = trim(form.staffingScheduleNotes)

  let block = `<strong>${escapeHtml(strings.htmlStaffingStrong)}</strong>`

  if (has(linkRaw)) {
    const href = escapeHtmlAttr(linkRaw)
    const display = escapeHtml(linkRaw)
    block += `<br><br>${escapeHtml(strings.htmlStaffingLink)}<br><a href="${href}" style="color:#1D4ED8;text-decoration:underline;">${display}</a>`
  }

  if (has(notesRaw)) {
    const bullets = notesRaw
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => `• ${escapeHtml(line)}`)
      .join('<br>')
    block += `<br><br>${bullets}`
  }

  return block
}

function appendStaffingSchedulePlain(lines, form, strings) {
  if (!hasStaffingScheduleContent(form)) return
  lines.push(strings.staffingSchedule)
  lines.push('')
  const linkRaw = trim(form.staffingScheduleLink)
  if (has(linkRaw)) {
    lines.push(strings.staffingLinkIntro)
    lines.push(linkRaw)
    lines.push('')
  }
  if (has(form.staffingScheduleNotes)) {
    trim(form.staffingScheduleNotes)
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line) => lines.push(`• ${line}`))
    lines.push('')
  }
}

function buildEventDatesAndHoursSectionHtml(form, strings) {
  if (!hasEventDatesAndHoursContent(form)) return ''

  const L = strings.htmlEventDatesLabels
  const subs = []
  if (has(form.eventDatesBoothSetup)) {
    subs.push(`${escapeHtml(L.setup)} ${escapeHtml(trim(form.eventDatesBoothSetup))}`)
  }
  if (has(form.eventDatesBoothHours)) {
    subs.push(`${escapeHtml(L.hours)}<br>${linesToHtmlPreserve(form.eventDatesBoothHours)}`)
  }
  if (has(form.eventDatesBoothCleanup)) {
    subs.push(`${escapeHtml(L.cleanup)} ${escapeHtml(trim(form.eventDatesBoothCleanup))}`)
  }
  if (has(form.eventDatesNotes)) {
    subs.push(`${escapeHtml(L.notes)}<br>${linesToHtmlPreserve(form.eventDatesNotes)}`)
  }

  let html = `<strong>${escapeHtml(strings.eventDatesTitle)}</strong>`
  if (subs.length > 0) {
    html += `<br><br>${subs.join('<br><br>')}`
  }
  const staffingHtml = buildStaffingScheduleSectionHtml(form, strings)
  if (staffingHtml) {
    html += `<br><br>${staffingHtml}`
  }
  return html
}

function buildEventDatesAndHoursSectionPlain(form, strings) {
  if (!hasEventDatesAndHoursContent(form)) return ''

  const lines = []
  lines.push(strings.eventDatesTitle, '')
  if (has(form.eventDatesBoothSetup)) {
    lines.push(`${strings.boothSetupLabel} ${trim(form.eventDatesBoothSetup)}`)
    lines.push('')
  }
  if (has(form.eventDatesBoothHours)) {
    lines.push(strings.boothHoursLabel)
    lines.push(trim(form.eventDatesBoothHours))
    lines.push('')
  }
  if (has(form.eventDatesBoothCleanup)) {
    lines.push(`${strings.boothCleanupLabel} ${trim(form.eventDatesBoothCleanup)}`)
    lines.push('')
  }
  if (has(form.eventDatesNotes)) {
    lines.push(strings.notesLabel)
    lines.push(trim(form.eventDatesNotes))
    lines.push('')
  }
  appendStaffingSchedulePlain(lines, form, strings)
  return lines.join('\n')
}

/** Event name for copy; fallback when field is empty. */
function eventNameLabel(form) {
  return trim(form.conferenceName) || 'the event'
}

function buildConferenceIntroHtml(form, strings) {
  const name = eventNameLabel(form)
  const enc = escapeHtml(name)
  let html = strings.htmlIntroHi
  html += strings.htmlThankYou(enc)
  if (has(form.knowBeforeYouGoDeckUrl)) {
    const href = escapeHtmlAttr(trim(form.knowBeforeYouGoDeckUrl))
    html += strings.htmlDeck(enc, href)
  }
  return html
}

function buildConferenceEmailHtml(form, opts = {}) {
  const strings = getConferenceStrings(normalizeLanguage(opts.language))
  const parts = []

  parts.push(buildConferenceIntroHtml(form, strings))
  if (has(form.conferenceName)) {
    parts.push(`<strong>${escapeHtml(trim(form.conferenceName))}</strong>`)
  }

  const tldrBodyHtml = buildConferenceTldrBodyHtml(form, strings)
  if (hasConferenceTldrSection(form, strings) && tldrBodyHtml.length > 0) {
    parts.push(`${strings.tldrHeadingHtml}<br><br>${tldrBodyHtml}`)
  }

  const eventDatesBlock = buildEventDatesAndHoursSectionHtml(form, strings)
  if (eventDatesBlock) {
    parts.push(eventDatesBlock)
  }
  if (has(form.ticketsText)) {
    parts.push(`<strong>${escapeHtml(strings.tickets)}</strong><br><br>${textToHtmlLines(form.ticketsText)}`)
  }

  if (has(form.locationVenue) || has(form.locationAddress)) {
    let loc = ''
    if (has(form.locationVenue)) loc += escapeHtml(trim(form.locationVenue))
    if (has(form.locationAddress)) {
      loc += (loc ? '<br>' : '') + escapeHtml(trim(form.locationAddress))
    }
    parts.push(`<strong>${escapeHtml(strings.location)}</strong><br><br>${loc}`)
  }

  const contactsHtml = buildContactsSectionHtml(form, strings)
  if (contactsHtml) {
    parts.push(contactsHtml)
  }

  const boothLogisticsHtml = buildBoothSetupLogisticsSectionHtml(form, strings)
  if (boothLogisticsHtml) {
    parts.push(boothLogisticsHtml)
  }
  if (has(form.avSetupRequirements)) {
    parts.push(
      `<strong>${escapeHtml(strings.avSetup)}</strong><br><br>${linesToHtmlPreserve(form.avSetupRequirements)}`,
    )
  }
  if (has(form.swagText)) {
    parts.push(`<strong>${escapeHtml(strings.swag)}</strong><br><br>${textToHtmlLines(form.swagText)}`)
  }
  if (has(form.parkingText)) {
    parts.push(`<strong>${escapeHtml(strings.parking)}</strong><br><br>${textToHtmlLines(form.parkingText)}`)
  }
  if (has(form.foodBeverageText)) {
    parts.push(`<strong>${escapeHtml(strings.foodBeverage)}</strong><br><br>${textToHtmlLines(form.foodBeverageText)}`)
  }

  const engagementHtml = buildEngagementSectionHtml(form, strings)
  if (engagementHtml) {
    parts.push(engagementHtml)
  }

  ;(form.additionalSections || []).forEach((sec) => {
    const t = trim(sec.title)
    const c = trim(sec.content)
    if (!has(c)) return
    const title = escapeHtml(t || strings.additionalSectionFallback)
    parts.push(`<strong>➕ ${title}</strong><br><br>${textToHtmlLines(sec.content)}`)
  })

  parts.push(
    `<strong>${strings.htmlTravelStrong}</strong><br><br>${escapeHtml(strings.standardTravel)}`,
  )
  parts.push(escapeHtml(strings.signoff))

  const inner = parts.filter((p) => String(p).trim().length > 0).join('<br><br>')
  return `<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#202124;">${inner}</div>`
}

function generateConferenceEmailPlain(form, opts = {}) {
  const strings = getConferenceStrings(normalizeLanguage(opts.language))
  const confName = eventNameLabel(form)
  const lines = []

  lines.push(strings.hiTeam, '')
  lines.push(strings.thankYou(confName), '')
  if (has(form.knowBeforeYouGoDeckUrl)) {
    lines.push(strings.deckParagraph(confName, trim(form.knowBeforeYouGoDeckUrl)), '')
  }
  if (has(form.conferenceName)) {
    lines.push(trim(form.conferenceName))
    lines.push('')
  }

  appendConferenceTldrPlain(lines, form, strings)
  const eventDatesPlain = buildEventDatesAndHoursSectionPlain(form, strings)
  if (eventDatesPlain) {
    lines.push(eventDatesPlain)
    lines.push('')
  }
  if (has(form.ticketsText)) {
    lines.push(strings.tickets)
    lines.push(trim(form.ticketsText))
    lines.push('')
  }
  if (has(form.locationVenue) || has(form.locationAddress)) {
    lines.push(strings.location)
    if (has(form.locationVenue)) lines.push(trim(form.locationVenue))
    if (has(form.locationAddress)) lines.push(trim(form.locationAddress))
    lines.push('')
  }

  const contactsPlain = buildContactsSectionPlain(form, strings)
  if (contactsPlain) {
    lines.push(contactsPlain.trimEnd())
    lines.push('')
  }

  appendBoothSetupLogisticsPlain(lines, form, strings)
  if (has(form.avSetupRequirements)) {
    lines.push(strings.avSetup)
    lines.push(trim(form.avSetupRequirements))
    lines.push('')
  }
  if (has(form.swagText)) {
    lines.push(strings.swag)
    lines.push(trim(form.swagText))
    lines.push('')
  }
  if (has(form.parkingText)) {
    lines.push(strings.parking)
    lines.push(trim(form.parkingText))
    lines.push('')
  }
  if (has(form.foodBeverageText)) {
    lines.push(strings.foodBeverage)
    lines.push(trim(form.foodBeverageText))
    lines.push('')
  }

  appendEngagementPlain(lines, form, strings)

  ;(form.additionalSections || []).forEach((sec) => {
    const t = trim(sec.title)
    const c = trim(sec.content)
    if (!has(c)) return
    lines.push(`➕ ${t || strings.additionalSectionFallback}`)
    lines.push(c)
    lines.push('')
  })

  lines.push(strings.travelExpenses)
  lines.push(strings.standardTravel)
  lines.push('')
  lines.push(strings.signoff)

  return lines.join('\n')
}

export default function ConferenceKnowBeforeYouGo() {
  const [conferenceLanguage, setConferenceLanguage] = useState('en')
  const [form, setForm] = useState(() => getInitialForm('en'))
  const subjectManuallyEditedRef = useRef(false)
  const [subjectLine, setSubjectLine] = useState(() => generateAutoSubjectLine(getInitialForm('en'), 'en'))
  const [plain, setPlain] = useState('')
  const [html, setHtml] = useState('')
  const [emailCopied, setEmailCopied] = useState(false)
  const [googleDocCopied, setGoogleDocCopied] = useState(false)
  const [subjectCopied, setSubjectCopied] = useState(false)
  const [organizerImportText, setOrganizerImportText] = useState('')
  const [structuredKbygPreview, setStructuredKbygPreview] = useState('')
  const [structuredKbygCopied, setStructuredKbygCopied] = useState(false)
  const [kbygEnhanceExisting, setKbygEnhanceExisting] = useState('')
  const [kbygEnhanceUpdates, setKbygEnhanceUpdates] = useState('')
  const [kbygEnhanceMode, setKbygEnhanceMode] = useState('email')
  const [kbygEnhanceOutput, setKbygEnhanceOutput] = useState('')
  const [kbygEnhanceCopied, setKbygEnhanceCopied] = useState(false)
  const [translateMessage, setTranslateMessage] = useState(null)

  const t = useMemo(() => getGeneratorUiTranslations(conferenceLanguage), [conferenceLanguage])
  const tldrIncludeLabels = getConferenceTldrIncludeLabels(conferenceLanguage)
  const boothDeliveryOptions = useMemo(
    () => getConferenceStrings(normalizeLanguage(conferenceLanguage)).boothDelivery,
    [conferenceLanguage],
  )
  const confUiStrings = useMemo(
    () => getConferenceStrings(normalizeLanguage(conferenceLanguage)),
    [conferenceLanguage],
  )

  useEffect(() => {
    if (subjectManuallyEditedRef.current) return
    setSubjectLine(generateAutoSubjectLine(form, conferenceLanguage))
  }, [form.conferenceName, form.locationVenue, form.locationAddress, conferenceLanguage])

  const update = (key) => (e) => {
    const v = e.target.value
    setForm((prev) => ({ ...prev, [key]: v }))
  }

  const updateBoothDeliveryMethod = (e) => {
    const v = normalizeBoothDeliveryMethodKey(e.target.value)
    setForm((prev) => ({ ...prev, boothMaterialsDeliveryMethod: v }))
  }

  const tldrIncludeMerged = { ...getInitialTldrInclude(), ...(form.tldrInclude || {}) }

  const updateGenerateTldr = (e) => {
    setForm((prev) => ({ ...prev, generateTldr: e.target.checked }))
  }

  const updateTldrInclude = (key) => (e) => {
    setForm((prev) => ({
      ...prev,
      tldrInclude: { ...getInitialTldrInclude(), ...(prev.tldrInclude || {}), [key]: e.target.checked },
    }))
  }

  const updateContact = (index, key) => (e) => {
    const v = e.target.value
    setForm((prev) => {
      const next = [...(prev.contacts || [])]
      next[index] = { ...next[index], [key]: v }
      return { ...prev, contacts: next }
    })
  }

  const addContact = () => {
    setForm((prev) => ({
      ...prev,
      contacts: [...(prev.contacts || []), { ...INITIAL_CONTACT }],
    }))
  }

  const removeContact = (index) => {
    setForm((prev) => {
      const next = (prev.contacts || []).filter((_, i) => i !== index)
      return { ...prev, contacts: next.length ? next : [{ ...INITIAL_CONTACT }] }
    })
  }

  const updateAdditionalSection = (index, key) => (e) => {
    const v = e.target.value
    setForm((prev) => {
      const next = [...(prev.additionalSections || [])]
      next[index] = { ...next[index], [key]: v }
      return { ...prev, additionalSections: next }
    })
  }

  const addAdditionalSection = () => {
    setForm((prev) => ({
      ...prev,
      additionalSections: [...(prev.additionalSections || []), { title: '', content: '' }],
    }))
  }

  const removeAdditionalSection = (index) => {
    setForm((prev) => ({
      ...prev,
      additionalSections: (prev.additionalSections || []).filter((_, i) => i !== index),
    }))
  }

  const handleTranslateConference = async (targetLang) => {
    const text = plain.trim()
    if (!text) return
    setTranslateMessage(null)
    const data = await tryRemoteTranslate(text, targetLang)
    const applied = applyRemoteKbygResult(data)
    if (applied?.plain) {
      setPlain(applied.plain)
      if (applied.html) setHtml(applied.html)
      return
    }
    setTranslateMessage(
      'Translation needs your /api/generate backend (POST with action: translate). Plain text was not changed.',
    )
    setTimeout(() => setTranslateMessage(null), 6000)
  }

  const handleGenerate = useCallback(
    async (e) => {
      e.preventDefault()
      const opts = { language: conferenceLanguage }
      const remote = await tryRemoteGenerate({
        generator: 'conferenceKbyg',
        language: conferenceLanguage,
        form,
        options: opts,
      })
      const applied = applyRemoteKbygResult(remote)
      if (applied?.plain) {
        setPlain(applied.plain)
        setHtml(applied.html || buildConferenceEmailHtml(form, opts))
        return
      }
      setPlain(generateConferenceEmailPlain(form, opts))
      setHtml(buildConferenceEmailHtml(form, opts))
    },
    [form, conferenceLanguage],
  )

  const handleReset = () => {
    const next = getInitialForm(conferenceLanguage)
    subjectManuallyEditedRef.current = false
    setForm(next)
    setSubjectLine(generateAutoSubjectLine(next, conferenceLanguage))
    setPlain('')
    setHtml('')
    setOrganizerImportText('')
    setStructuredKbygPreview('')
    setKbygEnhanceExisting('')
    setKbygEnhanceUpdates('')
    setKbygEnhanceMode('email')
    setKbygEnhanceOutput('')
  }

  const handleParseOrganizerDetails = () => {
    const result = processOrganizerImport(organizerImportText, conferenceLanguage)
    const { structuredKbygPlain, ...formPatch } = result
    setForm((prev) => mergeOrganizerParsedIntoForm(prev, formPatch))
    setStructuredKbygPreview(structuredKbygPlain || '')
  }

  const copyStructuredKbyg = async () => {
    if (!structuredKbygPreview.trim()) return
    try {
      await navigator.clipboard.writeText(structuredKbygPreview.trim())
      setStructuredKbygCopied(true)
      setTimeout(() => setStructuredKbygCopied(false), 2000)
    } catch (err) {
      console.error('Copy structured KBYG failed', err)
    }
  }

  const handleEnhanceKbyg = () => {
    const { output } = enhanceKbygOutput({
      existingStructuredKbyg: kbygEnhanceExisting,
      optionalNewDetails: kbygEnhanceUpdates,
      mode: kbygEnhanceMode,
      eventName: form.conferenceName,
    })
    setKbygEnhanceOutput(output)
  }

  const copyKbygEnhanced = async () => {
    if (!kbygEnhanceOutput.trim()) return
    try {
      await navigator.clipboard.writeText(kbygEnhanceOutput.trim())
      setKbygEnhanceCopied(true)
      setTimeout(() => setKbygEnhanceCopied(false), 2000)
    } catch (err) {
      console.error('Copy enhanced KBYG failed', err)
    }
  }

  const copySubject = async () => {
    if (!subjectLine.trim()) return
    try {
      await navigator.clipboard.writeText(subjectLine.trim())
      setSubjectCopied(true)
      setTimeout(() => setSubjectCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  /** Rich HTML + plain text for Gmail / clients (not raw HTML string paste). */
  const copyForEmail = async () => {
    if (!html) return
    const plainBody =
      trim(plain) || generateConferenceEmailPlain(form, { language: conferenceLanguage }).trim()
    try {
      const { html: clipHtml } = prepareConferenceEmailClipboardHtml(html)
      const payloadHtml = clipHtml || html
      if (typeof ClipboardItem !== 'undefined') {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([payloadHtml], { type: 'text/html' }),
              'text/plain': new Blob([plainBody], { type: 'text/plain' }),
            }),
          ])
        } catch {
          await navigator.clipboard.writeText(plainBody)
        }
      } else {
        await navigator.clipboard.writeText(plainBody)
      }
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 2000)
    } catch (err) {
      console.error('Copy for email failed', err)
    }
  }

  const copyForGoogleDoc = async () => {
    if (!html) return
    try {
      await navigator.clipboard.writeText(conferenceHtmlToGoogleDocPlain(html))
      setGoogleDocCopied(true)
      setTimeout(() => setGoogleDocCopied(false), 2000)
    } catch (err) {
      console.error('Copy for Google Doc failed', err)
    }
  }

  return (
    <>
      <aside className="form-panel conference-kbyg-form-panel">
        <form onSubmit={handleGenerate} className="form">
          <fieldset className="form-fieldset">
            <legend>{t.conf_email}</legend>
            <label>
              {t.conf_subjectLine}
              <input
                type="text"
                value={subjectLine}
                onChange={(e) => {
                  subjectManuallyEditedRef.current = true
                  setSubjectLine(e.target.value)
                }}
                placeholder="e.g. ElasticON 2026 Know Before You Go + Booth 412"
                autoComplete="off"
              />
            </label>
            <span className="form-hint">{t.conf_subjectHint}</span>
            <label>
              {t.conf_eventName}
              <input
                type="text"
                value={form.conferenceName}
                onChange={update('conferenceName')}
                placeholder="e.g. ElasticON 2026"
              />
            </label>
            <label>
              {t.conf_kbygDeckUrl}
              <input
                type="url"
                value={form.knowBeforeYouGoDeckUrl}
                onChange={update('knowBeforeYouGoDeckUrl')}
                placeholder="https://…"
                autoComplete="off"
              />
            </label>
            <span className="form-hint">{t.conf_kbygDeckHint}</span>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>{t.conf_importLegend}</legend>
            <p className="form-hint">
              {t.conf_importLead}
            </p>
            <label>
              {t.conf_organizerText}
              <textarea
                value={organizerImportText}
                onChange={(e) => setOrganizerImportText(e.target.value)}
                placeholder={t.conf_organizerImportPlaceholder}
                rows={10}
                autoComplete="off"
              />
            </label>
            <div className="quick-draft-stack">
              <button type="button" className="btn-quick-draft" onClick={handleParseOrganizerDetails}>
                {t.conf_parseBtn}
              </button>
              <p className="form-hint">
                {t.conf_parseHint}
              </p>
            </div>
            {structuredKbygPreview ? (
              <div className="structured-kbyg-preview">
                <label>
                  {t.conf_structuredLabel}
                  <textarea
                    readOnly
                    value={structuredKbygPreview}
                    rows={16}
                    className="structured-kbyg-textarea"
                    aria-label={t.conf_structuredLabel}
                  />
                </label>
                <div className="output-actions output-actions-inline structured-kbyg-copy">
                  <button type="button" className="btn-copy" onClick={copyStructuredKbyg} aria-pressed={structuredKbygCopied}>
                    {structuredKbygCopied ? 'Copied!' : t.conf_copyStructured}
                  </button>
                </div>
              </div>
            ) : null}
          </fieldset>

          <fieldset className="form-fieldset form-fieldset-kbyg-enhance">
            <legend>{t.conf_enhanceLegend}</legend>
            <p className="form-hint form-hint-kbyg-enhance-lead">
              {t.conf_enhanceLead}
            </p>
            <label>
              {t.conf_currentKbyg}
              <textarea
                value={kbygEnhanceExisting}
                onChange={(e) => setKbygEnhanceExisting(e.target.value)}
                placeholder="Paste your current Know Before You Go here (or load from parsed output)"
                rows={8}
                autoComplete="off"
              />
            </label>
            {structuredKbygPreview ? (
              <button type="button" className="btn-add-speaker" onClick={() => setKbygEnhanceExisting(structuredKbygPreview)}>
                {t.conf_useStructured}
              </button>
            ) : null}
            <label>
              {t.conf_pasteUpdates}
              <textarea
                value={kbygEnhanceUpdates}
                onChange={(e) => setKbygEnhanceUpdates(e.target.value)}
                placeholder="Paste new details from Slack, email, or organizer updates. These will automatically replace or merge into your KBYG."
                rows={5}
                autoComplete="off"
              />
            </label>
            <span className="form-hint form-hint-kbyg-enhance-sub">
              {t.conf_enhanceSub}
            </span>
            <label>
              {t.conf_outputMode}
              <select value={kbygEnhanceMode} onChange={(e) => setKbygEnhanceMode(e.target.value)}>
                <option value="slack">Slack — compact, scannable</option>
                <option value="email">Email — intro + spacing</option>
                <option value="doc">Doc — plain headers, Google Docs–friendly</option>
              </select>
            </label>
            <div className="quick-draft-stack">
              <button type="button" className="btn-quick-draft" onClick={handleEnhanceKbyg}>
                {t.conf_updateFormatBtn}
              </button>
            </div>
            {kbygEnhanceOutput ? (
              <div className="structured-kbyg-preview">
                <label>
                  {t.conf_enhancedOutput}
                  <textarea
                    readOnly
                    value={kbygEnhanceOutput}
                    rows={14}
                    className="structured-kbyg-textarea"
                    aria-label={t.conf_enhancedOutput}
                  />
                </label>
                <div className="output-actions output-actions-inline structured-kbyg-copy">
                  <button type="button" className="btn-copy" onClick={copyKbygEnhanced} aria-pressed={kbygEnhanceCopied}>
                    {kbygEnhanceCopied ? 'Copied!' : t.conf_copyEnhanced}
                  </button>
                </div>
              </div>
            ) : null}
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>{t.conf_tldrLegend}</legend>
            <label className="checkbox-label">
              <input type="checkbox" checked={form.generateTldr !== false} onChange={updateGenerateTldr} />
              {t.conf_generateTldr}
            </label>
            <span className="form-hint">
              {t.conf_tldrHint}
            </span>
            <div className="tldr-include-group" role="group" aria-label={t.conf_includeTldr}>
              <span className="tldr-include-heading">{t.conf_includeTldr}</span>
              <div className="tldr-include-checkboxes">
                {TLDR_ITEM_ORDER.map((id) => (
                  <label key={id} className="checkbox-label tldr-include-option">
                    <input type="checkbox" checked={!!tldrIncludeMerged[id]} onChange={updateTldrInclude(id)} />
                    {tldrIncludeLabels[id]}
                  </label>
                ))}
              </div>
            </div>
            <label>
              {t.conf_leadCapture}
              <input
                type="text"
                value={form.leadCaptureText}
                onChange={update('leadCaptureText')}
                placeholder="e.g. Scanner app, badge scans, demo sign-ups…"
                autoComplete="off"
              />
            </label>
            <label>
              {t.conf_customTldr}
              <textarea
                value={form.customTldrNotes}
                onChange={update('customTldrNotes')}
                placeholder="One short line per bullet when Custom note is checked"
                rows={3}
              />
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>{t.conf_eventDatesHours}</legend>
            <label>
              {t.conf_boothSetup}
              <textarea
                value={form.eventDatesBoothSetup}
                onChange={update('eventDatesBoothSetup')}
                placeholder="e.g. Build begins Tuesday 8am…"
                rows={3}
              />
            </label>
            <label>
              {t.conf_boothHours}
              <textarea
                value={form.eventDatesBoothHours}
                onChange={update('eventDatesBoothHours')}
                placeholder="One line per block or day (line breaks preserved in the email)"
                rows={4}
              />
            </label>
            <label>
              {t.conf_boothCleanup}
              <textarea
                value={form.eventDatesBoothCleanup}
                onChange={update('eventDatesBoothCleanup')}
                placeholder="e.g. Strike by 8pm Thursday…"
                rows={3}
              />
            </label>
            <label>
              {t.conf_notes}
              <textarea value={form.eventDatesNotes} onChange={update('eventDatesNotes')} placeholder="Anything else for dates &amp; hours…" rows={3} />
            </label>
            <label>
              {t.conf_staffingLink}
              <input
                type="text"
                inputMode="url"
                value={form.staffingScheduleLink}
                onChange={update('staffingScheduleLink')}
                placeholder="https://docs.google.com/spreadsheets/…"
                autoComplete="off"
              />
            </label>
            <label>
              {t.conf_staffingNotes}
              <textarea
                value={form.staffingScheduleNotes}
                onChange={update('staffingScheduleNotes')}
                placeholder="Paste a Google Sheet link or add quick staffing notes below"
                rows={3}
              />
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>{t.conf_tickets}</legend>
            <label>
              {t.conf_tickets}
              <textarea value={form.ticketsText} onChange={update('ticketsText')} placeholder="Badge pickup, exhibitor passes, guest list…" rows={3} />
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>{t.conf_location}</legend>
            <label>
              {t.conf_venue}
              <input type="text" value={form.locationVenue} onChange={update('locationVenue')} placeholder="e.g. Moscone South" />
            </label>
            <label>
              {t.conf_address}
              <input type="text" value={form.locationAddress} onChange={update('locationAddress')} placeholder="Street, city, region" />
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>{t.conf_contacts}</legend>
            <p className="form-hint">{t.conf_contactsHint}</p>
            {(form.contacts || []).map((contact, index) => (
              <div key={index} className="contact-row">
                <label>
                  {t.conf_nameReq} <span className="form-hint">({t.conf_required})</span>
                  <input
                    type="text"
                    value={contact.name}
                    onChange={updateContact(index, 'name')}
                    placeholder="e.g. Jane Smith"
                    aria-required="true"
                  />
                </label>
                <label>
                  {t.conf_group}
                  <select value={contact.group || ''} onChange={updateContact(index, 'group')} aria-label="Contact group">
                    {CONTACT_GROUP_OPTIONS.map((opt) => (
                      <option key={opt.value || 'none'} value={opt.value}>
                        {!opt.value ? t.conf_noContactGroup : confUiStrings.contactGroups[opt.value] || opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.conf_role}
                  <input type="text" value={contact.role} onChange={updateContact(index, 'role')} placeholder="e.g. booth lead" />
                </label>
                <label>
                  {t.conf_emailLabel}
                  <input type="email" value={contact.email} onChange={updateContact(index, 'email')} placeholder="e.g. jane@example.com" autoComplete="off" />
                </label>
                <label>
                  {t.conf_phone}
                  <input type="text" value={contact.phone} onChange={updateContact(index, 'phone')} placeholder="e.g. +1 …" autoComplete="off" />
                </label>
                {(form.contacts || []).length > 1 && (
                  <button type="button" className="btn-reset" onClick={() => removeContact(index)}>
                    {t.conf_removeContact}
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addContact} className="btn-add-speaker">
              {t.conf_addContact}
            </button>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>{t.conf_boothLogistics}</legend>
            <label>
              {t.conf_boothDelivery}
              <select value={normalizeBoothDeliveryMethodKey(form.boothMaterialsDeliveryMethod)} onChange={updateBoothDeliveryMethod}>
                {BOOTH_DELIVERY_METHOD_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {boothDeliveryOptions[value]?.label || value}
                  </option>
                ))}
              </select>
            </label>
            {normalizeBoothDeliveryMethodKey(form.boothMaterialsDeliveryMethod) === 'shipped_to_individual' && (
              <label>
                {t.conf_shippedTo}
                <input
                  type="text"
                  value={form.boothMaterialsShippedToName}
                  onChange={update('boothMaterialsShippedToName')}
                  placeholder="Name of recipient"
                  autoComplete="name"
                />
              </label>
            )}
            <span className="form-hint">
              {t.conf_boothGenHint}
            </span>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>{t.conf_avLegend}</legend>
            <label>
              {t.conf_avLegend}
              <textarea
                value={form.avSetupRequirements}
                onChange={update('avSetupRequirements')}
                placeholder="Power, Wi‑Fi, displays, microphones, session AV…"
                rows={4}
              />
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>{t.conf_swagLegend}</legend>
            <label>
              {t.conf_swagLegend}
              <textarea value={form.swagText} onChange={update('swagText')} placeholder="What to bring, inventory, giveaways…" rows={3} />
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>{t.conf_parkingLegend}</legend>
            <label>
              {t.conf_parkingLegend} <span className="form-hint">{t.conf_optionalMark}</span>
              <textarea value={form.parkingText} onChange={update('parkingText')} rows={3} />
              <span className="form-hint">{t.conf_parkingOptionalNote}</span>
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>{t.conf_foodBev}</legend>
            <label>
              {t.conf_foodBev} <span className="form-hint">{t.conf_optionalMark}</span>
              <textarea value={form.foodBeverageText} onChange={update('foodBeverageText')} rows={3} />
              <span className="form-hint">{t.conf_foodOptionalNote}</span>
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>{t.conf_engagement}</legend>
            <label>
              {t.conf_type}
              <select value={form.engagementType || 'none'} onChange={update('engagementType')} aria-label="Engagement type">
                <option value="none">{t.conf_engNone}</option>
                <option value="kahoot">{t.conf_engKahoot}</option>
                <option value="raffle">{t.conf_engRaffle}</option>
              </select>
            </label>
            {(form.engagementType === 'kahoot' || form.engagementType === 'raffle') && (
              <>
                <label>
                  {t.conf_details}
                  <textarea
                    value={form.engagementDetails}
                    onChange={update('engagementDetails')}
                    placeholder={form.engagementType === 'kahoot' ? 'Timing, join code, prize rules…' : 'How to enter, drawing time…'}
                    rows={4}
                    autoComplete="off"
                  />
                </label>
                <label>
                  {t.conf_prize}
                  <input
                    type="text"
                    value={form.engagementPrize}
                    onChange={update('engagementPrize')}
                    placeholder="e.g. Gift card, headphones"
                    autoComplete="off"
                  />
                </label>
              </>
            )}
            <span className="form-hint">
              {t.conf_engagementHint}
            </span>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>{t.conf_additionalSections}</legend>
            <p className="form-hint">{t.conf_additionalLead}</p>
            {(form.additionalSections || []).map((sec, index) => (
              <div key={index} className="contact-row conference-additional-section">
                <label>
                  {t.conf_sectionTitle}
                  <input
                    type="text"
                    value={sec.title}
                    onChange={updateAdditionalSection(index, 'title')}
                    placeholder="e.g. Evening event"
                  />
                </label>
                <label>
                  {t.conf_content}
                  <textarea value={sec.content} onChange={updateAdditionalSection(index, 'content')} placeholder="Details…" rows={3} />
                </label>
                <button type="button" className="btn-reset" onClick={() => removeAdditionalSection(index)}>
                  {t.conf_removeSection}
                </button>
              </div>
            ))}
            <button type="button" onClick={addAdditionalSection} className="btn-add-speaker">
              {t.conf_addSection}
            </button>
          </fieldset>

          <div className="form-language-row" role="group" aria-label={t.languageLabel}>
            <label>
              {t.languageLabel}
              <select value={conferenceLanguage} onChange={(e) => setConferenceLanguage(e.target.value)}>
                {LANGUAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" className="btn-generate">
            {t.conf_btnGenerate}
          </button>
          <button type="button" onClick={handleReset} className="btn-reset">
            🔄 {t.conf_btnReset}
          </button>
        </form>
      </aside>

      <main className="output-panel conference-kbyg-output-panel">
        <div className="output-header">
          <h2>{t.conf_outputTitle}</h2>
        </div>
        <div className="output-content">
          {subjectLine.trim() ? (
            <div className="subject-line-section">
              <h3 className="subject-line-heading">{t.conf_outputSubject}</h3>
              <pre className="output-text subject-line-text">{subjectLine.trim()}</pre>
              <div className="output-actions output-actions-inline">
                <button
                  type="button"
                  className="btn-section-action"
                  onClick={() => setSubjectLine(makeMoreConcise(subjectLine))}
                >
                  Make concise
                </button>
                <button type="button" onClick={copySubject} className="btn-copy" aria-pressed={subjectCopied}>
                  {subjectCopied ? 'Copied!' : 'Copy Subject'}
                </button>
              </div>
            </div>
          ) : null}
          {plain ? (
            <>
              <h3 className="generated-email-heading">Email body</h3>
              <div className="translate-output-bar" role="group" aria-label="Translate output via API">
                <span className="form-hint translate-output-label">Translate output</span>
                <button type="button" className="btn-section-action" onClick={() => handleTranslateConference('es')}>
                  → Spanish
                </button>
                <button type="button" className="btn-section-action" onClick={() => handleTranslateConference('pt')}>
                  → Portuguese (BR)
                </button>
              </div>
              {translateMessage ? <p className="form-hint translate-api-hint">{translateMessage}</p> : null}
              {html ? (
                <div className="meetup-page-preview output-text" dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                <pre className="output-text">{plain}</pre>
              )}
              <div className="output-actions conference-kbyg-copy-actions output-actions-inline">
                <button
                  type="button"
                  className="btn-section-action"
                  onClick={() => {
                    setPlain(makeMoreConcise(plain))
                    setHtml('')
                  }}
                >
                  Make concise
                </button>
                <button type="button" onClick={copyForEmail} className="btn-copy" aria-pressed={emailCopied}>
                  {emailCopied ? 'Copied!' : '📧 Copy for Email'}
                </button>
                <button type="button" onClick={copyForGoogleDoc} className="btn-copy" aria-pressed={googleDocCopied}>
                  {googleDocCopied ? 'Copied!' : '📄 Copy for Google Doc'}
                </button>
              </div>
            </>
          ) : (
            <p className="output-placeholder">
              Fill in the form and click &quot;Generate email&quot; to create the conference booth logistics email.
            </p>
          )}
        </div>
      </main>
    </>
  )
}
