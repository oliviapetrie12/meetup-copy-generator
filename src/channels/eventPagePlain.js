/**
 * Meetup / Luma event page channel: markdown-style plain text only (no HTML).
 */

import { normalizeElastiFlow } from '../textNormalize.js'

/**
 * @param {Array<{ time: string, title: string, speaker: string }>} items
 */
export function formatAgendaPlainMarkdown(items) {
  if (!items || !items.length) return ''
  const lines = []
  for (const it of items) {
    if (it.time && (it.title || it.speaker)) {
      lines.push(`- ${it.time}${it.title ? ` ${it.title}` : ''}`)
      if (it.speaker) lines.push(`  ${it.speaker}`)
    } else if (it.title || it.speaker) {
      lines.push(`- ${[it.title, it.speaker].filter(Boolean).join(' — ')}`)
    }
  }
  return lines.join('\n')
}

/**
 * @param {object} params
 * @param {import('../shared/eventData.js').SharedEventData} params.eventData
 * @param {object} params.form
 * @param {object} params.S - from getEventPageStrings(lang)
 * @param {string} params.intro
 * @param {Record<string, unknown>} [params.remoteSections]
 * @param {string} [params.agendaPlainFallback] - raw agenda text if structured items render empty
 */
export function renderEventPagePlainMarkdown({
  eventData,
  form,
  S,
  intro,
  remoteSections,
  agendaPlainFallback = '',
}) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const has = (s) => trim(s).length > 0
  const rs = remoteSections

  const arrivalField =
    rs && Object.prototype.hasOwnProperty.call(rs, 'arrivalInstructions')
      ? rs.arrivalInstructions
      : form.arrivalInstructions

  const parkingField = rs && Object.prototype.hasOwnProperty.call(rs, 'parking') ? rs.parking : form.parkingNotes

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

  const useEmojis = form.eventPageSectionEmojis !== false
  const withEmoji = {
    [S.when]: S.emojiWhen,
    [S.where]: S.emojiWhere,
    [S.whyAttend]: S.emojiWhy,
    [S.whatToExpect]: S.emojiWhat,
    [S.agenda]: S.emojiAgenda,
    [S.closing]: S.emojiClosing,
    [S.talkAbstracts]: S.emojiTalks,
    [S.arrival]: S.emojiArrival,
    [S.parking]: S.emojiParking,
    [S.rsvp]: S.emojiRsvp,
    [S.hostSponsor]: S.emojiHost,
  }
  const plainHeader = {
    [S.when]: S.plainWhen,
    [S.where]: S.plainWhere,
    [S.whyAttend]: S.plainWhy,
    [S.whatToExpect]: S.plainWhat,
    [S.agenda]: S.plainAgenda,
    [S.closing]: S.plainClosing,
    [S.talkAbstracts]: S.plainTalks,
    [S.arrival]: S.plainArrival,
    [S.parking]: S.plainParking,
    [S.rsvp]: S.plainRsvp,
    [S.hostSponsor]: S.plainHost,
  }

  const sectionLabel = (title) => (useEmojis ? withEmoji[title] || title : plainHeader[title] || title)

  /** @type {Array<{ title: string, body: string }>} */
  const sections = []

  if (has(form.date) || has(form.eventStartTime)) {
    if (eventData.date) {
      sections.push({ title: S.when, body: normalizeElastiFlow(eventData.date) })
    }
  }

  if (eventData.venue) {
    sections.push({ title: S.where, body: normalizeElastiFlow(eventData.venue) })
  }

  if (has(form.rsvpInstructions)) {
    sections.push({ title: S.rsvp, body: normalizeElastiFlow(trim(form.rsvpInstructions)) })
  }

  if (has(arrivalField)) {
    sections.push({ title: S.arrival, body: normalizeElastiFlow(trim(arrivalField)) })
  }

  if (has(parkingField)) {
    sections.push({ title: S.parking, body: normalizeElastiFlow(trim(parkingField)) })
  }

  if (form.eventPageIncludeWhyAttend !== false && has(form.meetupPageWhyAttend)) {
    sections.push({
      title: S.whyAttend,
      body: normalizeElastiFlow(trim(form.meetupPageWhyAttend)),
    })
  }

  if (form.eventPageIncludeWhatToExpect !== false && has(form.meetupPageWhatToExpect)) {
    sections.push({
      title: S.whatToExpect,
      body: normalizeElastiFlow(trim(form.meetupPageWhatToExpect)),
    })
  }

  let agendaBody = formatAgendaPlainMarkdown(eventData.agenda)
  if (!agendaBody && agendaPlainFallback) {
    agendaBody = normalizeElastiFlow(agendaPlainFallback)
  }
  sections.push({
    title: S.agenda,
    body: agendaBody,
  })

  if (form.eventPageInviteSpeakers) {
    const inviteTitle = (useEmojis ? '⚡ ' : '') + S.inviteTitle
    sections.push({
      title: inviteTitle,
      body: S.inviteBody,
    })
  }

  if (form.eventPageIncludeSpeakerSection !== false && (hasSpeaker1 || hasSpeaker2 || hasSpeaker3)) {
    sections.push({
      title: S.talkAbstracts,
      body: eventData.speakerPrep ? normalizeElastiFlow(eventData.speakerPrep) : '',
    })
  }

  if (has(form.hostOrSponsor)) {
    sections.push({ title: S.hostSponsor, body: normalizeElastiFlow(trim(form.hostOrSponsor)) })
  }

  if (has(form.meetupPageClosing)) {
    sections.push({ title: S.closing, body: normalizeElastiFlow(trim(form.meetupPageClosing)) })
  }

  const eventTitle = eventData.title ? normalizeElastiFlow(eventData.title) : ''

  const plainLines = [normalizeElastiFlow(intro), '']
  if (eventTitle) {
    plainLines.push(eventTitle, '')
  }
  for (const { title, body } of sections) {
    if (title) {
      plainLines.push(sectionLabel(title), body, '')
    } else {
      plainLines.push(body, '')
    }
  }

  return plainLines.join('\n').trim()
}
