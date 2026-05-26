import { getMeetupKbygStrings, normalizeLanguage } from './generationLanguage.js'

export const KBYG_TLDR_ITEM_ORDER = [
  'arrival_time',
  'venue_location',
  'parking',
  'food_drinks',
  'speaker_arrival',
  'av_setup',
  'host_contact',
  'custom_note',
]

export const KBYG_TLDR_LEAN_ORDER = ['arrival_time', 'venue_location', 'food_drinks', 'av_setup']

export function getInitialKbygTldrInclude() {
  return {
    arrival_time: true,
    venue_location: true,
    parking: false,
    food_drinks: true,
    speaker_arrival: false,
    av_setup: false,
    host_contact: true,
    custom_note: false,
  }
}

export const MAX_KBYG_TLDR_LEN = 115

export function truncateKbygTldr(s, max = MAX_KBYG_TLDR_LEN) {
  const t = (typeof s === 'string' ? s.trim() : '').replace(/\s+/g, ' ')
  if (!t) return ''
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

export function buildKbygTldrBullets(form, opts = {}) {
  const S = getMeetupKbygStrings(normalizeLanguage(opts.language))
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const has = (s) => trim(s).length > 0
  if (form.generateTldr === false) return []

  const inc = { ...getInitialKbygTldrInclude(), ...(form.kbygTldrInclude || {}) }
  let out = []

  for (const id of KBYG_TLDR_ITEM_ORDER) {
    if (!inc[id]) continue
    switch (id) {
      case 'arrival_time': {
        if (has(form.arrivalTime)) {
          out.push(`${S.tldrArriveBy(trim(form.arrivalTime))}`)
        } else if (has(form.eventDate) || has(form.eventTime)) {
          const when = [trim(form.eventDate), trim(form.eventTime)].filter(Boolean).join(' at ')
          if (when) out.push(S.tldrWhen(when))
        }
        break
      }
      case 'venue_location': {
        if (has(form.venueName) || has(form.venueAddress)) {
          const parts = [trim(form.venueName), trim(form.venueAddress)].filter(Boolean)
          out.push(S.tldrVenue(truncateKbygTldr(parts.join(' — '))))
        }
        break
      }
      case 'parking':
        if (has(form.parkingNotes)) {
          out.push(S.tldrParking(truncateKbygTldr(form.parkingNotes)))
        }
        break
      case 'food_drinks': {
        if (has(form.foodDetails) || has(form.drinkDetails)) {
          const fd = [trim(form.foodDetails), trim(form.drinkDetails)].filter(Boolean).join('; ')
          out.push(truncateKbygTldr(S.tldrFoodDrinks(fd)))
        }
        break
      }
      case 'speaker_arrival':
        if (has(form.speakerArrivalNote)) {
          out.push(truncateKbygTldr(form.speakerArrivalNote))
        }
        break
      case 'av_setup': {
        if (has(form.avNotes)) {
          const firstAv = trim(form.avNotes)
            .split(/\n+/)
            .map((s) => s.trim())
            .filter(Boolean)[0]
          if (firstAv) out.push(S.tldrAv(truncateKbygTldr(firstAv, 100)))
        }
        break
      }
      case 'host_contact': {
        const c = (form.contacts || []).find((x) => has(x.name))
        if (c) {
          const bits = [trim(c.name)]
          if (has(c.role)) bits.push(trim(c.role))
          if (has(c.contactInfo)) bits.push(trim(c.contactInfo))
          out.push(S.tldrContact(truncateKbygTldr(bits.join(' · '))))
        }
        break
      }
      case 'custom_note':
        if (has(form.additionalNotes)) {
          trim(form.additionalNotes)
            .split(/\n/)
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(0, 3)
            .forEach((line) => {
              out.push(truncateKbygTldr(line, 100))
            })
        }
        break
      default:
        break
    }
  }

  out = out.slice(0, 10)
  const rot = Math.max(0, Number(opts.tldrRotation) || 0)
  if (out.length > 1 && rot > 0) {
    const r = rot % out.length
    out = [...out.slice(r), ...out.slice(0, r)]
  }
  return out
}

export function buildKbygTldrBulletsLean(form, opts = {}) {
  const S = getMeetupKbygStrings(normalizeLanguage(opts.language))
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const has = (s) => trim(s).length > 0
  if (form.generateTldr === false) return []

  const inc = { ...getInitialKbygTldrInclude(), ...(form.kbygTldrInclude || {}) }
  let out = []

  for (const id of KBYG_TLDR_LEAN_ORDER) {
    if (!inc[id]) continue
    switch (id) {
      case 'arrival_time': {
        if (has(form.arrivalTime)) {
          out.push(`${S.tldrArriveBy(trim(form.arrivalTime))}`)
        } else if (has(form.eventDate) || has(form.eventTime)) {
          const when = [trim(form.eventDate), trim(form.eventTime)].filter(Boolean).join(' at ')
          if (when) out.push(S.tldrWhen(when))
        }
        break
      }
      case 'venue_location': {
        if (has(form.venueName) || has(form.venueAddress)) {
          const parts = [trim(form.venueName), trim(form.venueAddress)].filter(Boolean)
          out.push(S.tldrVenue(truncateKbygTldr(parts.join(' — '))))
        }
        break
      }
      case 'food_drinks': {
        if (has(form.foodDetails) || has(form.drinkDetails)) {
          const fd = [trim(form.foodDetails), trim(form.drinkDetails)].filter(Boolean).join('; ')
          out.push(truncateKbygTldr(S.tldrFoodDrinks(fd)))
        }
        break
      }
      case 'av_setup': {
        if (has(form.avNotes)) {
          const firstAv = trim(form.avNotes)
            .split(/\n+/)
            .map((s) => s.trim())
            .filter(Boolean)[0]
          if (firstAv) out.push(S.tldrAv(truncateKbygTldr(firstAv, 100)))
        }
        break
      }
      default:
        break
    }
  }

  out = out.slice(0, 4)
  const rot = Math.max(0, Number(opts.tldrRotation) || 0)
  if (out.length > 1 && rot > 0) {
    const r = rot % out.length
    out = [...out.slice(r), ...out.slice(0, r)]
  }
  return out
}
