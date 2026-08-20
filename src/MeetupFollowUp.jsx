import { useEffect, useMemo, useState } from 'react'
import {
  INTERNAL_CHECKLIST_ITEMS,
  createEmptyTalk,
  generateMeetupFollowUpEmail,
  getInitialMeetupFollowUpForm,
  isMeetupFollowUpFormEmpty,
  loadMeetupFollowUpForm,
  saveMeetupFollowUpForm,
  validateMeetupFollowUpForm,
} from './meetupFollowUp.js'

/**
 * Meetup Follow-Up generator — form + attendee email output + internal checklist.
 * State persists in localStorage so switching toolkit generators does not wipe the form.
 */
export default function MeetupFollowUp() {
  const [form, setForm] = useState(loadMeetupFollowUpForm)
  const [generated, setGenerated] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [talkErrors, setTalkErrors] = useState({})
  const [subjectCopied, setSubjectCopied] = useState(false)
  const [emailCopied, setEmailCopied] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)

  useEffect(() => {
    saveMeetupFollowUpForm(form)
  }, [form])

  const validation = useMemo(() => validateMeetupFollowUpForm(form), [form])
  const canGenerate = validation.ok
  const formEmpty = useMemo(() => isMeetupFollowUpFormEmpty(form), [form])
  const canReset = !formEmpty || Boolean(generated) || showErrors || subjectCopied || emailCopied

  const updateField = (key) => (e) => {
    const value = e.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const setPlatform = (platform) => {
    setForm((prev) => ({ ...prev, registrationPlatform: platform }))
  }

  const updateTalk = (id, key, value) => {
    setForm((prev) => ({
      ...prev,
      talks: prev.talks.map((t) => (t.id === id ? { ...t, [key]: value } : t)),
    }))
  }

  const addTalk = () => {
    setForm((prev) => ({ ...prev, talks: [...prev.talks, createEmptyTalk()] }))
  }

  const removeTalk = (id) => {
    setForm((prev) => {
      if (prev.talks.length <= 1) return prev
      return { ...prev, talks: prev.talks.filter((t) => t.id !== id) }
    })
  }

  const moveTalk = (id, direction) => {
    setForm((prev) => {
      const idx = prev.talks.findIndex((t) => t.id === id)
      if (idx < 0) return prev
      const nextIdx = idx + direction
      if (nextIdx < 0 || nextIdx >= prev.talks.length) return prev
      const talks = [...prev.talks]
      const [row] = talks.splice(idx, 1)
      talks.splice(nextIdx, 0, row)
      return { ...prev, talks }
    })
  }

  const handleGenerate = (e) => {
    e.preventDefault()
    const v = validateMeetupFollowUpForm(form)
    setFieldErrors(v.fieldErrors)
    setTalkErrors(v.talkErrors)
    setShowErrors(true)
    if (!v.ok) {
      setGenerated(null)
      return
    }
    setGenerated(generateMeetupFollowUpEmail(form))
    setSubjectCopied(false)
    setEmailCopied(false)
  }

  // Keep preview in sync when city/platform/talks change after a successful generate
  useEffect(() => {
    if (!generated) return
    const v = validateMeetupFollowUpForm(form)
    if (!v.ok) return
    setGenerated(generateMeetupFollowUpEmail(form))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refresh content when form fields change after generate
  }, [form])

  const applyReset = () => {
    setForm(getInitialMeetupFollowUpForm())
    setGenerated(null)
    setFieldErrors({})
    setTalkErrors({})
    setShowErrors(false)
    setSubjectCopied(false)
    setEmailCopied(false)
    setConfirmResetOpen(false)
  }

  const requestReset = () => {
    if (!canReset) return
    setConfirmResetOpen(true)
  }

  const cancelReset = () => {
    setConfirmResetOpen(false)
  }

  const copySubject = async () => {
    if (!generated?.subject) return
    try {
      await navigator.clipboard.writeText(generated.subject)
      setSubjectCopied(true)
      setTimeout(() => setSubjectCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const copyEmail = async () => {
    if (!generated) return
    try {
      if (typeof ClipboardItem !== 'undefined' && generated.html) {
        const htmlBlob = new Blob([generated.html], { type: 'text/html' })
        const textBlob = new Blob([generated.plain], { type: 'text/plain' })
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob }),
        ])
      } else {
        await navigator.clipboard.writeText(generated.plain)
      }
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 2000)
    } catch {
      try {
        await navigator.clipboard.writeText(generated.plain)
        setEmailCopied(true)
        setTimeout(() => setEmailCopied(false), 2000)
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <>
      <aside className="form-panel">
        <div className="mfu-form-toolbar">
          <button
            type="button"
            className="btn-reset mfu-reset-btn"
            onClick={requestReset}
            disabled={!canReset}
            aria-disabled={!canReset}
          >
            <span aria-hidden="true">🔄</span> Reset form
          </button>
        </div>
        <form onSubmit={handleGenerate} className="form" noValidate>
          <fieldset className="form-fieldset">
            <legend>Event Details</legend>
            <label>
              Meetup city <span className="form-hint">(required)</span>
              <input
                type="text"
                value={form.meetupCity}
                onChange={updateField('meetupCity')}
                placeholder="e.g. NYC"
                required
                aria-invalid={showErrors && !!fieldErrors.meetupCity}
                aria-describedby={showErrors && fieldErrors.meetupCity ? 'mfu-err-city' : undefined}
              />
              {showErrors && fieldErrors.meetupCity ? (
                <span id="mfu-err-city" className="form-error" role="alert">
                  {fieldErrors.meetupCity}
                </span>
              ) : null}
            </label>

            <label>
              Meetup name <span className="form-hint">(required)</span>
              <input
                type="text"
                value={form.meetupName}
                onChange={updateField('meetupName')}
                placeholder="e.g. Elastic NYC User Group"
                required
                aria-invalid={showErrors && !!fieldErrors.meetupName}
                aria-describedby={showErrors && fieldErrors.meetupName ? 'mfu-err-name' : undefined}
              />
              {showErrors && fieldErrors.meetupName ? (
                <span id="mfu-err-name" className="form-error" role="alert">
                  {fieldErrors.meetupName}
                </span>
              ) : null}
            </label>

            <div className="mfu-platform-field">
              <span className="mfu-platform-label" id="mfu-platform-label">
                Registration platform
              </span>
              <span className="form-hint mfu-platform-required" id="mfu-platform-hint">
                (required)
              </span>
              <div
                className="channel-selector mfu-platform-selector"
                role="radiogroup"
                aria-labelledby="mfu-platform-label"
                aria-describedby="mfu-platform-hint"
              >
                <label
                  className={`channel-option ${form.registrationPlatform === 'luma' ? 'channel-option-active' : ''}`}
                >
                  <input
                    type="radio"
                    name="mfuPlatform"
                    value="luma"
                    checked={form.registrationPlatform === 'luma'}
                    onChange={() => setPlatform('luma')}
                  />
                  <span>Luma</span>
                </label>
                <label
                  className={`channel-option ${form.registrationPlatform === 'meetup' ? 'channel-option-active' : ''}`}
                >
                  <input
                    type="radio"
                    name="mfuPlatform"
                    value="meetup"
                    checked={form.registrationPlatform === 'meetup'}
                    onChange={() => setPlatform('meetup')}
                  />
                  <span>Meetup</span>
                </label>
              </div>
            </div>

            <label>
              Advocate name <span className="form-hint">(required)</span>
              <input
                type="text"
                value={form.advocateName}
                onChange={updateField('advocateName')}
                placeholder="e.g. Olivia"
                required
                aria-invalid={showErrors && !!fieldErrors.advocateName}
                aria-describedby={showErrors && fieldErrors.advocateName ? 'mfu-err-advocate' : undefined}
              />
              {showErrors && fieldErrors.advocateName ? (
                <span id="mfu-err-advocate" className="form-error" role="alert">
                  {fieldErrors.advocateName}
                </span>
              ) : null}
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>Meetup Talks</legend>
            <p className="form-hint">Add, remove, or reorder talks. Slide URLs must be valid http(s) links.</p>
            {form.talks.map((talk, index) => {
              const errs = talkErrors[talk.id] || {}
              return (
                <div key={talk.id} className="mfu-talk-card">
                  <div className="mfu-talk-card-header">
                    <strong>Talk {index + 1}</strong>
                    <div className="mfu-talk-card-actions" role="group" aria-label={`Reorder talk ${index + 1}`}>
                      <button
                        type="button"
                        className="btn-section-action"
                        onClick={() => moveTalk(talk.id, -1)}
                        disabled={index === 0}
                        aria-label={`Move talk ${index + 1} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn-section-action"
                        onClick={() => moveTalk(talk.id, 1)}
                        disabled={index === form.talks.length - 1}
                        aria-label={`Move talk ${index + 1} down`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn-section-action"
                        onClick={() => removeTalk(talk.id)}
                        disabled={form.talks.length <= 1}
                        aria-label={`Remove talk ${index + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <label>
                    Talk title <span className="form-hint">(required)</span>
                    <input
                      type="text"
                      value={talk.talkTitle}
                      onChange={(e) => updateTalk(talk.id, 'talkTitle', e.target.value)}
                      placeholder="e.g. Getting started with Elasticsearch"
                      required
                      aria-invalid={showErrors && !!errs.talkTitle}
                    />
                    {showErrors && errs.talkTitle ? (
                      <span className="form-error" role="alert">
                        {errs.talkTitle}
                      </span>
                    ) : null}
                  </label>
                  <label>
                    Speaker name <span className="form-hint">(required)</span>
                    <input
                      type="text"
                      value={talk.speakerName}
                      onChange={(e) => updateTalk(talk.id, 'speakerName', e.target.value)}
                      placeholder="e.g. Jane Smith"
                      required
                      aria-invalid={showErrors && !!errs.speakerName}
                    />
                    {showErrors && errs.speakerName ? (
                      <span className="form-error" role="alert">
                        {errs.speakerName}
                      </span>
                    ) : null}
                  </label>
                  <label>
                    Slides URL <span className="form-hint">(required)</span>
                    <input
                      type="url"
                      inputMode="url"
                      value={talk.slidesUrl}
                      onChange={(e) => updateTalk(talk.id, 'slidesUrl', e.target.value)}
                      placeholder="https://…"
                      required
                      aria-invalid={showErrors && !!errs.slidesUrl}
                    />
                    {showErrors && errs.slidesUrl ? (
                      <span className="form-error" role="alert">
                        {errs.slidesUrl}
                      </span>
                    ) : null}
                  </label>
                </div>
              )
            })}
            <button type="button" className="btn-add-speaker" onClick={addTalk}>
              + Add another talk
            </button>
          </fieldset>

          <button type="submit" className="btn-generate" disabled={!canGenerate} aria-disabled={!canGenerate}>
            Generate
          </button>
        </form>
      </aside>

      <main className="output-panel">
        <div className="output-header">
          <h2>Meetup Follow-Up</h2>
        </div>
        <div className="output-content">
          {generated ? (
            <>
              <div className="subject-line-section">
                <h3 className="subject-line-heading">Subject</h3>
                <pre className="output-text subject-line-text">{generated.subject}</pre>
                <div className="output-actions output-actions-inline">
                  <button
                    type="button"
                    onClick={copySubject}
                    className="btn-copy"
                    aria-pressed={subjectCopied}
                  >
                    {subjectCopied ? 'Copied!' : 'Copy subject'}
                  </button>
                </div>
              </div>

              <h3 className="generated-email-heading">Attendee email</h3>
              <div
                className="meetup-page-preview kbyg-email-html-preview mfu-email-preview"
                dangerouslySetInnerHTML={{ __html: generated.html }}
              />
              <div className="output-actions output-actions-inline">
                <button type="button" onClick={copyEmail} className="btn-copy" aria-pressed={emailCopied}>
                  {emailCopied ? 'Copied!' : 'Copy email'}
                </button>
              </div>

              <details className="mfu-plain-details">
                <summary>Plain-text / copy-ready version</summary>
                <pre className="output-text">{generated.plain}</pre>
              </details>

              <section className="mfu-checklist" aria-labelledby="mfu-checklist-heading">
                <h3 id="mfu-checklist-heading" className="subject-line-heading">
                  Internal Checklist
                </h3>
                <p className="form-hint">For advocates only — not included when you copy the attendee email.</p>
                <ul className="mfu-checklist-list">
                  {INTERNAL_CHECKLIST_ITEMS.map((item, i) => {
                    if (typeof item === 'string') {
                      return <li key={i}>{item}</li>
                    }
                    return (
                      <li key={i}>
                        {item.before}
                        <a href={item.href} target="_blank" rel="noopener noreferrer">
                          {item.linkText}
                        </a>
                        {item.after}
                      </li>
                    )
                  })}
                </ul>
              </section>
            </>
          ) : (
            <p className="output-placeholder">
              Fill in the event details and talks, then click Generate to create the follow-up email with UTM
              tracking.
            </p>
          )}
        </div>
      </main>

      {confirmResetOpen ? (
        <div
          className="mfu-confirm-backdrop"
          role="presentation"
          onClick={cancelReset}
          onKeyDown={(e) => {
            if (e.key === 'Escape') cancelReset()
          }}
        >
          <div
            className="mfu-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mfu-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="mfu-confirm-title" className="mfu-confirm-message">
              Reset this form? All entered information will be cleared.
            </p>
            <div className="mfu-confirm-actions">
              <button type="button" className="btn-reset mfu-confirm-cancel" onClick={cancelReset}>
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
