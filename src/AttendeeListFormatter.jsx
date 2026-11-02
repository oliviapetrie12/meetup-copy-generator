import { useEffect, useMemo, useRef, useState } from 'react'
import {
  COLUMN_ROLE_OPTIONS,
  SORT_BY_FIRST_NAME,
  SORT_BY_LAST_NAME,
  acceptSuggestion,
  buildAttendees,
  buildExport,
  columnSummary,
  dismissSuggestion,
  duplicateEmailKeys,
  emailKey,
  exportStatus,
  getReviewFlags,
  isValidEmail,
  keepAttendeeRow,
  mappingIsReady,
  normalizeEmail,
  parseAttendeeSheet,
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

/**
 * Spreadsheet cleanup for attendee lists. Rows stay in component state for
 * this tab only and are never written to storage, logs, or analytics.
 */
export default function AttendeeListFormatter() {
  const [pasteText, setPasteText] = useState('')
  const [parsedText, setParsedText] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [sheet, setSheet] = useState(null)
  const [mapping, setMapping] = useState([])
  const [appliedMapping, setAppliedMapping] = useState([])
  const [showMapping, setShowMapping] = useState(false)
  const [attendees, setAttendees] = useState([])
  const [sortBy, setSortBy] = useState(SORT_BY_FIRST_NAME)
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false)
  const [parseError, setParseError] = useState('')
  const [mappingError, setMappingError] = useState('')
  const [copied, setCopied] = useState(false)
  const [exportError, setExportError] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [pendingText, setPendingText] = useState('')
  const [pendingSource, setPendingSource] = useState('')
  const fileRef = useRef(null)
  const copyTimer = useRef(null)

  useEffect(() => () => {
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
  }, [])

  const duplicateKeys = useMemo(() => duplicateEmailKeys(attendees), [attendees])
  const summary = useMemo(() => summarizeAttendees(attendees), [attendees])
  const preview = useMemo(
    () => previewAttendees(attendees, { sortBy, needsReviewOnly }),
    [attendees, sortBy, needsReviewOnly],
  )
  const status = useMemo(() => exportStatus(attendees), [attendees])
  const hasWork = Boolean(pasteText.trim() || sheet || attendees.length || parseError || sourceName)

  const applyParsed = (text, sourceLabel) => {
    const parsed = parseAttendeeSheet(text)
    setPasteText(text)
    setParsedText(text)
    setSourceName(sourceLabel || '')
    setCopied(false)
    setExportError('')
    setNeedsReviewOnly(false)
    if (parsed.error) {
      setParseError(parsed.error)
      setSheet(null)
      setMapping([])
      setAppliedMapping([])
      setShowMapping(false)
      setAttendees([])
      setMappingError('')
      return
    }
    setParseError('')
    setSheet(parsed)
    setMapping(parsed.mapping)
    const ready = mappingIsReady(parsed.mapping)
    if (!ready.ok) {
      setAppliedMapping([])
      setShowMapping(true)
      setMappingError(ready.message)
      setAttendees([])
      return
    }
    const built = buildAttendees(parsed.dataRows, parsed.mapping)
    if (!built.length) {
      setAppliedMapping([])
      setShowMapping(false)
      setAttendees([])
      setMappingError('')
      setParseError('No attendee rows found.')
      return
    }
    setAppliedMapping(parsed.mapping)
    setShowMapping(false)
    setMappingError('')
    setAttendees(built)
  }

  const requestLoad = (text, sourceLabel) => {
    if (attendees.length) {
      setPendingText(text)
      setPendingSource(sourceLabel || '')
      setConfirm('replace')
      return
    }
    applyParsed(text, sourceLabel)
  }

  const commitMapping = () => {
    if (!sheet) return
    const ready = mappingIsReady(mapping)
    if (!ready.ok) {
      setMappingError(ready.message)
      return
    }
    const built = buildAttendees(sheet.dataRows, mapping)
    if (!built.length) {
      setMappingError('No attendee rows found in the mapped columns.')
      return
    }
    setAppliedMapping(mapping)
    setMappingError('')
    setShowMapping(false)
    setAttendees(built)
    setNeedsReviewOnly(false)
    setCopied(false)
    setExportError('')
  }

  const onFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      requestLoad(text, file.name)
    } catch {
      setParseError('Could not read that file.')
    }
  }

  const applyClear = () => {
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
    setPasteText('')
    setParsedText('')
    setSourceName('')
    setSheet(null)
    setMapping([])
    setAppliedMapping([])
    setShowMapping(false)
    setAttendees([])
    setSortBy(SORT_BY_FIRST_NAME)
    setNeedsReviewOnly(false)
    setParseError('')
    setMappingError('')
    setCopied(false)
    setExportError('')
    setConfirm(null)
    setPendingText('')
    setPendingSource('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const confirmPending = () => {
    if (confirm === 'clear') {
      applyClear()
      return
    }
    if (confirm === 'replace') {
      const text = pendingText
      const source = pendingSource
      setConfirm(null)
      setPendingText('')
      setPendingSource('')
      applyParsed(text, source)
      return
    }
    if (confirm === 'remap') {
      setConfirm(null)
      commitMapping()
    }
  }

  const onApplyMapping = () => {
    const ready = mappingIsReady(mapping)
    if (!ready.ok) {
      setMappingError(ready.message)
      return
    }
    if (attendees.length) {
      setConfirm('remap')
      return
    }
    commitMapping()
  }

  const mappingIsCurrent = Boolean(showMapping && sheet && pasteText === parsedText)

  const onFormat = (event) => {
    event.preventDefault()
    if (mappingIsCurrent) {
      onApplyMapping()
      return
    }
    requestLoad(pasteText, sourceName)
  }

  const patchAttendee = (id, patch) => {
    setAttendees((current) => current.map((row) => (row.id === id ? updateAttendee(row, patch) : row)))
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

  const confirmMessage = confirm === 'replace'
    ? 'Replace the current attendee list? Edits will be lost. Attendee data is not saved on this device.'
    : confirm === 'remap'
      ? 'Apply this column mapping? The preview will be rebuilt from the pasted rows, and edits will be lost.'
      : 'Clear this attendee list? Pasted rows and edits will be removed from this tab. Attendee data is not saved on this device.'

  return (
    <>
      <aside className="form-panel gen-form-panel alf-form-panel">
        <form className="form gen-form" onSubmit={onFormat} noValidate>
          <GeneratorHeader
            title="Attendee List Formatter"
            description="Turn a spreadsheet export into first name, last name, and email."
            emoji="👥"
            tone="teal"
            resetLabel="Clear list"
            onReset={() => {
              if (hasWork) setConfirm('clear')
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
            hint="Paste from a spreadsheet or upload a CSV. Name, Full Name, First Name, Last Name, Email, and Email Address are detected automatically."
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
                Upload CSV
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv,.txt,text/plain"
                  onChange={onFile}
                />
              </label>
              {sourceName ? <span className="form-hint">Loaded {sourceName}</span> : null}
            </div>
            {parseError ? (
              <p className="form-error" role="alert">{parseError}</p>
            ) : null}
          </FormSection>

          {sheet && showMapping ? (
            <FormSection
              title="Match columns"
              emoji="🧭"
              id="alf-mapping-heading"
              hint={sheet.hasHeader
                ? 'Choose which columns contain the name and email. Extra columns can be ignored.'
                : 'No recognizable header row was found. Choose which columns contain the name and email.'}
            >
              {sheet.headers.map((header, index) => (
                <label key={`${header}-${index}`} htmlFor={`alf-role-${index}`}>
                  <FieldLabel>{header}</FieldLabel>
                  <span className="form-hint">
                    Example: {sheet.dataRows[0]?.[index]?.trim() || 'Empty'}
                  </span>
                  <select
                    id={`alf-role-${index}`}
                    value={mapping[index] || 'ignore'}
                    onChange={(event) => {
                      const next = mapping.slice()
                      next[index] = event.target.value
                      setMapping(next)
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
                <button type="button" className="btn-generate alf-apply-columns" onClick={onApplyMapping}>
                  Use these columns
                </button>
                {attendees.length ? (
                  <button
                    type="button"
                    className="btn-action"
                    onClick={() => {
                      setMapping(appliedMapping)
                      setShowMapping(false)
                      setMappingError('')
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </FormSection>
          ) : null}

          {sheet && appliedMapping.length && !showMapping ? (
            <p className="form-hint alf-column-summary">
              Columns in use: {columnSummary(sheet.headers, appliedMapping) || 'None'}.
              {' '}
              <button
                type="button"
                className="btn-section-action"
                onClick={() => {
                  setMapping(appliedMapping)
                  setShowMapping(true)
                  setMappingError('')
                }}
              >
                Change columns
              </button>
            </p>
          ) : null}

          <GeneratorActions
            label={mappingIsCurrent ? 'Use these columns' : 'Format list'}
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
                  Export is First Name, Last Name, and Email, in this sort order. Review flags stay on screen and are left out of the copy and CSV. The Needs review filter does not remove anyone from the export.
                </p>
              )}

              {preview.length ? (
                <div className="alf-table-wrap">
                  <table className="alf-table">
                    <caption className="alf-caption">
                      Editable attendee preview. Review notes are not part of the exported file.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">First Name</th>
                        <th scope="col">Last Name</th>
                        <th scope="col">Email</th>
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
                          onPatch={patchAttendee}
                          onAccept={(value) => {
                            setAttendees((current) => current.map((item) => (
                              item.id === row.id ? acceptSuggestion(item, value) : item
                            )))
                            setCopied(false)
                          }}
                          onDismiss={() => {
                            setAttendees((current) => current.map((item) => (
                              item.id === row.id ? dismissSuggestion(item) : item
                            )))
                            setCopied(false)
                          }}
                          onRemove={() => {
                            setAttendees((current) => current.filter((item) => item.id !== row.id))
                            setCopied(false)
                          }}
                          onKeep={() => {
                            setAttendees((current) => keepAttendeeRow(current, row.id))
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
              title={showMapping ? 'Column mapping needed' : 'No attendee list yet'}
              description={showMapping
                ? 'Choose the name and email columns, then use those columns to build the preview.'
                : 'Paste a spreadsheet or upload a CSV. The preview formats every row into first name, last name, and email.'}
            />
          )}
        </div>
      </main>

      <ConfirmResetDialog
        open={confirm != null}
        titleId="alf-confirm-title"
        message={confirmMessage}
        confirmLabel={confirm === 'replace' ? 'Replace list' : confirm === 'remap' ? 'Apply columns' : 'Clear list'}
        onCancel={() => {
          setConfirm(null)
          setPendingText('')
          setPendingSource('')
        }}
        onConfirm={confirmPending}
      />
    </>
  )
}

function Count({ label, value, tone = '' }) {
  return (
    <li className={`alf-count${tone ? ` alf-count-${tone}` : ''}`}>
      <span className="alf-count-value">{value}</span>
      <span className="alf-count-label">{label}</span>
    </li>
  )
}

function AttendeeRow({ row, duplicate, onPatch, onAccept, onDismiss, onRemove, onKeep }) {
  const flags = getReviewFlags(row, duplicate ? new Set([emailKey(row.email)]) : new Set())
  const emailInvalid = Boolean(normalizeEmail(row.email)) && !isValidEmail(row.email)
  const rowClass = [
    duplicate ? 'alf-row-duplicate' : '',
    flags.length ? 'alf-row-review' : '',
  ].filter(Boolean).join(' ')

  return (
    <>
      <tr className={rowClass || undefined}>
        <td>
          <input
            className="alf-input"
            aria-label={`First name for ${row.email || row.unparsedName || 'this attendee'}`}
            value={row.firstName}
            autoComplete="off"
            onChange={(event) => onPatch(row.id, { firstName: event.target.value })}
          />
        </td>
        <td>
          <input
            className="alf-input"
            aria-label={`Last name for ${row.email || row.unparsedName || 'this attendee'}`}
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
          <td colSpan={5}>
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
