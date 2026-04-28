/**
 * Shared language helpers for Event Page, Meetup KBYG, and Conference KBYG generators.
 */

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
]

export const FORMAT_RULE = 'Preserve formatting, emojis, and structure.'

/** Strict rule for event-page remote prompts (full localization). */
export const STRICT_LOCALIZATION_RULE =
  'Generate ALL content entirely in the selected language. Do not include any English unless the selected language is English.'

/** Instruction fragment for prompts / API (English default = structure-only reminder). */
export function languageInstruction(lang) {
  const n = normalizeLanguage(lang)
  if (n === 'es') return `Generate the content in Spanish. ${FORMAT_RULE}`
  if (n === 'pt') return `Generate the content in Brazilian Portuguese. ${FORMAT_RULE}`
  return FORMAT_RULE
}

export function normalizeLanguage(lang) {
  if (lang === 'es' || lang === 'pt') return lang
  return 'en'
}

/** Full instruction for Meetup event page remote generation—no mixed-language output. */
export function eventPageRemotePrompt(lang) {
  const n = normalizeLanguage(lang)
  const lines = [STRICT_LOCALIZATION_RULE, '']
  if (n === 'es') {
    lines.push('Generate the Meetup event page copy entirely in Spanish (neutral Latin American).')
  } else if (n === 'pt') {
    lines.push('Generate the Meetup event page copy entirely in Brazilian Portuguese.')
  } else {
    lines.push('Generate the Meetup event page copy in English.')
  }
  lines.push(
    '',
    'CRITICAL:',
    '- Translate ALL bullet points across every section.',
    '- Do NOT leave any bullet points in English when the selected language is not English.',
    '- Do NOT reuse or echo English example phrasing; write original copy in the target language.',
    '',
    'For the "Why attend" section:',
    '- Write exactly 3 bullet points in the selected language.',
    '- Do not copy, paraphrase, or translate from English template examples—generate the three reasons natively from the event details.',
    '',
    'Explicitly include and localize when applicable:',
    '- Agenda (every line, including times and activity labels, in the selected language).',
    '- A short closing sentence inviting attendees to join (fresh copy in the selected language—no canned English).',
    '- "Who this is for" / audience-oriented framing when the input implies an audience, theme, or target attendee.',
    '- "What to expect" when relevant.',
    'Do not hardcode English section titles, agenda lines, or sample closings—translate all labels and body copy to the selected language.',
    'Include a short closing sentence inviting attendees to join, in the selected language.',
    'Ensure section headers and bullet points are also translated.',
    '',
    FORMAT_RULE,
  )
  return lines.join('\n')
}

export function getAgendaLineLabels(lang) {
  const n = normalizeLanguage(lang)
  const M = {
    en: {
      doors: 'Doors open / mingle',
      concludes: 'Event concludes',
    },
    es: {
      doors: 'Apertura y convivencia',
      concludes: 'Cierre del evento',
    },
    pt: {
      doors: 'Abertura e confraternização',
      concludes: 'Encerramento do evento',
    },
  }
  return M[n] || M.en
}

/** Fallback agenda when the timed builder returns nothing (edge case). */
export function getEventPageAgendaFallbackLines(lang) {
  const n = normalizeLanguage(lang)
  const L = getAgendaLineLabels(n)
  const M = {
    en: `6:00 PM ${L.doors}\n6:30 PM Talks\n8:00 PM ${L.concludes}`,
    es: `6:00 p. m. ${L.doors}\n6:30 p. m. Charlas\n8:00 p. m. ${L.concludes}`,
    pt: `18:00 ${L.doors}\n18:30 Palestras\n20:00 ${L.concludes}`,
  }
  return M[n] || M.en
}

/** Default copy for Meetup event page fields (UI initial state + quick draft for non-English). */
export function getEventPageFieldDefaults(lang) {
  const n = normalizeLanguage(lang)
  const M = {
    en: {
      meetupPageWhyAttend:
        '- Learn from community talks and real-world Elastic use cases\n- Network with other practitioners\n- All experience levels welcome',
      meetupPageWhatToExpect: 'Talks + networking\nFood and drinks will be provided',
      meetupPageClosing:
        'Come hang out, learn something new, and connect with others in the Elastic community.',
    },
    es: {
      meetupPageWhyAttend:
        '- Aprende con charlas de la comunidad y casos reales con Elastic\n- Conecta con otras personas de la práctica\n- Todos los niveles de experiencia son bienvenidos',
      meetupPageWhatToExpect: 'Charlas + networking\nHabrá comida y bebidas',
      meetupPageClosing:
        'Únete, aprende algo nuevo y conecta con la comunidad Elastic.',
    },
    pt: {
      meetupPageWhyAttend:
        '- Aprenda com palestras da comunidade e casos reais com Elastic\n- Faça networking com outras pessoas da área\n- Todos os níveis de experiência são bem-vindos',
      meetupPageWhatToExpect: 'Palestras + networking\nComida e bebidas serão oferecidas',
      meetupPageClosing:
        'Venha, aprenda algo novo e conecte-se com a comunidade Elastic.',
    },
  }
  return M[n] || M.en
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
      helpfulContacts: 'Helpful contacts',
      foodBeverage: 'Food & beverage',
      setup: 'Setup',
      avSetup: 'AV / presentation setup',
      takePhotos: '📸 Take Photos',
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
      htmlTakePhotosStrong: '📸 Take Photos',
      htmlAdditionalStrong: 'Additional notes',
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
      helpfulContacts: 'Contactos útiles',
      foodBeverage: 'Comida y bebidas',
      setup: 'Montaje',
      avSetup: 'AV / configuración de presentación',
      takePhotos: '📸 Fotos',
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
      htmlTakePhotosStrong: '📸 Fotos',
      htmlAdditionalStrong: 'Notas adicionales',
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
      helpfulContacts: 'Contatos úteis',
      foodBeverage: 'Comida e bebidas',
      setup: 'Montagem',
      avSetup: 'AV / configuração de apresentação',
      takePhotos: '📸 Fotos',
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
      htmlTakePhotosStrong: '📸 Fotos',
      htmlAdditionalStrong: 'Notas adicionais',
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
      'Optional: short video clips for social',
    ],
    es: [
      'Captura algunas fotos del montaje y del espacio',
      'Fotos durante la charla (ponente + público)',
      'Algunas fotos espontáneas de networking',
      'Opcional: clips cortos para redes',
    ],
    pt: [
      'Tire algumas fotos da montagem e do espaço',
      'Fotos durante a palestra (palestrante + público)',
      'Algumas fotos espontâneas do networking',
      'Opcional: vídeos curtos para redes sociais',
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
      rsvp: 'RSVP',
      arrival: 'Llegada',
      parking: 'Estacionamiento',
      whyAttend: 'Por qué asistir',
      whatToExpect: 'Qué esperar',
      agenda: 'Agenda',
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
      emojiAgenda: '📝 Agenda',
      emojiClosing: '👋 Cierre',
      emojiTalks: '💬 Resúmenes de charlas',
      emojiArrival: '🪧 Instrucciones de llegada',
      emojiParking: '🚗 Estacionamiento',
      emojiRsvp: '📌 RSVP',
      emojiHost: '🏢 Anfitrión / patrocinador',
      plainWhen: 'Fecha y hora',
      plainWhere: 'Ubicación',
      plainWhy: 'Por qué asistir',
      plainWhat: 'Qué esperar',
      plainAgenda: 'Agenda',
      plainClosing: 'Cierre',
      plainTalks: 'Resúmenes de charlas',
      plainArrival: 'Instrucciones de llegada',
      plainParking: 'Estacionamiento',
      plainRsvp: 'RSVP',
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
      rsvp: 'RSVP',
      arrival: 'Chegada',
      parking: 'Estacionamento',
      whyAttend: 'Por que participar',
      whatToExpect: 'O que esperar',
      agenda: 'Agenda',
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
      emojiAgenda: '📝 Agenda',
      emojiClosing: '👋 Encerramento',
      emojiTalks: '💬 Resumos das palestras',
      emojiArrival: '🪧 Instruções de chegada',
      emojiParking: '🚗 Estacionamento',
      emojiRsvp: '📌 RSVP',
      emojiHost: '🏢 Anfitrião / patrocinador',
      plainWhen: 'Data e hora',
      plainWhere: 'Local',
      plainWhy: 'Por que participar',
      plainWhat: 'O que esperar',
      plainAgenda: 'Agenda',
      plainClosing: 'Encerramento',
      plainTalks: 'Resumos das palestras',
      plainArrival: 'Instruções de chegada',
      plainParking: 'Estacionamento',
      plainRsvp: 'RSVP',
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
  return M[n] || M.en
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
