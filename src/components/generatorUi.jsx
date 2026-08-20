/**
 * Shared generator UI primitives for consistent form/output chrome across the toolkit.
 */

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
  resetLabel = 'Reset form',
  onReset,
  resetDisabled = false,
  children,
}) {
  return (
    <header className="gen-form-header">
      <div className="gen-form-header-copy">
        <h2 className="gen-form-title">{title}</h2>
        {description ? <p className="gen-form-desc">{description}</p> : null}
        {children ? <div className="gen-form-header-extras">{children}</div> : null}
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
 * @param {{ title: string, hint?: string, children: import('react').ReactNode, id?: string }} props
 */
export function FormSection({ title, hint, children, id }) {
  const headingId = id || undefined
  return (
    <section className="gen-section" aria-labelledby={headingId}>
      <h3 id={headingId} className="gen-section-title">
        {title}
      </h3>
      {hint ? <p className="gen-section-hint">{hint}</p> : null}
      {children}
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
