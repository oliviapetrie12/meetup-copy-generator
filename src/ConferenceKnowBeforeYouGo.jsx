import { useState, useCallback } from 'react'

function escapeHtml(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const INITIAL_FORM = {
  greetingNames: '',
  conferenceName: '',
  conferenceDates: '',
  boothOrHall: '',
  scheduleText: '',
  setupText: '',
  contacts: [{ name: '', role: '', contactInfo: '' }],
  additionalNotes: '',
}

function buildConferenceTldrBullets(form) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const has = (s) => trim(s).length > 0
  const bullets = []
  const add = (condition, text) => {
    if (condition && text && bullets.length < 5) bullets.push(text)
  }

  if (has(form.conferenceDates)) add(true, `Dates: ${trim(form.conferenceDates)}.`)
  if (has(form.boothOrHall)) add(true, `Booth / hall: ${trim(form.boothOrHall)}.`)
  if (has(form.scheduleText)) {
    const first = trim(form.scheduleText).split(/\n+/).map((l) => l.trim()).filter(Boolean)[0]
    if (first) add(true, `Schedule: ${first}${trim(form.scheduleText).includes('\n') ? ' … (see Schedule below)' : ''}`)
  }
  if (has(form.setupText)) {
    const first = trim(form.setupText).split(/\n+/).map((l) => l.trim()).filter(Boolean)[0]
    if (first) add(true, `Setup: ${first}${trim(form.setupText).includes('\n') ? ' … (see Setup below)' : ''}`)
  }
  const hasAnyContact = (form.contacts || []).some((c) => has(c.name) || has(c.role) || has(c.contactInfo))
  add(hasAnyContact, 'Key contacts are listed in Contacts below.')

  return bullets.slice(0, 5)
}

function generateConferenceSubject(form) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const name = trim(form.conferenceName)
  const dates = trim(form.conferenceDates)
  if (!name) return 'Conference booth — Know before you go'
  return `${name} | Booth know-before-you-go${dates ? ` | ${dates}` : ''}`
}

function buildConferenceEmailHtml(form, includeTldr) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const has = (s) => trim(s).length > 0
  const names = trim(form.greetingNames) || 'team'
  const confName = trim(form.conferenceName) || 'the conference'

  const chunks = []
  chunks.push(`<p style="margin:0;line-height:1.5;">Hi ${escapeHtml(names)},</p>`)

  let titleBody = escapeHtml(confName)
  if (has(form.conferenceDates)) titleBody += `<br>${escapeHtml(trim(form.conferenceDates))}`
  if (has(form.boothOrHall)) titleBody += `<br>${escapeHtml(`Booth / location: ${trim(form.boothOrHall)}`)}`
  chunks.push(`<p style="margin:0;line-height:1.5;"><strong>Title</strong><br><br>${titleBody}</p>`)

  if (includeTldr) {
    const tldrBullets = buildConferenceTldrBullets(form)
    const tldrInner = tldrBullets.length
      ? `<span style="background-color: #FEF08A; font-weight: bold;">TL;DR</span><br><br>${tldrBullets.map((i) => `• ${escapeHtml(i)}`).join('<br>')}`
      : `<span style="background-color: #FEF08A; font-weight: bold;">TL;DR</span>`
    chunks.push(`<p style="margin:0;line-height:1.5;">${tldrInner}</p>`)
  }

  chunks.push(
    `<p style="margin:0;line-height:1.5;">${escapeHtml(
      `Below is booth logistics for ${confName}. Use this as a quick reference for staffing, setup, and who to contact on site.`,
    )}</p>`,
  )

  if (has(form.scheduleText)) {
    const lines = trim(form.scheduleText)
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
    const schedHtml = lines.map((b) => `• ${escapeHtml(b)}`).join('<br>')
    chunks.push(`<p style="margin:0;line-height:1.5;"><strong>Schedule</strong><br><br>${schedHtml}</p>`)
  }

  if (has(form.setupText)) {
    const lines = trim(form.setupText)
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
    const setupHtml = lines.map((b) => `• ${escapeHtml(b)}`).join('<br>')
    chunks.push(`<p style="margin:0;line-height:1.5;"><strong>Setup</strong><br><br>${setupHtml}</p>`)
  }

  const contactEntries = (form.contacts || []).filter((c) => has(c.name) || has(c.role) || has(c.contactInfo))
  if (contactEntries.length > 0) {
    const contactLines = contactEntries.map((c) => {
      const name = trim(c.name)
      const role = trim(c.role)
      const info = trim(c.contactInfo)
      let main = ''
      if (name && info) main = `${name} (${info})`
      else if (name) main = name
      else if (info) main = info
      let line = ''
      if (main && role) line = `${main} – ${role}`
      else if (main) line = main
      else line = role
      return `• ${escapeHtml(line)}`
    })
    chunks.push(`<p style="margin:0;line-height:1.5;"><strong>Contacts</strong><br><br>${contactLines.join('<br>')}</p>`)
  }

  if (has(form.additionalNotes)) {
    const notesHtml = escapeHtml(trim(form.additionalNotes)).replace(/\n/g, '<br>')
    chunks.push(`<p style="margin:0;line-height:1.5;"><strong>Additional notes</strong><br><br>${notesHtml}</p>`)
  }

  chunks.push(`<p style="margin:0;line-height:1.5;">${escapeHtml('Please reach out if anything changes on site or you need a hand.')}</p>`)

  const body = chunks.join('<br><br>')
  return `<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#202124;">${body}</div>`
}

function generateConferenceEmailPlain(form, includeTldr) {
  const trim = (s) => (typeof s === 'string' ? s.trim() : '')
  const has = (s) => trim(s).length > 0
  const section = (t) => `**${t}**`
  const names = trim(form.greetingNames) || 'team'
  const confName = trim(form.conferenceName) || 'the conference'

  const lines = []
  lines.push(`Hi ${names},`, '')

  lines.push(section('Title'))
  lines.push(confName)
  if (has(form.conferenceDates)) lines.push(trim(form.conferenceDates))
  if (has(form.boothOrHall)) lines.push(`Booth / location: ${trim(form.boothOrHall)}`)
  lines.push('')

  if (includeTldr) {
    lines.push(section('TL;DR'))
    buildConferenceTldrBullets(form).forEach((b) => lines.push(`- ${b}`))
    lines.push('')
  }

  lines.push(
    `Below is booth logistics for ${confName}. Use this as a quick reference for staffing, setup, and who to contact on site.`,
    '',
  )

  if (has(form.scheduleText)) {
    lines.push(section('Schedule'))
    trim(form.scheduleText)
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((l) => lines.push(`- ${l}`))
    lines.push('')
  }

  if (has(form.setupText)) {
    lines.push(section('Setup'))
    trim(form.setupText)
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((l) => lines.push(`- ${l}`))
    lines.push('')
  }

  const contactEntries = (form.contacts || []).filter((c) => has(c.name) || has(c.role) || has(c.contactInfo))
  if (contactEntries.length > 0) {
    lines.push(section('Contacts'))
    contactEntries.forEach((c) => {
      const name = trim(c.name)
      const role = trim(c.role)
      const info = trim(c.contactInfo)
      let main = ''
      if (name && info) main = `${name} (${info})`
      else if (name) main = name
      else if (info) main = info
      if (main && role) lines.push(`- ${main} – ${role}`)
      else if (main) lines.push(`- ${main}`)
      else if (role) lines.push(`- ${role}`)
    })
    lines.push('')
  }

  if (has(form.additionalNotes)) {
    lines.push(section('Additional notes'))
    lines.push(trim(form.additionalNotes))
    lines.push('')
  }

  lines.push('Please reach out if anything changes on site or you need a hand.')
  return lines.join('\n')
}

export default function ConferenceKnowBeforeYouGo() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [includeTldr, setIncludeTldr] = useState(true)
  const [subject, setSubject] = useState('')
  const [plain, setPlain] = useState('')
  const [html, setHtml] = useState('')
  const [copied, setCopied] = useState(false)
  const [subjectCopied, setSubjectCopied] = useState(false)

  const update = (key) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
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
      contacts: [...(prev.contacts || []), { name: '', role: '', contactInfo: '' }],
    }))
  }

  const handleGenerate = useCallback(
    (e) => {
      e.preventDefault()
      setSubject(generateConferenceSubject(form))
      const text = generateConferenceEmailPlain(form, includeTldr)
      const h = buildConferenceEmailHtml(form, includeTldr)
      setPlain(text)
      setHtml(h)
    },
    [form, includeTldr],
  )

  const handleReset = () => {
    setForm(INITIAL_FORM)
    setIncludeTldr(true)
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
          </fieldset>
          <fieldset className="form-fieldset">
            <legend>Conference &amp; booth</legend>
            <label>
              Conference name
              <input
                type="text"
                value={form.conferenceName}
                onChange={update('conferenceName')}
                placeholder="e.g. ElasticON 2026"
              />
            </label>
            <label>
              Dates
              <input
                type="text"
                value={form.conferenceDates}
                onChange={update('conferenceDates')}
                placeholder="e.g. March 4–6, 2026"
              />
            </label>
            <label>
              Booth # / hall / floor
              <input
                type="text"
                value={form.boothOrHall}
                onChange={update('boothOrHall')}
                placeholder="e.g. Hall B, booth 412"
              />
            </label>
          </fieldset>
          <fieldset className="form-fieldset">
            <legend>Schedule</legend>
            <label>
              Staffing / schedule
              <textarea
                value={form.scheduleText}
                onChange={update('scheduleText')}
                placeholder="One line per block or day (e.g. Wed 9–5 staffing: …)"
                rows={5}
              />
            </label>
          </fieldset>
          <fieldset className="form-fieldset">
            <legend>Setup</legend>
            <label>
              Booth setup &amp; logistics
              <textarea
                value={form.setupText}
                onChange={update('setupText')}
                placeholder="Build times, deliveries, power, Wi‑Fi, signage…"
                rows={5}
              />
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
                  <input type="text" value={contact.role} onChange={updateContact(index, 'role')} placeholder="e.g. booth lead, on-site AV" />
                </label>
                <label>
                  Email or Slack
                  <input type="text" value={contact.contactInfo} onChange={updateContact(index, 'contactInfo')} placeholder="e.g. jane@example.com" />
                </label>
              </div>
            ))}
            <button type="button" onClick={addContact} className="btn-add-speaker">
              + Add contact
            </button>
          </fieldset>
          <fieldset className="form-fieldset">
            <legend>Additional</legend>
            <label>
              Additional notes
              <textarea value={form.additionalNotes} onChange={update('additionalNotes')} placeholder="Parking, badges, shipping, evening events…" rows={3} />
            </label>
          </fieldset>
          <label className="checkbox-label">
            <input type="checkbox" checked={includeTldr} onChange={(e) => setIncludeTldr(e.target.checked)} />
            Include TL;DR summary
          </label>
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
