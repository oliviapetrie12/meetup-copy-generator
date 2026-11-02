import { describe, expect, it } from 'vitest'
import {
  OUTPUT_COLUMNS,
  PASTE_SOURCE_NAME,
  SORT_BY_FIRST_NAME,
  SORT_BY_LAST_NAME,
  acceptSuggestion,
  applySourceMapping,
  buildAttendees,
  buildExport,
  conflictingDuplicateGroups,
  dismissSuggestion,
  dropSource,
  duplicateEmailKeys,
  emailKey,
  exportStatus,
  integrateSources,
  keepAttendeeRow,
  keepChosenDetails,
  mappingIsReady,
  parseAttendeeSheet,
  parseFullName,
  previewAttendees,
  suggestLastName,
  summarizeAttendees,
  updateAttendee,
} from './attendeeListFormatter.js'

function rowsFrom(text, mapping) {
  const sheet = parseAttendeeSheet(text)
  expect(sheet.error).toBeUndefined()
  return buildAttendees(sheet.dataRows, mapping || sheet.mapping)
}

describe('attendee sheet parsing', () => {
  it('detects common name and email headers and ignores extra columns', () => {
    const sheet = parseAttendeeSheet([
      'First Name,Last Name,Email Address,Company',
      'Mary-Jane,Watson-Parker,mary@company.com,Elastic',
    ].join('\n'))
    expect(sheet.needsMapping).toBe(false)
    expect(sheet.mapping).toEqual(['firstName', 'lastName', 'email', 'ignore'])
    const [row] = buildAttendees(sheet.dataRows, sheet.mapping)
    expect(row).toMatchObject({
      firstName: 'Mary-Jane',
      lastName: 'Watson-Parker',
      email: 'mary@company.com',
      suggestion: null,
    })
  })

  it.each([
    ['Name,Email', 'fullName'],
    ['Full Name,Email', 'fullName'],
    ['E-mail Address,Name', 'email'],
  ])('recognizes %s', (header, role) => {
    const sheet = parseAttendeeSheet(`${header}\nJosh Phifer,josh@company.com`)
    expect(sheet.needsMapping).toBe(false)
    expect(sheet.mapping).toContain(role)
  })

  it('parses quoted commas, escaped quotes, and spreadsheet tabs', () => {
    const csv = rowsFrom([
      'Name,Email',
      '"García-López, José Luis",jose@company.com',
      '"Anne ""N"" Smith",anne@company.com',
    ].join('\n'))
    expect(csv[0]).toMatchObject({ firstName: 'José Luis', lastName: 'García-López' })
    expect(csv[1].nameSplitUnclear).toBe(true)
    expect(csv[1].unparsedName).toBe('Anne "N" Smith')

    const tsv = rowsFrom('Full Name\tEmail Address\nMary-Jane Watson-Parker\tmary@company.com')
    expect(tsv[0]).toMatchObject({ firstName: 'Mary-Jane', lastName: 'Watson-Parker' })
  })

  it('asks for a mapping when headers are missing or ambiguous', () => {
    const headerless = parseAttendeeSheet('Josh Phifer,josh.phifer@company.com')
    expect(headerless.needsMapping).toBe(true)
    expect(headerless.hasHeader).toBe(false)
    expect(headerless.headers).toEqual(['Column 1', 'Column 2'])

    const unknown = parseAttendeeSheet('Company,Ticket\nElastic,VIP')
    expect(unknown.needsMapping).toBe(true)
    expect(unknown.mapping).toEqual(['ignore', 'ignore'])

    const collision = parseAttendeeSheet('Email,Email Address\na@x.com,b@x.com')
    expect(collision.needsMapping).toBe(true)
    expect(mappingIsReady(collision.mapping).ok).toBe(false)

    const mapped = buildAttendees(headerless.dataRows, ['fullName', 'email'])
    expect(mapped[0]).toMatchObject({ firstName: 'Josh', lastName: 'Phifer' })

    const headerlessPeople = parseAttendeeSheet('Josh Phifer,Organizer\nAmy Lee,amy@company.com')
    expect(headerlessPeople.hasHeader).toBe(false)
    expect(headerlessPeople.dataRows).toHaveLength(2)
  })

  it('trims whitespace without turning internal email spaces into a valid address', () => {
    const [row] = rowsFrom('Name,Email\n  Josh   Phifer  ,  Josh.Phifer@X.com  ')
    expect(row.firstName).toBe('Josh')
    expect(row.lastName).toBe('Phifer')
    expect(row.email).toBe('Josh.Phifer@X.com')
    expect(emailKey(`  ${row.email}  `)).toBe('josh.phifer@x.com')
  })
})

describe('name parsing', () => {
  it('preserves hyphenated names and does not take the last word as the surname', () => {
    expect(parseFullName('Mary-Jane Watson-Parker')).toEqual({
      firstName: 'Mary-Jane',
      lastName: 'Watson-Parker',
      nameSplitUnclear: false,
      unparsedName: '',
    })
    expect(parseFullName('José Luis García-López')).toMatchObject({
      firstName: '',
      lastName: '',
      nameSplitUnclear: true,
      unparsedName: 'José Luis García-López',
    })
    expect(parseFullName('Mary Ann Smith').lastName).not.toBe('Smith')
    expect(parseFullName('Anna van der Berg')).toMatchObject({
      firstName: 'Anna',
      lastName: 'van der Berg',
    })
    expect(parseFullName('van der Berg')).toMatchObject({
      nameSplitUnclear: true,
      unparsedName: 'van der Berg',
    })
  })

  it('keeps an explicit first-name column intact', () => {
    const [row] = rowsFrom('First Name,Last Name,Email\nMary Ann,,mary@x.com')
    expect(row.firstName).toBe('Mary Ann')
    expect(row.lastName).toBe('')
    expect(row.nameSplitUnclear).toBe(false)
  })
})

describe('last-name suggestions', () => {
  it('suggests a clear surname and leaves ambiguous emails alone', () => {
    expect(suggestLastName('Josh', 'josh.phifer@company.com')).toBe('Phifer')
    expect(suggestLastName('Josh', 'JOSH.PHIFER@company.com')).toBe('Phifer')
    expect(suggestLastName('Josh', 'phifer.josh@company.com')).toBe('Phifer')
    expect(suggestLastName('Josh', 'josh_phifer@company.com')).toBe('Phifer')
    expect(suggestLastName('Mary Ann', 'mary.ann.smith@company.com')).toBe('Smith')
    expect(suggestLastName('Mary-Jane', 'mary-jane.watson@company.com')).toBe('Watson')
    expect(suggestLastName('Anna', 'anna.van.der.berg@company.com')).toBe('van der Berg')
    expect(suggestLastName('José', 'josé.garcía@company.com')).toBe('García')
    expect(suggestLastName('Josh', "josh.o'brien@company.com")).toBe("O'Brien")

    for (const [first, email] of [
      ['Josh', 'jp123@gmail.com'],
      ['Josh', 'j.phifer@gmail.com'],
      ['Josh', 'josh.p@gmail.com'],
      ['Josh', 'josh@company.com'],
      ['Josh', 'joshphifer@gmail.com'],
      ['Josh', 'jsmith@gmail.com'],
      ['Josh', 'info@company.com'],
      ['Josh', 'josh.info@company.com'],
      ['Josh', 'josh.phifer+list@company.com'],
      ['Josh', 'josh.phifer2@company.com'],
      ['Pat', 'josh.phifer@company.com'],
      ['J', 'j.phifer@company.com'],
    ]) {
      expect(suggestLastName(first, email), email).toBeNull()
    }
  })

  it('keeps an unaccepted suggestion out of the exported last name', () => {
    const [row] = rowsFrom('First Name,Email\nJosh,josh.phifer@company.com')
    expect(row.suggestion).toBe('Phifer')
    expect(row.lastName).toBe('')

    const pending = buildExport([row])
    expect(pending.ok).toBe(true)
    expect(pending.csv).toBe('First Name,Last Name,Email\r\nJosh,,josh.phifer@company.com\r\n')
    expect(pending.tsv).toBe('First Name\tLast Name\tEmail\nJosh\t\tjosh.phifer@company.com')
    expect(pending.csv).not.toContain('Unconfirmed')
    expect(pending.csv.split('\r\n')[1].split(',')[1]).toBe('')

    const accepted = acceptSuggestion(row)
    expect(buildExport([accepted]).csv.split('\r\n')[1]).toBe('Josh,Phifer,josh.phifer@company.com')

    const edited = acceptSuggestion(row, 'Fifer')
    expect(buildExport([edited]).csv.split('\r\n')[1]).toBe('Josh,Fifer,josh.phifer@company.com')

    const dismissed = dismissSuggestion(row)
    expect(dismissed.suggestion).toBeNull()
    expect(dismissed.lastName).toBe('')
    expect(buildExport([dismissed]).csv.split('\r\n')[1].split(',')[1]).toBe('')
    expect(updateAttendee(dismissed, { email: dismissed.email }).suggestion).toBeNull()
  })
})

describe('duplicates, review, and sorting', () => {
  it('keeps conflicting duplicate emails until the user resolves them', () => {
    const attendees = rowsFrom('Email,Name\nJosh@Company.com,Josh Phifer\njosh@company.com,Joshua Phifer')
    expect(attendees).toHaveLength(2)
    expect(attendees.map((row) => row.firstName).sort()).toEqual(['Josh', 'Joshua'])
    expect(duplicateEmailKeys(attendees)).toEqual(new Set(['josh@company.com']))
    expect(exportStatus(attendees).ok).toBe(false)
    expect(buildExport(attendees)).toMatchObject({ ok: false, csv: '', tsv: '' })

    const kept = keepAttendeeRow(attendees, attendees[1].id)
    expect(kept).toHaveLength(1)
    expect(kept[0].firstName).toBe('Joshua')
    expect(buildExport(kept).ok).toBe(true)
  })

  it('does not treat blank emails as duplicates and still flags invalid ones', () => {
    const attendees = rowsFrom('First Name,Last Name,Email\nAmy,Lee,\nBo,Ng,\nCy,Wu,not-an-email')
    expect(duplicateEmailKeys(attendees).size).toBe(0)
    expect(exportStatus(attendees).ok).toBe(true)
    const summary = summarizeAttendees(attendees)
    expect(summary.total).toBe(3)
    expect(summary.duplicateEmails).toBe(0)
    expect(summary.missingInformation).toBe(3)
    expect(summary.needsReview).toBe(3)
  })

  it('sorts by the chosen name, uses the other name second, and puts missing names last', () => {
    const attendees = rowsFrom([
      'First Name,Last Name,Email',
      'Zoe,Adams,z@x.com',
      'amy,Baker,a@x.com',
      ',Yates,y@x.com',
      'Amy,,b@x.com',
    ].join('\n'))

    expect(previewAttendees(attendees, { sortBy: SORT_BY_FIRST_NAME }).map((row) => [row.firstName, row.lastName])).toEqual([
      ['amy', 'Baker'],
      ['Amy', ''],
      ['Zoe', 'Adams'],
      ['', 'Yates'],
    ])
    expect(previewAttendees(attendees, { sortBy: SORT_BY_LAST_NAME }).map((row) => [row.firstName, row.lastName])).toEqual([
      ['Zoe', 'Adams'],
      ['amy', 'Baker'],
      ['', 'Yates'],
      ['Amy', ''],
    ])
  })

  it('counts pending suggestions separately from exported columns', () => {
    const attendees = rowsFrom([
      'First Name,Last Name,Email',
      'Josh,,josh.phifer@company.com',
      'Amy,Baker,amy@company.com',
    ].join('\n'))
    const summary = summarizeAttendees(attendees)
    expect(summary).toMatchObject({
      total: 2,
      duplicateEmails: 0,
      missingInformation: 1,
      pendingSuggestions: 1,
      needsReview: 1,
    })
    const review = previewAttendees(attendees, { needsReviewOnly: true })
    expect(review.map((row) => row.firstName)).toEqual(['Josh'])
    const exported = buildExport(attendees, SORT_BY_FIRST_NAME)
    expect(exported.csv.startsWith(OUTPUT_COLUMNS.join(','))).toBe(true)
    expect(exported.csv).not.toContain('Pending')
    expect(exported.csv).not.toContain('Missing')
    expect(exported.tsv.startsWith('First Name\tLast Name\tEmail')).toBe(true)
  })
})

describe('csv escaping', () => {
  it('quotes commas, quotes, and newlines without adding review columns', () => {
    const attendees = [{
      id: 'attendee-1',
      firstName: 'Anne "N"',
      lastName: 'Doe, Jr.',
      email: 'anne@company.com',
      suggestion: 'Ignored',
      dismissedSuggestion: null,
      nameSplitUnclear: true,
      unparsedName: 'should not export',
      sourceName: 'secret.csv',
    }]
    const csv = buildExport(attendees).csv
    expect(csv).toBe('First Name,Last Name,Email\r\n"Anne ""N""","Doe, Jr.",anne@company.com\r\n')
    expect(csv).not.toContain('Ignored')
    expect(csv).not.toContain('should not export')
    expect(csv).not.toContain('secret.csv')
    expect(buildExport(attendees).tsv).not.toContain('secret.csv')
  })
})

describe('multiple registration files', () => {
  it('maps each file separately, appends later files, and sorts the combined list', () => {
    const first = integrateSources([], [], [{
      id: 'file-1',
      name: 'meetup.csv',
      kind: 'file',
      text: 'Name,Email\nZoe Adams,zoe@x.com\nAmy Baker,amy@x.com',
    }])
    const both = integrateSources(first.sources, first.attendees, [{
      id: 'file-2',
      name: 'luma.csv',
      kind: 'file',
      text: 'First Name,Last Name,Email\n,Yates,y@x.com',
    }])
    const third = integrateSources(both.sources, both.attendees, [{
      id: 'file-3',
      name: 'eventbrite.csv',
      kind: 'file',
      text: 'Email Address,Full Name\nbea@x.com,Bea Chen',
    }])

    expect(first.sources[0].mapping).not.toEqual(both.sources[1].mapping)
    expect(third.sources.map((source) => source.name)).toEqual(['meetup.csv', 'luma.csv', 'eventbrite.csv'])
    expect(third.attendees.filter((row) => row.sourceName === 'meetup.csv')).toHaveLength(2)
    expect(previewAttendees(third.attendees, { sortBy: SORT_BY_FIRST_NAME }).map((row) => [row.firstName, row.lastName, row.sourceName])).toEqual([
      ['Amy', 'Baker', 'meetup.csv'],
      ['Bea', 'Chen', 'eventbrite.csv'],
      ['Zoe', 'Adams', 'meetup.csv'],
      ['', 'Yates', 'luma.csv'],
    ])
    expect(previewAttendees(third.attendees, { sortBy: SORT_BY_LAST_NAME })[0].lastName).toBe('Adams')
  })

  it('waits for a file with its own mapping without clearing rows already imported', () => {
    const imported = integrateSources([], [], [{
      id: 'file-1',
      name: 'meetup.csv',
      kind: 'file',
      text: 'First Name,Last Name,Email\nAda,Lovelace,ada@x.com',
    }])
    const waiting = integrateSources(imported.sources, imported.attendees, [{
      id: 'file-2',
      name: 'mystery.csv',
      kind: 'file',
      text: 'Person,Contact\nGrace Hopper,grace@x.com',
    }])
    expect(waiting.activateId).toBe('file-2')
    expect(waiting.attendees).toHaveLength(1)
    expect(waiting.sources.find((source) => source.id === 'file-2').status).toBe('needs-mapping')

    const applied = applySourceMapping(
      waiting.sources,
      waiting.attendees,
      'file-2',
      ['fullName', 'email'],
    )
    expect(applied.ok).toBe(true)
    expect(applied.attendees.filter((row) => row.sourceName === 'meetup.csv')).toHaveLength(1)
    expect(applied.attendees.find((row) => row.email === 'ada@x.com').firstName).toBe('Ada')
    expect(applied.attendees.find((row) => row.email === 'grace@x.com')).toMatchObject({
      firstName: 'Grace',
      lastName: 'Hopper',
      sourceName: 'mystery.csv',
    })
    expect(applied.sources.find((source) => source.id === 'file-1').appliedMapping).toEqual(imported.sources[0].appliedMapping)
  })

  it('finds duplicate emails across files and pasted rows and keeps the chosen details', () => {
    const files = integrateSources([], [], [{
      id: 'file-1',
      name: 'meetup.csv',
      kind: 'file',
      text: 'First Name,Last Name,Email\nJosh,Phifer,Josh@Company.com',
    }])
    const combined = integrateSources(files.sources, files.attendees, [{
      id: 'paste-1',
      name: PASTE_SOURCE_NAME,
      kind: 'paste',
      text: 'Email,Name\njosh@company.com,Joshua Phifer',
    }])
    expect(duplicateEmailKeys(combined.attendees)).toEqual(new Set(['josh@company.com']))
    expect(exportStatus(combined.attendees).ok).toBe(false)

    const [group] = conflictingDuplicateGroups(combined.attendees)
    expect(group.fields.firstName.map((option) => option.value).sort()).toEqual(['Josh', 'Joshua'])
    const kept = keepChosenDetails(combined.attendees, group.emailKey, {
      firstName: 'Joshua',
      lastName: 'Phifer',
      email: 'Josh@Company.com',
    })
    expect(kept).toHaveLength(1)
    expect(kept[0]).toMatchObject({
      firstName: 'Joshua',
      lastName: 'Phifer',
      email: 'Josh@Company.com',
    })
    expect(kept[0].sourceName).toContain('meetup.csv')
    expect(kept[0].sourceName).toContain(PASTE_SOURCE_NAME)

    const exported = buildExport(kept)
    expect(exported.csv).toBe('First Name,Last Name,Email\r\nJoshua,Phifer,Josh@Company.com\r\n')
    expect(exported.csv).not.toContain('meetup.csv')
    expect(exported.tsv).not.toContain(PASTE_SOURCE_NAME)

    const replacedPaste = integrateSources(combined.sources, combined.attendees, [{
      id: 'paste-1',
      name: PASTE_SOURCE_NAME,
      kind: 'paste',
      text: 'First Name,Last Name,Email\nBea,Chen,bea@x.com',
    }])
    expect(replacedPaste.attendees.find((row) => row.sourceName === 'meetup.csv').email).toBe('Josh@Company.com')
    expect(replacedPaste.attendees.find((row) => row.email === 'bea@x.com').sourceName).toBe(PASTE_SOURCE_NAME)
    expect(replacedPaste.attendees.some((row) => row.sourceId === 'paste-1' && row.firstName === 'Joshua')).toBe(false)
  })

  it('still requires a choice when duplicate rows match, and removing a file drops only its rows', () => {
    const first = integrateSources([], [], [{
      id: 'file-1',
      name: 'one.csv',
      kind: 'file',
      text: 'First Name,Last Name,Email\nAmy,Baker,amy@x.com\nJosh,,josh.phifer@company.com',
    }])
    const second = integrateSources(first.sources, first.attendees, [{
      id: 'file-2',
      name: 'two.csv',
      kind: 'file',
      text: 'First Name,Last Name,Email\nAmy,Baker,amy@x.com',
    }])
    expect(duplicateEmailKeys(second.attendees)).toEqual(new Set(['amy@x.com']))
    expect(conflictingDuplicateGroups(second.attendees)).toEqual([])
    expect(exportStatus(second.attendees).ok).toBe(false)
    expect(second.attendees.find((row) => row.firstName === 'Josh').suggestion).toBe('Phifer')
    expect(buildExport([second.attendees.find((row) => row.firstName === 'Josh')]).csv).not.toContain('Phifer')

    const kept = keepAttendeeRow(second.attendees, second.attendees.find((row) => row.sourceName === 'two.csv').id)
    expect(kept.filter((row) => emailKey(row.email) === 'amy@x.com')).toHaveLength(1)
    expect(buildExport(kept).ok).toBe(true)

    const removed = dropSource(second.sources, second.attendees, 'file-2')
    expect(removed.sources.map((source) => source.name)).toEqual(['one.csv'])
    expect(removed.attendees.map((row) => row.sourceName)).toEqual(['one.csv', 'one.csv'])
  })

  it('keeps an unconfirmed suggestion off the export after a blank last name is chosen', () => {
    const combined = integrateSources([], [], [
      {
        id: 'file-1',
        name: 'meetup.csv',
        kind: 'file',
        text: 'First Name,Last Name,Email\nJosh,,josh.phifer@company.com',
      },
      {
        id: 'file-2',
        name: 'luma.csv',
        kind: 'file',
        text: 'First Name,Last Name,Email\nJoshua,Phifer,josh.phifer@company.com',
      },
    ])
    const kept = keepChosenDetails(combined.attendees, 'josh.phifer@company.com', {
      firstName: 'Josh',
      lastName: '',
      email: 'josh.phifer@company.com',
    })
    expect(kept).toHaveLength(1)
    expect(kept[0].suggestion).toBe('Phifer')
    expect(kept[0].lastName).toBe('')
    const exported = buildExport(kept)
    expect(exported.csv).toBe('First Name,Last Name,Email\r\nJosh,,josh.phifer@company.com\r\n')
    expect(exported.csv).not.toContain('meetup.csv')
    expect(exported.csv).not.toContain('luma.csv')
  })
})
