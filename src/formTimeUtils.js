/** Timezone IANA → short label for event copy */
export const TIMEZONE_ABBREVIATIONS = {
  'America/New_York': 'ET',
  'America/Chicago': 'CT',
  'America/Denver': 'MT',
  'America/Los_Angeles': 'PT',
  'America/Phoenix': 'MST',
  'Europe/London': 'GMT',
  'Europe/Madrid': 'CET',
  'Europe/Paris': 'CET',
  'Asia/Tokyo': 'JST',
  'Asia/Singapore': 'SGT',
  'Australia/Sydney': 'AEST',
}

export function getTimezoneDisplay(iana) {
  const tz = (iana || '').trim()
  return tz ? TIMEZONE_ABBREVIATIONS[tz] || tz : ''
}

/** @returns {number | null} minutes from midnight */
export function parseTime(timeStr) {
  const s = String(timeStr).trim().replace(/\s+/g, ' ')
  let match = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i)
  if (match) {
    let h = parseInt(match[1], 10)
    const m = parseInt(match[2], 10)
    if (m >= 60 || h > 12) return null
    const ap = match[3].toLowerCase()
    if (ap === 'pm' && h !== 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    return h * 60 + m
  }
  match = s.match(/^(\d{1,2}):(\d{2})(am|pm)$/i)
  if (match) {
    let h = parseInt(match[1], 10)
    const m = parseInt(match[2], 10)
    if (m >= 60 || h > 12) return null
    const ap = match[3].toLowerCase()
    if (ap === 'pm' && h !== 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    return h * 60 + m
  }
  match = s.match(/^(\d{1,2}):(\d{2})$/)
  if (match) {
    const h = parseInt(match[1], 10)
    const m = parseInt(match[2], 10)
    if (h < 24 && m < 60) return h * 60 + m
  }
  return null
}

export function addMinutes(minutesFromMidnight, delta) {
  return (minutesFromMidnight + delta) % (24 * 60)
}
