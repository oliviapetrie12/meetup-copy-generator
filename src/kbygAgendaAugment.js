/**
 * Operational reminders for KBYG agenda output — injected at render time only;
 * {@link import('./shared/eventData.js').buildSharedEventDataFromKbygForm} / stored internalAgenda stay unchanged.
 */

/**
 * @param {string} raw
 * @param {import('./shared/agendaItems.js').AgendaItem[]} items
 */
function userAgendaBlob(raw, items) {
  const fromItems = items.map((i) => [i.time, i.title, i.speaker].filter(Boolean).join(' ')).join('\n')
  return `${raw}\n${fromItems}`.toLowerCase()
}

/** User already included a speaker-arrival style line (common EN + ES + PT phrasing). */
export function agendaAlreadyHasSpeakerOperationalLine(blob) {
  return (
    /speakers?\s+arrive|speaker\s+arrival|\barrive\s+by\b|speaker\s+prep|prep\s+time\b/i.test(blob) ||
    /los\s+ponentes\s+llegan|llegad\w\s+del\s+ponente|llegad\w\s+de\s+los\s+ponentes|ponentes\s+llegan/i.test(blob) ||
    /palestrantes\s+chegam|chegada\s+do(?:s)?\s+palestrante/i.test(blob)
  )
}

/** User already included a cleanup / tidy reminder (keywords + localized phrases). */
export function agendaAlreadyHasCleanupReminder(blob) {
  const b = blob.toLowerCase()
  return (
    /\btrash\b|\btidy\s+up\b|\bcleanup\b|\bclean\s+up\b|\bclean-up\b|\bbasura\b|\blixo\b/.test(b) ||
    /throw\s+away\s+trash|tidy\s+the\s+space|take\s+out\s+(the\s+)?trash|leave\s+.*\s+tidy/i.test(blob) ||
    /tirar\s+la\s+basura|dejar\s+el\s+espacio\s+ordenad|ordenad\w\s+antes\s+de\s+ir/i.test(blob) ||
    /jogar\s+o\s+lixo\s+fora|organizar\s+o\s+espa[cç]o/i.test(blob)
  )
}

/**
 * Inject operational bullets: speaker arrival (when schedule fields exist) + cleanup footer.
 * Idempotent with respect to duplicate phrases already present in pasted agenda text.
 *
 * @param {import('./shared/agendaItems.js').AgendaItem[]} agendaItems
 * @param {object} form - KBYG form
 * @param {object} S - {@link import('./generationLanguage.js').getMeetupKbygStrings}
 * @param {(s: string) => string} trim
 * @returns {import('./shared/agendaItems.js').AgendaItem[]}
 */
export function injectOperationalReminders(agendaItems, form, S, trim) {
  const raw = trim(form.internalAgenda || '')
  const blob = userAgendaBlob(raw, agendaItems)

  const arrival = trim(form.arrivalTime)
  const eventTime = trim(form.eventTime)
  const venueName = trim(form.venueName)

  /** @type {import('./shared/agendaItems.js').AgendaItem[]} */
  const out = []

  const shouldPrependSpeaker =
    Boolean(arrival && eventTime) && !agendaAlreadyHasSpeakerOperationalLine(blob)

  if (shouldPrependSpeaker) {
    const title = venueName ? S.kbygAgendaSpeakersArriveAt(venueName) : S.kbygAgendaSpeakersArrivePlain
    out.push({
      time: arrival,
      title,
      speaker: '',
      timePlain: true,
    })
  }

  out.push(...agendaItems)

  if (!agendaAlreadyHasCleanupReminder(blob)) {
    out.push({
      time: '',
      title: S.kbygAgendaCleanupReminder,
      speaker: '',
    })
  }

  return out
}

/**
 * @param {import('./shared/agendaItems.js').AgendaItem[]} agendaItems
 * @param {object} form
 * @param {object} S
 * @param {(s: string) => string} trim
 */
export function augmentKbygAgendaForEmail(agendaItems, form, S, trim) {
  return injectOperationalReminders(agendaItems, form, S, trim)
}
