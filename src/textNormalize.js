/** Brand normalization for generated copy */
export function normalizeElastiFlow(s) {
  if (!s || typeof s !== 'string') return s
  return s.replace(/\bElastiflow\b/gi, 'ElastiFlow')
}
