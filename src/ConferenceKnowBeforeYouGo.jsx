import { useState, useCallback } from 'react'

function escapeHtml(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Appended to every generated output (no form field). */
const STANDARD_TRAVEL_EXPENSES_TEXT =
  'Travel & expenses: follow your regional policy for submitting receipts and expense reports. Code charges to the project indicated by your manager. For policy questions, contact your People or Finance partner.'

const INITIAL_CONTACT = { name: '', role: '', email: '', phone: '' }

const INITIAL_FORM = {
  greetingNames: '',
  conferenceName: '',
  tldrText: '',
  eventDatesHours: '',
  ticketsText: '',
  locationVenue: '',
  locationAddress: '',
  contacts: [{ ...INITIAL_CONTACT }],
  boothSetupTeardown: '',
  swagText: '',
  parkingText: '',
  foodBeverageText: '',
  additionalSections: [],
}

function trim(s) {
  return typeof s === 'string' ? s.trim() : ''
}

function has(s) {
  return trim(s).length > 0
}

function textToHtmlParagraphs(text) {
  return escapeHtml(trim(text)).replace(/\n/g, '<br>')
}

/** Non-TL;DR body: one line per paragraph block, joined with &lt;br&gt; */
function textToHtmlLines(text) {
  return escapeHtml(trim(text))
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join('<br>')
}

function tldrTextToBulletsHtml(text) {
  return trim(text)
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `• ${escapeHtml(l)}`)
    .join('<br>')
}

function contactLineHtml(c) {
  const bits = []
  if (has(c.name)) bits.push(escapeHtml(trim(c.name)))
  if (has(c.role)) bits.push(escapeHtml(trim(c.role)))
  if (has(c.email)) bits.push(escapeHtml(trim(c.email)))
  if (has(c.phone)) bits.push(escapeHtml(trim(c.phone)))
  return bits.join(' – ')
}

function generateConferenceSubject(form) {
  const name = trim(form.conferenceName)
  const datesHint = trim(form.eventDatesHours)
    .split('\n')[0]
    ?.trim()
  if (!name) return 'Conference booth — Know before you go'
  return `${name} | Booth know-before-you-go${datesHint ? ` | ${datesHint}` : ''}`
}

function buildConferenceEmailHtml(form) {
  const names = trim(form.greetingNames) || 'team'
  const confName = trim(form.conferenceName) || 'the conference'
  const parts = []

  parts.push(`Hi ${escapeHtml(names)},`)
  parts.push(`<strong>Title</strong><br><br>${escapeHtml(confName)}`)

  if (has(form.tldrText)) {
    const bullets = tldrTextToBulletsHtml(form.tldrText)
    parts.push(
      `<strong>📝 <span style="background-color: #FEF08A; font-weight: bold;">TL;DR</span></strong><br><br>${bullets}`,
    )
  }

  if (has(form.eventDatesHours)) {
    parts.push(`<strong>🗓 Event Dates &amp; Hours</strong><br><br>${textToHtmlLines(form.eventDatesHours)}`)
  }
  if (has(form.ticketsText)) {
    parts.push(`<strong>🎟 Tickets</strong><br><br>${textToHtmlLines(form.ticketsText)}`)
  }

  if (has(form.locationVenue) || has(form.locationAddress)) {
    let loc = ''
    if (has(form.locationVenue)) loc += escapeHtml(trim(form.locationVenue))
    if (has(form.locationAddress)) {
      loc += (loc ? '<br>' : '') + escapeHtml(trim(form.locationAddress))
    }
    parts.push(`<strong>🏢 Location</strong><br><br>${loc}`)
  }

  const contactEntries = (form.contacts || []).filter(
    (c) => has(c.name) || has(c.role) || has(c.email) || has(c.phone),
  )
  if (contactEntries.length > 0) {
    const rows = contactEntries.map((c) => contactLineHtml(c)).join('<br>')
    parts.push(`<strong>💬 Contacts</strong><br><br>${rows}`)
  }

  if (has(form.boothSetupTeardown)) {
    parts.push(
      `<strong>📢 Booth Setup &amp; Teardown</strong><br><br>${textToHtmlLines(form.boothSetupTeardown)}`,
    )
  }
  if (has(form.swagText)) {
    parts.push(`<strong>🛍 Swag</strong><br><br>${textToHtmlLines(form.swagText)}`)
  }
  if (has(form.parkingText)) {
    parts.push(`<strong>🚙 Parking</strong><br><br>${textToHtmlLines(form.parkingText)}`)
  }
  if (has(form.foodBeverageText)) {
    parts.push(`<strong>🍔 Food &amp; Beverage</strong><br><br>${textToHtmlLines(form.foodBeverageText)}`)
  }

  ;(form.additionalSections || []).forEach((sec) => {
    const t = trim(sec.title)
    const c = trim(sec.content)
    if (!t && !c) return
    const title = escapeHtml(t || 'Section')
    parts.push(
      `<strong>➕ ${title}</strong><br><br>${c ? textToHtmlLines(sec.content) : ''}`,
    )
  })

  parts.push(
    `<strong>💵 Travel &amp; Expenses</strong><br><br>${escapeHtml(STANDARD_TRAVEL_EXPENSES_TEXT)}`,
  )
  parts.push(escapeHtml('Please reach out if anything changes on site or you need a hand.'))

  const inner = parts.join('<br><br>')
  return `<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#202124;">${inner}</div>`
}

function contactLinePlain(c) {
  const bits = []
  if (has(c.name)) bits.push(trim(c.name))
  if (has(c.role)) bits.push(trim(c.role))
  if (has(c.email)) bits.push(trim(c.email))
  if (has(c.phone)) bits.push(trim(c.phone))
  return bits.join(' – ')
}

function generateConferenceEmailPlain(form) {
  const names = trim(form.greetingNames) || 'team'
  const confName = trim(form.conferenceName) || 'the conference'
  const lines = []

  lines.push(`Hi ${names},`, '')
  lines.push('Title')
  lines.push(confName)
  lines.push('')

  if (has(form.tldrText)) {
    lines.push('📝 TL;DR')
    trim(form.tldrText)
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((l) => lines.push(`• ${l}`))
    lines.push('')
  }
  if (has(form.eventDatesHours)) {
    lines.push('🗓 Event Dates & Hours')
    lines.push(trim(form.eventDatesHours))
    lines.push('')
  }
  if (has(form.ticketsText)) {
    lines.push('🎟 Tickets')
    lines.push(trim(form.ticketsText))
    lines.push('')
  }
  if (has(form.locationVenue) || has(form.locationAddress)) {
    lines.push('🏢 Location')
    if (has(form.locationVenue)) lines.push(trim(form.locationVenue))
    if (has(form.locationAddress)) lines.push(trim(form.locationAddress))
    lines.push('')
  }

  const contactEntries = (form.contacts || []).filter(
    (c) => has(c.name) || has(c.role) || has(c.email) || has(c.phone),
  )
  if (contactEntries.length > 0) {
    lines.push('💬 Contacts')
    contactEntries.forEach((c) => {
      lines.push(contactLinePlain(c))
    })
    lines.push('')
  }

  if (has(form.boothSetupTeardown)) {
    lines.push('📢 Booth Setup & Teardown')
    lines.push(trim(form.boothSetupTeardown))
    lines.push('')
  }
  if (has(form.swagText)) {
    lines.push('🛍 Swag')
    lines.push(trim(form.swagText))
    lines.push('')
  }
  if (has(form.parkingText)) {
    lines.push('🚙 Parking')
    lines.push(trim(form.parkingText))
    lines.push('')
  }
  if (has(form.foodBeverageText)) {
    lines.push('🍔 Food & Beverage')
    lines.push(trim(form.foodBeverageText))
    lines.push('')
  }

  ;(form.additionalSections || []).forEach((sec) => {
    const t = trim(sec.title)
    const c = trim(sec.content)
    if (!t && !c) return
    lines.push(`➕ ${t || 'Section'}`)
    if (c) lines.push(c)
    lines.push('')
  })

  lines.push('💵 Travel & Expenses')
  lines.push(STANDARD_TRAVEL_EXPENSES_TEXT)
  lines.push('')
  lines.push('Please reach out if anything changes on site or you need a hand.')

  return lines.join('\n')
}

export default function ConferenceKnowBeforeYouGo() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [subject, setSubject] = useState('')
  const [plain, setPlain] = useState('')
  const [html, setHtml] = useState('')
  const [copied, setCopied] = useState(false)
  const [subjectCopied, setSubjectCopied] = useState(false)

  const update = (key) => (e) => {
    const v = e.target.value
    setForm((prev) => ({ ...prev, [key]: v }))
  }

  const updateContact = (index, key) => (e) => {
    const v = e.target.value
    setForm((prev) => {
      const next = [...(prev.contacts || [])]
      next[index] = { ...next[index], [key]: v }
      return { ...prev, contacts: next }
    })
  }

  const addContact = () => {
    setForm((prev) => ({
      ...prev,
      contacts: [...(prev.contacts || []), { ...INITIAL_CONTACT }],
    }))
  }

  const updateAdditionalSection = (index, key) => (e) => {
    const v = e.target.value
    setForm((prev) => {
      const next = [...(prev.additionalSections || [])]
      next[index] = { ...next[index], [key]: v }
      return { ...prev, additionalSections: next }
    })
  }

  const addAdditionalSection = () => {
    setForm((prev) => ({
      ...prev,
      additionalSections: [...(prev.additionalSections || []), { title: '', content: '' }],
    }))
  }

  const removeAdditionalSection = (index) => {
    setForm((prev) => ({
      ...prev,
      additionalSections: (prev.additionalSections || []).filter((_, i) => i !== index),
    }))
  }

  const handleGenerate = useCallback(
    (e) => {
      e.preventDefault()
      setSubject(generateConferenceSubject(form))
      setPlain(generateConferenceEmailPlain(form))
      setHtml(buildConferenceEmailHtml(form))
    },
    [form],
  )

  const handleReset = () => {
    setForm({
      ...INITIAL_FORM,
      contacts: [{ ...INITIAL_CONTACT }],
      additionalSections: [],
    })
    setSubject('')
    setPlain('')
    setHtml('')
  }

  const copySubject = async () => {
    if (!subject) return
    try {
      await navigator.clipboard.writeText(subject)
      setSubjectCopied(true)
      setTimeout(() => setSubjectCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  const copyBody = async () => {
    if (!plain) return
    try {
      if (html && typeof ClipboardItem !== 'undefined') {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([html], { type: 'text/html' }),
              'text/plain': new Blob([plain], { type: 'text/plain' }),
            }),
          ])
        } catch {
          await navigator.clipboard.writeText(plain)
        }
      } else {
        await navigator.clipboard.writeText(plain)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  return (
    <>
      <aside className="form-panel conference-kbyg-form-panel">
        <form onSubmit={handleGenerate} className="form">
          <fieldset className="form-fieldset">
            <legend>Email</legend>
            <label>
              Greeting names
              <input
                type="text"
                value={form.greetingNames}
                onChange={update('greetingNames')}
                placeholder="e.g. booth team, everyone"
              />
            </label>
            <label>
              Conference / event name
              <input
                type="text"
                value={form.conferenceName}
                onChange={update('conferenceName')}
                placeholder="e.g. ElasticON 2026"
              />
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>TL;DR</legend>
            <label>
              TL;DR
              <textarea value={form.tldrText} onChange={update('tldrText')} placeholder="Short summary for staff…" rows={4} />
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>Event dates &amp; hours</legend>
            <label>
              Event dates &amp; hours
              <textarea
                value={form.eventDatesHours}
                onChange={update('eventDatesHours')}
                placeholder="e.g. Wed 9am–6pm, Thu 10am–5pm exhibitor hours…"
                rows={4}
              />
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>Tickets</legend>
            <label>
              Tickets
              <textarea value={form.ticketsText} onChange={update('ticketsText')} placeholder="Badge pickup, exhibitor passes, guest list…" rows={3} />
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>Location</legend>
            <label>
              Venue
              <input type="text" value={form.locationVenue} onChange={update('locationVenue')} placeholder="e.g. Moscone South" />
            </label>
            <label>
              Address
              <input type="text" value={form.locationAddress} onChange={update('locationAddress')} placeholder="Street, city, region" />
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>Contacts</legend>
            {(form.contacts || []).map((contact, index) => (
              <div key={index} className="contact-row">
                <label>
                  Name
                  <input type="text" value={contact.name} onChange={updateContact(index, 'name')} placeholder="e.g. Jane Smith" />
                </label>
                <label>
                  Role
                  <input type="text" value={contact.role} onChange={updateContact(index, 'role')} placeholder="e.g. booth lead" />
                </label>
                <label>
                  Email
                  <input type="email" value={contact.email} onChange={updateContact(index, 'email')} placeholder="e.g. jane@example.com" autoComplete="off" />
                </label>
                <label>
                  Phone
                  <input type="text" value={contact.phone} onChange={updateContact(index, 'phone')} placeholder="e.g. +1 …" autoComplete="off" />
                </label>
              </div>
            ))}
            <button type="button" onClick={addContact} className="btn-add-speaker">
              + Add contact
            </button>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>Booth setup &amp; teardown</legend>
            <label>
              Booth setup &amp; teardown
              <textarea
                value={form.boothSetupTeardown}
                onChange={update('boothSetupTeardown')}
                placeholder="Build / strike times, deliveries, power, rigging…"
                rows={4}
              />
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>Swag</legend>
            <label>
              Swag
              <textarea value={form.swagText} onChange={update('swagText')} placeholder="What to bring, inventory, giveaways…" rows={3} />
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>Parking</legend>
            <label>
              Parking
              <textarea value={form.parkingText} onChange={update('parkingText')} placeholder="Lots, validation, load-in…" rows={3} />
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>Food &amp; beverage</legend>
            <label>
              Food &amp; beverage
              <textarea value={form.foodBeverageText} onChange={update('foodBeverageText')} placeholder="Catering, staff meals, hospitality suite…" rows={3} />
            </label>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>Additional sections</legend>
            <p className="form-hint">Optional custom sections (title + content). Travel &amp; expenses are added automatically to the output.</p>
            {(form.additionalSections || []).map((sec, index) => (
              <div key={index} className="contact-row conference-additional-section">
                <label>
                  Section title
                  <input
                    type="text"
                    value={sec.title}
                    onChange={updateAdditionalSection(index, 'title')}
                    placeholder="e.g. Evening event"
                  />
                </label>
                <label>
                  Content
                  <textarea value={sec.content} onChange={updateAdditionalSection(index, 'content')} placeholder="Details…" rows={3} />
                </label>
                <button type="button" className="btn-reset" onClick={() => removeAdditionalSection(index)}>
                  Remove section
                </button>
              </div>
            ))}
            <button type="button" onClick={addAdditionalSection} className="btn-add-speaker">
              + Add section
            </button>
          </fieldset>

          <button type="submit" className="btn-generate">
            Generate email
          </button>
          <button type="button" onClick={handleReset} className="btn-reset">
            🔄 Reset form
          </button>
        </form>
      </aside>

      <main className="output-panel conference-kbyg-output-panel">
        <div className="output-header">
          <h2>Generated email</h2>
        </div>
        <div className="output-content">
          {plain ? (
            <>
              {subject && (
                <div className="subject-line-section">
                  <h3 className="subject-line-heading">Subject line</h3>
                  <pre className="output-text subject-line-text">{subject}</pre>
                  <div className="output-actions">
                    <button type="button" onClick={copySubject} className="btn-copy" aria-pressed={subjectCopied}>
                      {subjectCopied ? 'Copied!' : 'Copy subject'}
                    </button>
                  </div>
                </div>
              )}
              <h3 className="generated-email-heading">Email body</h3>
              {html ? (
                <div className="meetup-page-preview output-text" dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                <pre className="output-text">{plain}</pre>
              )}
              <div className="output-actions">
                <button type="button" onClick={copyBody} className="btn-copy" aria-pressed={copied}>
                  {copied ? 'Copied!' : 'Copy to clipboard'}
                </button>
              </div>
            </>
          ) : (
            <p className="output-placeholder">
              Fill in the form and click &quot;Generate email&quot; to create the conference booth logistics email.
            </p>
          )}
        </div>
      </main>
    </>
  )
}
