import { normalizeElastiFlow } from './textNormalize.js'

/** Speaker / talk blocks for event page “Talk abstracts” style sections */
export function buildTalkAbstracts(form) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const hasSpeaker2 = [
    form.speaker2Name,
    form.speaker2Title,
    form.speaker2Company,
    form.speaker2TalkTitle,
    form.speaker2TalkAbstract,
  ].some((v) => trim(v).length > 0)
  const hasSpeaker3 = [
    form.speaker3Name,
    form.speaker3Title,
    form.speaker3Company,
    form.speaker3TalkTitle,
    form.speaker3TalkAbstract,
  ].some((v) => trim(v).length > 0)

  const formatTalk = (name, title, company, talkTitle, abstract) => {
    const parts = []
    if (trim(talkTitle)) parts.push(normalizeElastiFlow(trim(talkTitle)))
    const n = trim(name)
    const t = trim(title)
    const c = trim(company)
    let speakerLine = ''
    if (n && t && c) speakerLine = `${n}, ${t} at ${normalizeElastiFlow(c)}`
    else if (n && c) speakerLine = `${n}, ${normalizeElastiFlow(c)}`
    else if (n && t) speakerLine = `${n}, ${t}`
    else if (n) speakerLine = normalizeElastiFlow(n)
    else if (c) speakerLine = normalizeElastiFlow(c)
    else if (t) speakerLine = t
    if (speakerLine) parts.push(speakerLine)
    if (trim(abstract)) {
      if (parts.length) parts.push('')
      parts.push(normalizeElastiFlow(trim(abstract)))
    }
    return parts.join('\n')
  }

  const talks = []
  const name1 = trim(form.speaker1Name)
  const title1 = trim(form.speaker1Title)
  const company1 = trim(form.speaker1Company)
  const talkTitle1 = trim(form.speaker1TalkTitle)
  const abstract1 = trim(form.speaker1TalkAbstract)
  if (name1 || title1 || company1 || talkTitle1 || abstract1) {
    talks.push(formatTalk(form.speaker1Name, form.speaker1Title, form.speaker1Company, form.speaker1TalkTitle, form.speaker1TalkAbstract))
  }
  if (hasSpeaker2) {
    talks.push(formatTalk(form.speaker2Name, form.speaker2Title, form.speaker2Company, form.speaker2TalkTitle, form.speaker2TalkAbstract))
  }
  if (hasSpeaker3) {
    talks.push(formatTalk(form.speaker3Name, form.speaker3Title, form.speaker3Company, form.speaker3TalkTitle, form.speaker3TalkAbstract))
  }

  return talks.join('\n\n')
}
