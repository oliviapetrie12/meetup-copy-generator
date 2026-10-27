import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PRELIMINARY_BOOTH_STAFF_STORAGE_KEY,
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

function sampleForm(overrides = {}) {
  return updatePreliminaryBoothStaffForm(getInitialPreliminaryBoothStaffForm(), {
    conferenceName: 'All Things Open',
    eventDates: 'March 16–18',
    location: 'Raleigh, NC',
    sponsorshipDetails: 'Booth and a 40-minute workshop',
    registrationDeadline: 'March 6',
    registrationLink: 'https://reg.example.com/ato',
    registrationCode: 'BOOTH2026',
    additionalNote: 'A few extra staff passes are available.',
    senderName: 'Olivia',
    ...overrides,
  })
}

function memoryStorage() {
  const store = new Map()
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('preliminary booth staff email', () => {
  it('builds the subject from the conference name and keeps a manual edit', () => {
    const form = sampleForm()
    expect(form.subject).toBe('All Things Open: Preliminary Booth Staffing & Registration')
    expect(defaultSubject('')).toBe('[conference name]: Preliminary Booth Staffing & Registration')

    const edited = updatePreliminaryBoothStaffForm(form, {
      subject: 'ATO: Booth staff registration',
      subjectManual: true,
      conferenceName: 'All Things Open 2026',
    })
    expect(edited.subject).toBe('ATO: Booth staff registration')
    expect(generatePreliminaryBoothStaffEmail(edited).subject).toBe('ATO: Booth staff registration')
  })

  it('includes the registration code, optional details, and a linked registration step', () => {
    const email = generatePreliminaryBoothStaffEmail(sampleForm())
    expect(email.plain).toContain('Hi team,')
    expect(email.plain).toContain(
      'Thank you for helping staff the DevRel booth at All Things Open on March 16–18! I wanted to share some preliminary details and registration instructions.',
    )
    expect(email.plain).toContain('🎟️ Registration')
    expect(email.plain).toContain('Please register by March 6:')
    expect(email.plain).toContain('1. Visit All Things Open (https://reg.example.com/ato).')
    expect(email.plain).toContain('2. Use code BOOTH2026 to redeem your booth staff pass.')
    expect(email.plain).toContain('3. Let me know once you’ve registered.')
    expect(email.plain).toContain('- Dates: March 16–18')
    expect(email.plain).toContain('- Location: Raleigh, NC')
    expect(email.plain).toContain('- Elastic sponsorship: Booth and a 40-minute workshop')
    expect(email.plain).toContain('A few extra staff passes are available.')
    expect(email.plain.endsWith('Thanks again for your help!\nOlivia')).toBe(true)
    expect(email.html).toContain(
      '<a href="https://reg.example.com/ato">All Things Open</a>',
    )
    expect(email.html).toContain('<ol>')
    expect(email.html).not.toContain('class=')
  })

  it('omits the code step and renumbers when no code is provided', () => {
    const email = generatePreliminaryBoothStaffEmail(sampleForm({ registrationCode: '' }))
    expect(email.plain).toContain('1. Visit All Things Open (https://reg.example.com/ato).')
    expect(email.plain).toContain('2. Let me know once you’ve registered.')
    expect(email.plain).not.toContain('Use code')
    expect(email.plain).not.toContain('3. ')
    expect(email.html).not.toContain('Use code')
  })

  it('omits blank optional details and the registration section when registration is empty', () => {
    const email = generatePreliminaryBoothStaffEmail(
      sampleForm({
        location: '',
        sponsorshipDetails: '   ',
        registrationDeadline: '',
        registrationLink: '',
        registrationCode: '',
        additionalNote: '',
        senderName: '  ',
      }),
    )
    expect(email.plain).toContain(
      'Thank you for helping staff the DevRel booth at All Things Open on March 16–18! I wanted to share some preliminary details.',
    )
    expect(email.plain).not.toContain('registration instructions')
    expect(email.plain).not.toContain('🎟️ Registration')
    expect(email.plain).not.toContain('Location:')
    expect(email.plain).not.toContain('Elastic sponsorship:')
    expect(email.plain).toContain('- Dates: March 16–18')
    expect(email.plain).toContain('Event Overview')
    expect(email.plain).not.toContain('extra staff passes')
    expect(email.plain.endsWith('Thanks again for your help!')).toBe(true)
    expect(email.html).not.toContain('<a ')
  })

  it('drops the event overview when dates, location, and sponsorship are blank', () => {
    const email = generatePreliminaryBoothStaffEmail(
      sampleForm({
        eventDates: '',
        location: '',
        sponsorshipDetails: '',
        additionalNote: '',
        senderName: '',
      }),
    )
    expect(email.plain).not.toContain('Event Overview')
    expect(email.plain).toContain('Booth Staffing and Logistics')
    expect(email.plain).toContain('at All Things Open!')
    expect(email.plain).not.toContain(' on ')
  })

  it('uses edited registration steps and still links the registration link text', () => {
    const form = updatePreliminaryBoothStaffForm(sampleForm({ registrationCode: 'SHOULD-NOT-APPEAR' }), {
      registrationInstructions:
        'Create an account on the host site.\n\n1. Open All Things Open and choose Booth Staff.\n2. Email me when the pass is confirmed.',
      registrationInstructionsManual: true,
    })
    const email = generatePreliminaryBoothStaffEmail(form)
    expect(email.plain).toContain('Create an account on the host site.')
    expect(email.plain).toContain('1. Open All Things Open (https://reg.example.com/ato) and choose Booth Staff.')
    expect(email.plain).toContain('2. Email me when the pass is confirmed.')
    expect(email.plain).not.toContain('SHOULD-NOT-APPEAR')
    expect(email.plain).not.toContain('Use code')
    expect(email.html).toContain('<a href="https://reg.example.com/ato">All Things Open</a>')
  })

  it('requires a conference name and a valid registration link', () => {
    expect(validatePreliminaryBoothStaffForm(getInitialPreliminaryBoothStaffForm()).ok).toBe(false)
    expect(validatePreliminaryBoothStaffForm(sampleForm()).ok).toBe(true)
    const invalid = validatePreliminaryBoothStaffForm(sampleForm({ registrationLink: 'not a url' }))
    expect(invalid.ok).toBe(false)
    expect(invalid.fieldErrors.registrationLink).toMatch(/http/)
  })

  it('treats a fresh form as empty and a named conference as a draft', () => {
    expect(isPreliminaryBoothStaffFormEmpty(getInitialPreliminaryBoothStaffForm())).toBe(true)
    expect(isPreliminaryBoothStaffFormEmpty(sampleForm())).toBe(false)
    const linkTextOnly = updatePreliminaryBoothStaffForm(getInitialPreliminaryBoothStaffForm(), {
      registrationLinkText: 'Custom portal',
      registrationLinkTextManual: true,
    })
    expect(isPreliminaryBoothStaffFormEmpty(linkTextOnly)).toBe(false)
  })

  it('saves and restores each draft separately from the other generators', () => {
    const form = updatePreliminaryBoothStaffForm(sampleForm(), {
      subject: 'Custom subject',
      subjectManual: true,
      registrationInstructions: '1. Visit All Things Open.',
      registrationInstructionsManual: true,
    })
    savePreliminaryBoothStaffForm(form)
    localStorage.setItem('conference-followup-form-v1', JSON.stringify({ conferenceName: 'Other event' }))

    const loaded = loadPreliminaryBoothStaffForm()
    expect(loaded.conferenceName).toBe('All Things Open')
    expect(loaded.subject).toBe('Custom subject')
    expect(loaded.registrationInstructions).toBe('1. Visit All Things Open.')
    expect(loaded.registrationCode).toBe('BOOTH2026')
    expect(JSON.parse(localStorage.getItem('conference-followup-form-v1')).conferenceName).toBe('Other event')
    expect(localStorage.getItem(PRELIMINARY_BOOTH_STAFF_STORAGE_KEY)).toContain('All Things Open')
  })

  it('keeps ordered-list numbers and the registration URL in an edited body', () => {
    const plain = preliminaryBoothStaffHtmlToPlain(
      '<p>Hi team,</p><ol><li>Visit <a href="https://reg.example.com/ato">All Things Open</a>.</li><li>Let me know once you’ve registered.</li></ol>',
    )
    expect(plain).toContain('1. Visit All Things Open (https://reg.example.com/ato).')
    expect(plain).toContain('2. Let me know once you’ve registered.')
  })
})

describe('preliminary booth staff clipboard', () => {
  it('copies text/html and text/plain with the registration link', async () => {
    const email = generatePreliminaryBoothStaffEmail(sampleForm())
    const written = []
    const clipboard = {
      write: vi.fn(async (items) => {
        written.push(items)
      }),
      writeText: vi.fn(),
    }
    class FakeClipboardItem {
      constructor(items) {
        this.items = items
      }
    }
    const mode = await copyPreliminaryBoothStaffEmailToClipboard(email, {
      clipboard,
      ClipboardItem: FakeClipboardItem,
    })
    expect(mode).toBe('html')
    const htmlText = await written[0][0].items['text/html'].text()
    const plainText = await written[0][0].items['text/plain'].text()
    expect(htmlText).toContain('<a href="https://reg.example.com/ato">All Things Open</a>')
    expect(plainText).toContain('https://reg.example.com/ato')
    expect(plainText).toContain('Use code BOOTH2026')
  })

  it('falls back to plain text when rich clipboard write fails', async () => {
    const email = generatePreliminaryBoothStaffEmail(sampleForm({ registrationCode: '' }))
    const clipboard = {
      write: vi.fn(async () => {
        throw new Error('denied')
      }),
      writeText: vi.fn(async () => {}),
    }
    class FakeClipboardItem {
      constructor(items) {
        this.items = items
      }
    }
    const mode = await copyPreliminaryBoothStaffEmailToClipboard(email, {
      clipboard,
      ClipboardItem: FakeClipboardItem,
    })
    expect(mode).toBe('plain')
    expect(clipboard.writeText).toHaveBeenCalledWith(email.plain)
    expect(email.plain).not.toContain('Use code')
  })
})
