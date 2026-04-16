import { useState, useCallback, useRef, useEffect } from 'react'

function escapeHtml(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeHtmlAttr(s) {
  if (s == null) return ''
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

/** Appended to every generated output (no form field). */
const STANDARD_TRAVEL_EXPENSES_TEXT =
  'Travel & expenses: follow your regional policy for submitting receipts and expense reports. Code charges to the project indicated by your manager. For policy questions, contact your People or Finance partner.'

const INITIAL_CONTACT = { name: '', role: '', email: '', phone: '', group: '' }

const CONTACT_GROUP_OPTIONS = [
  { value: '', label: 'No group' },
  { value: 'devrel_onsite', label: 'DevRel Onsite Support' },
  { value: 'devrel_remote', label: 'DevRel Remote Support' },
  { value: 'conference_organizer', label: 'Conference Organizer' },
]

const CONTACT_GROUP_LABELS = {
  devrel_onsite: 'DevRel Onsite Support',
  devrel_remote: 'DevRel Remote Support',
  conference_organizer: 'Conference Organizer',
}

const CONTACT_GROUP_ORDER = ['devrel_onsite', 'devrel_remote', 'conference_organizer']

/** Starter copy users can edit or clear; not re-applied after mount except on Reset. */
const DEFAULT_TLDR_TEXT = [
  'Bring all booth materials from your home',
  'Keep the original box for return shipping',
  'Check in at registration upon arrival',
  'Review booth schedule and staffing expectations',
].join('\n')

const DEFAULT_BOOTH_SETUP_LOGISTICS = [
  'Include standard setup instructions',
  'Include bringing swag, banner, table cloth, signs',
].join('\n')

const DEFAULT_SWAG_TEXT = [
  'Keep extra swag behind the table',
  'Replenish throughout the day',
  'Monitor distribution across event days',
].join('\n')

const DEFAULT_PARKING_TEXT =
  'Parking details vary by venue. Check event page or SpotHero.'

const DEFAULT_FOOD_BEVERAGE_TEXT =
  'Meals and snacks may be provided. Lunch is typically on your own.'

function getInitialForm() {
  return {
    conferenceName: '',
    knowBeforeYouGoDeckUrl: '',
    tldrText: DEFAULT_TLDR_TEXT,
    eventDatesBoothSetup: '',
    eventDatesBoothHours: '',
    eventDatesBoothCleanup: '',
    eventDatesNotes: '',
    eventDatesStaffingSchedule: '',
    ticketsText: '',
    locationVenue: '',
    locationAddress: '',
    contacts: [{ ...INITIAL_CONTACT }],
    boothSetupTeardown: DEFAULT_BOOTH_SETUP_LOGISTICS,
    avSetupRequirements: '',
    swagText: DEFAULT_SWAG_TEXT,
    parkingText: DEFAULT_PARKING_TEXT,
    foodBeverageText: DEFAULT_FOOD_BEVERAGE_TEXT,
    additionalSections: [],
  }
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

/** Name + optional role on first line; email and phone on following lines only if set. */
function formatContactBlockHtml(c) {
  const name = escapeHtml(trim(c.name))
  const firstLine = has(c.role) ? `${name} – ${escapeHtml(trim(c.role))}` : name
  const lines = [firstLine]
  if (has(c.email)) lines.push(escapeHtml(trim(c.email)))
  if (has(c.phone)) lines.push(escapeHtml(trim(c.phone)))
  return lines.join('<br>')
}

function formatContactBlockPlain(c) {
  const name = trim(c.name)
  const firstLine = has(c.role) ? `${name} – ${trim(c.role)}` : name
  const lines = [firstLine]
  if (has(c.email)) lines.push(trim(c.email))
  if (has(c.phone)) lines.push(trim(c.phone))
  return lines.join('\n')
}

function buildContactsSectionHtml(form) {
  const withName = (form.contacts || []).filter((c) => has(c.name))
  if (withName.length === 0) return ''

  const byGroup = new Map()
  for (const c of withName) {
    const g = trim(c.group)
    const key = CONTACT_GROUP_ORDER.includes(g) ? g : '_other'
    if (!byGroup.has(key)) byGroup.set(key, [])
    byGroup.get(key).push(c)
  }

  const chunks = []
  for (const key of CONTACT_GROUP_ORDER) {
    const list = byGroup.get(key)
    if (!list?.length) continue
    chunks.push(
      `<strong>${escapeHtml(CONTACT_GROUP_LABELS[key])}</strong><br><br>${list.map(formatContactBlockHtml).join('<br><br>')}`,
    )
  }

  const other = byGroup.get('_other') || []
  if (other.length) {
    const block = other.map(formatContactBlockHtml).join('<br><br>')
    if (chunks.length) {
      chunks.push(`<strong>Other contacts</strong><br><br>${block}`)
    } else {
      chunks.push(block)
    }
  }

  return `<strong>💬 Contacts</strong><br><br>${chunks.join('<br><br>')}`
}

function buildContactsSectionPlain(form) {
  const withName = (form.contacts || []).filter((c) => has(c.name))
  if (withName.length === 0) return ''

  const byGroup = new Map()
  for (const c of withName) {
    const g = trim(c.group)
    const key = CONTACT_GROUP_ORDER.includes(g) ? g : '_other'
    if (!byGroup.has(key)) byGroup.set(key, [])
    byGroup.get(key).push(c)
  }

  const hasGrouped = CONTACT_GROUP_ORDER.some((k) => (byGroup.get(k) || []).length > 0)

  const parts = ['💬 Contacts', '']
  for (const key of CONTACT_GROUP_ORDER) {
    const list = byGroup.get(key)
    if (!list?.length) continue
    parts.push(CONTACT_GROUP_LABELS[key], '')
    list.forEach((c) => {
      parts.push(formatContactBlockPlain(c))
      parts.push('')
    })
  }

  const other = byGroup.get('_other') || []
  if (other.length) {
    if (hasGrouped) {
      parts.push('Other contacts', '')
    }
    other.forEach((c) => {
      parts.push(formatContactBlockPlain(c))
      parts.push('')
    })
  }

  return parts.join('\n').replace(/\n+$/, '\n')
}

/** Auto subject: "[Event Name] Know Before You Go + [booth info]" (venue, else first line of address). */
function generateAutoSubjectLine(form) {
  const name = trim(form.conferenceName)
  const venue = trim(form.locationVenue)
  const addrFirst = trim(form.locationAddress).split('\n')[0]?.trim() || ''
  const boothInfo = venue || addrFirst
  const base = name ? `${name} Know Before You Go` : 'Know Before You Go'
  return boothInfo ? `${base} + ${boothInfo}` : base
}

/** Preserve newlines; each line escaped. */
function linesToHtmlPreserve(text) {
  return String(text ?? '')
    .split(/\n/)
    .map((line) => escapeHtml(line))
    .join('<br>')
}

function hasEventDatesAndHoursContent(form) {
  return (
    has(form.eventDatesBoothSetup) ||
    has(form.eventDatesBoothHours) ||
    has(form.eventDatesBoothCleanup) ||
    has(form.eventDatesNotes) ||
    has(form.eventDatesStaffingSchedule)
  )
}

function buildEventDatesAndHoursSectionHtml(form) {
  if (!hasEventDatesAndHoursContent(form)) return ''

  const subs = []
  if (has(form.eventDatesBoothSetup)) {
    subs.push(`Booth Setup: ${escapeHtml(trim(form.eventDatesBoothSetup))}`)
  }
  if (has(form.eventDatesBoothHours)) {
    subs.push(`Booth Hours:<br>${linesToHtmlPreserve(form.eventDatesBoothHours)}`)
  }
  if (has(form.eventDatesBoothCleanup)) {
    subs.push(`Booth Cleanup: ${escapeHtml(trim(form.eventDatesBoothCleanup))}`)
  }
  if (has(form.eventDatesNotes)) {
    subs.push(`Notes:<br>${linesToHtmlPreserve(form.eventDatesNotes)}`)
  }

  let html = `<strong>🗓 Event Dates &amp; Hours</strong>`
  if (subs.length > 0) {
    html += `<br><br>${subs.join('<br><br>')}`
  }
  if (has(form.eventDatesStaffingSchedule)) {
    html += `<br><br><strong>Staffing Schedule</strong><br>${linesToHtmlPreserve(form.eventDatesStaffingSchedule)}`
  }
  return html
}

function buildEventDatesAndHoursSectionPlain(form) {
  if (!hasEventDatesAndHoursContent(form)) return ''

  const lines = []
  lines.push('🗓 Event Dates & Hours', '')
  if (has(form.eventDatesBoothSetup)) {
    lines.push(`Booth Setup: ${trim(form.eventDatesBoothSetup)}`)
    lines.push('')
  }
  if (has(form.eventDatesBoothHours)) {
    lines.push('Booth Hours:')
    lines.push(trim(form.eventDatesBoothHours))
    lines.push('')
  }
  if (has(form.eventDatesBoothCleanup)) {
    lines.push(`Booth Cleanup: ${trim(form.eventDatesBoothCleanup)}`)
    lines.push('')
  }
  if (has(form.eventDatesNotes)) {
    lines.push('Notes:')
    lines.push(trim(form.eventDatesNotes))
    lines.push('')
  }
  if (has(form.eventDatesStaffingSchedule)) {
    lines.push('Staffing Schedule')
    lines.push(trim(form.eventDatesStaffingSchedule))
    lines.push('')
  }
  return lines.join('\n')
}

/** Event name for copy; fallback when field is empty. */
function eventNameLabel(form) {
  return trim(form.conferenceName) || 'the event'
}

function buildConferenceIntroHtml(form) {
  const name = eventNameLabel(form)
  const enc = escapeHtml(name)
  let html = `Hi Team,<br><br>`
  html += `First and foremost, thank you for attending ${enc} and helping out at the DevRel booth! We appreciate your help very much!`
  if (has(form.knowBeforeYouGoDeckUrl)) {
    const href = escapeHtmlAttr(trim(form.knowBeforeYouGoDeckUrl))
    html += `<br><br>For additional information, please take a look at the <a href="${href}" style="color:#1D4ED8;text-decoration:underline;">${enc} Know Before You Go slide deck</a>. If you have any questions, please don't hesitate to reach out.`
  }
  return html
}

function buildConferenceEmailHtml(form) {
  const confName = eventNameLabel(form)
  const parts = []

  parts.push(buildConferenceIntroHtml(form))
  if (has(form.conferenceName)) {
    parts.push(`<strong>Title</strong><br><br>${escapeHtml(trim(form.conferenceName))}`)
  }

  if (has(form.tldrText)) {
    const bullets = tldrTextToBulletsHtml(form.tldrText)
    parts.push(
      `<strong>📝 <span style="background-color: #FEF08A; font-weight: bold;">TL;DR</span></strong><br><br>${bullets}`,
    )
  }

  const eventDatesBlock = buildEventDatesAndHoursSectionHtml(form)
  if (eventDatesBlock) {
    parts.push(eventDatesBlock)
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

  const contactsHtml = buildContactsSectionHtml(form)
  if (contactsHtml) {
    parts.push(contactsHtml)
  }

  if (has(form.boothSetupTeardown)) {
    parts.push(
      `<strong>📢 Booth Setup &amp; Teardown</strong><br><br>${textToHtmlLines(form.boothSetupTeardown)}`,
    )
  }
  if (has(form.avSetupRequirements)) {
    parts.push(
      `<strong>🔌 AV / Setup Requirements</strong><br><br>${linesToHtmlPreserve(form.avSetupRequirements)}`,
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
    if (!has(c)) return
    const title = escapeHtml(t || 'Section')
    parts.push(`<strong>➕ ${title}</strong><br><br>${textToHtmlLines(sec.content)}`)
  })

  parts.push(
    `<strong>💵 Travel &amp; Expenses</strong><br><br>${escapeHtml(STANDARD_TRAVEL_EXPENSES_TEXT)}`,
  )
  parts.push(escapeHtml('Please reach out if anything changes on site or you need a hand.'))

  const inner = parts.filter((p) => String(p).trim().length > 0).join('<br><br>')
  return `<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#202124;">${inner}</div>`
}

function generateConferenceEmailPlain(form) {
  const confName = eventNameLabel(form)
  const lines = []

  lines.push('Hi Team', '')
  lines.push(
    `First and foremost, thank you for attending ${confName} and helping out at the DevRel booth! We appreciate your help very much!`,
    '',
  )
  if (has(form.knowBeforeYouGoDeckUrl)) {
    lines.push(
      `For additional information, please take a look at the ${confName} Know Before You Go slide deck (${trim(form.knowBeforeYouGoDeckUrl)}). If you have any questions, please don't hesitate to reach out.`,
      '',
    )
  }
  if (has(form.conferenceName)) {
    lines.push('Title')
    lines.push(trim(form.conferenceName))
    lines.push('')
  }

  if (has(form.tldrText)) {
    lines.push('📝 TL;DR')
    trim(form.tldrText)
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((l) => lines.push(`• ${l}`))
    lines.push('')
  }
  const eventDatesPlain = buildEventDatesAndHoursSectionPlain(form)
  if (eventDatesPlain) {
    lines.push(eventDatesPlain)
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

  const contactsPlain = buildContactsSectionPlain(form)
  if (contactsPlain) {
    lines.push(contactsPlain.trimEnd())
    lines.push('')
  }

  if (has(form.boothSetupTeardown)) {
    lines.push('📢 Booth Setup & Teardown')
    lines.push(trim(form.boothSetupTeardown))
    lines.push('')
  }
  if (has(form.avSetupRequirements)) {
    lines.push('🔌 AV / Setup Requirements')
    lines.push(trim(form.avSetupRequirements))
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
    if (!has(c)) return
    lines.push(`➕ ${t || 'Section'}`)
    lines.push(c)
    lines.push('')
  })

  lines.push('💵 Travel & Expenses')
  lines.push(STANDARD_TRAVEL_EXPENSES_TEXT)
  lines.push('')
  lines.push('Please reach out if anything changes on site or you need a hand.')

  return lines.join('\n')
}

export default function ConferenceKnowBeforeYouGo() {
  const [form, setForm] = useState(() => getInitialForm())
  const subjectManuallyEditedRef = useRef(false)
  const [subjectLine, setSubjectLine] = useState(() => generateAutoSubjectLine(getInitialForm()))
  const [plain, setPlain] = useState('')
  const [html, setHtml] = useState('')
  const [copied, setCopied] = useState(false)
  const [emailCopied, setEmailCopied] = useState(false)
  const [subjectCopied, setSubjectCopied] = useState(false)

  useEffect(() => {
    if (subjectManuallyEditedRef.current) return
    setSubjectLine(generateAutoSubjectLine(form))
  }, [form.conferenceName, form.locationVenue, form.locationAddress])

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

  const removeContact = (index) => {
    setForm((prev) => {
      const next = (prev.contacts || []).filter((_, i) => i !== index)
      return { ...prev, contacts: next.length ? next : [{ ...INITIAL_CONTACT }] }
    })
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
      setPlain(generateConferenceEmailPlain(form))
      setHtml(buildConferenceEmailHtml(form))
    },
    [form],
  )

  const handleReset = () => {
    const next = getInitialForm()
    subjectManuallyEditedRef.current = false
    setForm(next)
    setSubjectLine(generateAutoSubjectLine(next))
    setPlain('')
    setHtml('')
  }

  const copySubject = async () => {
    if (!subjectLine.trim()) return
    try {
      await navigator.clipboard.writeText(subjectLine.trim())
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

  /** Puts full body HTML on the clipboard for rich paste (e.g. Gmail). Falls back to writeText(html). */
  const copyForEmail = async () => {
    if (!html) return
    try {
      if (typeof ClipboardItem !== 'undefined') {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([html], { type: 'text/html' }),
              'text/plain': new Blob([plain || ''], { type: 'text/plain' }),
            }),
          ])
        } catch {
          await navigator.clipboard.writeText(html)
        }
      } else {
        await navigator.clipboard.writeText(html)
      }
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 2000)
    } catch (err) {
      console.error('Copy for email failed', err)
    }
  }

  return (
    <>
      <aside className="form-panel conference-kbyg-form-panel">
        <form onSubmit={handleGenerate} className="form">
          <fieldset className="form-fieldset">
            <legend>Email</legend>
            <label>
              Subject line
              <input
                type="text"
                value={subjectLine}
                onChange={(e) => {
                  subjectManuallyEditedRef.current = true
                  setSubjectLine(e.target.value)
                }}
                placeholder="e.g. ElasticON 2026 Know Before You Go + Booth 412"
                autoComplete="off"
              />
            </label>
            <span className="form-hint">
              Auto-fills from event name and location; if you edit this field, it won&apos;t auto-update until you reset the form.
            </span>
            <label>
              Event name
              <input
                type="text"
                value={form.conferenceName}
                onChange={update('conferenceName')}
                placeholder="e.g. ElasticON 2026"
              />
            </label>
            <label>
              Know Before You Go Deck URL
              <input
                type="url"
                value={form.knowBeforeYouGoDeckUrl}
                onChange={update('knowBeforeYouGoDeckUrl')}
                placeholder="https://…"
                autoComplete="off"
              />
            </label>
            <span className="form-hint">If provided, the generated email links to this deck. Leave blank to omit that sentence.</span>
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
              Booth Setup
              <textarea
                value={form.eventDatesBoothSetup}
                onChange={update('eventDatesBoothSetup')}
                placeholder="e.g. Build begins Tuesday 8am…"
                rows={3}
              />
            </label>
            <label>
              Booth Hours
              <textarea
                value={form.eventDatesBoothHours}
                onChange={update('eventDatesBoothHours')}
                placeholder="One line per block or day (line breaks preserved in the email)"
                rows={4}
              />
            </label>
            <label>
              Booth Cleanup
              <textarea
                value={form.eventDatesBoothCleanup}
                onChange={update('eventDatesBoothCleanup')}
                placeholder="e.g. Strike by 8pm Thursday…"
                rows={3}
              />
            </label>
            <label>
              Notes
              <textarea value={form.eventDatesNotes} onChange={update('eventDatesNotes')} placeholder="Anything else for dates &amp; hours…" rows={3} />
            </label>
            <label>
              Staffing Schedule <span className="form-hint">(optional)</span>
              <textarea
                value={form.eventDatesStaffingSchedule}
                onChange={update('eventDatesStaffingSchedule')}
                placeholder="Who is on booth when…"
                rows={3}
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
            <p className="form-hint">Only contacts with a name are included in the email. Use groups to organize onsite, remote, and organizer contacts.</p>
            {(form.contacts || []).map((contact, index) => (
              <div key={index} className="contact-row">
                <label>
                  Name <span className="form-hint">(required)</span>
                  <input
                    type="text"
                    value={contact.name}
                    onChange={updateContact(index, 'name')}
                    placeholder="e.g. Jane Smith"
                    aria-required="true"
                  />
                </label>
                <label>
                  Group (optional)
                  <select value={contact.group || ''} onChange={updateContact(index, 'group')} aria-label="Contact group">
                    {CONTACT_GROUP_OPTIONS.map((opt) => (
                      <option key={opt.value || 'none'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Role (optional)
                  <input type="text" value={contact.role} onChange={updateContact(index, 'role')} placeholder="e.g. booth lead" />
                </label>
                <label>
                  Email (optional)
                  <input type="email" value={contact.email} onChange={updateContact(index, 'email')} placeholder="e.g. jane@example.com" autoComplete="off" />
                </label>
                <label>
                  Phone (optional)
                  <input type="text" value={contact.phone} onChange={updateContact(index, 'phone')} placeholder="e.g. +1 …" autoComplete="off" />
                </label>
                {(form.contacts || []).length > 1 && (
                  <button type="button" className="btn-reset" onClick={() => removeContact(index)}>
                    Remove contact
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addContact} className="btn-add-speaker">
              Add Contact
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
            <legend>AV / Setup Requirements</legend>
            <label>
              AV / Setup Requirements
              <textarea
                value={form.avSetupRequirements}
                onChange={update('avSetupRequirements')}
                placeholder="Power, Wi‑Fi, displays, microphones, session AV…"
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
          {subjectLine.trim() ? (
            <div className="subject-line-section">
              <h3 className="subject-line-heading">Subject line</h3>
              <pre className="output-text subject-line-text">{subjectLine.trim()}</pre>
              <div className="output-actions">
                <button type="button" onClick={copySubject} className="btn-copy" aria-pressed={subjectCopied}>
                  {subjectCopied ? 'Copied!' : 'Copy Subject'}
                </button>
              </div>
            </div>
          ) : null}
          {plain ? (
            <>
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
                <button type="button" onClick={copyForEmail} className="btn-copy" aria-pressed={emailCopied}>
                  {emailCopied ? 'Copied!' : 'Copy for Email'}
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
