/**
 * Canonical Meetup KBYG email body section sequence (after greeting + intro paragraph).
 * {@link ./channels/kbygEmail.js} HTML and plain renderers emit sections in this order.
 *
 * Rationale: Event links and helpful contacts stay near the top for RSVP + operational reach-outs.
 * Logistics, speaker arrival, and photo checklist precede the agenda so ops/setup context comes before the timeline.
 *
 * 1. TL;DR — optional summary bullets
 * 2. Event page — optional Meetup / Luma links
 * 3. Helpful contacts — optional (skipped when no filled rows)
 * 4. Logistics — standalone blocks (Location, Parking, Food & beverage, AV), each optional
 * 5. Speaker arrival — optional note
 * 6. Photos checklist — optional (respect includePhotos toggle)
 * 7. Agenda — optional timed agenda (includes speaker lines when present on agenda items)
 * 8. Setup / swag
 * 9. Additional notes
 *
 * (Standalone “Speaker” section removed — names/talks belong in the agenda to avoid duplication.)
 *
 * Closing lines (question / sign-off) are appended after this pipeline.
 */
export const KBYG_EMAIL_BODY_SECTION_IDS = Object.freeze([
  'tldr',
  'eventPage',
  'helpfulContacts',
  'logistics',
  'speakerArrival',
  'photos',
  'agenda',
  'setupSwag',
  'additionalNotes',
])
