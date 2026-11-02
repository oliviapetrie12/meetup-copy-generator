import { useEffect, useMemo, useRef, useState } from 'react'
import {
  COLUMN_ROLE_OPTIONS,
  PASTE_SOURCE_NAME,
  SORT_BY_FIRST_NAME,
  SORT_BY_LAST_NAME,
  acceptSuggestion,
  applySourceMapping,
  buildExport,
  columnSummary,
  conflictingDuplicateGroups,
  dismissSuggestion,
  dropSource,
  duplicateEmailKeys,
  emailKey,
  exportStatus,
  getReviewFlags,
  integrateSources,
  isValidEmail,
  keepAttendeeRow,
  keepChosenDetails,
  mappingIsReady,
  normalizeEmail,
  previewAttendees,
  summarizeAttendees,
  updateAttendee,
} from './attendeeListFormatter.js'
import {
  ConfirmResetDialog,
  EmptyState,
  FieldLabel,
  FormSection,
  GeneratorActions,
  GeneratorHeader,
  SegmentedControl,
} from './components/generatorUi.jsx'

const DETAIL_FIELDS = [
  { id: 'firstName', label: 'First name' },
  { id: 'lastName', label: 'Last name' },
  { id: 'email', label: 'Email' },
]

/**
 * Spreadsheet cleanup for attendee lists. Rows stay in component state for
 * this tab only and are never written to storage, logs, or analytics.
 */
export default function AttendeeListFormatter() {
  const [pasteText, setPasteText] = useState('')
  const [sources, setSources] = useState([])
  const [attendees, setAttendees] = useState([])
  const [activeSourceId, setActiveSourceId] = useState(null)
  const [mappingOpen, setMappingOpen] = useState(false)
  const [remappingId, setRemappingId] = useState(null)
  const [sortBy, setSortBy] = useState(SORT_BY_FIRST_NAME)
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false)
  const [parseError, setParseError] = useState('')
  const [mappingError, setMappingError] = useState('')
  const [copied, setCopied] = useState(false)
  const [exportError, setExportError] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [detailChoices, setDetailChoices] = useState({})
  const fileRef = useRef(null)
  const copyTimer = useRef(null)
  const sourceSeq = useRef(0)
  const sourcesRef = useRef([])
  const attendeesRef = useRef([])

  const commitList = (nextSources, nextAttendees) => {
    sourcesRef.current = nextSources
    attendeesRef.current = nextAttendees
    setSources(nextSources)
    setAttendees(nextAttendees)
  }

  useEffect(() => () => {
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
  }, [])

  const duplicateKeys = useMemo(() => duplicateEmailKeys(attendees), [attendees])
  const conflictGroups = useMemo(() => conflictingDuplicateGroups(attendees), [attendees])
  const conflictingKeys = useMemo(
    () => new Set(conflictGroups.map((group) => group.emailKey)),
    [conflictGroups],
  )
  const summary = useMemo(() => summarizeAttendees(attendees), [attendees])
  const preview = useMemo(
    () => previewAttendees(attendees, { sortBy, needsReviewOnly }),
    [attendees, sortBy, needsReviewOnly],
  )
  const status = useMemo(() => exportStatus(attendees), [attendees])
  const activeSource = sources.find((source) => source.id === activeSourceId) || null
  const mappingVisible = Boolean(
    mappingOpen
    && activeSource?.sheet
    && (activeSource.status === 'needs-mapping' || remappingId === activeSource.id),
  )
  const pasteSource = sources.find((source) => source.kind === 'paste') || null
  const pasteMappingCurrent = Boolean(
    mappingVisible
    && activeSource?.kind === 'paste'
    && pasteText === activeSource.parsedText,
  )
  const pendingMapping = sources.filter((source) => source.status === 'needs-mapping')
  const hasWork = Boolean(pasteText.trim() || sources.length || attendees.length || parseError)
  const confirmSource = confirm?.sourceId
    ? sources.find((source) => source.id === confirm.sourceId)
    : null

  const nextSourceId = (kind) => {
    sourceSeq.current += 1
    return `${kind}-${sourceSeq.current}`
  }

  const focusMapping = (sourceId) => {
    setActiveSourceId(sourceId)
    setMappingOpen(true)
    setRemappingId(null)
    setMappingError('')
  }

  const ingest = (entries, { forceFocus = false } = {}) => {
    const result = integrateSources(sourcesRef.current, attendeesRef.current, entries)
    commitList(result.sources, result.attendees)
    setCopied(false)
    setExportError('')
    const active = sourcesRef.current.find((source) => source.id === activeSourceId)
    const busy = mappingOpen && active && (active.status === 'needs-mapping' || remappingId === active.id)
    if (result.activateId && (forceFocus || !busy)) focusMapping(result.activateId)
  }

  const onFiles = async (event) => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    if (!files.length) return
    const entries = []
    const failed = []
    const used = new Set(sources.map((source) => source.name))
    for (const file of files) {
      try {
        const text = await file.text()
        entries.push({
          id: nextSourceId('file'),
          name: disambiguateFileName(file.name, used),
          kind: 'file',
          text,
        })
      } catch {
        failed.push(file.name || 'A file')
      }
    }
    if (entries.length) ingest(entries)
    setParseError(failed.length ? `Could not read ${failed.join(', ')}.` : '')
  }

  const applyMapping = (sourceId, { confirmed = false } = {}) => {
    const source = sourcesRef.current.find((item) => item.id === sourceId)
    if (!source) return
    const ready = mappingIsReady(source.mapping)
    if (!ready.ok) {
      setMappingError(ready.message)
      return
    }
    const hasRows = attendeesRef.current.some((row) => row.sourceId === sourceId)
    if (!confirmed && source.status === 'imported' && hasRows) {
      setConfirm({ type: 'remap', sourceId })
      return
    }
    const result = applySourceMapping(sourcesRef.current, attendeesRef.current, sourceId, source.mapping)
    if (!result.ok) {
      setMappingError(result.message)
      return
    }
    commitList(result.sources, result.attendees)
    setMappingError('')
    setCopied(false)
    setExportError('')
    const nextPending = result.sources.find((item) => item.status === 'needs-mapping')
    setActiveSourceId(nextPending ? nextPending.id : null)
    setMappingOpen(Boolean(nextPending))
    setRemappingId(null)
    setConfirm(null)
  }

  const openMapping = (sourceId) => {
    const source = sources.find((item) => item.id === sourceId)
    if (!source) return
    if (source.status === 'imported' && source.appliedMapping) {
      const applied = source.appliedMapping.slice()
      commitList(sourcesRef.current.map((item) => (
        item.id === sourceId ? { ...item, mapping: applied } : item
      )), attendeesRef.current)
      setRemappingId(sourceId)
    } else {
      setRemappingId(null)
    }
    setActiveSourceId(sourceId)
    setMappingOpen(true)
    setMappingError('')
  }

  const cancelMapping = () => {
    if (activeSource?.status === 'imported' && activeSource.appliedMapping) {
      const applied = activeSource.appliedMapping.slice()
      commitList(sourcesRef.current.map((source) => (
        source.id === activeSource.id ? { ...source, mapping: applied } : source
      )), attendeesRef.current)
    }
    setRemappingId(null)
    setMappingOpen(false)
    setMappingError('')
  }

  const removeSource = (sourceId) => {
    const result = dropSource(sourcesRef.current, attendeesRef.current, sourceId)
    commitList(result.sources, result.attendees)
    setCopied(false)
    setExportError('')
    setMappingError('')
    if (activeSourceId === sourceId) {
      const nextPending = result.sources.find((item) => item.status === 'needs-mapping')
      setActiveSourceId(nextPending ? nextPending.id : null)
      setMappingOpen(Boolean(nextPending))
      setRemappingId(null)
    }
    setConfirm(null)
  }

  const applyClear = () => {
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
    setPasteText('')
    commitList([], [])
    setActiveSourceId(null)
    setMappingOpen(false)
    setRemappingId(null)
    setSortBy(SORT_BY_FIRST_NAME)
    setNeedsReviewOnly(false)
    setParseError('')
    setMappingError('')
    setCopied(false)
    setExportError('')
    setConfirm(null)
    setDetailChoices({})
    if (fileRef.current) fileRef.current.value = ''
  }

  const confirmPending = () => {
    if (confirm?.type === 'clear') {
      applyClear()
      return
    }
    if (confirm?.type === 'remap') {
      const sourceId = confirm.sourceId
      setConfirm(null)
      applyMapping(sourceId, { confirmed: true })
      return
    }
    if (confirm?.type === 'remove') removeSource(confirm.sourceId)
  }

  const onFormat = (event) => {
    event.preventDefault()
    if (pasteMappingCurrent) {
      applyMapping(activeSource.id)
      return
    }
    const id = pasteSource?.id || nextSourceId('paste')
    ingest([{ id, name: PASTE_SOURCE_NAME, kind: 'paste', text: pasteText }], { forceFocus: true })
  }

  const patchAttendee = (id, patch) => {
    commitList(sourcesRef.current, attendeesRef.current.map((row) => (
      row.id === id ? updateAttendee(row, patch) : row
    )))
    setCopied(false)
  }

  const copyForSheets = async () => {
    const result = buildExport(attendees, sortBy)
    if (!result.ok) {
      setExportError(result.reason)
      setCopied(false)
      return
    }
    try {
      await navigator.clipboard.writeText(result.tsv)
      setExportError('')
      setCopied(true)
      if (copyTimer.current) window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
      setExportError('Could not copy. Download the CSV instead.')
    }
  }

  const downloadCsv = () => {
    const result = buildExport(attendees, sortBy)
    if (!result.ok) {
      setExportError(result.reason)
      return
    }
    const blob = new Blob([`\uFEFF${result.csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'attendee-list.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setExportError('')
  }

  const selectedChoice = (group) => {
    const saved = detailChoices[group.emailKey] || {}
    const pick = (field) => {
      const options = group.fields[field]
      if (options.some((option) => option.value === saved[field])) return saved[field]
      return options[0]?.value ?? ''
    }
    return {
      firstName: pick('firstName'),
      lastName: pick('lastName'),
      email: pick('email'),
    }
  }

  let confirmMessage = 'Clear this attendee list? Pasted rows, uploaded files, and edits will be removed from this tab. Attendee data is not saved on this device.'
  let confirmLabel = 'Clear list'
  if (confirm?.type === 'remap') {
    confirmMessage = `Apply this column mapping for ${confirmSource?.name || 'this file'}? Its imported rows will be rebuilt, and edits to those rows will be lost.`
    confirmLabel = 'Apply columns'
  } else if (confirm?.type === 'remove') {
    confirmMessage = confirmSource?.kind === 'paste'
      ? 'Remove the pasted rows? Uploaded files stay in the list.'
      : `Remove ${confirmSource?.name || 'this file'} and its imported rows? Other files and pasted rows stay in the list.`
    confirmLabel = confirmSource?.kind === 'paste' ? 'Remove rows' : 'Remove file'
  }

  const mappingHint = mappingQueueHint(activeSource, pendingMapping)

  return (
    <>
      <aside className="form-panel gen-form-panel alf-form-panel">
        <form className="form gen-form" onSubmit={onFormat} noValidate>
          <GeneratorHeader
            title="Attendee List Formatter"
            description="Combine registration lists into an alphabetized attendee list with first name, last name, and email—ready for building security, venue access, or event check-in."
            emoji="🪪"
            tone="teal"
            resetLabel="Clear list"
            onReset={() => {
              if (hasWork) setConfirm({ type: 'clear' })
            }}
            resetDisabled={!hasWork}
          />
          <p className="form-hint alf-privacy">
            Attendee data stays in this browser tab. It is not saved, logged, or sent anywhere.
          </p>

          <FormSection
            title="Attendee data"
            emoji="📋"
            id="alf-source-heading"
            hint="Paste from a spreadsheet or upload one or more CSVs. Add more files later without clearing the list. Each file is mapped on its own. Name, Full Name, First Name, Last Name, Email, and Email Address are detected automatically."
          >
            <label htmlFor="alf-paste">
              <FieldLabel optional>Paste from a spreadsheet</FieldLabel>
              <textarea
                id="alf-paste"
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                rows={10}
                spellCheck={false}
                autoComplete="off"
                placeholder={'First Name, Last Name, Email\nMary-Jane, Watson-Parker, mary@company.com\nJosh, , josh.phifer@company.com'}
              />
            </label>
            <div className="alf-upload-row">
              <label className="btn-action alf-file-btn">
                Upload CSV files
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv,.txt,text/plain"
                  multiple
                  onChange={onFiles}
                />
              </label>
            </div>
            {parseError ? (
              <p className="form-error" role="alert">{parseError}</p>
            ) : null}
            {sources.length ? (
              <ul className="alf-files" aria-label="Uploaded files and pasted data">
                {sources.map((source) => {
                  const rowCount = attendees.filter((row) => row.sourceId === source.id).length
                  const summaryText = source.status === 'imported'
                    ? columnSummary(source.sheet?.headers, source.appliedMapping)
                    : ''
                  const mappingThis = mappingVisible && activeSourceId === source.id
                  return (
                    <li key={source.id} className="alf-file-item">
                      <div className="alf-file-copy">
                        <span className="alf-file-name">{source.name}</span>
                        {source.status === 'imported' ? (
                          <span className="form-hint alf-file-meta">
                            {rowCount} {rowCount === 1 ? 'row' : 'rows'}
                            {summaryText ? ` · ${summaryText}` : ''}
                          </span>
                        ) : null}
                        {source.status === 'needs-mapping' ? (
                          <span className="alf-flag alf-flag-warning">Needs column mapping</span>
                        ) : null}
                        {source.status === 'error' ? (
                          <span className="form-error alf-file-meta" role="alert">{source.error}</span>
                        ) : null}
                        {mappingThis ? (
                          <span className="alf-flag alf-flag-info">Mapping columns</span>
                        ) : null}
                      </div>
                      <div className="alf-file-actions">
                        {source.status === 'needs-mapping' && !mappingThis ? (
                          <button type="button" className="btn-section-action" onClick={() => openMapping(source.id)}>
                            Map columns
                          </button>
                        ) : null}
                        {source.status === 'imported' && !mappingThis ? (
                          <button type="button" className="btn-section-action" onClick={() => openMapping(source.id)}>
                            Change columns
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn-section-action"
                          onClick={() => setConfirm({ type: 'remove', sourceId: source.id })}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </FormSection>

          {mappingVisible ? (
            <FormSection
              title={`Match columns for ${activeSource.name}`}
              emoji="🧭"
              id="alf-mapping-heading"
              hint={mappingHint}
            >
              {activeSource.sheet.headers.map((header, index) => (
                <label key={`${activeSource.id}-${header}-${index}`} htmlFor={`alf-role-${activeSource.id}-${index}`}>
                  <FieldLabel>{header}</FieldLabel>
                  <span className="form-hint">
                    Example: {activeSource.sheet.dataRows[0]?.[index]?.trim() || 'Empty'}
                  </span>
                  <select
                    id={`alf-role-${activeSource.id}-${index}`}
                    value={activeSource.mapping[index] || 'ignore'}
                    onChange={(event) => {
                      const value = event.target.value
                      commitList(sourcesRef.current.map((source) => {
                        if (source.id !== activeSource.id) return source
                        const next = source.mapping.slice()
                        next[index] = value
                        return { ...source, mapping: next }
                      }), attendeesRef.current)
                      setMappingError('')
                    }}
                  >
                    {COLUMN_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              ))}
              {mappingError ? (
                <p className="form-error" role="alert">{mappingError}</p>
              ) : null}
              <div className="output-actions">
                <button
                  type="button"
                  className="btn-generate alf-apply-columns"
                  onClick={() => applyMapping(activeSource.id)}
                >
                  Use these columns
                </button>
                <button type="button" className="btn-action" onClick={cancelMapping}>
                  Cancel
                </button>
              </div>
            </FormSection>
          ) : null}

          <GeneratorActions
            label={pasteMappingCurrent ? 'Use these columns' : 'Format list'}
            icon="✨"
            disabled={!pasteText.trim()}
          />
        </form>
      </aside>

      <main className="output-panel gen-output-panel alf-output-panel">
        <div className="output-header">
          <h2>Attendee preview</h2>
          {attendees.length ? (
            <div className="output-actions output-actions-inline">
              <button
                type="button"
                className="btn-copy"
                onClick={copyForSheets}
                disabled={!status.ok}
                aria-pressed={copied}
              >
                {copied ? 'Copied!' : 'Copy for Google Sheets'}
              </button>
              <button type="button" className="btn-action" onClick={downloadCsv} disabled={!status.ok}>
                Download CSV
              </button>
            </div>
          ) : null}
        </div>
        <div className={`output-content${attendees.length ? '' : ' gen-output-content--empty'}`}>
          {attendees.length ? (
            <>
              <ul className="alf-counts" aria-label="Attendee list summary">
                <Count label="Total attendees" value={summary.total} />
                <Count label="Duplicate emails" value={summary.duplicateEmails} tone={summary.duplicateEmails ? 'alert' : ''} />
                <Count label="Missing information" value={summary.missingInformation} tone={summary.missingInformation ? 'warning' : ''} />
                <Count label="Pending suggestions" value={summary.pendingSuggestions} tone={summary.pendingSuggestions ? 'info' : ''} />
              </ul>

              <div className="alf-toolbar">
                <div className="alf-sort">
                  <FieldLabel>Sort by</FieldLabel>
                  <SegmentedControl
                    name="Sort attendees"
                    value={sortBy}
                    onChange={setSortBy}
                    options={[
                      { value: SORT_BY_FIRST_NAME, label: 'First name' },
                      { value: SORT_BY_LAST_NAME, label: 'Last name' },
                    ]}
                  />
                </div>
                <button
                  type="button"
                  className={`btn-action alf-filter${needsReviewOnly ? ' alf-filter-active' : ''}`}
                  aria-pressed={needsReviewOnly}
                  onClick={() => setNeedsReviewOnly((value) => !value)}
                >
                  Needs review ({summary.needsReview})
                </button>
              </div>

              {exportError || !status.ok ? (
                <p className="form-error" role="alert">{exportError || status.reason}</p>
              ) : (
                <p className="form-hint alf-export-note">
                  Export is First Name, Last Name, and Email, in this sort order. Source filenames and review flags stay on screen and are left out of the copy and CSV. The Needs review filter does not remove anyone from the export.
                </p>
              )}

              {conflictGroups.length ? (
                <div className="alf-conflicts">
                  {conflictGroups.map((group, index) => (
                    <ConflictChooser
                      key={group.emailKey}
                      group={group}
                      index={index}
                      choice={selectedChoice(group)}
                      onChange={(field, value) => {
                        setDetailChoices((current) => ({
                          ...current,
                          [group.emailKey]: { ...selectedChoice(group), [field]: value },
                        }))
                      }}
                      onApply={() => {
                        const choice = selectedChoice(group)
                        commitList(
                          sourcesRef.current,
                          keepChosenDetails(attendeesRef.current, group.emailKey, choice),
                        )
                        setCopied(false)
                      }}
                    />
                  ))}
                </div>
              ) : null}

              {preview.length ? (
                <div className="alf-table-wrap">
                  <table className="alf-table">
                    <caption className="alf-caption">
                      Editable attendee preview. Source filenames and review notes are not part of the exported file.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">First Name</th>
                        <th scope="col">Last Name</th>
                        <th scope="col">Email</th>
                        <th scope="col">Source</th>
                        <th scope="col">Review</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row) => (
                        <AttendeeRow
                          key={row.id}
                          row={row}
                          duplicate={duplicateKeys.has(emailKey(row.email))}
                          conflicting={conflictingKeys.has(emailKey(row.email))}
                          onPatch={patchAttendee}
                          onAccept={(value) => {
                            commitList(sourcesRef.current, attendeesRef.current.map((item) => (
                              item.id === row.id ? acceptSuggestion(item, value) : item
                            )))
                            setCopied(false)
                          }}
                          onDismiss={() => {
                            commitList(sourcesRef.current, attendeesRef.current.map((item) => (
                              item.id === row.id ? dismissSuggestion(item) : item
                            )))
                            setCopied(false)
                          }}
                          onRemove={() => {
                            commitList(sourcesRef.current, attendeesRef.current.filter((item) => item.id !== row.id))
                            setCopied(false)
                          }}
                          onKeep={() => {
                            commitList(sourcesRef.current, keepAttendeeRow(attendeesRef.current, row.id))
                            setCopied(false)
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="form-hint">No attendees need review.</p>
              )}
            </>
          ) : (
            <EmptyState
              emoji="👥"
              title={pendingMapping.length ? 'Column mapping needed' : 'No attendee list yet'}
              description={pendingMapping.length
                ? 'Choose the name and email columns for each file, then use those columns to add its rows.'
                : 'Paste a spreadsheet or upload CSV files. The preview combines every row into first name, last name, and email.'}
            />
          )}
        </div>
      </main>

      <ConfirmResetDialog
        open={confirm != null}
        titleId="alf-confirm-title"
        message={confirmMessage}
        confirmLabel={confirmLabel}
        onCancel={() => setConfirm(null)}
        onConfirm={confirmPending}
      />
    </>
  )
}

function mappingQueueHint(activeSource, pendingMapping) {
  const position = pendingMapping.findIndex((source) => source.id === activeSource?.id)
  const queue = position >= 0 && pendingMapping.length > 1
    ? ` File ${position + 1} of ${pendingMapping.length} that need column mapping.`
    : ''
  const base = activeSource?.sheet?.hasHeader
    ? 'Choose which columns contain the name and email. Extra columns can be ignored.'
    : 'No recognizable header row was found. Choose which columns contain the name and email.'
  return `${base}${queue}`
}

function disambiguateFileName(name, used) {
  const clean = String(name || '').trim() || 'CSV file'
  if (!used.has(clean)) {
    used.add(clean)
    return clean
  }
  const dot = clean.lastIndexOf('.')
  const stem = dot > 0 ? clean.slice(0, dot) : clean
  const ext = dot > 0 ? clean.slice(dot) : ''
  let count = 2
  let next = `${stem} (${count})${ext}`
  while (used.has(next)) {
    count += 1
    next = `${stem} (${count})${ext}`
  }
  used.add(next)
  return next
}

function Count({ label, value, tone = '' }) {
  return (
    <li className={`alf-count${tone ? ` alf-count-${tone}` : ''}`}>
      <span className="alf-count-value">{value}</span>
      <span className="alf-count-label">{label}</span>
    </li>
  )
}

function ConflictChooser({ group, index, choice, onChange, onApply }) {
  const emailLabel = group.rows.find((row) => row.email)?.email || group.emailKey
  return (
    <fieldset className="alf-conflict">
      <legend>Choose details for {emailLabel}</legend>
      <p className="form-hint alf-conflict-copy">
        These records use the same email and do not match. Pick the information to keep. The other rows with this email will be removed.
      </p>
      {DETAIL_FIELDS.map((field) => {
        const options = group.fields[field.id]
        if (options.length < 2) return null
        return (
          <div key={field.id} className="alf-choice" role="radiogroup" aria-label={field.label}>
            <span className="alf-choice-label">{field.label}</span>
            {options.map((option) => {
              const optionId = `alf-choice-${index}-${field.id}-${option.compare || 'blank'}`
              return (
                <label key={optionId} className="alf-choice-option" htmlFor={optionId}>
                  <input
                    id={optionId}
                    type="radio"
                    name={`alf-choice-${index}-${field.id}`}
                    checked={choice[field.id] === option.value}
                    onChange={() => onChange(field.id, option.value)}
                  />
                  <span>
                    {option.value || 'Blank'}
                    <span className="form-hint alf-choice-source"> from {option.sources.join(', ')}</span>
                  </span>
                </label>
              )
            })}
          </div>
        )
      })}
      <button type="button" className="btn-section-action" onClick={onApply}>
        Keep selected details
      </button>
    </fieldset>
  )
}

function AttendeeRow({ row, duplicate, conflicting, onPatch, onAccept, onDismiss, onRemove, onKeep }) {
  const duplicateKey = duplicate ? new Set([emailKey(row.email)]) : new Set()
  const conflictingKeys = conflicting ? duplicateKey : new Set()
  const flags = getReviewFlags(row, duplicateKey, conflictingKeys)
  const emailInvalid = Boolean(normalizeEmail(row.email)) && !isValidEmail(row.email)
  const rowClass = [
    duplicate ? 'alf-row-duplicate' : '',
    flags.length ? 'alf-row-review' : '',
  ].filter(Boolean).join(' ')
  const who = row.email || row.unparsedName || 'this attendee'

  return (
    <>
      <tr className={rowClass || undefined}>
        <td>
          <input
            className="alf-input"
            aria-label={`First name for ${who}`}
            value={row.firstName}
            autoComplete="off"
            onChange={(event) => onPatch(row.id, { firstName: event.target.value })}
          />
        </td>
        <td>
          <input
            className="alf-input"
            aria-label={`Last name for ${who}`}
            value={row.lastName}
            autoComplete="off"
            onChange={(event) => onPatch(row.id, { lastName: event.target.value })}
          />
          {row.suggestion ? (
            <SuggestionControls
              suggestion={row.suggestion}
              onAccept={onAccept}
              onDismiss={onDismiss}
            />
          ) : null}
        </td>
        <td>
          <input
            className="alf-input"
            aria-label={`Email for ${row.firstName || row.unparsedName || 'this attendee'}`}
            value={row.email}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={emailInvalid || duplicate || undefined}
            onChange={(event) => onPatch(row.id, { email: event.target.value })}
          />
        </td>
        <td className="alf-source">{row.sourceName || PASTE_SOURCE_NAME}</td>
        <td>
          {flags.length ? (
            <ul className="alf-flags" aria-label="Review flags">
              {flags.map((flag) => (
                <li key={flag.id} className={`alf-flag alf-flag-${flag.tone}`}>{flag.label}</li>
              ))}
            </ul>
          ) : (
            <span className="alf-flag alf-flag-ok">Ready</span>
          )}
        </td>
        <td>
          <div className="alf-row-actions">
            {duplicate ? (
              <button type="button" className="btn-section-action" onClick={onKeep}>
                Keep this row
              </button>
            ) : null}
            <button type="button" className="btn-section-action" onClick={onRemove}>
              Remove
            </button>
          </div>
        </td>
      </tr>
      {row.nameSplitUnclear && row.unparsedName ? (
        <tr className="alf-split-row">
          <td colSpan={6}>
            <p className="form-hint alf-split-hint">
              Spreadsheet name: “{row.unparsedName}”. Enter the first and last name. A compound last name was not guessed from the last word.
            </p>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function SuggestionControls({ suggestion, onAccept, onDismiss }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(suggestion)

  useEffect(() => {
    setDraft(suggestion)
    setEditing(false)
  }, [suggestion])

  return (
    <div className="alf-suggestion" role="group" aria-label="Unconfirmed last name suggestion">
      <p>
        <span className="alf-flag alf-flag-info">Unconfirmed suggestion</span>
      </p>
      <p>
        Suggested last name:{' '}
        {editing ? (
          <input
            className="alf-input alf-suggestion-input"
            value={draft}
            aria-label="Edit suggested last name"
            autoComplete="off"
            onChange={(event) => setDraft(event.target.value)}
          />
        ) : (
          <strong>{suggestion}</strong>
        )}
      </p>
      <p className="form-hint">Not included in the export until you accept it.</p>
      <div className="alf-suggestion-actions">
        <button
          type="button"
          className="btn-section-action"
          onClick={() => onAccept(editing ? draft : suggestion)}
          disabled={editing && !draft.trim()}
        >
          Accept
        </button>
        <button
          type="button"
          className="btn-section-action"
          onClick={() => setEditing(true)}
          aria-pressed={editing}
        >
          Edit
        </button>
        <button type="button" className="btn-section-action" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  )
}
