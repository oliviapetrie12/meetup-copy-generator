/**
 * Meetup KBYG section header labels (optional emoji prefix).
 * Central map enables future overrides (custom emoji, per-section toggles, minimal mode).
 */

/** Semantic keys for Meetup KBYG email sections (stable API for callers). */
export const SECTION_EMOJIS = {
  dateTime: '📅',
  location: '📍',
  arrivalInstructions: '🔑',
  parking: '🚗',
  foodDrinks: '🍕',
  agenda: '📝',
  speaker: '🎤',
  wifi: '📶',
  swag: '🎁',
  photos: '📸',
  contact: '📞',
  registration: '✅',
  reminder: '⚠️',
  networking: '🤝',
  transit: '🚆',
  checkIn: '🪪',
}

/**
 * @param {string | undefined | null} sectionKey — key in SECTION_EMOJIS; omit or unknown → plain title only
 * @param {string} title — localized section title (no emoji baked in)
 * @param {boolean} emojisEnabled
 * @returns {string}
 */
export function formatSectionHeader(sectionKey, title, emojisEnabled) {
  const t = typeof title === 'string' ? title.trim() : String(title ?? '').trim()
  if (!emojisEnabled) return t
  if (!sectionKey || typeof sectionKey !== 'string') return t
  const emoji = SECTION_EMOJIS[sectionKey]
  if (!emoji) return t
  return `${emoji} ${t}`.trim()
}

/**
 * Plain-text **bold** line used as a section delimiter in KBYG email copy (Slack/Gmail/Docs friendly).
 * @param {string | undefined | null} sectionKey
 * @param {string} title
 * @param {boolean} emojisEnabled
 */
export function formatKbygPlainSectionHeading(sectionKey, title, emojisEnabled) {
  return `**${formatSectionHeader(sectionKey, title, emojisEnabled)}**`
}
