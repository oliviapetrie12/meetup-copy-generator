import { memo, useEffect, useRef, useMemo, useState } from 'react'
import {
  applyConferenceNameChange,
  conferenceMediumFromName,
  DEFAULT_UTM_CAMPAIGN,
  copyConferenceFollowUpEmailToClipboard,
  createEmptyResource,
  defaultOpeningSentence,
  generateConferenceFollowUpEmail,
  getResetConferenceFollowUpForm,
  htmlEmailToPlain,
  isConferenceFollowUpFormEmpty,
  loadConferenceFollowUpForm,
  saveConferenceFollowUpForm,
  validateConferenceFollowUpForm,
} from './conferenceFollowUp.js'
import {
  FieldLabel,
  GeneratorHeader,
  FormSection,
  CollapsibleFormSection,
  GeneratorActions,
  EmptyState,
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
 * Conference lead follow-up email. Form state persists in localStorage so
 * switching generators does not clear the draft.
 */
export default function ConferenceFollowUp() {
  const [form, setForm] = useState(loadConferenceFollowUpForm)
  const [generated, setGenerated] = useState(null)
  const [showErrors, setShowErrors] = useState(false)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [preview, setPreview] = useState('')
  const [subjectDirty, setSubjectDirty] = useState(false)
  const [previewDirty, setPreviewDirty] = useState(false)
  const [bodyDirty, setBodyDirty] = useState(false)
  const [editedHtml, setEditedHtml] = useState('')
  const [appliedHtml, setAppliedHtml] = useState('')
  const [bodyRevision, setBodyRevision] = useState(0)
  const [subjectCopied, setSubjectCopied] = useState(false)
  const [previewCopied, setPreviewCopied] = useState(false)
  const [emailCopyMode, setEmailCopyMode] = useState(/** @type {null | 'html' | 'plain'} */ (null))

  useEffect(() => {
    saveConferenceFollowUpForm(form)
  }, [form])

  const validation = useMemo(() => validateConferenceFollowUpForm(form), [form])
  const canGenerate = validation.ok
  const formEmpty = useMemo(() => isConferenceFollowUpFormEmpty(form), [form])
  const canReset =
    !formEmpty || Boolean(generated) || showErrors || subjectCopied || previewCopied || emailCopyMode != null
  const generatedMedium = conferenceMediumFromName(form.conferenceName)
  const mediumDiverged = form.utmMediumManual && form.utmMedium !== generatedMedium
  const campaignDiverged = form.utmCampaignManual && form.utmCampaign !== DEFAULT_UTM_CAMPAIGN
  const openingDiverged =
    form.openingManual && form.openingSentence !== defaultOpeningSentence(form.conferenceName)

  const updateConferenceName = (value) => {
    setForm((prev) => applyConferenceNameChange(prev, value))
  }

  const updateField = (key) => (e) => {
    const value = e.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateOpening = (value) => {
    setForm((prev) => ({ ...prev, openingSentence: value, openingManual: true }))
  }

  const updateMedium = (value) => {
    setForm((prev) => ({ ...prev, utmMedium: value, utmMediumManual: true }))
  }

  const useGeneratedMedium = () => {
    setForm((prev) => ({
      ...prev,
      utmMedium: conferenceMediumFromName(prev.conferenceName),
      utmMediumManual: false,
    }))
  }

  const updateCampaign = (value) => {
    setForm((prev) => ({ ...prev, utmCampaign: value, utmCampaignManual: true }))
  }

  const useDefaultCampaign = () => {
    setForm((prev) => ({
      ...prev,
      utmCampaign: DEFAULT_UTM_CAMPAIGN,
      utmCampaignManual: false,
    }))
  }

  const useDefaultOpening = () => {
    setForm((prev) => ({
      ...prev,
      openingSentence: defaultOpeningSentence(prev.conferenceName),
      openingManual: false,
    }))
  }

  const updateResource = (id, key, value) => {
    setForm((prev) => ({
      ...prev,
      resources: prev.resources.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
    }))
  }

  const addResource = () => {
    setForm((prev) => ({ ...prev, resources: [...prev.resources, createEmptyResource()] }))
  }

  const removeResource = (id) => {
    setForm((prev) => ({ ...prev, resources: prev.resources.filter((r) => r.id !== id) }))
  }

  const handleGenerate = (e) => {
    e.preventDefault()
    const v = validateConferenceFollowUpForm(form)
    setShowErrors(true)
    if (!v.ok) {
      setGenerated(null)
      return
    }
    const email = generateConferenceFollowUpEmail(form)
    setSubjectDirty(false)
    setPreviewDirty(false)
    setBodyDirty(false)
    setEditedHtml('')
    setAppliedHtml(email.html)
    setBodyRevision((n) => n + 1)
    setSubjectCopied(false)
    setPreviewCopied(false)
    setEmailCopyMode(null)
    setGenerated(email)
  }

  useEffect(() => {
    if (!generated) return
    const v = validateConferenceFollowUpForm(form)
    if (!v.ok) return
    setGenerated(generateConferenceFollowUpEmail(form))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  useEffect(() => {
    if (!generated || subjectDirty) return
    setSubject(generated.subject)
  }, [generated, subjectDirty])

  useEffect(() => {
    if (!generated || previewDirty) return
    setPreview(generated.preview)
  }, [generated, previewDirty])

  useEffect(() => {
    if (!generated || bodyDirty) return
    setAppliedHtml(generated.html)
  }, [generated, bodyDirty])

  const applyReset = () => {
    setForm(getResetConferenceFollowUpForm())
    setGenerated(null)
    setShowErrors(false)
    setSubject('')
    setPreview('')
    setSubjectDirty(false)
    setPreviewDirty(false)
    setBodyDirty(false)
    setEditedHtml('')
    setAppliedHtml('')
    setSubjectCopied(false)
    setPreviewCopied(false)
    setEmailCopyMode(null)
    setConfirmResetOpen(false)
  }

  const requestReset = () => {
    if (!canReset) return
    setConfirmResetOpen(true)
  }

  const copySubject = async () => {
    if (!subject) return
    try {
      await navigator.clipboard.writeText(subject)
      setSubjectCopied(true)
      window.setTimeout(() => setSubjectCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const copyPreview = async () => {
    if (!preview) return
    try {
      await navigator.clipboard.writeText(preview)
      setPreviewCopied(true)
      window.setTimeout(() => setPreviewCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const copyEmail = async () => {
    if (!generated) return
    const html = bodyDirty ? editedHtml || appliedHtml || generated.html : generated.html
    const plain = bodyDirty ? htmlEmailToPlain(html) : generated.plain
    try {
      const mode = await copyConferenceFollowUpEmailToClipboard({ html, plain })
      setEmailCopyMode(mode)
      window.setTimeout(() => setEmailCopyMode(null), 2500)
    } catch {
      /* ignore */
    }
  }

  const plainForDisplay =
    generated && bodyDirty ? htmlEmailToPlain(editedHtml || appliedHtml || generated.html) : generated?.plain || ''
  const filledResources = form.resources.filter(
    (r) => String(r.label || '').trim() || String(r.url || '').trim(),
  )

  return (
    <>
      <aside className="form-panel gen-form-panel mfu-form-panel">
        <form onSubmit={handleGenerate} className="form gen-form mfu-form" noValidate>
          <GeneratorHeader
            title="Conference Follow-Up"
            description="Generate a post-conference lead follow-up email with resources and automatic UTM tracking."
            onReset={requestReset}
            resetDisabled={!canReset}
          />

          <FormSection title="Event details" id="cfu-event-heading">
            <label className="mfu-field">
              <FieldLabel required>Conference name</FieldLabel>
              <input
                type="text"
                value={form.conferenceName}
                onChange={(e) => updateConferenceName(e.target.value)}
                placeholder="e.g. LangChain Interrupt"
                required
                aria-invalid={showErrors && !!validation.fieldErrors.conferenceName}
                aria-describedby={
                  showErrors && validation.fieldErrors.conferenceName ? 'cfu-err-name' : undefined
                }
              />
              {showErrors && validation.fieldErrors.conferenceName ? (
                <span id="cfu-err-name" className="form-error" role="alert">
                  {validation.fieldErrors.conferenceName}
                </span>
              ) : null}
            </label>

            <label className="mfu-field">
              <FieldLabel>Opening sentence</FieldLabel>
              <textarea
                className="cfu-opening"
                value={form.openingSentence}
                onChange={(e) => updateOpening(e.target.value)}
                rows={2}
                aria-describedby="cfu-opening-hint"
              />
              <span id="cfu-opening-hint" className="form-hint">
                Defaults to a thank-you that includes the conference name.
              </span>
              {openingDiverged ? (
                <button type="button" className="btn-use-utm-url" onClick={useDefaultOpening}>
                  Use default opening
                </button>
              ) : null}
            </label>
          </FormSection>

          <FormSection title="UTM parameters" id="cfu-utm-heading">
            <div className="gen-two-col mfu-two-col">
              <label className="mfu-field">
                <FieldLabel>UTM source</FieldLabel>
                <input
                  type="text"
                  value={form.utmSource}
                  onChange={updateField('utmSource')}
                  placeholder="e.g. intuition"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="cfu-source-hint"
                />
                <span id="cfu-source-hint" className="form-hint">
                  Identifies the platform sending the follow-up.
                </span>
              </label>
              <label className="mfu-field">
                <FieldLabel>UTM medium</FieldLabel>
                <input
                  type="text"
                  value={form.utmMedium}
                  onChange={(e) => updateMedium(e.target.value)}
                  placeholder="Generated from the conference name"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="cfu-medium-hint"
                />
                <span id="cfu-medium-hint" className="form-hint">
                  Identifies the conference and is generated automatically.
                  {mediumDiverged && generatedMedium ? ` Generated value: ${generatedMedium}.` : ''}
                </span>
                {mediumDiverged ? (
                  <button type="button" className="btn-use-utm-url" onClick={useGeneratedMedium}>
                    Use generated medium
                  </button>
                ) : null}
              </label>
            </div>
            <label className="mfu-field">
              <FieldLabel>UTM campaign</FieldLabel>
              <input
                type="text"
                value={form.utmCampaign}
                onChange={(e) => updateCampaign(e.target.value)}
                placeholder="conference-followup-cm"
                autoComplete="off"
                spellCheck={false}
                aria-describedby="cfu-campaign-hint"
              />
              <span id="cfu-campaign-hint" className="form-hint">
                Identifies the follow-up program.
              </span>
              {campaignDiverged ? (
                <button type="button" className="btn-use-utm-url" onClick={useDefaultCampaign}>
                  Use default campaign
                </button>
              ) : null}
            </label>
          </FormSection>

          <CollapsibleFormSection
            id="cfu-resources"
            title="Conference resources"
            hint="Optional links added to the stay-connected list. elastic.co links get the same UTM parameters."
            optional
            defaultOpen={filledResources.length > 0}
            completed={filledResources.length > 0 && validation.ok}
            summary={
              filledResources.length
                ? `${filledResources.length} custom ${filledResources.length === 1 ? 'link' : 'links'}`
                : null
            }
          >
            <div className="mfu-talk-list">
              {form.resources.map((resource, index) => {
                const errs = validation.resourceErrors[resource.id] || {}
                return (
                  <div key={resource.id} className="mfu-talk-card">
                    <div className="mfu-talk-card-header">
                      <span className="mfu-talk-card-title">Link {index + 1}</span>
                      <button
                        type="button"
                        className="mfu-icon-btn mfu-icon-btn-danger"
                        onClick={() => removeResource(resource.id)}
                        aria-label={`Remove link ${index + 1}`}
                        title="Remove link"
                      >
                        <span aria-hidden="true">🗑</span>
                      </button>
                    </div>
                    <div className="mfu-talk-card-body">
                      <label className="mfu-field">
                        <FieldLabel required>Link text</FieldLabel>
                        <input
                          type="text"
                          value={resource.label}
                          onChange={(e) => updateResource(resource.id, 'label', e.target.value)}
                          placeholder="e.g. Booth slide deck"
                          aria-invalid={!!errs.label}
                        />
                        {errs.label ? (
                          <span className="form-error" role="alert">
                            {errs.label}
                          </span>
                        ) : null}
                      </label>
                      <label className="mfu-field">
                        <FieldLabel required>URL</FieldLabel>
                        <input
                          type="url"
                          inputMode="url"
                          value={resource.url}
                          onChange={(e) => updateResource(resource.id, 'url', e.target.value)}
                          placeholder="https://…"
                          aria-invalid={!!errs.url}
                        />
                        {errs.url ? (
                          <span className="form-error" role="alert">
                            {errs.url}
                          </span>
                        ) : null}
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
            <button type="button" className="mfu-add-talk-btn" onClick={addResource}>
              + Add a link
            </button>
          </CollapsibleFormSection>

          <GeneratorActions label="Generate follow-up" disabled={!canGenerate} />
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
                  value={subject}
                  onChange={(e) => {
                    setSubjectDirty(true)
                    setSubject(e.target.value)
                  }}
                  aria-label="Subject line"
                />
                <div className="output-actions output-actions-inline">
                  <button type="button" onClick={copySubject} className="btn-copy" aria-pressed={subjectCopied}>
                    {subjectCopied ? 'Copied!' : 'Copy subject'}
                  </button>
                </div>
              </div>

              <div className="subject-line-section">
                <h3 className="subject-line-heading">Preview text</h3>
                <textarea
                  className="cfu-editable-textarea"
                  value={preview}
                  onChange={(e) => {
                    setPreviewDirty(true)
                    setPreview(e.target.value)
                  }}
                  rows={3}
                  aria-label="Preview text"
                />
                <div className="output-actions output-actions-inline">
                  <button type="button" onClick={copyPreview} className="btn-copy" aria-pressed={previewCopied}>
                    {previewCopied ? 'Copied!' : 'Copy preview text'}
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
                Copies with links and formatting for Intuition. Plain text is used when rich-text copy is
                unavailable.
              </p>
              {bodyDirty ? (
                <p className="form-hint mfu-copy-email-hint">
                  Generate follow-up again to rebuild the subject, preview text, and email body from the form.
                </p>
              ) : null}

              <details className="mfu-plain-details">
                <summary>Plain-text fallback</summary>
                <pre className="output-text">{plainForDisplay}</pre>
              </details>

              <section className="cfu-tracked" aria-labelledby="cfu-tracked-heading">
                <h3 id="cfu-tracked-heading" className="gen-notes-heading">
                  UTM tracking
                </h3>
                <p className="form-hint">Parameters and links created from the fields above.</p>
                <dl className="cfu-utm-values">
                  <dt>Campaign</dt>
                  <dd>{generated.utm.utm_campaign || '—'}</dd>
                  <dt>Source</dt>
                  <dd>{generated.utm.utm_source || '—'}</dd>
                  <dt>Medium</dt>
                  <dd>{generated.utm.utm_medium || '—'}</dd>
                </dl>
                <ul className="cfu-link-list">
                  {generated.links.map((link) => (
                    <li key={link.id}>
                      <span className="cfu-link-label">{link.label}</span>
                      <a className="cfu-tracked-url" href={link.href} target="_blank" rel="noopener noreferrer">
                        {link.href}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : (
            <EmptyState
              emoji="💌"
              title="No follow-up yet"
              description="Add the conference name, then generate a lead follow-up email with tracked resource links."
            />
          )}
        </div>
      </main>

      {confirmResetOpen ? (
        <div
          className="mfu-confirm-backdrop"
          role="presentation"
          onClick={() => setConfirmResetOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setConfirmResetOpen(false)
          }}
        >
          <div
            className="mfu-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cfu-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="cfu-confirm-title" className="mfu-confirm-message">
              Reset this form? Conference details, UTM fields, and custom links will be cleared.
            </p>
            <div className="mfu-confirm-actions">
              <button type="button" className="btn-reset mfu-confirm-cancel" onClick={() => setConfirmResetOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-generate mfu-confirm-reset" onClick={applyReset}>
                Reset form
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
