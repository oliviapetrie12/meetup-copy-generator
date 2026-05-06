/**
 * Enrich KBYG agenda output with operational reminders without mutating stored {@link internalAgenda} text.
 */

/**
 * @param {string} raw
 * @param {import('./shared/agendaItems.js').AgendaItem[]} items
 */
function userAgendaBlob(raw, items) {
  const fromItems = items.map((i) => [i.time, i.title, i.speaker].filter(Boolean).join(' ')).join('\n')
  return `${raw}\n${fromItems}`.toLowerCase()
}

/** User already included a speaker-arrival style line (any common locale). */
function agendaBlobHasSpeakerArrivalReminder(blob) {
  return (
    /speakers?\s+arrive|speaker\s+arriv|llegad\w\s+de\s+los\s+ponentes|ponentes\s+llegan|los\s+ponentes\s+llegan|palestrantes\s+chegam|chegada\s+do(?:s)?\s+palestrante/i.test(
      blob,
    )
  )
}

/** User already included a cleanup / tidy reminder (any common locale). */
function agendaBlobHasCleanupReminder(blob) {
  return (
    /throw\s+away\s+trash|tidy\s+up|tidy\s+the\s+space|clean\s+up\s+before\s+leaving|take\s+out\s+(the\s+)?trash/i.test(
      blob,
    ) ||
    /tirar\s+la\s+basura|dejar\s+el\s+espacio\s+ordenad|ordenad\w\s+antes\s+de\s+ir/i.test(blob) ||
    /jogar\s+o\s+lixo\s+fora|organizar\s+o\s+espa[cç]o/i.test(blob)
  )
}

/**
 * @param {import('./shared/agendaItems.js').AgendaItem[]} agendaItems
 * @param {object} form
 * @param {object} S - {@link import('./generationLanguage.js').getMeetupKbygStrings}
 * @param {(s: string) => string} trim
 * @returns {import('./shared/agendaItems.js').AgendaItem[]}
 */
export function augmentKbygAgendaForEmail(agendaItems, form, S, trim) {
  const raw = trim(form.internalAgenda || '')
  const blob = userAgendaBlob(raw, agendaItems)

  const arrival = trim(form.arrivalTime)
  const venueName = trim(form.venueName)

  /** @type {import('./shared/agendaItems.js').AgendaItem[]} */
  const out = []

  const addPrepend = Boolean(arrival && venueName) && !agendaBlobHasSpeakerArrivalReminder(blob)
  if (addPrepend) {
    out.push({
      time: arrival,
      title: S.kbygAgendaSpeakersArriveAt(venueName),
      speaker: '',
      timePlain: true,
    })
  }

  out.push(...agendaItems)

  if (!agendaBlobHasCleanupReminder(blob)) {
    out.push({
      time: '',
      title: S.kbygAgendaCleanupReminder,
      speaker: '',
    })
  }

  return out
}
