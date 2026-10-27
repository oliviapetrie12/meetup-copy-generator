import { memo, useEffect, useMemo, useRef, useState } from 'react'
import {
  ALREADY_REGISTERED_MESSAGE,
  REGISTRATION_MODE_ALREADY,
  REGISTRATION_MODE_SELF,
  copyPreliminaryBoothStaffEmailToClipboard,
  defaultSubject,
  generatePreliminaryBoothStaffEmail,
  getInitialPreliminaryBoothStaffForm,
  isPreliminaryBoothStaffFormEmpty,
  loadPreliminaryBoothStaffForm,
  preliminaryBoothStaffHtmlToPlain,
  savePreliminaryBoothStaffForm,
  updatePreliminaryBoothStaffForm,
  validatePreliminaryBoothStaffForm,
} from './preliminaryBoothStaff.js'
import {
  ConfirmResetDialog,
  DraftSavedNote,
  EmptyState,
  FieldLabel,
  FormSection,
  GeneratorActions,
  GeneratorHeader,
  SegmentedControl,
} from './components/generatorUi.jsx'

const EmailBodyEditor = memo(
  function EmailBodyEditor({ html, revision, onInput }) {
    const ref = useRef(null)
    useEffect(() => {
      const el = ref.current
      if (!el) return
      el.innerHTML = html
    }, [html, revision])
    return (
      <div
        ref={ref}
        className="meetup-page-preview kbyg-email-html-preview cfu-body-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Email body"
        aria-multiline="true"
        onInput={(e) => onInput(e.currentTarget.innerHTML)}
      />
    )
  },
  (prev, next) => prev.html === next.html && prev.revision === next.revision,
)

/**
 * Early booth-staff email. The form is stored on this device separately from
 * Conference Know Before You Go.
 */
export default function PreliminaryBoothStaff() {
  const [form, setForm] = useState(loadPreliminaryBoothStaffForm)
  const [generated, setGenerated] = useState(null)
  const [showErrors, setShowErrors] = useState(false)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [bodyDirty, setBodyDirty] = useState(false)
  const [editedHtml, setEditedHtml] = useState('')
  const [appliedHtml, setAppliedHtml] = useState('')
  const [bodyRevision, setBodyRevision] = useState(0)
  const [subjectCopied, setSubjectCopied] = useState(false)
  const [emailCopyMode, setEmailCopyMode] = useState(/** @type {null | 'html' | 'plain'} */ (null))

  useEffect(() => {
    savePreliminaryBoothStaffForm(form)
  }, [form])

  const validation = useMemo(() => validatePreliminaryBoothStaffForm(form), [form])
  const formEmpty = useMemo(() => isPreliminaryBoothStaffFormEmpty(form), [form])
  const canReset = !formEmpty || Boolean(generated) || showErrors || subjectCopied || emailCopyMode != null
  const subjectDiverged = form.subjectManual && form.subject !== defaultSubject(form.conferenceName)
  const linkTextDiverged =
    form.registrationLinkTextManual && form.registrationLinkText !== form.conferenceName
  const instructionsDiverged = form.registrationInstructionsManual
  const registeredMessageDiverged =
    form.alreadyRegisteredMessageManual && form.alreadyRegisteredMessage !== ALREADY_REGISTERED_MESSAGE
  const staffRegisterThemselves = form.registrationMode !== REGISTRATION_MODE_ALREADY

  const patchForm = (patch) => {
    setForm((prev) => updatePreliminaryBoothStaffForm(prev, patch))
  }

  const refreshGeneratedBody = () => {
    setBodyDirty(false)
    setEditedHtml('')
    setBodyRevision((n) => n + 1)
  }

  const handleGenerate = (e) => {
    e.preventDefault()
    setShowErrors(true)
    if (!validation.ok) {
      setGenerated(null)
      return
    }
    const email = generatePreliminaryBoothStaffEmail(form)
    setBodyDirty(false)
    setEditedHtml('')
    setAppliedHtml(email.html)
    setBodyRevision((n) => n + 1)
    setSubjectCopied(false)
    setEmailCopyMode(null)
    setGenerated(email)
  }

  useEffect(() => {
    if (!generated) return
    if (!validatePreliminaryBoothStaffForm(form).ok) return
    setGenerated(generatePreliminaryBoothStaffEmail(form))
    // Rebuild from the form unless the user has edited the preview directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  useEffect(() => {
    if (!generated || bodyDirty) return
    setAppliedHtml(generated.html)
  }, [generated, bodyDirty])

  const applyReset = () => {
    setForm(getInitialPreliminaryBoothStaffForm())
    setGenerated(null)
    setShowErrors(false)
    setBodyDirty(false)
    setEditedHtml('')
    setAppliedHtml('')
    setSubjectCopied(false)
    setEmailCopyMode(null)
    setConfirmResetOpen(false)
  }

  const requestReset = () => {
    if (!canReset) return
    if (!formEmpty) {
      setConfirmResetOpen(true)
      return
    }
    applyReset()
  }

  const copySubject = async () => {
    if (!form.subject) return
    try {
      await navigator.clipboard.writeText(form.subject)
      setSubjectCopied(true)
      window.setTimeout(() => setSubjectCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const copyEmail = async () => {
    if (!generated) return
    const html = bodyDirty ? editedHtml || appliedHtml || generated.html : generated.html
    const plain = bodyDirty ? preliminaryBoothStaffHtmlToPlain(html) : generated.plain
    try {
      const mode = await copyPreliminaryBoothStaffEmailToClipboard({ html, plain })
      setEmailCopyMode(mode)
      window.setTimeout(() => setEmailCopyMode(null), 2500)
    } catch {
      /* ignore */
    }
  }

  const plainForDisplay =
    generated && bodyDirty
      ? preliminaryBoothStaffHtmlToPlain(editedHtml || appliedHtml || generated.html)
      : generated?.plain || ''
  const linkError = trimError(form.registrationLink) ? validation.fieldErrors.registrationLink : ''

  return (
    <>
      <aside className="form-panel gen-form-panel mfu-form-panel">
        <form onSubmit={handleGenerate} className="form gen-form mfu-form" noValidate>
          <GeneratorHeader
            title="Preliminary Booth Staff Email"
            description="Generate an early email for confirmed booth staff with event details and registration instructions."
            emoji="🎟️"
            tone="pink"
            onReset={requestReset}
            resetDisabled={!canReset}
          >
            {formEmpty ? null : <DraftSavedNote />}
          </GeneratorHeader>

          <FormSection title="Event details" emoji="📅" id="pbs-event-heading">
            <label className="mfu-field">
              <FieldLabel required>Conference name</FieldLabel>
              <input
                type="text"
                value={form.conferenceName}
                onChange={(e) => patchForm({ conferenceName: e.target.value })}
                placeholder="e.g. All Things Open"
                required
                aria-invalid={showErrors && !!validation.fieldErrors.conferenceName}
              />
              {showErrors && validation.fieldErrors.conferenceName ? (
                <span className="form-error" role="alert">
                  {validation.fieldErrors.conferenceName}
                </span>
              ) : null}
            </label>

            <label className="mfu-field">
              <FieldLabel>Event dates</FieldLabel>
              <input
                type="text"
                value={form.eventDates}
                onChange={(e) => patchForm({ eventDates: e.target.value })}
                placeholder="e.g. March 16–18"
              />
            </label>

            <label className="mfu-field">
              <FieldLabel>Location</FieldLabel>
              <input
                type="text"
                value={form.location}
                onChange={(e) => patchForm({ location: e.target.value })}
                placeholder="e.g. Raleigh, NC"
              />
            </label>

            <label className="mfu-field">
              <FieldLabel>Elastic sponsorship details</FieldLabel>
              <input
                type="text"
                value={form.sponsorshipDetails}
                onChange={(e) => patchForm({ sponsorshipDetails: e.target.value })}
                placeholder="e.g. Booth and a 40-minute workshop"
              />
            </label>
          </FormSection>

          <FormSection title="Registration" emoji="🎟️" id="pbs-registration-heading">
            <SegmentedControl
              name="Registration approach"
              value={form.registrationMode}
              onChange={(registrationMode) => patchForm({ registrationMode })}
              options={[
                { value: REGISTRATION_MODE_SELF, label: 'Staff will register themselves' },
                { value: REGISTRATION_MODE_ALREADY, label: 'Team is already registered' },
              ]}
            />

            {staffRegisterThemselves ? (
            <>
            <div className="gen-two-col mfu-two-col">
              <label className="mfu-field">
                <FieldLabel>Registration deadline</FieldLabel>
                <input
                  type="text"
                  value={form.registrationDeadline}
                  onChange={(e) => patchForm({ registrationDeadline: e.target.value })}
                  placeholder="e.g. March 6"
                />
              </label>
              <label className="mfu-field">
                <FieldLabel optional>Registration code</FieldLabel>
                <input
                  type="text"
                  value={form.registrationCode}
                  onChange={(e) => patchForm({ registrationCode: e.target.value })}
                  placeholder="e.g. BOOTH2026"
                />
              </label>
            </div>

            <label className="mfu-field">
              <FieldLabel>Registration link</FieldLabel>
              <input
                type="url"
                inputMode="url"
                value={form.registrationLink}
                onChange={(e) => patchForm({ registrationLink: e.target.value })}
                placeholder="https://…"
                aria-invalid={!!linkError}
                aria-describedby={linkError ? 'pbs-err-link' : undefined}
              />
              {linkError ? (
                <span id="pbs-err-link" className="form-error" role="alert">
                  {linkError}
                </span>
              ) : null}
            </label>

            <label className="mfu-field">
              <FieldLabel>Registration link text</FieldLabel>
              <input
                type="text"
                value={form.registrationLinkText}
                onChange={(e) =>
                  patchForm({
                    registrationLinkText: e.target.value,
                    registrationLinkTextManual: true,
                  })
                }
                placeholder="Defaults to the conference name"
                aria-describedby="pbs-link-text-hint"
              />
              <span id="pbs-link-text-hint" className="form-hint">
                Defaults to the conference name. This text becomes the registration link in the email.
              </span>
              {linkTextDiverged ? (
                <button
                  type="button"
                  className="btn-use-utm-url"
                  onClick={() => patchForm({ registrationLinkTextManual: false })}
                >
                  Use conference name
                </button>
              ) : null}
            </label>

            <label className="mfu-field">
              <FieldLabel>Registration instructions</FieldLabel>
              <textarea
                value={form.registrationInstructions}
                onChange={(e) =>
                  patchForm({
                    registrationInstructions: e.target.value,
                    registrationInstructionsManual: true,
                  })
                }
                rows={8}
                aria-describedby="pbs-instructions-hint"
                placeholder="Add a deadline, link, or code to draft the registration steps."
              />
              <span id="pbs-instructions-hint" className="form-hint">
                Edit or replace these steps for a conference with a different registration process. The code
                step is left out when no code is entered.
              </span>
              {instructionsDiverged ? (
                <button
                  type="button"
                  className="btn-use-utm-url"
                  onClick={() => {
                    patchForm({ registrationInstructionsManual: false })
                    refreshGeneratedBody()
                  }}
                >
                  Use default instructions
                </button>
              ) : null}
            </label>
            </>
            ) : (
            <label className="mfu-field">
              <FieldLabel>Registration message</FieldLabel>
              <textarea
                value={form.alreadyRegisteredMessage}
                onChange={(e) =>
                  patchForm({
                    alreadyRegisteredMessage: e.target.value,
                    alreadyRegisteredMessageManual: true,
                  })
                }
                rows={4}
                aria-describedby="pbs-registered-hint"
              />
              <span id="pbs-registered-hint" className="form-hint">
                Shown under Registration in the email. Add any extra details the team should know.
              </span>
              {registeredMessageDiverged ? (
                <button
                  type="button"
                  className="btn-use-utm-url"
                  onClick={() => {
                    patchForm({ alreadyRegisteredMessageManual: false })
                    refreshGeneratedBody()
                  }}
                >
                  Use default message
                </button>
              ) : null}
            </label>
            )}
          </FormSection>

          <FormSection title="Email" emoji="✉️" id="pbs-email-heading">
            <label className="mfu-field">
              <FieldLabel optional>Additional note</FieldLabel>
              <textarea
                value={form.additionalNote}
                onChange={(e) => patchForm({ additionalNote: e.target.value })}
                rows={3}
                placeholder="e.g. A few extra staff passes are available."
                aria-describedby="pbs-note-hint"
              />
              <span id="pbs-note-hint" className="form-hint">
                Staff passes or anything else to include before the sign-off.
              </span>
            </label>

            <label className="mfu-field">
              <FieldLabel optional>Sender name</FieldLabel>
              <input
                type="text"
                value={form.senderName}
                onChange={(e) => patchForm({ senderName: e.target.value })}
                placeholder="e.g. Olivia"
              />
            </label>

            <label className="mfu-field">
              <FieldLabel>Subject line</FieldLabel>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => patchForm({ subject: e.target.value, subjectManual: true })}
                aria-describedby="pbs-subject-hint"
              />
              <span id="pbs-subject-hint" className="form-hint">
                Defaults to the conference name plus Preliminary Booth Staffing & Registration.
              </span>
              {subjectDiverged ? (
                <button
                  type="button"
                  className="btn-use-utm-url"
                  onClick={() => patchForm({ subjectManual: false })}
                >
                  Use default subject
                </button>
              ) : null}
            </label>
          </FormSection>

          <GeneratorActions label="Generate email" disabled={!validation.ok} />
        </form>
      </aside>

      <main className="output-panel gen-output-panel mfu-output-panel">
        <div className="output-header">
          <h2>Generated email</h2>
        </div>
        <div className={`output-content${generated ? '' : ' gen-output-content--empty'}`}>
          {generated ? (
            <>
              <div className="subject-line-section">
                <h3 className="subject-line-heading">Subject</h3>
                <input
                  className="cfu-editable-input"
                  type="text"
                  value={form.subject}
                  onChange={(e) => patchForm({ subject: e.target.value, subjectManual: true })}
                  aria-label="Subject line"
                />
                <div className="output-actions output-actions-inline">
                  <button type="button" onClick={copySubject} className="btn-copy" aria-pressed={subjectCopied}>
                    {subjectCopied ? 'Copied!' : 'Copy subject'}
                  </button>
                </div>
              </div>

              <h3 className="generated-email-heading">Email body</h3>
              <EmailBodyEditor
                html={appliedHtml}
                revision={bodyRevision}
                onInput={(html) => {
                  setBodyDirty(true)
                  setEditedHtml(html)
                }}
              />
              <div className="output-actions output-actions-inline mfu-copy-email-row">
                <button
                  type="button"
                  onClick={copyEmail}
                  className="btn-copy"
                  aria-pressed={emailCopyMode != null}
                >
                  {emailCopyMode === 'html'
                    ? 'Copied with formatting'
                    : emailCopyMode === 'plain'
                      ? 'Copied as plain text'
                      : 'Copy email'}
                </button>
              </div>
              <p className="form-hint mfu-copy-email-hint">
                Copies with the registration link and formatting for Gmail. Plain text is used when rich-text
                copy is unavailable.
              </p>
              {bodyDirty ? (
                <p className="form-hint mfu-copy-email-hint">
                  Generate email again to rebuild the email body from the form.
                </p>
              ) : null}

              <details className="mfu-plain-details">
                <summary>Plain-text fallback</summary>
                <pre className="output-text">{plainForDisplay}</pre>
              </details>
            </>
          ) : (
            <EmptyState
              emoji="🎟️"
              title="No email yet"
              description="Add the conference name and registration details, then generate a preliminary booth staff email."
            />
          )}
        </div>
      </main>

      <ConfirmResetDialog
        open={confirmResetOpen}
        titleId="pbs-confirm-title"
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={applyReset}
      />
    </>
  )
}

function trimError(value) {
  return String(value || '').trim()
}
