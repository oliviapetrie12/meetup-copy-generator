/**
 * Attendee list formatting. All processing stays in the calling browser tab.
 * This module does not store, transmit, or log attendee data.
 */

export const OUTPUT_COLUMNS = ['First Name', 'Last Name', 'Email']

export const SORT_BY_FIRST_NAME = 'firstName'
export const SORT_BY_LAST_NAME = 'lastName'
export const PASTE_SOURCE_NAME = 'Pasted spreadsheet'

export const COLUMN_ROLE_OPTIONS = [
  { value: 'ignore', label: 'Ignore' },
  { value: 'firstName', label: 'First name' },
  { value: 'lastName', label: 'Last name' },
  { value: 'fullName', label: 'Full name' },
  { value: 'email', label: 'Email' },
]

const ROLE_LABELS = {
  firstName: 'First name',
  lastName: 'Last name',
  fullName: 'Full name',
  email: 'Email',
}

const HEADER_ROLES = new Map([
  ['first name', 'firstName'],
  ['firstname', 'firstName'],
  ['given name', 'firstName'],
  ['givenname', 'firstName'],
  ['last name', 'lastName'],
  ['lastname', 'lastName'],
  ['surname', 'lastName'],
  ['family name', 'lastName'],
  ['familyname', 'lastName'],
  ['full name', 'fullName'],
  ['fullname', 'fullName'],
  ['name', 'fullName'],
  ['attendee name', 'fullName'],
  ['contact name', 'fullName'],
  ['email', 'email'],
  ['email address', 'email'],
  ['e mail', 'email'],
  ['e mail address', 'email'],
  ['emailaddress', 'email'],
])

/** Surname particles. Matched only when they are not the first token. */
const SURNAME_PARTICLES = new Set([
  'da', 'das', 'de', 'del', 'della', 'dei', 'der', 'di', 'do', 'dos', 'du',
  'la', 'le', 'van', 'von', 'den', 'op', 'ten', 'ter', 'bin', 'ibn', 'st', 'san', 'santa',
])

const GENERIC_EMAIL_SEGMENTS = new Set([
  'admin', 'careers', 'contact', 'email', 'event', 'events', 'hello', 'help', 'hr',
  'info', 'jobs', 'mail', 'meetup', 'noreply', 'office', 'register', 'registration',
  'sales', 'support', 'team', 'test', 'the', 'user',
])

export function normalizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

export function normalizeEmail(value) {
  return String(value ?? '').trim()
}

export function emailKey(email) {
  return normalizeEmail(email).toLowerCase()
}

function stripDiacritics(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function nameKey(value) {
  return stripDiacritics(value).toLowerCase().replace(/[^a-z]/g, '')
}

function particleKey(token) {
  return String(token ?? '').toLowerCase().replace(/\./g, '')
}

function isParticle(token) {
  return SURNAME_PARTICLES.has(particleKey(token))
}

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
}

function headerRole(cell) {
  return HEADER_ROLES.get(normalizeHeader(cell)) || null
}

export function isValidEmail(email) {
  const value = normalizeEmail(email)
  if (!value || /\s/.test(value)) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function titleCasePiece(piece) {
  const chars = Array.from(piece.toLocaleLowerCase())
  if (!chars.length) return ''
  return chars[0].toLocaleUpperCase() + chars.slice(1).join('')
}

function titleCaseToken(token) {
  return String(token)
    .split('-')
    .map((hyphenPart) =>
      hyphenPart
        .split(/([’'])/)
        .map((part) => (/[’']/.test(part) || part === '' ? part : titleCasePiece(part)))
        .join(''),
    )
    .join('-')
}

function segmentIsPlausible(segment) {
  const pieces = String(segment).split(/[-'’]/).filter(Boolean)
  if (!pieces.length) return false
  const hasApostrophe = /['’]/.test(segment)
  return pieces.every((piece, index) => {
    const ascii = stripDiacritics(piece)
    if (!/^[A-Za-z]+$/.test(ascii)) return false
    if (ascii.length >= 2) return true
    return hasApostrophe && index === 0 && ascii.length === 1
  })
}

function emailLocalSegments(email) {
  const normalized = normalizeEmail(email)
  if (!isValidEmail(normalized)) return null
  const local = normalized.slice(0, normalized.indexOf('@'))
  const ascii = stripDiacritics(local)
  if (!/^[A-Za-z][A-Za-z._'+-]*$/.test(ascii)) return null
  if (/[.]{2}|_{2}/.test(ascii)) return null
  const segments = local.split(/[._]+/).filter(Boolean)
  if (segments.length < 2) return null
  if (segments.some((segment) => !segmentIsPlausible(segment))) return null
  if (segments.some((segment) => GENERIC_EMAIL_SEGMENTS.has(nameKey(segment)))) return null
  return segments
}

function remainderAfterFirstName(segments, target, fromStart) {
  let acc = ''
  const indexes = fromStart
    ? segments.map((_, index) => index)
    : segments.map((_, index) => segments.length - 1 - index)
  for (const index of indexes) {
    const key = nameKey(segments[index])
    if (!key) return null
    const next = fromStart ? acc + key : key + acc
    const matches = fromStart ? target.startsWith(next) : target.endsWith(next)
    if (!matches) return null
    acc = next
    if (acc === target) {
      const remainder = fromStart ? segments.slice(index + 1) : segments.slice(0, index)
      return remainder.length ? remainder : null
    }
  }
  return null
}

function formatSuggestedLastName(segments) {
  if (!segments.length) return null
  if (segments.some((segment) => GENERIC_EMAIL_SEGMENTS.has(nameKey(segment)))) return null
  const lastIsParticle = isParticle(segments[segments.length - 1])
  if (segments.length === 1) {
    if (lastIsParticle) return null
    return titleCaseToken(segments[0])
  }
  for (let index = 0; index < segments.length - 1; index += 1) {
    if (!isParticle(segments[index])) return null
  }
  if (lastIsParticle) return null
  return segments
    .map((segment, index) => (index < segments.length - 1 ? particleKey(segment) : titleCaseToken(segment)))
    .join(' ')
}

/**
 * Suggest a last name only when the mailbox local-part clearly repeats the
 * known first name plus a separate surname, as in josh.phifer@company.com.
 * Ambiguous values such as jp123@gmail.com return null.
 */
export function suggestLastName(firstName, email) {
  const target = nameKey(normalizeName(firstName))
  if (target.length < 2) return null
  const segments = emailLocalSegments(email)
  if (!segments) return null
  const remainder = remainderAfterFirstName(segments, target, true)
    || remainderAfterFirstName(segments, target, false)
  if (!remainder) return null
  const formatted = formatSuggestedLastName(remainder)
  if (!formatted || nameKey(formatted) === target) return null
  return formatted
}

/**
 * Split a full name without treating the final word as the surname whenever
 * the name has three or more parts. Hyphenated tokens stay intact.
 */
export function parseFullName(raw) {
  const cleaned = normalizeName(raw)
  if (!cleaned) {
    return { firstName: '', lastName: '', nameSplitUnclear: false, unparsedName: '' }
  }

  if (cleaned.includes(',')) {
    const parts = cleaned.split(',')
    if (parts.length === 2) {
      const lastName = normalizeName(parts[0])
      const firstName = normalizeName(parts[1])
      if (lastName && firstName) {
        return { firstName, lastName, nameSplitUnclear: false, unparsedName: '' }
      }
    }
    return { firstName: '', lastName: '', nameSplitUnclear: true, unparsedName: cleaned }
  }

  const tokens = cleaned.split(' ').filter(Boolean)
  if (tokens.length === 1) {
    return { firstName: tokens[0], lastName: '', nameSplitUnclear: false, unparsedName: '' }
  }
  if (tokens.length === 2) {
    return { firstName: tokens[0], lastName: tokens[1], nameSplitUnclear: false, unparsedName: '' }
  }

  const startsWithParticle = isParticle(tokens[0])
  const particleIndex = tokens.findIndex((token, index) => index > 0 && isParticle(token))
  if (!startsWithParticle && particleIndex > 0) {
    return {
      firstName: tokens.slice(0, particleIndex).join(' '),
      lastName: tokens.slice(particleIndex).join(' '),
      nameSplitUnclear: false,
      unparsedName: '',
    }
  }

  return { firstName: '', lastName: '', nameSplitUnclear: true, unparsedName: cleaned }
}

function detectDelimiter(text) {
  let inQuotes = false
  let tabs = 0
  let commas = 0
  let semicolons = 0
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        index += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (inQuotes) continue
    if (char === '\n') break
    if (char === '\t') tabs += 1
    else if (char === ',') commas += 1
    else if (char === ';') semicolons += 1
  }
  const best = Math.max(tabs, commas, semicolons)
  if (best === 0) return ','
  if (tabs === best) return '\t'
  if (commas === best) return ','
  return ';'
}

export function parseDelimited(text) {
  const source = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!source.trim()) return []
  const delimiter = detectDelimiter(source)
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function rowHasEmail(row) {
  return row.some((cell) => isValidEmail(normalizeEmail(cell)))
}

export function mappingIsReady(mapping) {
  const counts = {}
  for (const role of mapping || []) {
    if (!role || role === 'ignore') continue
    counts[role] = (counts[role] || 0) + 1
  }
  const duplicate = Object.entries(counts).find(([, count]) => count > 1)
  if (duplicate) {
    return {
      ok: false,
      message: `${ROLE_LABELS[duplicate[0]] || 'A column'} is mapped more than once. Choose each column role once.`,
    }
  }
  if (!counts.email) {
    return { ok: false, message: 'Choose the column that contains email addresses.' }
  }
  if (!counts.firstName && !counts.lastName && !counts.fullName) {
    return { ok: false, message: 'Choose a name column: first name, last name, or full name.' }
  }
  return { ok: true, message: '' }
}

export function columnSummary(headers, mapping) {
  return (mapping || [])
    .map((role, index) => (role && role !== 'ignore' ? `${ROLE_LABELS[role]} (${headers[index]})` : null))
    .filter(Boolean)
    .join(', ')
}

export function parseAttendeeSheet(text) {
  const rows = parseDelimited(text).filter((row) => row.some((cell) => String(cell).trim() !== ''))
  if (!String(text ?? '').trim()) return { error: 'Paste attendee data or choose a CSV file.' }
  if (!rows.length) return { error: 'No attendee rows found.' }

  const knownCount = rows[0].map(headerRole).filter(Boolean).length
  const firstHasEmail = rowHasEmail(rows[0])
  // Only treat the first row as labels when it actually matches a known column.
  // Unrecognized rows stay in the data so a headerless list is not truncated.
  const hasHeader = !firstHasEmail && knownCount > 0

  const dataRows = (hasHeader ? rows.slice(1) : rows).filter((row) => row.some((cell) => String(cell).trim() !== ''))
  if (!dataRows.length) return { error: 'No attendee rows found.' }

  const width = Math.max(...rows.map((row) => row.length))
  const headerRow = hasHeader ? rows[0] : []
  const headers = Array.from({ length: width }, (_, index) => {
    const label = hasHeader ? normalizeName(headerRow[index] || '') : ''
    return label || `Column ${index + 1}`
  })
  const mapping = Array.from({ length: width }, (_, index) => {
    if (!hasHeader) return 'ignore'
    return headerRole(headerRow[index] || '') || 'ignore'
  })
  const ready = mappingIsReady(mapping)

  return {
    headers,
    dataRows,
    hasHeader,
    mapping,
    needsMapping: !ready.ok,
  }
}

function mappedValues(cells, mapping) {
  const values = { firstName: '', lastName: '', fullName: '', email: '' }
  mapping.forEach((role, index) => {
    if (!role || role === 'ignore' || values[role]) return
    const cell = cells[index] ?? ''
    values[role] = role === 'email' ? normalizeEmail(cell) : normalizeName(cell)
  })
  return values
}

function namesFromMapped(values) {
  if (values.firstName || values.lastName) {
    return {
      firstName: values.firstName,
      lastName: values.lastName,
      nameSplitUnclear: false,
      unparsedName: '',
    }
  }
  if (values.fullName) return parseFullName(values.fullName)
  return { firstName: '', lastName: '', nameSplitUnclear: false, unparsedName: '' }
}

function attendeeFromCells(cells, mapping, id) {
  const values = mappedValues(cells, mapping)
  if (!values.firstName && !values.lastName && !values.fullName && !values.email) return null
  const names = namesFromMapped(values)
  const suggestion = names.lastName ? null : suggestLastName(names.firstName, values.email)
  return {
    id,
    firstName: names.firstName,
    lastName: names.lastName,
    email: values.email,
    suggestion,
    dismissedSuggestion: null,
    nameSplitUnclear: names.nameSplitUnclear,
    unparsedName: names.unparsedName,
  }
}

export function buildAttendees(dataRows, mapping, options = {}) {
  const sourceId = options.sourceId || ''
  const sourceName = options.sourceName || ''
  const idPrefix = options.idPrefix || sourceId || 'attendee'
  const attendees = []
  dataRows.forEach((cells, index) => {
    const attendee = attendeeFromCells(cells, mapping, `${idPrefix}-${index + 1}`)
    if (!attendee) return
    attendees.push({ ...attendee, sourceId, sourceName })
  })
  return attendees
}

export function createSource(text, { id, name, kind = 'file' } = {}) {
  const base = {
    id,
    name,
    kind,
    parsedText: text,
    sheet: null,
    mapping: [],
    appliedMapping: null,
    status: 'error',
    error: '',
  }
  const sheet = parseAttendeeSheet(text)
  if (sheet.error) {
    return { source: { ...base, error: sheet.error }, attendees: [] }
  }
  const attendees = buildAttendees(sheet.dataRows, sheet.mapping, { sourceId: id, sourceName: name })
  if (!mappingIsReady(sheet.mapping).ok) {
    return {
      source: {
        ...base,
        sheet,
        mapping: sheet.mapping.slice(),
        status: 'needs-mapping',
        error: '',
      },
      attendees: [],
    }
  }
  if (!attendees.length) {
    return {
      source: {
        ...base,
        sheet,
        mapping: sheet.mapping.slice(),
        error: 'No attendee rows found.',
      },
      attendees: [],
    }
  }
  return {
    source: {
      ...base,
      sheet,
      mapping: sheet.mapping.slice(),
      appliedMapping: sheet.mapping.slice(),
      status: 'imported',
      error: '',
    },
    attendees,
  }
}

export function integrateSources(sources, attendees, entries) {
  let nextSources = sources.slice()
  let nextAttendees = attendees
  let activateId = null
  for (const entry of entries) {
    const created = createSource(entry.text, {
      id: entry.id,
      name: entry.name,
      kind: entry.kind,
    })
    const index = nextSources.findIndex((source) => source.id === entry.id)
    if (index >= 0) nextSources[index] = created.source
    else nextSources.push(created.source)
    nextAttendees = nextAttendees
      .filter((row) => row.sourceId !== entry.id)
      .concat(created.attendees)
    if (!activateId && created.source.status === 'needs-mapping') activateId = created.source.id
  }
  return { sources: nextSources, attendees: nextAttendees, activateId }
}

export function applySourceMapping(sources, attendees, sourceId, mapping) {
  const ready = mappingIsReady(mapping)
  if (!ready.ok) return { ok: false, message: ready.message, sources, attendees }
  const source = sources.find((item) => item.id === sourceId)
  if (!source?.sheet) {
    return { ok: false, message: 'That file could not be read.', sources, attendees }
  }
  const built = buildAttendees(source.sheet.dataRows, mapping, {
    sourceId: source.id,
    sourceName: source.name,
  })
  if (!built.length) {
    return { ok: false, message: 'No attendee rows found in the mapped columns.', sources, attendees }
  }
  return {
    ok: true,
    message: '',
    sources: sources.map((item) => (
      item.id === sourceId
        ? {
          ...item,
          mapping: mapping.slice(),
          appliedMapping: mapping.slice(),
          status: 'imported',
          error: '',
        }
        : item
    )),
    attendees: attendees.filter((row) => row.sourceId !== sourceId).concat(built),
  }
}

export function dropSource(sources, attendees, sourceId) {
  const removed = sources.find((source) => source.id === sourceId)
  return {
    sources: sources.filter((source) => source.id !== sourceId),
    attendees: attendees
      .filter((row) => row.sourceId !== sourceId)
      .map((row) => stripSourceName(row, removed?.name)),
  }
}

export function updateAttendee(attendee, patch) {
  const next = { ...attendee }
  if (Object.prototype.hasOwnProperty.call(patch, 'firstName')) {
    next.firstName = normalizeName(patch.firstName)
    next.nameSplitUnclear = false
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'lastName')) {
    next.lastName = normalizeName(patch.lastName)
    next.nameSplitUnclear = false
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'email')) {
    next.email = normalizeEmail(patch.email)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'dismissedSuggestion')) {
    next.dismissedSuggestion = patch.dismissedSuggestion
  }
  if (!next.lastName) {
    const proposed = suggestLastName(next.firstName, next.email)
    next.suggestion = proposed && proposed !== next.dismissedSuggestion ? proposed : null
  } else {
    next.suggestion = null
  }
  return next
}

export function acceptSuggestion(attendee, rawValue) {
  const value = normalizeName(rawValue == null ? attendee.suggestion : rawValue)
  if (!value) return attendee
  return updateAttendee(attendee, { lastName: value, dismissedSuggestion: null })
}

export function dismissSuggestion(attendee) {
  if (!attendee.suggestion) return attendee
  return {
    ...attendee,
    suggestion: null,
    dismissedSuggestion: attendee.suggestion,
  }
}

export function duplicateEmailKeys(attendees) {
  const counts = new Map()
  for (const attendee of attendees) {
    const key = emailKey(attendee.email)
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key))
}

export function keepAttendeeRow(attendees, id) {
  const chosen = attendees.find((attendee) => attendee.id === id)
  if (!chosen) return attendees
  const key = emailKey(chosen.email)
  if (!key) return attendees
  return attendees.filter((attendee) => attendee.id === id || emailKey(attendee.email) !== key)
}

function fieldCompare(field, value) {
  const normalized = field === 'email' ? normalizeEmail(value) : normalizeName(value)
  return field === 'email' ? normalized : normalized.toLocaleLowerCase()
}

function distinctFieldOptions(rows, field) {
  const options = []
  for (const row of rows) {
    const value = field === 'email' ? normalizeEmail(row.email) : normalizeName(row[field])
    const compare = fieldCompare(field, value)
    const source = row.sourceName || PASTE_SOURCE_NAME
    const existing = options.find((option) => option.compare === compare)
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source)
    } else {
      options.push({ value, compare, sources: [source] })
    }
  }
  return options
}

export function conflictingDuplicateGroups(attendees) {
  const groups = new Map()
  for (const attendee of attendees) {
    const key = emailKey(attendee.email)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(attendee)
  }
  const conflicts = []
  for (const [key, rows] of groups) {
    if (rows.length < 2) continue
    const fields = {
      firstName: distinctFieldOptions(rows, 'firstName'),
      lastName: distinctFieldOptions(rows, 'lastName'),
      email: distinctFieldOptions(rows, 'email'),
    }
    if (fields.firstName.length < 2 && fields.lastName.length < 2 && fields.email.length < 2) continue
    conflicts.push({ emailKey: key, rows, fields })
  }
  return conflicts
}

export function keepChosenDetails(attendees, key, choice) {
  const matches = attendees.filter((attendee) => emailKey(attendee.email) === key)
  if (!matches.length) return attendees
  const choiceFirst = fieldCompare('firstName', choice.firstName)
  const choiceLast = fieldCompare('lastName', choice.lastName)
  const choiceEmail = fieldCompare('email', choice.email)
  const exact = matches.find((row) => (
    fieldCompare('firstName', row.firstName) === choiceFirst
    && fieldCompare('lastName', row.lastName) === choiceLast
    && fieldCompare('email', row.email) === choiceEmail
  ))
  const keeper = exact || matches[0]
  const sourceNames = []
  for (const field of ['firstName', 'lastName', 'email']) {
    const wanted = field === 'firstName' ? choiceFirst : field === 'lastName' ? choiceLast : choiceEmail
    for (const row of matches) {
      if (fieldCompare(field, row[field]) !== wanted) continue
      const source = row.sourceName || PASTE_SOURCE_NAME
      if (!sourceNames.includes(source)) sourceNames.push(source)
    }
  }
  const updated = {
    ...updateAttendee(keeper, {
      firstName: choice.firstName,
      lastName: choice.lastName,
      email: choice.email,
    }),
    sourceId: keeper.sourceId,
    sourceName: sourceNames.join(', ') || keeper.sourceName,
  }
  return attendees
    .filter((attendee) => attendee.id === keeper.id || emailKey(attendee.email) !== key)
    .map((attendee) => (attendee.id === keeper.id ? updated : attendee))
}

function stripSourceName(attendee, removedName) {
  if (!removedName || !attendee.sourceName) return attendee
  const names = attendee.sourceName.split(', ').filter((name) => name !== removedName)
  if (names.length === attendee.sourceName.split(', ').length) return attendee
  return { ...attendee, sourceName: names.join(', ') }
}

export function getReviewFlags(attendee, duplicateKeys, conflictingKeys = new Set()) {
  const flags = []
  if (!attendee.firstName) flags.push({ id: 'missing-first', label: 'Missing first name', tone: 'warning' })
  if (!attendee.lastName) flags.push({ id: 'missing-last', label: 'Missing last name', tone: 'warning' })
  if (!normalizeEmail(attendee.email)) flags.push({ id: 'missing-email', label: 'Missing email', tone: 'warning' })
  else if (!isValidEmail(attendee.email)) flags.push({ id: 'invalid-email', label: 'Invalid email', tone: 'warning' })
  const key = emailKey(attendee.email)
  if (key && duplicateKeys.has(key)) {
    flags.push({
      id: 'duplicate',
      label: conflictingKeys.has(key) ? 'Conflicting details' : 'Duplicate email',
      tone: 'alert',
    })
  }
  if (attendee.nameSplitUnclear) flags.push({ id: 'split', label: 'Check name split', tone: 'warning' })
  if (attendee.suggestion) flags.push({ id: 'suggestion', label: 'Pending suggestion', tone: 'info' })
  return flags
}

export function rowMissingInformation(attendee) {
  if (!attendee.firstName || !attendee.lastName) return true
  if (!normalizeEmail(attendee.email) || !isValidEmail(attendee.email)) return true
  return false
}

export function rowNeedsReview(attendee, duplicateKeys) {
  return getReviewFlags(attendee, duplicateKeys).length > 0
}

export function summarizeAttendees(attendees) {
  const duplicates = duplicateEmailKeys(attendees)
  let missingInformation = 0
  let pendingSuggestions = 0
  let needsReview = 0
  for (const attendee of attendees) {
    if (rowMissingInformation(attendee)) missingInformation += 1
    if (attendee.suggestion) pendingSuggestions += 1
    if (rowNeedsReview(attendee, duplicates)) needsReview += 1
  }
  return {
    total: attendees.length,
    duplicateEmails: duplicates.size,
    missingInformation,
    pendingSuggestions,
    needsReview,
  }
}

function compareName(left, right) {
  const a = normalizeName(left)
  const b = normalizeName(right)
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

export function sortAttendees(attendees, sortBy = SORT_BY_FIRST_NAME) {
  const primary = sortBy === SORT_BY_LAST_NAME ? 'lastName' : 'firstName'
  const secondary = primary === 'firstName' ? 'lastName' : 'firstName'
  return [...attendees].sort((a, b) => {
    const byPrimary = compareName(a[primary], b[primary])
    if (byPrimary) return byPrimary
    const bySecondary = compareName(a[secondary], b[secondary])
    if (bySecondary) return bySecondary
    return compareName(a.email, b.email)
  })
}

export function previewAttendees(attendees, { sortBy = SORT_BY_FIRST_NAME, needsReviewOnly = false } = {}) {
  const sorted = sortAttendees(attendees, sortBy)
  if (!needsReviewOnly) return sorted
  const duplicates = duplicateEmailKeys(attendees)
  return sorted.filter((attendee) => rowNeedsReview(attendee, duplicates))
}

export function exportStatus(attendees) {
  if (!attendees.length) {
    return { ok: false, reason: 'Add at least one attendee before exporting.' }
  }
  const duplicateEmails = duplicateEmailKeys(attendees).size
  if (duplicateEmails) {
    const noun = duplicateEmails === 1 ? 'address' : 'addresses'
    return {
      ok: false,
      reason: `Resolve ${duplicateEmails} duplicate email ${noun} before exporting. Choose which details to keep, or remove the extra rows.`,
    }
  }
  return { ok: true, reason: '' }
}

function exportFields(attendee) {
  return [attendee.firstName, attendee.lastName, attendee.email]
}

function escapeCsvField(value) {
  const text = String(value ?? '')
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function escapeTsvField(value) {
  return String(value ?? '').replace(/[\t\r\n]+/g, ' ')
}

function formatCsv(attendees) {
  const lines = [OUTPUT_COLUMNS.map(escapeCsvField).join(',')]
  for (const attendee of attendees) {
    lines.push(exportFields(attendee).map(escapeCsvField).join(','))
  }
  return `${lines.join('\r\n')}\r\n`
}

function formatTsv(attendees) {
  const lines = [OUTPUT_COLUMNS.map(escapeTsvField).join('\t')]
  for (const attendee of attendees) {
    lines.push(exportFields(attendee).map(escapeTsvField).join('\t'))
  }
  return lines.join('\n')
}

export function buildExport(attendees, sortBy = SORT_BY_FIRST_NAME) {
  const status = exportStatus(attendees)
  if (!status.ok) return { ok: false, reason: status.reason, csv: '', tsv: '' }
  const sorted = sortAttendees(attendees, sortBy)
  return { ok: true, reason: '', csv: formatCsv(sorted), tsv: formatTsv(sorted) }
}
