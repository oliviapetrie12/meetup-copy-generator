import { useEffect, useMemo, useState } from 'react'
import {
  EVENT_ASSETS_LANGUAGE_OPTIONS,
  EVENT_TYPE_OPTIONS,
  copyEventAssetsToClipboard,
  generateEventAssetsDocument,
  getResetEventAssetsForm,
  isEventAssetsFormEmpty,
  loadEventAssetsForm,
  saveEventAssetsForm,
  trimField,
  validateEventAssetsForm,
} from './devrelEventAssets.js'
import {
  FieldLabel,
  GeneratorHeader,
  FormSection,
  CollapsibleFormSection,
  GeneratorActions,
  EmptyState,
} from './components/generatorUi.jsx'

/**
 * DevRel Event Assets — live localized document for organizers and community partners.
 * State persists in localStorage so switching toolkit generators does not wipe the form.
 */
export default function DevrelEventAssets() {
  const [form, setForm] = useState(loadEventAssetsForm)
  const [copyMode, setCopyMode] = useState(/** @type {null | 'html' | 'plain' | 'error'} */ (null))
  const [copyMessage, setCopyMessage] = useState('')
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    saveEventAssetsForm(form)
  }, [form])

  const validation = useMemo(() => validateEventAssetsForm(form), [form])
  const generated = useMemo(() => generateEventAssetsDocument(form), [form])
  const hasEventName = Boolean(trimField(form.eventName))
  const formEmpty = useMemo(() => isEventAssetsFormEmpty(form), [form])
  const canReset = !formEmpty || copyMode != null || showErrors
  const canCopy = hasEventName && !validation.fieldErrors.contactEmail

  const speakerFilled = Boolean(
    trimField(form.speakerName) || trimField(form.speakerTitle) || trimField(form.speakerBio),
  )
  const sessionFilled = Boolean(trimField(form.sessionTitle) || trimField(form.sessionDescription))
  const contactFilled = Boolean(trimField(form.contactName) || trimField(form.contactEmail))
  const participationFilled = Boolean(trimField(form.participationDetails))

  const updateField = (key) => (e) => {
    const value = e.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
    setCopyMode(null)
    setCopyMessage('')
  }

  const applyReset = () => {
    setForm(getResetEventAssetsForm())
    setCopyMode(null)
    setCopyMessage('')
    setShowErrors(false)
  }

  const copyDocument = async () => {
    if (!hasEventName) {
      setShowErrors(true)
      return
    }
    if (validation.fieldErrors.contactEmail) {
      setShowErrors(true)
      return
    }
    try {
      const mode = await copyEventAssetsToClipboard({
        html: generated.html,
        plain: generated.plain,
      })
      setCopyMode(mode)
      setCopyMessage(
        mode === 'html'
          ? 'Copied with formatting — paste into Google Docs.'
          : 'Copied as plain text. Rich formatting was unavailable.',
      )
      window.setTimeout(() => {
        setCopyMode(null)
        setCopyMessage('')
      }, 3500)
    } catch {
      setCopyMode('error')
      setCopyMessage('Could not copy. Select the document preview and copy it manually.')
    }
  }

  const copyLabel =
    copyMode === 'html'
      ? 'Copied with formatting'
      : copyMode === 'plain'
        ? 'Copied as plain text'
        : copyMode === 'error'
          ? 'Copy failed'
          : 'Copy for Google Docs'

  return (
    <>
      <aside className="form-panel gen-form-panel dea-form-panel">
        <form
          className="form gen-form dea-form"
          onSubmit={(e) => {
            e.preventDefault()
            copyDocument()
          }}
          noValidate
        >
          <GeneratorHeader
            title="DevRel Event Assets"
            description="Generate a localized Elastic document that conference organizers and community partners can paste into Google Docs for event websites, sponsor listings, and promotional materials."
            onReset={applyReset}
            resetDisabled={!canReset}
          />

          <FormSection title="Event Details" id="dea-event-details-heading">
            <label className="dea-field" htmlFor="dea-event-name">
              <FieldLabel required>Event name</FieldLabel>
              <input
                id="dea-event-name"
                type="text"
                value={form.eventName}
                onChange={updateField('eventName')}
                placeholder="e.g. TDC São Paulo"
                autoComplete="off"
                required
                aria-invalid={showErrors && !!validation.fieldErrors.eventName}
                aria-describedby={
                  showErrors && validation.fieldErrors.eventName ? 'dea-err-event-name' : undefined
                }
              />
              {showErrors && validation.fieldErrors.eventName ? (
                <span id="dea-err-event-name" className="form-error" role="alert">
                  {validation.fieldErrors.eventName}
                </span>
              ) : null}
            </label>

            <div className="gen-two-col">
              <label className="dea-field" htmlFor="dea-language">
                <FieldLabel required>Language</FieldLabel>
                <select
                  id="dea-language"
                  value={form.language}
                  onChange={updateField('language')}
                >
                  {EVENT_ASSETS_LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="dea-field" htmlFor="dea-event-type">
                <FieldLabel required>Event type</FieldLabel>
                <select
                  id="dea-event-type"
                  value={form.eventType}
                  onChange={updateField('eventType')}
                >
                  {EVENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </FormSection>

          <CollapsibleFormSection
            id="dea-participation"
            title="Event participation"
            hint="Optional notes on sponsorship, booth presence, workshops, or other Elastic involvement. Shown as entered — not translated."
            defaultOpen={false}
            completed={participationFilled}
            summary={participationFilled ? 'Details added' : null}
          >
            <label className="dea-field" htmlFor="dea-participation-details">
              <FieldLabel optional>Event participation details</FieldLabel>
              <textarea
                id="dea-participation-details"
                value={form.participationDetails}
                onChange={updateField('participationDetails')}
                placeholder="e.g. Gold sponsor, booth in the expo hall, and a 45-minute workshop on Elasticsearch."
                rows={4}
              />
            </label>
          </CollapsibleFormSection>

          <CollapsibleFormSection
            id="dea-speaker"
            title="Speaker information"
            hint="Optional. Included only when at least one speaker field is filled. Names and bios are not translated."
            defaultOpen={false}
            completed={speakerFilled}
            summary={speakerFilled ? form.speakerName || 'Speaker details added' : null}
          >
            <label className="dea-field" htmlFor="dea-speaker-name">
              <FieldLabel optional>Speaker name</FieldLabel>
              <input
                id="dea-speaker-name"
                type="text"
                value={form.speakerName}
                onChange={updateField('speakerName')}
                placeholder="e.g. Jane Smith"
                autoComplete="name"
              />
            </label>
            <label className="dea-field" htmlFor="dea-speaker-title">
              <FieldLabel optional>Speaker title</FieldLabel>
              <input
                id="dea-speaker-title"
                type="text"
                value={form.speakerTitle}
                onChange={updateField('speakerTitle')}
                placeholder="e.g. Principal Developer Advocate"
                autoComplete="organization-title"
              />
            </label>
            <label className="dea-field" htmlFor="dea-speaker-bio">
              <FieldLabel optional>Speaker bio</FieldLabel>
              <textarea
                id="dea-speaker-bio"
                value={form.speakerBio}
                onChange={updateField('speakerBio')}
                placeholder="Short bio for the event website or program."
                rows={4}
              />
            </label>
          </CollapsibleFormSection>

          <CollapsibleFormSection
            id="dea-session"
            title="Session information"
            hint="Optional. Included only when a session title or description is provided. Session copy is not translated."
            defaultOpen={false}
            completed={sessionFilled}
            summary={sessionFilled ? form.sessionTitle || 'Session details added' : null}
          >
            <label className="dea-field" htmlFor="dea-session-title">
              <FieldLabel optional>Session title</FieldLabel>
              <input
                id="dea-session-title"
                type="text"
                value={form.sessionTitle}
                onChange={updateField('sessionTitle')}
                placeholder="e.g. Grounding AI apps with Elasticsearch"
                autoComplete="off"
              />
            </label>
            <label className="dea-field" htmlFor="dea-session-description">
              <FieldLabel optional>Session description</FieldLabel>
              <textarea
                id="dea-session-description"
                value={form.sessionDescription}
                onChange={updateField('sessionDescription')}
                placeholder="Abstract or session summary for the event agenda."
                rows={4}
              />
            </label>
          </CollapsibleFormSection>

          <CollapsibleFormSection
            id="dea-contact"
            title="Event contact"
            hint="Optional organizer-facing contact. Email is validated when provided."
            defaultOpen={false}
            completed={contactFilled && !validation.fieldErrors.contactEmail}
            summary={contactFilled ? form.contactName || form.contactEmail : null}
          >
            <div className="gen-two-col">
              <label className="dea-field" htmlFor="dea-contact-name">
                <FieldLabel optional>Contact name</FieldLabel>
                <input
                  id="dea-contact-name"
                  type="text"
                  value={form.contactName}
                  onChange={updateField('contactName')}
                  placeholder="e.g. Olivia Petrie"
                  autoComplete="name"
                />
              </label>
              <label className="dea-field" htmlFor="dea-contact-email">
                <FieldLabel optional>Contact email</FieldLabel>
                <input
                  id="dea-contact-email"
                  type="email"
                  inputMode="email"
                  value={form.contactEmail}
                  onChange={updateField('contactEmail')}
                  placeholder="e.g. meetups@elastic.co"
                  autoComplete="email"
                  aria-invalid={!!validation.fieldErrors.contactEmail}
                  aria-describedby={
                    validation.fieldErrors.contactEmail ? 'dea-err-email' : undefined
                  }
                />
                {validation.fieldErrors.contactEmail ? (
                  <span id="dea-err-email" className="form-error" role="alert">
                    {validation.fieldErrors.contactEmail}
                  </span>
                ) : null}
              </label>
            </div>
          </CollapsibleFormSection>

          <GeneratorActions
            label={copyLabel}
            icon="📄"
            type="button"
            disabled={!canCopy}
            onClick={copyDocument}
          />
        </form>
      </aside>

      <main className="output-panel gen-output-panel dea-output-panel">
        <div className="output-header">
          <h2>Generated document</h2>
          {hasEventName ? (
            <button
              type="button"
              className="btn-copy dea-copy-google-docs"
              onClick={copyDocument}
              disabled={!canCopy}
              aria-pressed={copyMode === 'html' || copyMode === 'plain'}
            >
              {copyLabel}
            </button>
          ) : null}
        </div>
        <div className={`output-content${hasEventName ? '' : ' gen-output-content--empty'}`}>
          {hasEventName ? (
            <>
              <div
                className="meetup-page-preview dea-doc-preview"
                lang={form.language === 'pt' ? 'pt-BR' : 'en'}
                dangerouslySetInnerHTML={{ __html: generated.html }}
              />
              {copyMessage ? (
                <p
                  className={`form-hint dea-copy-status${copyMode === 'error' ? ' dea-copy-status-error' : ''}`}
                  role={copyMode === 'error' ? 'alert' : 'status'}
                >
                  {copyMessage}
                </p>
              ) : (
                <p className="form-hint dea-copy-status">
                  Copies HTML and plain text for a clean paste into Google Docs.
                </p>
              )}

              <details className="dea-plain-details">
                <summary>Plain-text / copy-ready version</summary>
                <pre className="output-text">{generated.plain}</pre>
              </details>
            </>
          ) : (
            <EmptyState
              emoji="📋"
              title="No event assets yet"
              description="Enter an event name to preview a localized document for organizers and community partners."
            />
          )}
        </div>
      </main>
    </>
  )
}
