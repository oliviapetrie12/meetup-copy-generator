import { formatAgendaClock, getAgendaLineLabels } from './generationLanguage.js'
import { addMinutes, parseTime } from './formTimeUtils.js'

function agendaSpeakerLine(name, talkTitle) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const n = trim(name)
  const t = trim(talkTitle)
  if (n && t) return `${n} - ${t}`
  if (n) return n
  if (t) return t
  return ''
}

/** Stock timed agenda when no custom agenda text is provided */
export function buildAgenda(form, lang = 'en') {
  const L = getAgendaLineLabels(lang)
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const hasSpeaker2 =
    [form.speaker2Name, form.speaker2Title, form.speaker2Company, form.speaker2TalkTitle, form.speaker2TalkAbstract].some((v) =>
      trim(v).length > 0,
    )
  const hasSpeaker3 =
    [form.speaker3Name, form.speaker3Title, form.speaker3Company, form.speaker3TalkTitle, form.speaker3TalkAbstract].some((v) =>
      trim(v).length > 0,
    )

  const startMins = parseTime(form.eventStartTime)
  const at = (offsetMins) =>
    startMins != null ? formatAgendaClock(addMinutes(startMins, offsetMins), lang) : null

  const lines = []
  const pushTimed = (offsetMins, text) => {
    const clock = at(offsetMins)
    if (clock) lines.push(`${clock} ${text}`)
    else lines.push(text)
  }

  pushTimed(0, L.doorsOpen)
  pushTimed(15, L.welcome)

  const speaker1Line = agendaSpeakerLine(form.speaker1Name, form.speaker1TalkTitle)
  if (speaker1Line) pushTimed(30, speaker1Line)

  if (hasSpeaker2) {
    const speaker2Line = agendaSpeakerLine(form.speaker2Name, form.speaker2TalkTitle)
    if (speaker2Line) pushTimed(60, speaker2Line)
  }

  if (hasSpeaker3 && hasSpeaker2) {
    const speaker3Line = agendaSpeakerLine(form.speaker3Name, form.speaker3TalkTitle)
    if (speaker3Line) pushTimed(90, speaker3Line)
  }

  pushTimed(120, L.concludes)

  return lines.join('\n')
}
