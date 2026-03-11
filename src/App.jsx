import { useState, useRef, useEffect } from 'react'

const USER_GROUPS = [
  'Argentina Elastic User Group',
  'Canberra Elastic Fantastics',
  'Chile Elastic User Group',
  'Elastic Algeria User Group',
  'Elastic APJ Virtual User Group',
  'Elastic Atlanta User Group',
  'Elastic Austin User Group',
  'Elastic Bangalore User Group',
  'Elastic Barcelona User Group',
  'Elastic Baltic States User Group',
  'Elastic Bauru e região User Group',
  'Elastic Belgium User Group',
  'Elastic Blumenau User Group',
  'Elastic Boston User Group',
  'Elastic Brasil Virtual',
  'Elastic Brasília User Group',
  'Elastic Brisbane User Group',
  'Elastic Bulgaria User Group',
  'Elastic Campinas User Group',
  'Elastic Chennai User Group',
  'Elastic Chicago User Group',
  'Elastic Cincinnati User Group',
  'Elastic Cleveland User Group',
  'Elastic Colombia User Group',
  'Elastic Copenhagen User Group',
  'Elastic Costa Rica User Group',
  'Elastic CZ User Group',
  'Elastic Curitiba User Group',
  'Elastic Dallas User Group',
  'Elastic Delhi User Group',
  'Elastic Denver User Group',
  'Elastic Detroit User Group',
  'Elastic Dubai User Group',
  'Elastic Dublin User Group',
  'Elastic East Bay User Group',
  'Elastic Florianópolis User Group',
  'Elastic Fortaleza User Group',
  'Elastic FR User Group',
  'Elastic Goiânia User Group',
  'Elastic Göteborg User Group',
  'Elastic Greece',
  'Elastic Guadalajara user group',
  'Elastic Gujarat User Group',
  'Elastic Hanoi User Group',
  'Elastic Helsinki User Group',
  'Elastic Houston User Group',
  'Elastic Hyderabad User Group',
  'Elastic Indonesia User Group',
  'Elastic Italy User Group',
  'Elastic Jacksonville User Group',
  'Elastic Jaipur User Group',
  'Elastic Kansas City User Group',
  'Elastic Kochi User Group',
  'Elastic Kolkata User Group',
  'Elastic Krakow',
  'Elastic Kuala Lumpur User Group',
  'Elastic Lancaster User Group',
  'Elastic Las Vegas User Group',
  'Elastic Latin America Virtual',
  'Elastic London User Group',
  'Elastic Los Angeles User Group',
  'Elastic Luxembourg User Group',
  'Elastic Manchester User Group',
  'Elastic Melbourne User Group',
  'Elastic Mexico City User Group',
  'Elastic Miami User Group',
  'Elastic Minas Gerais User Group',
  'Elastic Minneapolis User Group',
  'Elastic Montreal User Group',
  'Elastic Morocco User Group',
  'Elastic Mumbai User Group',
  'Elastic Netherlands User Group',
  'Elastic New York City User Group',
  'Elastic New Zealand User Group',
  'Elastic Nigeria User Group',
  'Elastic Oslo User Group',
  'Elastic Orlando User Group',
  'Elastic Pakistan User Group',
  'Elastic Perth User Group',
  'Elastic Philadelphia User Group',
  'Elastic Phoenix User Group',
  'Elastic Pittsburgh User Group',
  'Elastic Portland User Group',
  'Elastic Portugal User Group',
  'Elastic Porto Alegre User Group',
  'Elastic Pune User Group',
  'Elastic Québec User Group',
  'Elastic Recife User Group',
  'Elastic Richmond User Group',
  'Elastic RheinRuhr',
  'Elastic Rio de Janeiro User Group',
  'Elastic Romania User Group',
  'Elastic Sacramento User Group',
  'Elastic Saint Louis User Group',
  'Elastic Salt Lake City User Group',
  'Elastic San Antonio User Group',
  'Elastic San Diego User Group',
  'Elastic San Francisco User Group',
  'Elastic São Paulo User Group',
  'Elastic Scotland User Group',
  'Elastic Seattle User Group',
  'Elastic Silicon Valley User Group',
  'Elastic Singapore User Group',
  'Elastic Slovak User Group',
  'Elastic South Africa User Group',
  'Elastic Stockholm User Group',
  'Elastic Sydney User Group',
  'Elastic Tel Aviv User Group',
  'Elastic Thailand User Group',
  'Elastic Toronto User Group',
  'Elastic Triangle User Group',
  'Elastic Turkey User Group',
  'Elastic United States and Canada Virtual User Group',
  'Elastic Vancouver User Group',
  'Elastic Vitória User Group',
  'Elastic Warsaw User Group',
  'Elastic Washington, D.C. User Group',
  'Elastic West Michigan User Group',
  'Elastic Wisconsin User Group',
  'Elastic Zagreb User Group',
  'Elasticsearch Berlin',
  'Elasticsearch Taipei',
  'Elasticsearch Toronto',
  'Elasticsearch Usergroup Vienna',
  'Elasticsearch勉強会(Elastic Tokyo User Group) #elasticsearchjp',
  'Hong Kong Elastic Fantastics',
  'Madrid Elasticsearch Meetup',
  'Ottawa Elastic User Group',
  'Search Meetup Munich',
  'Search Meetup NRW',
  'Search Technology Meetup Hamburg',
  'South West Elastic Community',
  'Waterloo/Kitchener Elastic User Group',
].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

const TIMEZONE_OPTIONS = [
  { value: '', label: 'Select timezone (optional)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles' },
  { value: 'America/Denver', label: 'America/Denver' },
  { value: 'America/Chicago', label: 'America/Chicago' },
  { value: 'America/New_York', label: 'America/New York' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney' },
]

const TIMEZONE_ABBREVIATIONS = {
  'America/Los_Angeles': 'PT',
  'America/Denver': 'MT',
  'America/Chicago': 'CT',
  'America/New_York': 'ET',
  'Europe/London': 'GMT',
  'Europe/Madrid': 'CET',
  'Europe/Paris': 'CET',
  'Asia/Tokyo': 'JST',
  'Asia/Singapore': 'SGT',
  'Australia/Sydney': 'AEST',
}

function getTimezoneDisplay(iana) {
  const tz = (iana || '').trim()
  return tz ? (TIMEZONE_ABBREVIATIONS[tz] || tz) : ''
}

const INITIAL_STATE = {
  chapterOrCity: '',
  eventTitle: '',
  date: '',
  eventStartTime: '',
  timezone: '',
  venueName: '',
  venueAddress: '',
  speaker1Name: '',
  speaker1Title: '',
  speaker1Company: '',
  speaker1TalkTitle: '',
  speaker1TalkAbstract: '',
  speaker2Name: '',
  speaker2Title: '',
  speaker2Company: '',
  speaker2TalkTitle: '',
  speaker2TalkAbstract: '',
  speaker3Name: '',
  speaker3Title: '',
  speaker3Company: '',
  speaker3TalkTitle: '',
  speaker3TalkAbstract: '',
  hostOrSponsor: '',
  rsvpInstructions: '',
  arrivalInstructions: '',
  parkingNotes: '',
}

const GENERATOR_TYPES = [
  { value: 'eventPromotion', label: 'Event Promotion' },
  { value: 'knowBeforeYouGo', label: 'Meetup Know Before You Go' },
]

const KBYG_INITIAL_STATE = {
  recipients: '',
  greetingNames: '',
  eventTitle: '',
  eventDate: '',
  eventTime: '',
  arrivalTime: '',
  venueName: '',
  venueAddress: '',
  meetupLink: '',
  lumaLink: '',
  contacts: [
    { name: '', role: '', contactInfo: '' },
    { name: '', role: '', contactInfo: '' },
  ],
  speaker1Name: '',
  speaker1Title: '',
  speaker1TalkTitle: '',
  speaker2Name: '',
  speaker2Title: '',
  speaker2TalkTitle: '',
  foodDetails: '',
  drinkDetails: '',
  swagNotes: '',
  setupNotes: '',
  avNotes: '',
  internalAgenda: '',
  additionalNotes: '',
}

function generateKnowBeforeYouGoEmail(form, includeTldr) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const has = (s) => trim(s).length > 0

  const lines = []

  const names = trim(form.greetingNames) || 'everyone'
  lines.push(`Hi ${names},`)
  lines.push('')

  if (includeTldr) {
    lines.push('TL;DR')
    const bullets = []
    if (has(form.arrivalTime)) bullets.push(`Arrive by ${trim(form.arrivalTime)}.`)
    const hasAnyContact = (form.contacts || []).some((c) => has(c.name) || has(c.role) || has(c.contactInfo))
    if (hasAnyContact) bullets.push('Your host and key contacts are listed in Helpful Contacts below.')
    if (has(form.speaker1Name) || has(form.speaker2Name)) bullets.push('Speakers: bring your laptop, slides, and any demo setup.')
    if (has(form.foodDetails) || has(form.drinkDetails)) bullets.push('Food and drinks will be provided.')
    if (has(form.setupNotes)) bullets.push(`Setup: ${trim(form.setupNotes)}`)
    bullets.slice(0, 5).forEach((b) => lines.push(`• ${b}`))
    lines.push('')
  }

  const eventTitle = trim(form.eventTitle)
  const eventDate = trim(form.eventDate)
  if (eventDate && eventTitle) {
    lines.push(`Thank you for being part of the ${eventTitle} meetup on ${eventDate}. Below are the logistics to help you prepare for the event.`)
  } else if (eventTitle) {
    lines.push(`Thank you for being part of the ${eventTitle} meetup. Below are the logistics to help you prepare for the event.`)
  } else if (eventDate) {
    lines.push(`Thank you for being part of this meetup on ${eventDate}. Below are the logistics to help you prepare for the event.`)
  } else {
    lines.push('Thank you for being part of this meetup. Below are the logistics to help you prepare for the event.')
  }
  lines.push('')

  if (has(form.eventDate) || has(form.eventTime)) {
    lines.push('Date and Time')
    const when = [trim(form.eventDate), trim(form.eventTime)].filter(Boolean).join(' at ')
    if (when) lines.push(when)
    if (has(form.arrivalTime)) lines.push(`Arrival time: ${trim(form.arrivalTime)}`)
    lines.push('')
  }

  if (has(form.meetupLink) || has(form.lumaLink)) {
    lines.push('Event Page')
    if (has(form.meetupLink)) lines.push(`• Meetup: ${trim(form.meetupLink)}`)
    if (has(form.lumaLink)) lines.push(`• Luma: ${trim(form.lumaLink)}`)
    lines.push('')
  }

  const contactEntries = (form.contacts || []).filter((c) => has(c.name) || has(c.role) || has(c.contactInfo))
  if (contactEntries.length > 0) {
    lines.push('Helpful Contacts')
    contactEntries.forEach((c) => {
      const name = trim(c.name)
      const role = trim(c.role)
      const info = trim(c.contactInfo)
      let main = ''
      if (name && info) main = `${name} (${info})`
      else if (name) main = name
      else if (info) main = info
      if (main && role) lines.push(`• ${main} – ${role}`)
      else if (main) lines.push(`• ${main}`)
      else if (role) lines.push(`• ${role}`)
    })
    lines.push('')
  }

  if (has(form.venueName) || has(form.venueAddress)) {
    lines.push('Location')
    if (has(form.venueName)) lines.push(trim(form.venueName))
    if (has(form.venueAddress)) lines.push(trim(form.venueAddress))
    lines.push('')
  }

  if (has(form.foodDetails) || has(form.drinkDetails)) {
    lines.push('Food & Refreshments')
    if (has(form.foodDetails)) lines.push(`• ${trim(form.foodDetails)}`)
    if (has(form.drinkDetails)) lines.push(`• ${trim(form.drinkDetails)}`)
    lines.push('')
  }

  if (has(form.setupNotes) || has(form.swagNotes)) {
    lines.push('Setup')
    if (has(form.setupNotes)) lines.push(`• ${trim(form.setupNotes)}`)
    if (has(form.swagNotes)) lines.push(`• ${trim(form.swagNotes)}`)
    lines.push('')
  }

  if (has(form.avNotes)) {
    lines.push('AV')
    const avBullets = trim(form.avNotes).split(/\n+/).map((s) => s.trim()).filter(Boolean)
    avBullets.forEach((b) => lines.push(`• ${b}`))
    lines.push('')
  }

  if (has(form.internalAgenda)) {
    lines.push('Internal Agenda')
    const agendaBullets = trim(form.internalAgenda).split(/\n+/).map((s) => s.trim()).filter(Boolean)
    agendaBullets.forEach((b) => lines.push(`• ${b}`))
    lines.push('')
  }

  if (has(form.additionalNotes)) {
    lines.push('Additional notes')
    lines.push(trim(form.additionalNotes))
    lines.push('')
  }

  lines.push('Please let me know if you have any questions.')
  return lines.join('\n')
}

function parseTime(timeStr) {
  const s = String(timeStr).trim()
  const match = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i)
  if (!match) return null
  let h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const ampm = (match[3] || '').toLowerCase()
  if (ampm === 'pm' && h !== 12) h += 12
  if (ampm === 'am' && h === 12) h = 0
  if (ampm === '' && h <= 12) return null
  return h * 60 + m
}

function formatTime(minutesFromMidnight) {
  const h = Math.floor(minutesFromMidnight / 60) % 24
  const m = minutesFromMidnight % 60
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

function addMinutes(minutesFromMidnight, delta) {
  return (minutesFromMidnight + delta) % (24 * 60)
}

function buildAgenda(form) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const hasSpeaker2 =
    [form.speaker2Name, form.speaker2Title, form.speaker2Company, form.speaker2TalkTitle, form.speaker2TalkAbstract]
      .some((v) => trim(v).length > 0)
  const hasSpeaker3 =
    [form.speaker3Name, form.speaker3Title, form.speaker3Company, form.speaker3TalkTitle, form.speaker3TalkAbstract]
      .some((v) => trim(v).length > 0)

  const startMins = parseTime(form.eventStartTime)
  const timeStr = (mins) => (startMins != null ? formatTime(addMinutes(startMins, mins)) : '')

  const lines = []
  const prefix = (t) => (t ? `${t} – ` : '')

  if (hasSpeaker3) {
    // Three-speaker: 0, 15, 20, 50, 80, 110, 120
    const t0 = timeStr(0)
    const t15 = timeStr(15)
    const t20 = timeStr(20)
    const t50 = timeStr(50)
    const t80 = timeStr(80)
    const t110 = timeStr(110)
    const t120 = timeStr(120)
    lines.push(`${prefix(t0)}Doors open / event start`)
    lines.push(`${prefix(t15)}Welcome and introductions`)
    lines.push(`${prefix(t20)}Speaker 1${form.speaker1TalkTitle ? `: ${trim(form.speaker1TalkTitle)}` : ''}`)
    lines.push(`${prefix(t50)}Speaker 2${form.speaker2TalkTitle ? `: ${trim(form.speaker2TalkTitle)}` : ''}`)
    lines.push(`${prefix(t80)}Speaker 3${form.speaker3TalkTitle ? `: ${trim(form.speaker3TalkTitle)}` : ''}`)
    lines.push(`${prefix(t110)}Networking`)
    lines.push(`${prefix(t120)}Event concludes`)
  } else if (hasSpeaker2) {
    // Two-speaker: 0, 15, 20, 50, 80, 120
    const t0 = timeStr(0)
    const t15 = timeStr(15)
    const t20 = timeStr(20)
    const t50 = timeStr(50)
    const t80 = timeStr(80)
    const t120 = timeStr(120)
    lines.push(`${prefix(t0)}Doors open / event start`)
    lines.push(`${prefix(t15)}Welcome and introductions`)
    lines.push(`${prefix(t20)}Speaker 1${form.speaker1TalkTitle ? `: ${trim(form.speaker1TalkTitle)}` : ''}`)
    lines.push(`${prefix(t50)}Speaker 2${form.speaker2TalkTitle ? `: ${trim(form.speaker2TalkTitle)}` : ''}`)
    lines.push(`${prefix(t80)}Networking`)
    lines.push(`${prefix(t120)}Event concludes`)
  } else {
    // One-speaker: 0, 15, 20, 80, 120
    const t0 = timeStr(0)
    const t15 = timeStr(15)
    const t20 = timeStr(20)
    const t80 = timeStr(80)
    const t120 = timeStr(120)
    lines.push(`${prefix(t0)}Doors open / event start`)
    lines.push(`${prefix(t15)}Welcome and introductions`)
    lines.push(`${prefix(t20)}Talk${form.speaker1TalkTitle ? `: ${trim(form.speaker1TalkTitle)}` : ''}`)
    lines.push(`${prefix(t80)}Networking`)
    lines.push(`${prefix(t120)}Event concludes`)
  }

  return lines.join('\n')
}

function buildTalkAbstracts(form) {
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
    const speakerLine = [name, title, company].map(trim).filter(Boolean).join(', ')
    const parts = []
    if (trim(talkTitle)) parts.push(trim(talkTitle))
    if (speakerLine) parts.push(speakerLine)
    if (trim(abstract)) {
      if (parts.length) parts.push('')
      parts.push(trim(abstract))
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

function buildLinkedInPost(form) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const city = trim(form.chapterOrCity)
  const date = trim(form.date)
  const time = trim(form.eventStartTime)
  const venue = trim(form.venueName) || trim(form.venueAddress)
  const name1 = trim(form.speaker1Name)
  const name2 = trim(form.speaker2Name)
  const name3 = trim(form.speaker3Name)
  const hasSpeaker2 = [form.speaker2Name, form.speaker2Title, form.speaker2Company, form.speaker2TalkTitle, form.speaker2TalkAbstract].some((v) => trim(v).length > 0)
  const hasSpeaker3 = [form.speaker3Name, form.speaker3Title, form.speaker3Company, form.speaker3TalkTitle, form.speaker3TalkAbstract].some((v) => trim(v).length > 0)

  const timezone = trim(form.timezone)
  const parts = []
  const groupName = city
    ? (city.includes('User Group') || city.includes('Elastic') || city.includes('Meetup') ? city : `The Elastic ${city} User Group`)
    : 'Our community'
  if (date || time) {
    let when = [date, time].filter(Boolean).join(' at ')
    const tzDisplay = getTimezoneDisplay(timezone)
    if (tzDisplay) when += ` ${tzDisplay}`
    parts.push(`🎉 ${groupName} is hosting a meetup ${when}.`)
  } else {
    parts.push(`🎉 ${groupName} is hosting an upcoming meetup.`)
  }
  if (venue) parts.push(`📍 ${venue}`)
  if (name1 && hasSpeaker2 && name2 && hasSpeaker3 && name3) {
    parts.push(`👥 Featuring ${name1}, ${name2}, and ${name3}.`)
  } else if (name1 && hasSpeaker2 && name2) {
    parts.push(`👥 Featuring ${name1} and ${name2}.`)
  } else if (name1) {
    parts.push(`👥 Featuring ${name1}.`)
  }
  parts.push('')
  parts.push('Hope to see you there! 🙌 #elastic #elasticcommunity #elasticmeetups')
  parts.push('')
  parts.push('🔗 RSVP:')
  parts.push('[Insert Meetup Link]')
  return parts.join('\n')
}

function buildIntro(form) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const city = trim(form.chapterOrCity)
  const date = trim(form.date)
  const name1 = trim(form.speaker1Name)
  const name2 = trim(form.speaker2Name)
  const name3 = trim(form.speaker3Name)
  const hasSpeaker2 = [form.speaker2Name, form.speaker2Title, form.speaker2Company, form.speaker2TalkTitle, form.speaker2TalkAbstract].some((v) => trim(v).length > 0)
  const hasSpeaker3 = [form.speaker3Name, form.speaker3Title, form.speaker3Company, form.speaker3TalkTitle, form.speaker3TalkAbstract].some((v) => trim(v).length > 0)

  const groupName = city
    ? (city.includes('User Group') || city.includes('Elastic') || city.includes('Meetup') ? city : `The Elastic ${city} User Group`)
    : 'The Elastic User Group'
  const when = date ? ` on ${date}` : ''
  let presentations
  if (name1 && hasSpeaker2 && name2 && hasSpeaker3 && name3) {
    presentations = `presentations from ${name1}, ${name2}, and ${name3}`
  } else if (name1 && hasSpeaker2 && name2) {
    presentations = `presentations from ${name1} and ${name2}`
  } else if (name1) {
    presentations = `a presentation from ${name1}`
  } else {
    presentations = 'presentations'
  }

  return `${groupName} is hosting a meetup${when}. We'll have ${presentations}, followed by food, refreshments, and networking.`
}

function generateMeetupCopy(form) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const has = (s) => trim(s).length > 0
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

  const sections = []

  if (has(form.eventTitle)) {
    sections.push({ title: null, body: trim(form.eventTitle) })
  }

  if (has(form.date) || has(form.eventStartTime)) {
    let when = [form.date, form.eventStartTime].map(trim).filter(Boolean).join(' at ')
    const tzDisplay = getTimezoneDisplay(form.timezone)
    if (tzDisplay) when += ` ${tzDisplay}`
    sections.push({ title: 'When', body: when })
  }

  if (has(form.venueName) || has(form.venueAddress)) {
    const where = [form.venueName, form.venueAddress].map(trim).filter(Boolean).join('\n')
    sections.push({ title: 'Where', body: where })
  }

  if (has(form.rsvpInstructions)) {
    sections.push({ title: 'RSVP', body: trim(form.rsvpInstructions) })
  }

  if (has(form.arrivalInstructions)) {
    sections.push({ title: 'Arrival', body: trim(form.arrivalInstructions) })
  }

  if (has(form.parkingNotes)) {
    sections.push({ title: 'Parking', body: trim(form.parkingNotes) })
  }

  sections.push({
    title: 'Agenda',
    body: buildAgenda(form),
  })

  if (hasSpeaker1 || hasSpeaker2 || hasSpeaker3) {
    sections.push({
      title: 'Talk Abstracts',
      body: buildTalkAbstracts(form),
    })
  }

  if (has(form.hostOrSponsor)) {
    sections.push({ title: 'Host / Sponsor', body: trim(form.hostOrSponsor) })
  }

  const sectionHeader = (title) => {
    const withEmoji = {
      'When': '📅 Date & Time',
      'Where': '📍 Location',
      'Agenda': '📝 Agenda',
      'Talk Abstracts': '💭 Talk Abstracts',
      'Arrival': '🪪 Arrival Instructions',
      'Parking': '🚗 Parking',
    }
    const display = withEmoji[title] || title
    return `**${display}**`
  }

  const lines = []
  lines.push(buildIntro(form), '')
  for (const { title, body } of sections) {
    if (title) lines.push(sectionHeader(title), body, '')
    else lines.push(body, '')
  }
  return lines.join('\n').trim()
}

export default function App() {
  const [generatorType, setGeneratorType] = useState('eventPromotion')
  const [form, setForm] = useState(INITIAL_STATE)
  const [kbygForm, setKbygForm] = useState(KBYG_INITIAL_STATE)
  const [kbygIncludeTldr, setKbygIncludeTldr] = useState(true)
  const [generatedCopy, setGeneratedCopy] = useState('')
  const [copied, setCopied] = useState(false)
  const [linkedInCopied, setLinkedInCopied] = useState(false)
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [comboboxHighlight, setComboboxHighlight] = useState(0)
  const comboboxRef = useRef(null)
  const [showSpeaker2, setShowSpeaker2] = useState(false)
  const [showSpeaker3, setShowSpeaker3] = useState(false)

  const query = (form.chapterOrCity || '').trim().toLowerCase()
  const filteredGroups = query
    ? USER_GROUPS.filter((g) => g.toLowerCase().includes(query))
    : USER_GROUPS

  useEffect(() => {
    if (!comboboxOpen) return
    setComboboxHighlight(0)
  }, [form.chapterOrCity, comboboxOpen])

  useEffect(() => {
    function handleClickOutside(e) {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
        setComboboxOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectGroup = (name) => {
    setForm((prev) => ({ ...prev, chapterOrCity: name }))
    setComboboxOpen(false)
    setComboboxHighlight(0)
  }

  const handleComboboxKeyDown = (e) => {
    if (!comboboxOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        setComboboxOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setComboboxHighlight((i) => (i < filteredGroups.length - 1 ? i + 1 : i))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setComboboxHighlight((i) => (i > 0 ? i - 1 : 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredGroups[comboboxHighlight] != null) {
        selectGroup(filteredGroups[comboboxHighlight])
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setComboboxOpen(false)
    }
  }

  const update = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const updateKbyg = (key) => (e) =>
    setKbygForm((prev) => ({ ...prev, [key]: e.target.value }))

  const updateKbygContact = (index, field) => (e) =>
    setKbygForm((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => (i === index ? { ...c, [field]: e.target.value } : c)),
    }))

  const addKbygContact = () =>
    setKbygForm((prev) => ({
      ...prev,
      contacts: [...prev.contacts, { name: '', role: '', contactInfo: '' }],
    }))

  const handleGenerate = () => {
    if (generatorType === 'knowBeforeYouGo') {
      setGeneratedCopy(generateKnowBeforeYouGoEmail(kbygForm, kbygIncludeTldr))
    } else {
      setGeneratedCopy(generateMeetupCopy(form))
    }
  }

  const handleCopy = async () => {
    if (!generatedCopy) return
    try {
      await navigator.clipboard.writeText(generatedCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  const handleReset = () => {
    if (generatorType === 'knowBeforeYouGo') {
      setKbygForm(KBYG_INITIAL_STATE)
    } else {
      setForm(INITIAL_STATE)
      setShowSpeaker2(false)
      setShowSpeaker3(false)
    }
    setGeneratedCopy('')
  }

  const handleCopyLinkedIn = async () => {
    const post = buildLinkedInPost(form)
    if (!post) return
    try {
      await navigator.clipboard.writeText(post)
      setLinkedInCopied(true)
      setTimeout(() => setLinkedInCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Elastic Meetup Toolkit</h1>
        <p className="subtitle">Generate meetup event pages, promo posts, and speaker logistics emails.</p>
      </header>

      <div className="layout">
        <>
        <aside className="form-panel">
          <label className="generator-type-label">
            Generator Type
            <select
              value={generatorType}
              onChange={(e) => {
                setGeneratorType(e.target.value)
                setGeneratedCopy('')
              }}
              className="generator-type-select"
              aria-label="Generator type"
            >
              {GENERATOR_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {generatorType === 'eventPromotion' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleGenerate()
            }}
            className="form"
          >
            <label>
              User Group (optional)
              <div className="combobox" ref={comboboxRef}>
                <input
                  type="text"
                  value={form.chapterOrCity}
                  onChange={update('chapterOrCity')}
                  onFocus={() => setComboboxOpen(true)}
                  onKeyDown={handleComboboxKeyDown}
                  placeholder="Search or select a user group..."
                  autoComplete="off"
                  aria-expanded={comboboxOpen}
                  aria-haspopup="listbox"
                  aria-autocomplete="list"
                />
                {comboboxOpen && (
                  <ul
                    className="combobox-list"
                    role="listbox"
                    aria-label="User groups"
                  >
                    {filteredGroups.map((group, i) => (
                      <li
                        key={group}
                        role="option"
                        aria-selected={i === comboboxHighlight}
                        className={i === comboboxHighlight ? 'combobox-option combobox-option-highlight' : 'combobox-option'}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          selectGroup(group)
                        }}
                        onMouseEnter={() => setComboboxHighlight(i)}
                      >
                        {group}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <span className="form-hint">Optional: select a user group to auto-fill details.</span>
            </label>
            <label>
              Event title
              <input
                type="text"
                value={form.eventTitle}
                onChange={update('eventTitle')}
                placeholder="e.g. March Meetup: State Management"
              />
            </label>
            <label>
              Date
              <input
                type="text"
                value={form.date}
                onChange={update('date')}
                placeholder="e.g. Tuesday, March 18"
              />
            </label>
            <label>
              Event start time
              <input
                type="text"
                value={form.eventStartTime}
                onChange={update('eventStartTime')}
                placeholder="e.g. 6:00 PM"
              />
            </label>
            <label>
              Timezone
              <select
                value={form.timezone}
                onChange={update('timezone')}
                aria-label="Event timezone (optional)"
              >
                {TIMEZONE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Venue name
              <input
                type="text"
                value={form.venueName}
                onChange={update('venueName')}
                placeholder="e.g. WeWork Downtown"
              />
            </label>
            <label>
              Venue address
              <input
                type="text"
                value={form.venueAddress}
                onChange={update('venueAddress')}
                placeholder="e.g. 123 Main St, Seattle, WA"
              />
            </label>

            <fieldset className="form-fieldset">
              <legend>Speaker 1</legend>
              <label>
                Speaker 1 name
                <input
                  type="text"
                  value={form.speaker1Name}
                  onChange={update('speaker1Name')}
                  placeholder="e.g. Jane Smith"
                />
              </label>
              <label>
                Speaker 1 title
                <input
                  type="text"
                  value={form.speaker1Title}
                  onChange={update('speaker1Title')}
                  placeholder="e.g. Staff Engineer"
                />
              </label>
              <label>
                Speaker 1 company
                <input
                  type="text"
                  value={form.speaker1Company}
                  onChange={update('speaker1Company')}
                  placeholder="e.g. Acme Inc"
                />
              </label>
              <label>
                Speaker 1 talk title
                <input
                  type="text"
                  value={form.speaker1TalkTitle}
                  onChange={update('speaker1TalkTitle')}
                  placeholder="e.g. React Server Components in Production"
                />
              </label>
              <label>
                Speaker 1 talk abstract
                <textarea
                  value={form.speaker1TalkAbstract}
                  onChange={update('speaker1TalkAbstract')}
                  placeholder="Brief description of the talk..."
                  rows={3}
                />
              </label>
            </fieldset>

            <div className="speaker-toggle-row">
              {showSpeaker2 ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowSpeaker2(false)
                    setShowSpeaker3(false)
                    setForm((prev) => ({
                      ...prev,
                      speaker2Name: '',
                      speaker2Title: '',
                      speaker2Company: '',
                      speaker2TalkTitle: '',
                      speaker2TalkAbstract: '',
                      speaker3Name: '',
                      speaker3Title: '',
                      speaker3Company: '',
                      speaker3TalkTitle: '',
                      speaker3TalkAbstract: '',
                    }))
                  }}
                  className="btn-remove-speaker"
                >
                  Remove Speaker 2
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSpeaker2(true)}
                  className="btn-add-speaker"
                >
                  + Add Speaker 2
                </button>
              )}
            </div>

            {showSpeaker2 && (
            <fieldset className="form-fieldset">
              <legend>Speaker 2</legend>
              <label>
                Speaker 2 name
                <input
                  type="text"
                  value={form.speaker2Name}
                  onChange={update('speaker2Name')}
                  placeholder="e.g. John Doe"
                />
              </label>
              <label>
                Speaker 2 title
                <input
                  type="text"
                  value={form.speaker2Title}
                  onChange={update('speaker2Title')}
                  placeholder="e.g. Principal Engineer"
                />
              </label>
              <label>
                Speaker 2 company
                <input
                  type="text"
                  value={form.speaker2Company}
                  onChange={update('speaker2Company')}
                  placeholder="e.g. TechCo"
                />
              </label>
              <label>
                Speaker 2 talk title
                <input
                  type="text"
                  value={form.speaker2TalkTitle}
                  onChange={update('speaker2TalkTitle')}
                  placeholder="e.g. Building Scalable APIs"
                />
              </label>
              <label>
                Speaker 2 talk abstract
                <textarea
                  value={form.speaker2TalkAbstract}
                  onChange={update('speaker2TalkAbstract')}
                  placeholder="Brief description of the talk..."
                  rows={3}
                />
              </label>
            </fieldset>
            )}

            {showSpeaker2 && (
              <div className="speaker-toggle-row">
                {showSpeaker3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSpeaker3(false)
                      setForm((prev) => ({
                        ...prev,
                        speaker3Name: '',
                        speaker3Title: '',
                        speaker3Company: '',
                        speaker3TalkTitle: '',
                        speaker3TalkAbstract: '',
                      }))
                    }}
                    className="btn-remove-speaker"
                  >
                    Remove Speaker 3
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSpeaker3(true)}
                    className="btn-add-speaker"
                  >
                    + Add Speaker 3
                  </button>
                )}
              </div>
            )}

            {showSpeaker3 && (
            <fieldset className="form-fieldset">
              <legend>Speaker 3</legend>
              <label>
                Speaker 3 name
                <input
                  type="text"
                  value={form.speaker3Name}
                  onChange={update('speaker3Name')}
                  placeholder="e.g. Alex Chen"
                />
              </label>
              <label>
                Speaker 3 title
                <input
                  type="text"
                  value={form.speaker3Title}
                  onChange={update('speaker3Title')}
                  placeholder="e.g. Senior Developer"
                />
              </label>
              <label>
                Speaker 3 company
                <input
                  type="text"
                  value={form.speaker3Company}
                  onChange={update('speaker3Company')}
                  placeholder="e.g. StartupCo"
                />
              </label>
              <label>
                Speaker 3 talk title
                <input
                  type="text"
                  value={form.speaker3TalkTitle}
                  onChange={update('speaker3TalkTitle')}
                  placeholder="e.g. Talk title"
                />
              </label>
              <label>
                Speaker 3 talk abstract
                <textarea
                  value={form.speaker3TalkAbstract}
                  onChange={update('speaker3TalkAbstract')}
                  placeholder="Brief description of the talk..."
                  rows={3}
                />
              </label>
            </fieldset>
            )}

            <label>
              Host or sponsor
              <input
                type="text"
                value={form.hostOrSponsor}
                onChange={update('hostOrSponsor')}
                placeholder="e.g. Sponsored by Acme"
              />
            </label>
            <label>
              RSVP instructions
              <input
                type="text"
                value={form.rsvpInstructions}
                onChange={update('rsvpInstructions')}
                placeholder="e.g. RSVP on this page to get the link"
              />
            </label>
            <label>
              Arrival instructions
              <input
                type="text"
                value={form.arrivalInstructions}
                onChange={update('arrivalInstructions')}
                placeholder="e.g. Check in at front desk"
              />
            </label>
            <label>
              Parking notes
              <input
                type="text"
                value={form.parkingNotes}
                onChange={update('parkingNotes')}
                placeholder="e.g. Free street parking after 6 PM"
              />
            </label>
            <button type="submit" className="btn-generate">
              Generate Meetup Copy
            </button>
            <button type="button" onClick={handleReset} className="btn-reset">
              🔄 Reset Form
            </button>
          </form>
          )}

          {generatorType === 'knowBeforeYouGo' && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleGenerate() }}
            className="form"
          >
            <fieldset className="form-fieldset">
              <legend>Email Details</legend>
              <label>Recipients <input type="text" value={kbygForm.recipients} onChange={updateKbyg('recipients')} placeholder="e.g. Speakers, hosts" /></label>
              <label>Greeting names <input type="text" value={kbygForm.greetingNames} onChange={updateKbyg('greetingNames')} placeholder="e.g. everyone" /></label>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>Event Details</legend>
              <label>Event title <input type="text" value={kbygForm.eventTitle} onChange={updateKbyg('eventTitle')} placeholder="e.g. March Meetup" /></label>
              <label>Event date <input type="text" value={kbygForm.eventDate} onChange={updateKbyg('eventDate')} placeholder="e.g. Tuesday, March 18" /></label>
              <label>Event time <input type="text" value={kbygForm.eventTime} onChange={updateKbyg('eventTime')} placeholder="e.g. 6:00 PM" /></label>
              <label>Arrival time <input type="text" value={kbygForm.arrivalTime} onChange={updateKbyg('arrivalTime')} placeholder="e.g. 5:45 PM" /></label>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>Location</legend>
              <label>Venue name <input type="text" value={kbygForm.venueName} onChange={updateKbyg('venueName')} placeholder="e.g. WeWork Downtown" /></label>
              <label>Venue address <input type="text" value={kbygForm.venueAddress} onChange={updateKbyg('venueAddress')} placeholder="e.g. 123 Main St" /></label>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>Event Links</legend>
              <label>Meetup link <input type="text" value={kbygForm.meetupLink} onChange={updateKbyg('meetupLink')} placeholder="https://..." /></label>
              <label>Luma link <input type="text" value={kbygForm.lumaLink} onChange={updateKbyg('lumaLink')} placeholder="https://..." /></label>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>Helpful Contacts</legend>
              {(kbygForm.contacts || []).map((contact, index) => (
                <div key={index} className="contact-row">
                  <label>Contact Name <input type="text" value={contact.name} onChange={updateKbygContact(index, 'name')} placeholder="e.g. Jane Smith" /></label>
                  <label>Role / Description <input type="text" value={contact.role} onChange={updateKbygContact(index, 'role')} placeholder="e.g. onsite host, program manager, venue contact" /></label>
                  <label>Contact Info (email or Slack) <input type="text" value={contact.contactInfo} onChange={updateKbygContact(index, 'contactInfo')} placeholder="e.g. jane@example.com or @jane" /></label>
                </div>
              ))}
              <button type="button" onClick={addKbygContact} className="btn-add-speaker">+ Add Contact</button>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>Speakers</legend>
              <label>Speaker 1 name <input type="text" value={kbygForm.speaker1Name} onChange={updateKbyg('speaker1Name')} placeholder="e.g. Jane Smith" /></label>
              <label>Speaker 1 title <input type="text" value={kbygForm.speaker1Title} onChange={updateKbyg('speaker1Title')} placeholder="e.g. Staff Engineer" /></label>
              <label>Speaker 1 talk title <input type="text" value={kbygForm.speaker1TalkTitle} onChange={updateKbyg('speaker1TalkTitle')} placeholder="Talk title" /></label>
              <label>Speaker 2 name <input type="text" value={kbygForm.speaker2Name} onChange={updateKbyg('speaker2Name')} placeholder="e.g. John Doe" /></label>
              <label>Speaker 2 title <input type="text" value={kbygForm.speaker2Title} onChange={updateKbyg('speaker2Title')} placeholder="e.g. Principal Engineer" /></label>
              <label>Speaker 2 talk title <input type="text" value={kbygForm.speaker2TalkTitle} onChange={updateKbyg('speaker2TalkTitle')} placeholder="Talk title" /></label>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>Logistics</legend>
              <label>Food details <input type="text" value={kbygForm.foodDetails} onChange={updateKbyg('foodDetails')} placeholder="e.g. Pizza and snacks" /></label>
              <label>Drink details <input type="text" value={kbygForm.drinkDetails} onChange={updateKbyg('drinkDetails')} placeholder="e.g. Coffee, water, soda" /></label>
              <label>Swag notes <input type="text" value={kbygForm.swagNotes} onChange={updateKbyg('swagNotes')} placeholder="e.g. T-shirts for attendees" /></label>
              <label>Setup notes <input type="text" value={kbygForm.setupNotes} onChange={updateKbyg('setupNotes')} placeholder="e.g. Tables and signage" /></label>
              <label>AV notes <input type="text" value={kbygForm.avNotes} onChange={updateKbyg('avNotes')} placeholder="e.g. HDMI adapter provided" /></label>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>Agenda</legend>
              <label>Internal agenda <textarea value={kbygForm.internalAgenda} onChange={updateKbyg('internalAgenda')} placeholder="Paste or type agenda..." rows={4} /></label>
            </fieldset>
            <fieldset className="form-fieldset">
              <legend>Additional</legend>
              <label>Additional notes <textarea value={kbygForm.additionalNotes} onChange={updateKbyg('additionalNotes')} placeholder="Any other logistics..." rows={3} /></label>
            </fieldset>
            <label className="checkbox-label">
              <input type="checkbox" checked={kbygIncludeTldr} onChange={(e) => setKbygIncludeTldr(e.target.checked)} />
              Include TL;DR summary
            </label>
            <button type="submit" className="btn-generate">Generate Email</button>
            <button type="button" onClick={handleReset} className="btn-reset">🔄 Reset Form</button>
          </form>
          )}
        </aside>

        <main className="output-panel">
          <div className="output-header">
            <h2>{generatorType === 'knowBeforeYouGo' ? 'Generated email' : 'Generated copy'}</h2>
            {generatedCopy && (
              <button
                type="button"
                onClick={handleCopy}
                className="btn-copy"
                aria-pressed={copied}
              >
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </button>
            )}
          </div>
          <div className="output-content">
            {generatedCopy ? (
              <>
                <pre className="output-text">{generatedCopy}</pre>
                {generatorType === 'eventPromotion' && (
                <div className="linkedin-section">
                  <h3 className="linkedin-heading">📣 LinkedIn Promo Post</h3>
                  <pre className="linkedin-text">{buildLinkedInPost(form)}</pre>
                  <button
                    type="button"
                    onClick={handleCopyLinkedIn}
                    className="btn-copy btn-copy-linkedin"
                    aria-pressed={linkedInCopied}
                  >
                    {linkedInCopied ? 'Copied!' : 'Copy LinkedIn Post'}
                  </button>
                </div>
                )}
              </>
            ) : (
              <p className="output-placeholder">
                {generatorType === 'knowBeforeYouGo'
                  ? 'Fill in the form and click "Generate Email" to create the Know Before You Go logistics email.'
                  : 'Fill in the form and click "Generate Meetup Copy" to see the event description here. Use the buttons below to add optional Speaker 2 or Speaker 3.'}
              </p>
            )}
          </div>
        </main>
        </>
      </div>
    </div>
  )
}
