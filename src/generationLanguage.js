/**
 * Shared language helpers for Event Page, Meetup KBYG, and Conference KBYG generators.
 */

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
]

export const FORMAT_RULE =
  'Preserve formatting, emojis, bullet points, and section headers.'

/**
 * Localized stock agenda lines (timed builder + fallback). Keys: en / es / pt.
 */
export const agendaTranslationsByLanguage = {
  en: {
    doorsOpen: 'Doors open, grab a seat, and enjoy some pizza!',
    welcome: 'Welcome & introduction',
    concludes: 'Event concludes',
  },
  es: {
    doorsOpen: 'Apertura de puertas, toma asiento y disfruta de pizza',
    welcome: 'Bienvenida e introducción',
    concludes: 'Cierre del evento',
  },
  pt: {
    doorsOpen: 'Abertura das portas, sente-se e aproveite a pizza',
    welcome: 'Boas-vindas e introdução',
    concludes: 'Encerramento do evento',
  },
}

/** Bullet list appended to remote prompts so agenda / arrival / parking stay localized. */
export function translateAllSectionsPromptBlock() {
  return [
    'Translate ALL sections including:',
    '- Agenda (every agenda line and label)',
    '- Arrival instructions',
    '- Parking',
    '- Bullet points',
  ].join('\n')
}

/** Display / prompt target name for the selected locale. */
export function getPromptLanguageName(lang) {
  const n = normalizeLanguage(lang)
  if (n === 'es') return 'Spanish'
  if (n === 'pt') return 'Brazilian Portuguese'
  return 'English'
}

/**
 * Shared remote-generation preamble: single language, no mixed output, no English stock examples.
 */
export function baseGenerationPrompt(lang) {
  const name = getPromptLanguageName(lang)
  return [
    `Generate ALL content entirely in ${name}.`,
    'Do NOT include any English unless the selected language is English.',
    '',
    'CRITICAL:',
    '- Do NOT include any English unless the selected language is English',
    '- Translate ALL sections, headers, and bullet points',
    '- Do NOT reuse or copy English examples',
    '',
    translateAllSectionsPromptBlock(),
  ].join('\n')
}

/** Fallback instruction for translate and unknown generators. */
export function languageInstruction(lang) {
  return `${baseGenerationPrompt(lang)}\n\n${FORMAT_RULE}`
}

export function normalizeLanguage(lang) {
  if (lang === 'es' || lang === 'pt') return lang
  return 'en'
}

/** Meetup event page — remote API prompt. */
export function eventPageRemotePrompt(lang) {
  const n = normalizeLanguage(lang)
  const variant =
    n === 'es'
      ? 'Generate the Meetup event page copy entirely in Spanish (neutral Latin American).'
      : n === 'pt'
        ? 'Generate the Meetup event page copy entirely in Brazilian Portuguese.'
        : 'Generate the Meetup event page copy in English.'
  return [
    baseGenerationPrompt(lang),
    '',
    variant,
    '',
    'Additional requirements:',
    '- Translate ALL bullet points across every section.',
    '- Do NOT leave any bullet points in English when the selected language is not English.',
    '- Do NOT reuse or echo English example phrasing; write original copy in the target language.',
    '',
    'For the “Why attend” section: include exactly 3 bullet points written in the selected language. Describe value using event details only—do not copy or translate canned English example bullets.',
    '',
    'Explicitly include and localize when applicable: agenda; a short closing sentence inviting attendees; “Who this is for” / audience copy; “Why attend”; “What to expect”.',
    'Ensure section headers and bullet points match the selected language.',
    '',
    'Agenda (critical): Every agenda label and line must be in the selected language—use localized wording for openings, welcome, talks, and closing; never emit English stock phrases for Spanish or Portuguese.',
    'Arrival instructions and parking (critical): Write both sections entirely in the selected language.',
    '- Do not copy English placeholder or example text from the form; treat empty arrival/parking fields as a signal to compose fresh logistics copy.',
    '- If arrival instructions or parking notes are missing or blank in the form data, infer sensible content from venue name, venue address, date/time, timezone, RSVP instructions, and related fields—still fully in the selected language.',
    '- If the form contains English for those fields, rewrite the substance in the selected language for the generated output (do not leave English when Spanish or Portuguese is selected).',
    '',
    'API JSON (recommended): Return `plain` (full page as plain text) and optionally `html`. You may also return structured fields so the UI does not fall back to English form defaults: `arrivalInstructions` (string), `parking` (string), `agenda` (array of lines or one string). You may nest these under `sections` if preferred.',
    '',
    FORMAT_RULE,
  ].join('\n')
}

/** Meetup Know Before You Go email — remote API prompt. */
export function meetupKbygRemotePrompt(lang) {
  const n = normalizeLanguage(lang)
  const arrivalParkingRule =
    n === 'en'
      ? 'Parking and arrival-related logistics (TL;DR lines, body sections): compose in English from the form and inferred venue/event context.'
      : 'Parking and any arrival or check-in logistics must be written entirely in the target language. If parking or arrival fields are empty, infer practical copy from venue, address, time, and links—never leave English in the output.'

  return [
    baseGenerationPrompt(lang),
    '',
    'Generate the Meetup Know Before You Go organizer email from the form.',
    'Localize every section title, paragraph, and bullet. Use only information implied by the form fields.',
    'Do not paste English template logistics sentences—write natural copy in the selected language.',
    'Agenda section: translate every agenda bullet from the form; if bullets are in English, rewrite them fully in the selected language.',
    arrivalParkingRule,
    '',
    FORMAT_RULE,
  ].join('\n')
}

/** Conference Know Before You Go email — remote API prompt. */
export function conferenceKbygRemotePrompt(lang) {
  return [
    baseGenerationPrompt(lang),
    '',
    'Generate the Conference Know Before You Go email for onsite staff from the form.',
    'Localize all sections (TL;DR, dates, tickets, location, contacts, booth logistics, AV, swag, parking, food, engagement, travel, etc.).',
    'Do not leave English headers or bullets when the selected language is not English. Do not reuse canned English paragraphs—compose from the provided fields.',
    'Agenda and schedule bullets: translate fully; never leave English agenda labels or lines when Spanish or Portuguese is selected.',
    'Parking and arrival / transportation content: generate fully in the selected language. Empty parking or transit fields should be filled with plausible, venue-aware copy inferred from the form—not English placeholders.',
    '',
    FORMAT_RULE,
  ].join('\n')
}

export function getAgendaLineLabels(lang) {
  const n = normalizeLanguage(lang)
  if (n === 'es' || n === 'pt') return agendaTranslationsByLanguage[n]
  return agendaTranslationsByLanguage.en
}

/** Generic timed agenda row when no speaker line applies (mirrors fallback middle line). */
export function getAgendaMiddleSlotLabel(lang) {
  const n = normalizeLanguage(lang)
  if (n === 'es') return 'Charlas'
  if (n === 'pt') return 'Palestras'
  return 'Talks'
}

/**
 * Clock times on generated agendas: 12h + AM/PM for English; 24h (HH:mm) for Spanish/Portuguese.
 */
export function formatAgendaClock(minutesFromMidnight, lang) {
  const n = normalizeLanguage(lang)
  let t = Math.floor(Number(minutesFromMidnight))
  if (!Number.isFinite(t)) t = 0
  t = ((t % (24 * 60)) + (24 * 60)) % (24 * 60)
  const h = Math.floor(t / 60)
  const m = t % 60
  if (n === 'en') {
    const ap = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${ap}`
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parseDateStringToLocaleDate(dateStr) {
  const s = String(dateStr || '').trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T12:00:00')
  const parsed = Date.parse(s)
  if (!Number.isNaN(parsed)) return new Date(parsed)
  return null
}

/** Long calendar date for event copy (locale weekday/month; no English when lang is es/pt). */
export function formatLocalizedLongDate(dateStr, lang) {
  const d = parseDateStringToLocaleDate(dateStr)
  if (!d || Number.isNaN(d.getTime())) return String(dateStr || '').trim()
  const n = normalizeLanguage(lang)
  const locale = n === 'es' ? 'es' : n === 'pt' ? 'pt-BR' : 'en-US'
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

/** Date + start time phrase for “When” sections (localized connector, no English for es/pt). */
export function formatWhenDateTimePhrase(dateStr, timeMinutesFromMidnight, lang) {
  const n = normalizeLanguage(lang)
  const datePart = formatLocalizedLongDate(dateStr, n)
  const timePart = formatAgendaClock(timeMinutesFromMidnight, n)
  if (n === 'es') return `${datePart} a las ${timePart}`
  if (n === 'pt') return `${datePart} às ${timePart}`
  return `${datePart} at ${timePart}`
}

/** Conference organizer-import structured sections (emoji headers). */
export function getConferenceStructuredKbygSectionSpec(lang) {
  const n = normalizeLanguage(lang)
  const M = {
    en: [
      { cats: ['keyContacts'], emoji: '🔑', title: 'Key Contacts' },
      { cats: ['eventVenue', 'foodBeverage'], emoji: '📍', title: 'Event & Venue' },
      { cats: ['boothHours'], emoji: '🕒', title: 'Booth Hours' },
      { cats: ['setupMoveIn'], emoji: '🛠️', title: 'Setup & Move-in' },
      { cats: ['teardownMoveOut'], emoji: '📦', title: 'Teardown / Move-out' },
      { cats: ['parkingTransportation'], emoji: '🚗', title: 'Parking & Transportation' },
      { cats: ['logisticsBoothInfo'], emoji: '📋', title: 'Logistics / Booth Info' },
      { cats: ['tickets'], emoji: '🎟️', title: 'Tickets' },
      { cats: ['leadCapture'], emoji: '📱', title: 'Lead Capture' },
      { cats: ['additionalNotes'], emoji: '📎', title: 'Additional Notes' },
    ],
    es: [
      { cats: ['keyContacts'], emoji: '🔑', title: 'Contactos clave' },
      { cats: ['eventVenue', 'foodBeverage'], emoji: '📍', title: 'Evento y lugar' },
      { cats: ['boothHours'], emoji: '🕒', title: 'Horario del stand' },
      { cats: ['setupMoveIn'], emoji: '🛠️', title: 'Montaje y entrada' },
      { cats: ['teardownMoveOut'], emoji: '📦', title: 'Desmontaje / salida' },
      { cats: ['parkingTransportation'], emoji: '🚗', title: 'Estacionamiento y transporte' },
      { cats: ['logisticsBoothInfo'], emoji: '📋', title: 'Logística / información del stand' },
      { cats: ['tickets'], emoji: '🎟️', title: 'Entradas' },
      { cats: ['leadCapture'], emoji: '📱', title: 'Captación de leads' },
      { cats: ['additionalNotes'], emoji: '📎', title: 'Notas adicionales' },
    ],
    pt: [
      { cats: ['keyContacts'], emoji: '🔑', title: 'Contatos principais' },
      { cats: ['eventVenue', 'foodBeverage'], emoji: '📍', title: 'Evento e local' },
      { cats: ['boothHours'], emoji: '🕒', title: 'Horário do estande' },
      { cats: ['setupMoveIn'], emoji: '🛠️', title: 'Montagem e entrada' },
      { cats: ['teardownMoveOut'], emoji: '📦', title: 'Desmontagem / saída' },
      { cats: ['parkingTransportation'], emoji: '🚗', title: 'Estacionamento e transporte' },
      { cats: ['logisticsBoothInfo'], emoji: '📋', title: 'Logística / informações do estande' },
      { cats: ['tickets'], emoji: '🎟️', title: 'Ingressos' },
      { cats: ['leadCapture'], emoji: '📱', title: 'Captura de leads' },
      { cats: ['additionalNotes'], emoji: '📎', title: 'Notas adicionais' },
    ],
  }
  return M[n] || M.en
}

/** Fallback agenda when the timed builder returns nothing (edge case). */
export function getEventPageAgendaFallbackLines(lang) {
  const n = normalizeLanguage(lang)
  const L = getAgendaLineLabels(n)
  const mid = getAgendaMiddleSlotLabel(n)
  const t1 = formatAgendaClock(18 * 60, n)
  const tWelcome = formatAgendaClock(18 * 60 + 15, n)
  const t2 = formatAgendaClock(18 * 60 + 30, n)
  const t3 = formatAgendaClock(20 * 60, n)
  return `${t1} ${L.doorsOpen}\n${tWelcome} ${L.welcome}\n${t2} ${mid}\n${t3} ${L.concludes}`
}

export function buildEventPageWhatToExpectQuickDraft({ city, theme1, lang }) {
  const n = normalizeLanguage(lang)
  const T = {
    en: {
      withBoth: (c, t) =>
        `Expect an evening of community talks focused on ${t}, time for questions, and networking with the ${c} Elastic community. Light refreshments will be available.`,
      withCity: (c) =>
        `Expect community talks, Q&A, and networking with the ${c} Elastic community. Light refreshments will be available.`,
      generic: 'Expect community talks, Q&A, and networking. Light refreshments will be available.',
    },
    es: {
      withBoth: (c, t) =>
        `Cuenta con una velada de charlas comunitarias sobre ${t}, espacio para preguntas y networking con la comunidad Elastic de ${c}. Habrá refrigerios ligeros.`,
      withCity: (c) =>
        `Cuenta con charlas comunitarias, rondas de preguntas y networking con la comunidad Elastic de ${c}. Habrá refrigerios ligeros.`,
      generic:
        'Cuenta con charlas comunitarias, rondas de preguntas y networking. Habrá refrigerios ligeros.',
    },
    pt: {
      withBoth: (c, t) =>
        `Prepare-se para uma noite de palestras comunitárias focadas em ${t}, tempo para perguntas e networking com a comunidade Elastic de ${c}. Haverá refrescos leves.`,
      withCity: (c) =>
        `Prepare-se para palestras comunitárias, perguntas e respostas e networking com a comunidade Elastic de ${c}. Haverá refrescos leves.`,
      generic:
        'Prepare-se para palestras comunitárias, perguntas e respostas e networking. Haverá refrescos leves.',
    },
  }
  const m = T[n] || T.en
  const c = typeof city === 'string' ? city.trim() : ''
  const t = typeof theme1 === 'string' ? theme1.trim() : ''
  if (c && t) return m.withBoth(c, t)
  if (c) return m.withCity(c)
  return m.generic
}

export function getMeetupKbygTldrLabels(lang) {
  const n = normalizeLanguage(lang)
  const M = {
    en: {
      arrival_time: 'Arrival time',
      venue_location: 'Venue / location',
      parking: 'Parking',
      food_drinks: 'Food & drinks',
      speaker_arrival: 'Speaker arrival note',
      av_setup: 'AV / presentation setup',
      host_contact: 'Host / point of contact',
      custom_note: 'Custom note',
    },
    es: {
      arrival_time: 'Hora de llegada',
      venue_location: 'Lugar / ubicación',
      parking: 'Estacionamiento',
      food_drinks: 'Comida y bebidas',
      speaker_arrival: 'Nota de llegada del ponente',
      av_setup: 'AV / configuración de presentación',
      host_contact: 'Anfitrión / contacto',
      custom_note: 'Nota personalizada',
    },
    pt: {
      arrival_time: 'Horário de chegada',
      venue_location: 'Local / endereço',
      parking: 'Estacionamento',
      food_drinks: 'Comida e bebidas',
      speaker_arrival: 'Nota de chegada do palestrante',
      av_setup: 'AV / configuração de apresentação',
      host_contact: 'Anfitrião / contato',
      custom_note: 'Nota personalizada',
    },
  }
  return M[n] || M.en
}

export function getMeetupKbygStrings(lang) {
  const n = normalizeLanguage(lang)
  const M = {
    en: {
      subjectSuffix: 'Meetup Know Before You Go',
      meetupFallbackTitle: 'Meetup',
      titleHeading: 'Title',
      tldrHeading: 'TL;DR',
      location: 'Location',
      parking: 'Parking',
      agenda: 'Agenda',
      speaker: 'Speaker',
      speaker1Default: 'Speaker 1',
      speaker2Default: 'Speaker 2',
      speakerArrival: 'Speaker arrival',
      eventPage: 'Event page',
      meetupLabel: 'Meetup',
      lumaLabel: 'Luma',
      /** Short hyperlink label for Meetup URL (no raw URL in preview copy). */
      meetupEventLinkLabel: 'Meetup Event',
      /** Short hyperlink label for Luma URL (no raw URL in preview copy). */
      lumaRegistrationLinkLabel: 'Luma Registration',
      helpfulContacts: 'Helpful contacts',
      foodBeverage: 'Food & beverage',
      setup: 'Setup',
      avSetup: 'AV / presentation setup',
      takePhotos: 'Take Photos',
      additionalNotes: 'Additional notes',
      closingQuestion: 'Please let me know if you have any questions.',
      thanksFull: (eventTitle, eventDate) =>
        `Thank you for being part of the ${eventTitle} meetup on ${eventDate}. Below are the logistics to help you prepare for the event.`,
      thanksTitle: (eventTitle) =>
        `Thank you for being part of the ${eventTitle} meetup. Below are the logistics to help you prepare for the event.`,
      thanksDate: (eventDate) =>
        `Thank you for being part of this meetup on ${eventDate}. Below are the logistics to help you prepare for the event.`,
      thanksGeneric:
        'Thank you for being part of this meetup. Below are the logistics to help you prepare for the event.',
      htmlTitleStrong: 'Title',
      htmlLocationStrong: 'Location',
      htmlParkingStrong: 'Parking',
      htmlAgendaStrong: 'Agenda',
      htmlSpeakerStrong: 'Speaker',
      htmlSpeakerArrivalStrong: 'Speaker arrival',
      htmlEventPageStrong: 'Event page',
      htmlMeetupLink: 'Meetup',
      htmlLumaLink: 'Luma',
      htmlHelpfulContactsStrong: 'Helpful contacts',
      htmlFoodStrong: 'Food &amp; beverage',
      htmlSetupStrong: 'Setup',
      htmlAvStrong: 'AV / presentation setup',
      htmlTakePhotosStrong: 'Take Photos',
      htmlAdditionalStrong: 'Additional notes',
      logisticsHeading: 'Logistics',
      kbygLookingForward: 'Looking forward to seeing you there!',
      kbygSignature: 'Olivia',
      thanksLeanFull: (eventTitle, eventDate) =>
        `Thank you for being part of ${eventTitle} on ${eventDate}.`,
      thanksLeanTitle: (eventTitle) => `Thank you for being part of ${eventTitle}.`,
      thanksLeanDate: (eventDate) => `Thank you for being part of this meetup on ${eventDate}.`,
      thanksLeanGeneric: 'Thank you for being part of this event.',
      /** Lean KBYG opening line — `fallbackTitle` is used when the event title field is blank. */
      kbygIntroLead: (eventTitle, whenLine, fallbackTitle) => {
        const t = (eventTitle && String(eventTitle).trim()) || fallbackTitle
        const w = (whenLine && String(whenLine).trim()) || ''
        if (w) return `Thank you for being part of the ${t} on ${w}.`
        return `Thank you for being part of the ${t}.`
      },
      htmlClosing: 'Please let me know if you have any questions.',
      htmlThanksFull: (eventTitle, eventDate) =>
        `Thank you for being part of the ${eventTitle} meetup on ${eventDate}. Below are the logistics to help you prepare for the event.`,
      htmlThanksTitle: (eventTitle) =>
        `Thank you for being part of the ${eventTitle} meetup. Below are the logistics to help you prepare for the event.`,
      htmlThanksDate: (eventDate) =>
        `Thank you for being part of this meetup on ${eventDate}. Below are the logistics to help you prepare for the event.`,
      htmlThanksGeneric:
        'Thank you for being part of this meetup. Below are the logistics to help you prepare for the event.',
      htmlArriveBy: (t) => `Arrive by ${t}`,
      tldrWhen: (when) => `When: ${when}.`,
      tldrVenue: (v) => `Venue: ${v}`,
      tldrParking: (p) => `Parking: ${p}`,
      tldrFoodDrinks: (fd) =>
        fd.endsWith('.') ? `Food & drinks: ${fd}` : `Food & drinks: ${fd}.`,
      tldrAv: (line) => `AV: ${line}`,
      tldrContact: (line) => `Contact: ${line}`,
      tldrArriveBy: (t) => `Arrive by ${t}.`,
      parkingBookingIntro: 'Reserve parking in advance:',
      parkingBookLinkDefaultLabel: 'Book Parking',
    },
    es: {
      subjectSuffix: 'Meetup — Información previa',
      meetupFallbackTitle: 'Meetup',
      titleHeading: 'Título',
      tldrHeading: 'TL;DR',
      location: 'Ubicación',
      parking: 'Estacionamiento',
      agenda: 'Agenda',
      speaker: 'Ponente',
      speaker1Default: 'Ponente 1',
      speaker2Default: 'Ponente 2',
      speakerArrival: 'Llegada del ponente',
      eventPage: 'Página del evento',
      meetupLabel: 'Meetup',
      lumaLabel: 'Luma',
      meetupEventLinkLabel: 'Evento en Meetup',
      lumaRegistrationLinkLabel: 'Registro en Luma',
      helpfulContacts: 'Contactos útiles',
      foodBeverage: 'Comida y bebidas',
      setup: 'Montaje',
      avSetup: 'AV / configuración de presentación',
      takePhotos: 'Fotos',
      additionalNotes: 'Notas adicionales',
      closingQuestion: 'Avísame si tienes alguna pregunta.',
      thanksFull: (eventTitle, eventDate) =>
        `Gracias por ser parte del meetup ${eventTitle} el ${eventDate}. Abajo tienes la logística para prepararte.`,
      thanksTitle: (eventTitle) =>
        `Gracias por ser parte del meetup ${eventTitle}. Abajo tienes la logística para prepararte.`,
      thanksDate: (eventDate) =>
        `Gracias por ser parte de este meetup el ${eventDate}. Abajo tienes la logística para prepararte.`,
      thanksGeneric:
        'Gracias por ser parte de este meetup. Abajo tienes la logística para prepararte.',
      htmlTitleStrong: 'Título',
      htmlLocationStrong: 'Ubicación',
      htmlParkingStrong: 'Estacionamiento',
      htmlAgendaStrong: 'Agenda',
      htmlSpeakerStrong: 'Ponente',
      htmlSpeakerArrivalStrong: 'Llegada del ponente',
      htmlEventPageStrong: 'Página del evento',
      htmlMeetupLink: 'Meetup',
      htmlLumaLink: 'Luma',
      htmlHelpfulContactsStrong: 'Contactos útiles',
      htmlFoodStrong: 'Comida y bebidas',
      htmlSetupStrong: 'Montaje',
      htmlAvStrong: 'AV / configuración de presentación',
      htmlTakePhotosStrong: 'Fotos',
      htmlAdditionalStrong: 'Notas adicionales',
      logisticsHeading: 'Logística',
      kbygLookingForward: '¡Nos vemos allí!',
      kbygSignature: 'Olivia',
      thanksLeanFull: (eventTitle, eventDate) =>
        `Gracias por unirte a ${eventTitle} el ${eventDate}.`,
      thanksLeanTitle: (eventTitle) => `Gracias por unirte a ${eventTitle}.`,
      thanksLeanDate: (eventDate) => `Gracias por acompañarnos el ${eventDate}.`,
      thanksLeanGeneric: 'Gracias por ser parte de este evento.',
      kbygIntroLead: (eventTitle, whenLine, fallbackTitle) => {
        const t = (eventTitle && String(eventTitle).trim()) || fallbackTitle
        const w = (whenLine && String(whenLine).trim()) || ''
        if (w) return `Gracias por ser parte de ${t} el ${w}.`
        return `Gracias por ser parte de ${t}.`
      },
      htmlClosing: 'Avísame si tienes alguna pregunta.',
      htmlThanksFull: (eventTitle, eventDate) =>
        `Gracias por ser parte del meetup ${eventTitle} el ${eventDate}. Abajo tienes la logística para prepararte.`,
      htmlThanksTitle: (eventTitle) =>
        `Gracias por ser parte del meetup ${eventTitle}. Abajo tienes la logística para prepararte.`,
      htmlThanksDate: (eventDate) =>
        `Gracias por ser parte de este meetup el ${eventDate}. Abajo tienes la logística para prepararte.`,
      htmlThanksGeneric:
        'Gracias por ser parte de este meetup. Abajo tienes la logística para prepararte.',
      htmlArriveBy: (t) => `Llega antes de las ${t}`,
      tldrWhen: (when) => `Cuándo: ${when}.`,
      tldrVenue: (v) => `Lugar: ${v}`,
      tldrParking: (p) => `Estacionamiento: ${p}`,
      tldrFoodDrinks: (fd) =>
        fd.endsWith('.') ? `Comida y bebidas: ${fd}` : `Comida y bebidas: ${fd}.`,
      tldrAv: (line) => `AV: ${line}`,
      tldrContact: (line) => `Contacto: ${line}`,
      tldrArriveBy: (t) => `Llega antes de las ${t}.`,
      parkingBookingIntro: 'Reserva estacionamiento con anticipación:',
      parkingBookLinkDefaultLabel: 'Reservar estacionamiento',
    },
    pt: {
      subjectSuffix: 'Meetup — Saiba antes de ir',
      meetupFallbackTitle: 'Meetup',
      titleHeading: 'Título',
      tldrHeading: 'TL;DR',
      location: 'Local',
      parking: 'Estacionamento',
      agenda: 'Agenda',
      speaker: 'Palestrante',
      speaker1Default: 'Palestrante 1',
      speaker2Default: 'Palestrante 2',
      speakerArrival: 'Chegada do palestrante',
      eventPage: 'Página do evento',
      meetupLabel: 'Meetup',
      lumaLabel: 'Luma',
      meetupEventLinkLabel: 'Evento no Meetup',
      lumaRegistrationLinkLabel: 'Inscrição no Luma',
      helpfulContacts: 'Contatos úteis',
      foodBeverage: 'Comida e bebidas',
      setup: 'Montagem',
      avSetup: 'AV / configuração de apresentação',
      takePhotos: 'Fotos',
      additionalNotes: 'Notas adicionais',
      closingQuestion: 'Me avise se tiver alguma dúvida.',
      thanksFull: (eventTitle, eventDate) =>
        `Obrigado por fazer parte do meetup ${eventTitle} em ${eventDate}. Abaixo estão os detalhes logísticos para você se preparar.`,
      thanksTitle: (eventTitle) =>
        `Obrigado por fazer parte do meetup ${eventTitle}. Abaixo estão os detalhes logísticos para você se preparar.`,
      thanksDate: (eventDate) =>
        `Obrigado por fazer parte deste meetup em ${eventDate}. Abaixo estão os detalhes logísticos para você se preparar.`,
      thanksGeneric:
        'Obrigado por fazer parte deste meetup. Abaixo estão os detalhes logísticos para você se preparar.',
      htmlTitleStrong: 'Título',
      htmlLocationStrong: 'Local',
      htmlParkingStrong: 'Estacionamento',
      htmlAgendaStrong: 'Agenda',
      htmlSpeakerStrong: 'Palestrante',
      htmlSpeakerArrivalStrong: 'Chegada do palestrante',
      htmlEventPageStrong: 'Página do evento',
      htmlMeetupLink: 'Meetup',
      htmlLumaLink: 'Luma',
      htmlHelpfulContactsStrong: 'Contatos úteis',
      htmlFoodStrong: 'Comida e bebidas',
      htmlSetupStrong: 'Montagem',
      htmlAvStrong: 'AV / configuração de apresentação',
      htmlTakePhotosStrong: 'Fotos',
      htmlAdditionalStrong: 'Notas adicionais',
      logisticsHeading: 'Logística',
      kbygLookingForward: 'Te vejo lá!',
      kbygSignature: 'Olivia',
      thanksLeanFull: (eventTitle, eventDate) =>
        `Obrigado por participar do ${eventTitle} em ${eventDate}.`,
      thanksLeanTitle: (eventTitle) => `Obrigado por participar do ${eventTitle}.`,
      thanksLeanDate: (eventDate) => `Obrigado por vir em ${eventDate}.`,
      thanksLeanGeneric: 'Obrigado por fazer parte deste evento.',
      kbygIntroLead: (eventTitle, whenLine, fallbackTitle) => {
        const t = (eventTitle && String(eventTitle).trim()) || fallbackTitle
        const w = (whenLine && String(whenLine).trim()) || ''
        if (w) return `Obrigado por fazer parte do ${t} em ${w}.`
        return `Obrigado por fazer parte do ${t}.`
      },
      htmlClosing: 'Me avise se tiver alguma dúvida.',
      htmlThanksFull: (eventTitle, eventDate) =>
        `Obrigado por fazer parte do meetup ${eventTitle} em ${eventDate}. Abaixo estão os detalhes logísticos para você se preparar.`,
      htmlThanksTitle: (eventTitle) =>
        `Obrigado por fazer parte do meetup ${eventTitle}. Abaixo estão os detalhes logísticos para você se preparar.`,
      htmlThanksDate: (eventDate) =>
        `Obrigado por fazer parte deste meetup em ${eventDate}. Abaixo estão os detalhes logísticos para você se preparar.`,
      htmlThanksGeneric:
        'Obrigado por fazer parte deste meetup. Abaixo estão os detalhes logísticos para você se preparar.',
      htmlArriveBy: (t) => `Chegue até ${t}`,
      tldrWhen: (when) => `Quando: ${when}.`,
      tldrVenue: (v) => `Local: ${v}`,
      tldrParking: (p) => `Estacionamento: ${p}`,
      tldrFoodDrinks: (fd) =>
        fd.endsWith('.') ? `Comida e bebidas: ${fd}` : `Comida e bebidas: ${fd}.`,
      tldrAv: (line) => `AV: ${line}`,
      tldrContact: (line) => `Contato: ${line}`,
      tldrArriveBy: (t) => `Chegue até ${t}.`,
      parkingBookingIntro: 'Reserve estacionamento com antecedência:',
      parkingBookLinkDefaultLabel: 'Reservar estacionamento',
    },
  }
  return M[n] || M.en
}

export function getMeetupKbygPhotoLines(lang) {
  const n = normalizeLanguage(lang)
  const M = {
    en: [
      'Capture a few photos of the setup and space',
      'Take photos during the talk (speaker + audience)',
      'Get a few candid networking shots',
    ],
    es: [
      'Captura algunas fotos del montaje y del espacio',
      'Fotos durante la charla (ponente + público)',
      'Algunas fotos espontáneas de networking',
    ],
    pt: [
      'Tire algumas fotos da montagem e do espaço',
      'Fotos durante a palestra (palestrante + público)',
      'Algumas fotos espontâneas do networking',
    ],
  }
  return M[n] || M.en
}

export function getEventPageStrings(lang) {
  const n = normalizeLanguage(lang)
  const M = {
    en: {
      when: 'When',
      where: 'Where',
      rsvp: 'RSVP',
      arrival: 'Arrival',
      parking: 'Parking',
      whyAttend: 'Why Attend',
      whatToExpect: 'What to Expect',
      agenda: 'Agenda',
      talkAbstracts: 'Talk Abstracts',
      hostSponsor: 'Host / Sponsor',
      closing: 'Closing',
      inviteTitle: 'Are you interested in presenting your Elastic use case?',
      inviteBody:
        "We welcome 5–10 minute lightning talks, 45-minute deep dives, and everything in between.\n\nIf you're interested, please send us an email at meetups@elastic.co.",
      emojiWhen: '📅 Date and Time',
      emojiWhere: '📍 Location',
      emojiWhy: '✨ Why Attend',
      emojiWhat: '💡 What to Expect',
      emojiAgenda: '📝 Agenda',
      emojiClosing: '👋 Closing',
      emojiTalks: '💬 Talk Abstracts',
      emojiArrival: '🪧 Arrival Instructions',
      emojiParking: '🚗 Parking',
      emojiRsvp: '📌 RSVP',
      emojiHost: '🏢 Host / Sponsor',
      plainWhen: 'Date and Time',
      plainWhere: 'Location',
      plainWhy: 'Why Attend',
      plainWhat: 'What to Expect',
      plainAgenda: 'Agenda',
      plainClosing: 'Closing',
      plainTalks: 'Talk Abstracts',
      plainArrival: 'Arrival Instructions',
      plainParking: 'Parking',
      plainRsvp: 'RSVP',
      plainHost: 'Host / Sponsor',
      intro3speakers: (groupName, when, s1, s2, s3) =>
        `${groupName} is hosting a meetup${when}. We'll have presentations from ${s1}, ${s2}, and ${s3}, followed by food, refreshments, and networking.`,
      intro2speakers: (groupName, when, s1, s2) =>
        `${groupName} is hosting a meetup${when}. We'll have presentations from ${s1} and ${s2}, followed by food, refreshments, and networking.`,
      intro1speaker: (groupName, when, s1) =>
        `${groupName} is hosting a meetup${when}. We'll have a presentation from ${s1}, followed by food, refreshments, and networking.`,
      introNone: (groupName, when) =>
        `${groupName} is hosting a meetup${when}. We'll have presentations, followed by food, refreshments, and networking.`,
      onDate: (d) => ` on ${d}`,
    },
    es: {
      when: 'Cuándo',
      where: 'Dónde',
      rsvp: 'Inscripción',
      arrival: 'Llegada',
      parking: 'Estacionamiento',
      whyAttend: 'Por qué asistir',
      whatToExpect: 'Qué esperar',
      agenda: 'Programa',
      talkAbstracts: 'Resúmenes de charlas',
      hostSponsor: 'Anfitrión / patrocinador',
      closing: 'Cierre',
      inviteTitle: '¿Te interesa presentar tu caso de uso de Elastic?',
      inviteBody:
        'Aceptamos charlas relámpago de 5–10 minutos, sesiones profundas de 45 minutos y todo lo intermedio.\n\nSi te interesa, envíanos un correo a meetups@elastic.co.',
      emojiWhen: '📅 Fecha y hora',
      emojiWhere: '📍 Ubicación',
      emojiWhy: '✨ Por qué asistir',
      emojiWhat: '💡 Qué esperar',
      emojiAgenda: '📝 Programa',
      emojiClosing: '👋 Cierre',
      emojiTalks: '💬 Resúmenes de charlas',
      emojiArrival: '🪧 Instrucciones de llegada',
      emojiParking: '🚗 Estacionamiento',
      emojiRsvp: '📌 Inscripción',
      emojiHost: '🏢 Anfitrión / patrocinador',
      plainWhen: 'Fecha y hora',
      plainWhere: 'Ubicación',
      plainWhy: 'Por qué asistir',
      plainWhat: 'Qué esperar',
      plainAgenda: 'Programa',
      plainClosing: 'Cierre',
      plainTalks: 'Resúmenes de charlas',
      plainArrival: 'Instrucciones de llegada',
      plainParking: 'Estacionamiento',
      plainRsvp: 'Inscripción',
      plainHost: 'Anfitrión / patrocinador',
      intro3speakers: (groupName, when, s1, s2, s3) =>
        `${groupName} organiza un meetup${when}. Tendremos presentaciones de ${s1}, ${s2} y ${s3}, y después comida, refrescos y networking.`,
      intro2speakers: (groupName, when, s1, s2) =>
        `${groupName} organiza un meetup${when}. Tendremos presentaciones de ${s1} y ${s2}, y después comida, refrescos y networking.`,
      intro1speaker: (groupName, when, s1) =>
        `${groupName} organiza un meetup${when}. Tendremos una presentación de ${s1}, y después comida, refrescos y networking.`,
      introNone: (groupName, when) =>
        `${groupName} organiza un meetup${when}. Tendremos presentaciones, y después comida, refrescos y networking.`,
      onDate: (d) => ` el ${d}`,
    },
    pt: {
      when: 'Quando',
      where: 'Onde',
      rsvp: 'Inscrição',
      arrival: 'Chegada',
      parking: 'Estacionamento',
      whyAttend: 'Por que participar',
      whatToExpect: 'O que esperar',
      agenda: 'Programação',
      talkAbstracts: 'Resumos das palestras',
      hostSponsor: 'Anfitrião / patrocinador',
      closing: 'Encerramento',
      inviteTitle: 'Quer apresentar seu caso de uso com Elastic?',
      inviteBody:
        'Aceitamos lightning talks de 5–10 minutos, sessões de 45 minutos e tudo no meio.\n\nSe tiver interesse, envie um e-mail para meetups@elastic.co.',
      emojiWhen: '📅 Data e hora',
      emojiWhere: '📍 Local',
      emojiWhy: '✨ Por que participar',
      emojiWhat: '💡 O que esperar',
      emojiAgenda: '📝 Programação',
      emojiClosing: '👋 Encerramento',
      emojiTalks: '💬 Resumos das palestras',
      emojiArrival: '🪧 Instruções de chegada',
      emojiParking: '🚗 Estacionamento',
      emojiRsvp: '📌 Inscrição',
      emojiHost: '🏢 Anfitrião / patrocinador',
      plainWhen: 'Data e hora',
      plainWhere: 'Local',
      plainWhy: 'Por que participar',
      plainWhat: 'O que esperar',
      plainAgenda: 'Programação',
      plainClosing: 'Encerramento',
      plainTalks: 'Resumos das palestras',
      plainArrival: 'Instruções de chegada',
      plainParking: 'Estacionamento',
      plainRsvp: 'Inscrição',
      plainHost: 'Anfitrião / patrocinador',
      intro3speakers: (groupName, when, s1, s2, s3) =>
        `${groupName} está organizando um meetup${when}. Teremos apresentações de ${s1}, ${s2} e ${s3}, depois comida, refrescos e networking.`,
      intro2speakers: (groupName, when, s1, s2) =>
        `${groupName} está organizando um meetup${when}. Teremos apresentações de ${s1} e ${s2}, depois comida, refrescos e networking.`,
      intro1speaker: (groupName, when, s1) =>
        `${groupName} está organizando um meetup${when}. Teremos uma apresentação de ${s1}, depois comida, refrescos e networking.`,
      introNone: (groupName, when) =>
        `${groupName} está organizando um meetup${when}. Teremos apresentações, depois comida, refrescos e networking.`,
      onDate: (d) => ` em ${d}`,
    },
  }
  if (n === 'es' || n === 'pt') return M[n]
  return M.en
}

/** Conference KBYG: UI labels for TL;DR checkboxes (optional). */
export function getConferenceTldrIncludeLabels(lang) {
  const n = normalizeLanguage(lang)
  const M = {
    en: {
      arrival_time: 'Arrival time',
      badge_pickup: 'Badge pickup',
      booth_materials: 'Booth materials',
      staffing_note: 'Staffing note',
      lead_capture: 'Lead capture',
      swag_materials: 'Swag/materials',
      return_shipping: 'Return shipping',
      key_contact: 'Key contact',
      important_links: 'Important links',
      custom_note: 'Custom note',
    },
    es: {
      arrival_time: 'Hora de llegada',
      badge_pickup: 'Retiro de credencial',
      booth_materials: 'Materiales del stand',
      staffing_note: 'Nota de staffing',
      lead_capture: 'Captación de leads',
      swag_materials: 'Swag / materiales',
      return_shipping: 'Envío de vuelta',
      key_contact: 'Contacto clave',
      important_links: 'Enlaces importantes',
      custom_note: 'Nota personalizada',
    },
    pt: {
      arrival_time: 'Horário de chegada',
      badge_pickup: 'Retirada do crachá',
      booth_materials: 'Materiais do estande',
      staffing_note: 'Nota de equipe',
      lead_capture: 'Captura de leads',
      swag_materials: 'Swag / materiais',
      return_shipping: 'Devolução / envio',
      key_contact: 'Contato principal',
      important_links: 'Links importantes',
      custom_note: 'Nota personalizada',
    },
  }
  return M[n] || M.en
}

/**
 * Full conference email strings + booth scenario copy.
 */
export function getConferenceStrings(lang) {
  const n = normalizeLanguage(lang)
  const B = CONFERENCE_BASE[n] || CONFERENCE_BASE.en
  return {
    ...B,
    boothDelivery: getConferenceBoothDelivery(n),
    boothFixedBullets: BOOTH_FIXED_BULLETS[n] || BOOTH_FIXED_BULLETS.en,
  }
}

const BOOTH_FIXED_BULLETS = {
  en: [
    'Table and chairs are typically provided onsite—confirm placement with venue or event staff if anything is unclear.',
    'Assign setup and cleanup roles: who opens the booth, who covers sessions, and who does the final sweep and pack-out.',
    'Place swag where it is visible from the aisle; keep backup stock behind or under the table and replenish as needed.',
  ],
  es: [
    'La mesa y las sillas suelen estar en el sitio: confirma la ubicación con el venue o el staff si algo no está claro.',
    'Define roles de montaje y cierre: quién abre el stand, quién cubre sesiones y quién hace el barrido final y el desmontaje.',
    'Coloca el swag donde se vea desde el pasillo; guarda stock extra detrás o bajo la mesa y repón cuando haga falta.',
  ],
  pt: [
    'Mesa e cadeiras costumam ser fornecidas no local — confirme o posicionamento com o venue ou a equipe do evento se algo não estiver claro.',
    'Defina papéis de montagem e encerramento: quem abre o estande, quem cobre as sessões e quem faz a varredura final e o recolhimento.',
    'Coloque o swag onde seja visível do corredor; mantenha estoque reserva atrás ou sob a mesa e reponha conforme necessário.',
  ],
}

function getConferenceBoothDelivery(n) {
  return BOOTH_SCENARIOS[n] || BOOTH_SCENARIOS.en
}

const BOOTH_SCENARIOS = {
  en: {
    shipped_to_individual: {
      label: 'Shipped to individual',
      bullets: [
        'Plan for luggage, shipping boxes, and weight limits when transporting items to the venue.',
        'Arrive with enough time to move everything to the booth and finish setup before the floor opens.',
      ],
    },
    shipped_to_venue: {
      label: 'Shipped to venue',
      bullets: [
        'Coordinate with event staff on receiving, storage, and where crates or pallets will be staged.',
        'After you arrive, check in with registration or ops to locate your delivered materials before you start building the booth.',
      ],
    },
    minimal_setup: {
      label: 'No shipped materials / minimal setup',
      bullets: [
        'Expect a light footprint (e.g. laptop, small signage, swag); confirm ahead of time what the venue provides.',
        'Keep setup and teardown quick—focus on essentials and leave the space clean and complete.',
      ],
    },
  },
  es: {
    shipped_to_individual: {
      label: 'Enviado a la persona',
      bullets: [
        'Ten en cuenta equipaje, cajas de envío y límites de peso al transportar materiales al venue.',
        'Llega con tiempo para llevar todo al stand y terminar el montaje antes de que abra el piso.',
      ],
    },
    shipped_to_venue: {
      label: 'Enviado al venue',
      bullets: [
        'Coordina con el staff del evento la recepción, el almacenamiento y dónde se ubicarán cajas o pallets.',
        'Al llegar, pásate por registro u operaciones para ubicar tus materiales antes de montar el stand.',
      ],
    },
    minimal_setup: {
      label: 'Sin envíos / montaje mínimo',
      bullets: [
        'Espera una huella ligera (p. ej. laptop, señalética pequeña, swag); confirma antes qué provee el venue.',
        'Mantén montaje y desmontaje ágiles — lo esencial y deja el espacio limpio y listo.',
      ],
    },
  },
  pt: {
    shipped_to_individual: {
      label: 'Enviado para a pessoa',
      bullets: [
        'Planeje bagagem, caixas de envio e limites de peso ao levar itens ao local.',
        'Chegue com tempo de sobra para levar tudo ao estande e terminar a montagem antes da abertura.',
      ],
    },
    shipped_to_venue: {
      label: 'Enviado ao local',
      bullets: [
        'Alinhe com a equipe do evento recebimento, armazenamento e onde caixas ou pallets ficarão.',
        'Ao chegar, passe pelo credenciamento ou operações para localizar seus materiais antes de montar o estande.',
      ],
    },
    minimal_setup: {
      label: 'Sem envios / montagem mínima',
      bullets: [
        'Espere pegada leve (ex.: laptop, sinalização pequena, swag); confirme antes o que o local fornece.',
        'Mantenha montagem e desmontagem rápidas — foque no essencial e deixe o espaço limpo.',
      ],
    },
  },
}

const CONFERENCE_BASE = {
  en: {
    hiTeam: 'Hi Team',
    thankYou: (name) =>
      `First and foremost, thank you for attending ${name} and helping out at the DevRel booth! We appreciate your help very much!`,
    deckParagraph: (name, url) =>
      `For additional information, please take a look at the ${name} Know Before You Go slide deck (${url}). If you have any questions, please don't hesitate to reach out.`,
    signoff: 'Please reach out if anything changes on site or you need a hand.',
    subjectKbyg: 'Know Before You Go',
    otherContacts: 'Other contacts',
    tldrHeadingPlain: '📝 TL;DR',
    tldrHeadingHtml:
      '<strong>📝 <span style="background-color:#FEF08A;font-weight:bold;">TL;DR</span></strong>',
    eventDatesTitle: '🗓 Event Dates & Hours',
    boothSetupLabel: 'Booth Setup:',
    boothHoursLabel: 'Booth Hours:',
    boothCleanupLabel: 'Booth Cleanup:',
    notesLabel: 'Notes:',
    staffingSchedule: 'Staffing Schedule',
    staffingLinkIntro: 'Please refer to the staffing schedule here:',
    tickets: '🎟 Tickets',
    location: '🏢 Location',
    contactsHeading: '💬 Contacts',
    boothSetupLogisticsTitle: '📢 Booth Setup & Logistics',
    avSetup: '🔌 AV / Setup Requirements',
    swag: '🛍 Swag',
    parking: '🚙 Parking',
    foodBeverage: '🍔 Food & Beverage',
    engagement: '🎉 Engagement',
    raffle: '🎉 Raffle',
    kahoot: 'Kahoot!',
    prizeLabel: 'Prize:',
    additionalSectionFallback: 'Section',
    travelExpenses: '💵 Travel & Expenses',
    standardTravel:
      "Be sure to keep your receipts throughout the event so you can expense via Concur. Feel free to refer to Elastic's travel and expense policy for additional guidance.",
    shippedToIndividualIntroNamed: (name) =>
      `All booth materials were shipped to ${name}, so please bring everything with you to the event, including:`,
    shippedToIndividualIntroGeneric:
      'All booth materials were shipped to the onsite contact, so please bring everything with you to the event, including:',
    contactGroups: {
      devrel_onsite: 'DevRel Onsite Support',
      devrel_remote: 'DevRel Remote Support',
      conference_organizer: 'Conference Organizer',
    },
    tldr: {
      arriveBuild: 'Arrive / build',
      badges: 'Badges',
      materialsPrefix: 'Materials',
      staffing: 'Staffing',
      leadCapture: 'Lead capture',
      swag: 'Swag',
      returnStrike: 'Return / strike',
      keyContact: 'Key contact',
      links: 'Links',
      deckShort: 'Deck',
      staffingShort: 'Staffing',
    },
    htmlIntroHi: 'Hi Team,<br><br>',
    htmlThankYou: (encName) =>
      `First and foremost, thank you for attending ${encName} and helping out at the DevRel booth! We appreciate your help very much!`,
    htmlDeck: (encName, href) =>
      `<br><br>For additional information, please take a look at the <a href="${href}" style="color:#1D4ED8;text-decoration:underline;">${encName} Know Before You Go slide deck</a>. If you have any questions, please don't hesitate to reach out.`,
    htmlEventDatesLabels: {
      setup: 'Booth Setup:',
      hours: 'Booth Hours:',
      cleanup: 'Booth Cleanup:',
      notes: 'Notes:',
    },
    htmlStaffingStrong: 'Staffing Schedule',
    htmlStaffingLink: 'Please refer to the staffing schedule here:',
    engagementKahootStrong: '🎉 Engagement',
    engagementRaffleStrong: '🎉 Raffle',
    engagementPrize: 'Prize:',
    htmlTravelStrong: '💵 Travel &amp; Expenses',
  },
  es: {
    hiTeam: 'Hola equipo',
    thankYou: (name) =>
      `Antes que nada, gracias por asistir a ${name} y ayudar en el stand de DevRel. ¡Valoramos muchísimo tu apoyo!`,
    deckParagraph: (name, url) =>
      `Para más información, revisa las diapositivas “Know Before You Go” de ${name} (${url}). Si tienes dudas, escríbenos sin problema.`,
    signoff: 'Si algo cambia en el sitio o necesitas una mano, avísanos.',
    subjectKbyg: 'Información previa',
    otherContacts: 'Otros contactos',
    tldrHeadingPlain: '📝 TL;DR',
    tldrHeadingHtml:
      '<strong>📝 <span style="background-color:#FEF08A;font-weight:bold;">TL;DR</span></strong>',
    eventDatesTitle: '🗓 Fechas y horarios del evento',
    boothSetupLabel: 'Montaje del stand:',
    boothHoursLabel: 'Horario del stand:',
    boothCleanupLabel: 'Desmontaje:',
    notesLabel: 'Notas:',
    staffingSchedule: 'Calendario de staffing',
    staffingLinkIntro: 'Consulta el calendario de staffing aquí:',
    tickets: '🎟 Entradas',
    location: '🏢 Ubicación',
    contactsHeading: '💬 Contactos',
    boothSetupLogisticsTitle: '📢 Montaje y logística del stand',
    avSetup: '🔌 Requisitos de AV / montaje',
    swag: '🛍 Swag',
    parking: '🚙 Estacionamiento',
    foodBeverage: '🍔 Comida y bebidas',
    engagement: '🎉 Dinámica',
    raffle: '🎉 Sorteo',
    kahoot: 'Kahoot!',
    prizeLabel: 'Premio:',
    additionalSectionFallback: 'Sección',
    travelExpenses: '💵 Viajes y gastos',
    standardTravel:
      'Guarda tus recibos durante el evento para cargarlos en Concur. Consulta la política de viajes y gastos de Elastic si lo necesitas.',
    shippedToIndividualIntroNamed: (name) =>
      `Todo el material del stand se envió a ${name}; trae contigo todo lo necesario al evento, incluyendo:`,
    shippedToIndividualIntroGeneric:
      'Todo el material del stand se envió al contacto onsite; trae contigo todo lo necesario al evento, incluyendo:',
    contactGroups: {
      devrel_onsite: 'DevRel — soporte onsite',
      devrel_remote: 'DevRel — soporte remoto',
      conference_organizer: 'Organización del evento',
    },
    tldr: {
      arriveBuild: 'Llegada / montaje',
      badges: 'Credenciales',
      materialsPrefix: 'Materiales',
      staffing: 'Staffing',
      leadCapture: 'Captación de leads',
      swag: 'Swag',
      returnStrike: 'Devolución / cierre',
      keyContact: 'Contacto clave',
      links: 'Enlaces',
      deckShort: 'Deck',
      staffingShort: 'Staffing',
    },
    htmlIntroHi: 'Hola equipo,<br><br>',
    htmlThankYou: (encName) =>
      `Antes que nada, gracias por asistir a ${encName} y ayudar en el stand de DevRel. ¡Valoramos muchísimo tu apoyo!`,
    htmlDeck: (encName, href) =>
      `<br><br>Para más información, revisa las <a href="${href}" style="color:#1D4ED8;text-decoration:underline;">diapositivas “Know Before You Go” de ${encName}</a>. Si tienes dudas, escríbenos sin problema.`,
    htmlEventDatesLabels: {
      setup: 'Montaje del stand:',
      hours: 'Horario del stand:',
      cleanup: 'Desmontaje:',
      notes: 'Notas:',
    },
    htmlStaffingStrong: 'Calendario de staffing',
    htmlStaffingLink: 'Consulta el calendario de staffing aquí:',
    engagementKahootStrong: '🎉 Dinámica',
    engagementRaffleStrong: '🎉 Sorteo',
    engagementPrize: 'Premio:',
    htmlTravelStrong: '💵 Viajes y gastos',
  },
  pt: {
    hiTeam: 'Olá, equipe',
    thankYou: (name) =>
      `Primeiro, obrigado por participar de ${name} e ajudar no estande DevRel! Agradecemos muito sua ajuda!`,
    deckParagraph: (name, url) =>
      `Para mais informações, veja o deck “Know Before You Go” de ${name} (${url}). Se tiver dúvidas, é só falar.`,
    signoff: 'Se algo mudar no local ou você precisar de uma mão, avise a gente.',
    subjectKbyg: 'Saiba antes de ir',
    otherContacts: 'Outros contatos',
    tldrHeadingPlain: '📝 TL;DR',
    tldrHeadingHtml:
      '<strong>📝 <span style="background-color:#FEF08A;font-weight:bold;">TL;DR</span></strong>',
    eventDatesTitle: '🗓 Datas e horários do evento',
    boothSetupLabel: 'Montagem do estande:',
    boothHoursLabel: 'Horário do estande:',
    boothCleanupLabel: 'Desmontagem:',
    notesLabel: 'Notas:',
    staffingSchedule: 'Escala de equipe',
    staffingLinkIntro: 'Consulte a escala de equipe aqui:',
    tickets: '🎟 Ingressos',
    location: '🏢 Local',
    contactsHeading: '💬 Contatos',
    boothSetupLogisticsTitle: '📢 Montagem e logística do estande',
    avSetup: '🔌 Requisitos de AV / montagem',
    swag: '🛍 Swag',
    parking: '🚙 Estacionamento',
    foodBeverage: '🍔 Comida e bebidas',
    engagement: '🎉 Dinâmica',
    raffle: '🎉 Sorteio',
    kahoot: 'Kahoot!',
    prizeLabel: 'Prêmio:',
    additionalSectionFallback: 'Seção',
    travelExpenses: '💵 Viagens e despesas',
    standardTravel:
      'Guarde seus recibos durante o evento para enviar ao Concur. Veja a política de viagens e despesas da Elastic se precisar.',
    shippedToIndividualIntroNamed: (name) =>
      `Todo o material do estande foi enviado para ${name}; leve tudo com você para o evento, incluindo:`,
    shippedToIndividualIntroGeneric:
      'Todo o material do estande foi enviado ao contato no local; leve tudo com você para o evento, incluindo:',
    contactGroups: {
      devrel_onsite: 'DevRel — suporte no local',
      devrel_remote: 'DevRel — suporte remoto',
      conference_organizer: 'Organização do evento',
    },
    tldr: {
      arriveBuild: 'Chegada / montagem',
      badges: 'Credenciais',
      materialsPrefix: 'Materiais',
      staffing: 'Equipe',
      leadCapture: 'Captura de leads',
      swag: 'Swag',
      returnStrike: 'Devolução / desmontagem',
      keyContact: 'Contato principal',
      links: 'Links',
      deckShort: 'Deck',
      staffingShort: 'Equipe',
    },
    htmlIntroHi: 'Olá, equipe,<br><br>',
    htmlThankYou: (encName) =>
      `Primeiro, obrigado por participar de ${encName} e ajudar no estande DevRel! Agradecemos muito sua ajuda!`,
    htmlDeck: (encName, href) =>
      `<br><br>Para mais informações, veja o <a href="${href}" style="color:#1D4ED8;text-decoration:underline;">deck “Know Before You Go” de ${encName}</a>. Se tiver dúvidas, é só falar.`,
    htmlEventDatesLabels: {
      setup: 'Montagem do estande:',
      hours: 'Horário do estande:',
      cleanup: 'Desmontagem:',
      notes: 'Notas:',
    },
    htmlStaffingStrong: 'Escala de equipe',
    htmlStaffingLink: 'Consulte a escala de equipe aquí:',
    engagementKahootStrong: '🎉 Dinâmica',
    engagementRaffleStrong: '🎉 Sorteio',
    engagementPrize: 'Prêmio:',
    htmlTravelStrong: '💵 Viagens e despesas',
  },
}
