/**
 * Shared generator UI primitives for consistent form/output chrome across the toolkit.
 */

import { useEffect, useState } from 'react'

export function DraftSavedNote() {
  return (
    <p className="draft-saved-note" role="status">
      Draft saved on this device
    </p>
  )
}

/**
 * Confirm before a reset that would clear entered form details.
 */
export function ConfirmResetDialog({
  open,
  titleId,
  message = 'Reset this form? The details you entered will be cleared on this device.',
  confirmLabel = 'Reset form',
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null
  return (
    <div className="mfu-confirm-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="mfu-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <p id={titleId} className="mfu-confirm-message">
          {message}
        </p>
        <div className="mfu-confirm-actions">
          <button type="button" className="btn-reset mfu-confirm-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-generate mfu-confirm-reset" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function FieldLabel({ children, required = false, optional = false, htmlFor }) {
  const inner = (
    <span className="gen-label-row">
      <span className="gen-label-text">{children}</span>
      {required ? <span className="gen-badge gen-badge-required">Required</span> : null}
      {optional ? <span className="gen-badge gen-badge-optional">Optional</span> : null}
    </span>
  )
  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} className="gen-field-label">
        {inner}
      </label>
    )
  }
  return inner
}

/**
 * @param {{
 *   title: string
 *   description?: string
 *   resetLabel?: string
 *   onReset?: () => void
 *   resetDisabled?: boolean
 *   children?: import('react').ReactNode
 * }} props
 */
export function GeneratorHeader({
  title,
  description,
  emoji,
  tone = 'teal',
  resetLabel = 'Reset form',
  onReset,
  resetDisabled = false,
  children,
}) {
  return (
    <header className="gen-form-header">
      <div className="gen-form-header-main">
        {emoji ? (
          <span className={`gen-icon-tile gen-icon-tile--${tone}`} aria-hidden="true">
            {emoji}
          </span>
        ) : null}
        <div className="gen-form-header-copy">
          <h2 className="gen-form-title">{title}</h2>
          {description ? <p className="gen-form-desc">{description}</p> : null}
          {children ? <div className="gen-form-header-extras">{children}</div> : null}
        </div>
      </div>
      {onReset ? (
        <button
          type="button"
          className="btn-reset gen-reset-btn"
          onClick={onReset}
          disabled={resetDisabled}
          aria-disabled={resetDisabled}
        >
          <span aria-hidden="true">🔄</span> {resetLabel}
        </button>
      ) : null}
    </header>
  )
}

/**
 * Soft section card (prefer over heavy fieldsets when migrating).
 * @param {{ title: string, hint?: string, emoji?: string, children: import('react').ReactNode, id?: string }} props
 */
export function FormSection({ title, hint, emoji, children, id }) {
  const headingId = id || undefined
  return (
    <section className="gen-section" aria-labelledby={headingId}>
      <h3 id={headingId} className="gen-section-title">
        {emoji ? (
          <span className="gen-section-emoji" aria-hidden="true">
            {emoji}
          </span>
        ) : null}
        <span>{title}</span>
      </h3>
      {hint ? <p className="gen-section-hint">{hint}</p> : null}
      {children}
    </section>
  )
}

/**
 * Collapsible optional section — collapsed by default, keyboard accessible.
 * @param {{
 *   title: string
 *   hint?: string
 *   id?: string
 *   defaultOpen?: boolean
 *   completed?: boolean
 *   optional?: boolean
 *   summary?: string | null
 *   emoji?: string
 *   children: import('react').ReactNode
 * }} props
 */
export function CollapsibleFormSection({
  title,
  hint,
  id,
  defaultOpen = false,
  completed = false,
  optional = false,
  summary = null,
  emoji,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const headingId = id ? `${id}-trigger` : undefined
  const panelId = id ? `${id}-panel` : undefined

  return (
    <section
      className={`gen-section gen-section-collapsible${completed ? ' gen-section-collapsible--complete' : ''}${open ? ' gen-section-collapsible--open' : ''}`}
    >
      <button
        type="button"
        id={headingId}
        className="gen-collapse-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="gen-collapse-copy">
          <span className="gen-collapse-main">
            <span className="gen-section-title gen-collapse-title">
              {emoji ? (
                <span className="gen-section-emoji" aria-hidden="true">
                  {emoji}
                </span>
              ) : null}
              <span>{title}</span>
            </span>
            {optional ? <span className="gen-badge gen-badge-optional">Optional</span> : null}
            {completed ? (
              <span className="gen-collapse-check" aria-label="Completed">
                ✓
              </span>
            ) : null}
          </span>
          {!open && summary ? <span className="gen-collapse-summary">{summary}</span> : null}
        </span>
        <span className={`gen-collapse-chevron${open ? ' is-open' : ''}`} aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headingId}
        className="gen-collapse-panel"
        hidden={!open}
      >
        {hint ? <p className="gen-section-hint">{hint}</p> : null}
        {children}
      </div>
    </section>
  )
}

/**
 * Primary generate action (full-width, bottom of form).
 */
export function GeneratorActions({
  label,
  icon = '✨',
  disabled = false,
  type = 'submit',
  onClick,
}) {
  return (
    <button
      type={type}
      className="btn-generate gen-generate-btn"
      disabled={disabled}
      aria-disabled={disabled}
      onClick={onClick}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {label}
    </button>
  )
}

/**
 * Centered empty output state.
 */
export function EmptyState({ emoji, title, description }) {
  return (
    <div className="gen-empty-state">
      <div className="gen-empty-icon" aria-hidden="true">
        {emoji}
      </div>
      <h3 className="gen-empty-title">{title}</h3>
      {description ? <p className="gen-empty-desc">{description}</p> : null}
    </div>
  )
}

/**
 * Copy button with pressed/copied feedback.
 */
export function CopyButton({
  onClick,
  copied = false,
  idleLabel = 'Copy',
  copiedLabel = 'Copied!',
  className = 'btn-copy',
}) {
  return (
    <button type="button" className={className} onClick={onClick} aria-pressed={copied}>
      {copied ? copiedLabel : idleLabel}
    </button>
  )
}

/**
 * Two-option segmented control (Luma/Meetup, etc.).
 */
export function SegmentedControl({ label, value, options, onChange, name }) {
  return (
    <div className="form-group">
      {label ? <FieldLabel required>{label}</FieldLabel> : null}
      <div className="segmented-control" role="group" aria-label={label || name || 'Options'}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={value === opt.value ? 'active' : ''}
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
