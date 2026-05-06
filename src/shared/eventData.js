/**
 * Shared structured event payload used by Meetup Event Page and KBYG renderers.
 * Values are localized content only (no HTML/markdown/bullets).
 *
 * @typedef {{ time: string, title: string, speaker: string }} AgendaItem
 * @typedef {{
 *   title: string
 *   date: string
 *   arrivalTime: string
 *   venue: string
 *   parking: string
 *   parkingBookingUrl: string
 *   parkingBookingLabel: string
 *   food: string
 *   foodLines: string[]
 *   av: string
 *   speakerPrep: string
 *   agenda: AgendaItem[]
 * }} SharedEventData
 */

import {
  formatAgendaClock,
  formatLocalizedLongDate,
  formatWhenDateTimePhrase,
  normalizeLanguage,
} from '../generationLanguage.js'
import { buildAgenda } from '../eventPageAgendaFallback.js'
import { parseTime, getTimezoneDisplay } from '../formTimeUtils.js'
import { normalizeElastiFlow } from '../textNormalize.js'
import { buildTalkAbstracts } from '../speakerAbstracts.js'
import { agendaPlainTextToAgendaItems, parseKbygAgendaBlocks, kbygBlocksToAgendaItems } from './agendaItems.js'

export function createEmptySharedEventData() {
  return {
    title: '',
    date: '',
    arrivalTime: '',
    venue: '',
    parking: '',
    parkingBookingUrl: '',
    parkingBookingLabel: '',
    food: '',
    foodLines: [],
    av: '',
    speakerPrep: '',
    agenda: [],
  }
}

export function buildEventPageWhenLine(form, lang) {
  const n = normalizeLanguage(lang)
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const dateRaw = trim(form.date)
  const startMins = parseTime(form.eventStartTime)
  const tzDisplay = getTimezoneDisplay(form.timezone)
  const parts = []
  if (dateRaw && startMins != null) {
    parts.push(formatWhenDateTimePhrase(dateRaw, startMins, n))
  } else if (dateRaw) {
    parts.push(formatLocalizedLongDate(dateRaw, n) || dateRaw)
  } else if (startMins != null) {
    parts.push(formatAgendaClock(startMins, n))
  }
  if (tzDisplay && parts.length) parts[0] = `${parts[0]} ${tzDisplay}`
  return parts.join('\n')
}

/** @param {Record<string, unknown> | null | undefined} rs */
export function resolveAgendaBodyForEventPage(form, lang, trim, has, rs) {
  if (rs && Object.prototype.hasOwnProperty.call(rs, 'agenda') && rs.agenda != null) {
    const g = rs.agenda
    const joined = Array.isArray(g)
      ? g.map((x) => String(x).trim()).filter(Boolean).join('\n')
      : String(g).trim()
    if (joined) return normalizeElastiFlow(joined)
  }
  if (rs && Object.prototype.hasOwnProperty.call(rs, 'meetupPageAgenda') && rs.meetupPageAgenda != null) {
    const t = String(rs.meetupPageAgenda).trim()
    if (t) return normalizeElastiFlow(t)
  }
  if (has(form.meetupPageAgenda)) return normalizeElastiFlow(trim(form.meetupPageAgenda))
  return normalizeElastiFlow(buildAgenda(form, lang))
}

/**
 * @param {object} form - event promotion form
 * @param {string} language
 * @param {object} [options]
 * @param {Record<string, unknown>} [options.remoteSections]
 */
export function buildSharedEventDataFromEventPageForm(form, language, options = {}) {
  const lang = normalizeLanguage(language)
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const has = (s) => trim(s).length > 0
  const rs = options.remoteSections

  const arrivalField =
    rs && Object.prototype.hasOwnProperty.call(rs, 'arrivalInstructions')
      ? rs.arrivalInstructions
      : form.arrivalInstructions

  const parkingField = rs && Object.prototype.hasOwnProperty.call(rs, 'parking') ? rs.parking : form.parkingNotes

  const whenLine = buildEventPageWhenLine(form, lang)
  const agendaBody = resolveAgendaBodyForEventPage(form, lang, trim, has, rs)
  const venue = [form.venueName, form.venueAddress].map(trim).filter(Boolean).join('\n')

  const hasSpeaker1 = [
    form.speaker1Name,
    form.speaker1Title,
    form.speaker1Company,
    form.speaker1TalkTitle,
    form.speaker1TalkAbstract,
  ].some(has)
  const hasSpeaker2 = [
    form.speaker2Name,
    form.speaker2Title,
    form.speaker2Company,
    form.speaker2TalkTitle,
    form.speaker2TalkAbstract,
  ].some(has)
  const hasSpeaker3 = [
    form.speaker3Name,
    form.speaker3Title,
    form.speaker3Company,
    form.speaker3TalkTitle,
    form.speaker3TalkAbstract,
  ].some(has)
  const speakerPrep =
    form.eventPageIncludeSpeakerSection !== false && (hasSpeaker1 || hasSpeaker2 || hasSpeaker3)
      ? buildTalkAbstracts(form)
      : ''

  return {
    title: trim(form.eventTitle),
    date: whenLine,
    arrivalTime: has(arrivalField) ? normalizeElastiFlow(trim(arrivalField)) : '',
    venue: venue ? normalizeElastiFlow(venue) : '',
    parking: has(parkingField) ? normalizeElastiFlow(trim(parkingField)) : '',
    parkingBookingUrl: '',
    parkingBookingLabel: '',
    food: '',
    foodLines: [],
    av: '',
    speakerPrep: speakerPrep ? normalizeElastiFlow(speakerPrep) : '',
    agenda: agendaPlainTextToAgendaItems(agendaBody),
  }
}

/**
 * @param {object} form - KBYG form
 * @param {string} language
 */
export function buildSharedEventDataFromKbygForm(form, language) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const has = (s) => trim(s).length > 0

  const whenLine = [trim(form.eventDate), trim(form.eventTime)].filter(Boolean).join(' at ')
  const venue = [trim(form.venueName), trim(form.venueAddress)].filter(Boolean).join('\n')
  const foodLines = [
    has(form.foodDetails) ? trim(form.foodDetails) : '',
    has(form.drinkDetails) ? trim(form.drinkDetails) : '',
  ].filter(Boolean)
  const fd = foodLines.join(' · ')

  let agenda = []
  if (has(form.internalAgenda)) {
    const blocks = parseKbygAgendaBlocks(trim(form.internalAgenda))
    agenda = kbygBlocksToAgendaItems(blocks)
  }

  const prepParts = []
  if (has(form.speakerArrivalNote)) prepParts.push(trim(form.speakerArrivalNote))
  if (has(form.setupNotes)) prepParts.push(trim(form.setupNotes))

  return {
    title: trim(form.eventTitle),
    date: whenLine,
    arrivalTime: trim(form.arrivalTime),
    venue,
    parking: has(form.parkingNotes) ? trim(form.parkingNotes) : '',
    parkingBookingUrl: has(form.parkingBookingUrl) ? trim(form.parkingBookingUrl) : '',
    parkingBookingLabel: trim(form.parkingBookingLabel || ''),
    food: fd,
    foodLines,
    av: has(form.avNotes) ? trim(form.avNotes) : '',
    speakerPrep: prepParts.join('\n\n'),
    agenda,
  }
}
