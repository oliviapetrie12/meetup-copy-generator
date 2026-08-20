import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ADVOCATE_NAME_STORAGE_KEY,
  MEETUP_FOLLOWUP_STORAGE_KEY,
  assertMeetupFollowUpClipboardHtmlShape,
  buildFollowUpUtm,
  buildMeetupFollowUpClipboardHtml,
  buildNextMeetupParagraph,
  copyMeetupFollowUpEmailToClipboard,
  formatNextMeetupDate,
  generateMeetupFollowUpEmail,
  getNextMeetupState,
  getResetMeetupFollowUpForm,
  isElasticCoHost,
  loadMeetupFollowUpForm,
  loadSavedAdvocateName,
  resolveNextMeetupEventUrl,
  saveMeetupFollowUpForm,
  saveSavedAdvocateName,
  validateMeetupFollowUpForm,
} from './meetupFollowUp.js'

function memoryStorage() {
  /** @type {Record<string, string>} */
  const store = {}
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v)
    },
    removeItem: (k) => {
      delete store[k]
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k])
    },
    _store: store,
  }
}

const baseTalks = [
  {
    id: 'a',
    talkTitle: 'Search 101',
    speakerName: 'Ada',
    slidesUrl: 'https://slides.example/search',
  },
  {
    id: 'b',
    talkTitle: 'Observability',
    speakerName: 'Ben',
    slidesUrl: 'https://slides.example/obs',
  },
]

function sampleForm(overrides = {}) {
  return {
    meetupCity: 'NYC',
    meetupName: 'Elastic NYC Meetup',
    registrationPlatform: 'luma',
    advocateName: 'Olivia',
    talks: baseTalks,
    nextMeetupName: '',
    nextMeetupUrl: '',
    nextMeetupDate: '',
    ...overrides,
  }
}

describe('advocate name localStorage', () => {
  beforeEach(() => {
    const mem = memoryStorage()
    vi.stubGlobal('localStorage', mem)
  })

  it('saves and loads advocate name with the namespaced key', () => {
    saveSavedAdvocateName('  Olivia  ')
    expect(localStorage.getItem(ADVOCATE_NAME_STORAGE_KEY)).toBe('Olivia')
    expect(loadSavedAdvocateName()).toBe('Olivia')
  })

  it('prefills advocate name when reopening the form', () => {
    saveSavedAdvocateName('Alex')
    const form = loadMeetupFollowUpForm()
    expect(form.advocateName).toBe('Alex')
  })

  it('reset form clears event fields but keeps saved advocate name', () => {
    saveSavedAdvocateName('Sam')
    saveMeetupFollowUpForm({
      meetupCity: 'NYC',
      meetupName: 'Elastic NYC',
      registrationPlatform: 'meetup',
      advocateName: 'Sam',
      talks: [
        {
          id: 't1',
          talkTitle: 'Talk A',
          speakerName: 'Jane',
          slidesUrl: 'https://example.com/a',
        },
      ],
      nextMeetupName: 'Next event',
      nextMeetupUrl: 'https://lu.ma/next',
      nextMeetupDate: '2026-09-24',
    })

    const reset = getResetMeetupFollowUpForm()
    expect(reset.meetupCity).toBe('')
    expect(reset.meetupName).toBe('')
    expect(reset.registrationPlatform).toBe('luma')
    expect(reset.advocateName).toBe('Sam')
    expect(reset.nextMeetupName).toBe('')
    expect(reset.nextMeetupUrl).toBe('')
    expect(reset.nextMeetupDate).toBe('')
    expect(reset.talks).toHaveLength(2)
    expect(reset.talks.every((t) => !t.talkTitle && !t.speakerName && !t.slidesUrl)).toBe(true)
    expect(localStorage.getItem(ADVOCATE_NAME_STORAGE_KEY)).toBe('Sam')
  })

  it('does not delete the namespaced advocate key when resetting event draft storage', () => {
    saveSavedAdvocateName('Jordan')
    localStorage.setItem(
      MEETUP_FOLLOWUP_STORAGE_KEY,
      JSON.stringify({
        meetupCity: 'London',
        meetupName: 'Elastic London',
        registrationPlatform: 'luma',
        advocateName: 'Jordan',
        talks: [],
      }),
    )
    const reset = getResetMeetupFollowUpForm()
    saveMeetupFollowUpForm(reset)
    expect(localStorage.getItem(ADVOCATE_NAME_STORAGE_KEY)).toBe('Jordan')
    expect(JSON.parse(localStorage.getItem(MEETUP_FOLLOWUP_STORAGE_KEY)).advocateName).toBe('Jordan')
    expect(JSON.parse(localStorage.getItem(MEETUP_FOLLOWUP_STORAGE_KEY)).meetupCity).toBe('')
  })

  it('handles blocked localStorage without throwing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => saveSavedAdvocateName('X')).not.toThrow()
    expect(loadSavedAdvocateName()).toBe('')
    expect(() => saveMeetupFollowUpForm({ advocateName: 'X' })).not.toThrow()
  })
})

describe('next meetup', () => {
  it('omits next-meetup language when the section is blank', () => {
    const { html, plain } = generateMeetupFollowUpEmail(sampleForm())
    expect(html).not.toContain('Join us at our next meetup')
    expect(plain).not.toContain('Join us at our next meetup')
  })

  it('flags incomplete pair when only name or only URL is entered', () => {
    const nameOnly = getNextMeetupState(sampleForm({ nextMeetupName: 'Agents' }))
    expect(nameOnly.incompletePair).toBe(true)
    expect(nameOnly.complete).toBe(false)
    expect(nameOnly.pairMessage).toMatch(/both event name and event page url/i)

    const urlOnly = getNextMeetupState(sampleForm({ nextMeetupUrl: 'https://lu.ma/x' }))
    expect(urlOnly.incompletePair).toBe(true)
    expect(urlOnly.complete).toBe(false)

    const { html } = generateMeetupFollowUpEmail(sampleForm({ nextMeetupName: 'Agents' }))
    expect(html).not.toContain('Join us at our next meetup')
  })

  it('validates invalid URL when name and URL are both present', () => {
    const v = validateMeetupFollowUpForm(
      sampleForm({ nextMeetupName: 'Agents', nextMeetupUrl: 'not-a-url' }),
    )
    expect(v.ok).toBe(false)
    expect(v.fieldErrors.nextMeetupUrl).toMatch(/valid http/i)
  })

  it('formats the date as Month Day, Year', () => {
    expect(formatNextMeetupDate('2026-09-24')).toBe('September 24, 2026')
  })

  it('outputs next meetup without a date', () => {
    const form = sampleForm({
      nextMeetupName: 'Building AI Agents with Elasticsearch',
      nextMeetupUrl: 'https://lu.ma/agents',
    })
    const para = buildNextMeetupParagraph(form, buildFollowUpUtm(form))
    expect(para.plain).toBe(
      'Join us at our next meetup: Building AI Agents with Elasticsearch (https://lu.ma/agents).',
    )
    expect(para.html).toBe(
      '<p>Join us at our next meetup: <a href="https://lu.ma/agents">Building AI Agents with Elasticsearch</a>.</p>',
    )

    const { html, plain } = generateMeetupFollowUpEmail(form)
    expect(html).toContain(para.html)
    expect(plain).toContain(para.plain)
    expect(html.indexOf('Join us at our next meetup')).toBeGreaterThan(html.indexOf('</ul>'))
    expect(html.indexOf('Join us at our next meetup')).toBeLessThan(
      html.indexOf('See you soon at the next meetup'),
    )
  })

  it('outputs next meetup with a formatted date', () => {
    const form = sampleForm({
      nextMeetupName: 'Building AI Agents with Elasticsearch',
      nextMeetupUrl: 'https://lu.ma/agents',
      nextMeetupDate: '2026-09-24',
    })
    const { html, plain } = generateMeetupFollowUpEmail(form)
    expect(plain).toContain(
      'Join us at our next meetup on September 24, 2026: Building AI Agents with Elasticsearch (https://lu.ma/agents).',
    )
    expect(html).toContain(
      '<p>Join us at our next meetup on September 24, 2026: <a href="https://lu.ma/agents">Building AI Agents with Elasticsearch</a>.</p>',
    )
  })

  it('includes next meetup in rich HTML and plain clipboard output', async () => {
    const form = sampleForm({
      nextMeetupName: 'Next Session',
      nextMeetupUrl: 'https://lu.ma/next',
    })
    const { html, plain } = generateMeetupFollowUpEmail(form)
    const clip = buildMeetupFollowUpClipboardHtml(html)
    expect(clip).toContain('<a href="https://lu.ma/next">Next Session</a>')
    expect(plain).toContain('Next Session (https://lu.ma/next)')

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
    const mode = await copyMeetupFollowUpEmailToClipboard(
      { html, plain },
      { clipboard, ClipboardItem: FakeClipboardItem },
    )
    expect(mode).toBe('html')
    const htmlText = await written[0][0].items['text/html'].text()
    expect(htmlText).toContain('Join us at our next meetup')
    expect(htmlText).toContain('href="https://lu.ma/next"')
    expect(htmlText.toLowerCase()).not.toContain('promote an upcoming meetup')
    expect(htmlText.toLowerCase()).not.toContain('next meetup (optional)')
  })

  it('preserves existing query parameters on event URLs', () => {
    const url = 'https://www.elastic.co/community/events?ref=promo&id=42'
    const resolved = resolveNextMeetupEventUrl(url, {
      utm_campaign: 'meetup-followup-cm',
      utm_source: 'luma',
      utm_medium: 'nyc',
    })
    const u = new URL(resolved)
    expect(u.searchParams.get('ref')).toBe('promo')
    expect(u.searchParams.get('id')).toBe('42')
    expect(u.searchParams.get('utm_campaign')).toBe('meetup-followup-cm')
  })

  it('adds UTMs for elastic.co hosts only', () => {
    expect(isElasticCoHost('https://www.elastic.co/events/foo')).toBe(true)
    expect(isElasticCoHost('https://lu.ma/agents')).toBe(false)
    expect(isElasticCoHost('https://www.meetup.com/x')).toBe(false)

    const utm = { utm_campaign: 'meetup-followup-cm', utm_source: 'luma', utm_medium: 'nyc' }
    const elastic = resolveNextMeetupEventUrl('https://www.elastic.co/community/events', utm)
    expect(elastic).toContain('utm_campaign=meetup-followup-cm')
    expect(elastic).toContain('utm_source=luma')
    expect(elastic).toContain('utm_medium=nyc')

    const luma = resolveNextMeetupEventUrl('https://lu.ma/agents?x=1', utm)
    expect(luma).toBe('https://lu.ma/agents?x=1')
    expect(luma).not.toContain('utm_')

    const meetup = resolveNextMeetupEventUrl('https://www.meetup.com/elastic/events/123', utm)
    expect(meetup).toBe('https://www.meetup.com/elastic/events/123')
    expect(meetup).not.toContain('utm_')
  })
})

describe('follow-up clipboard HTML', () => {
  it('generates semantic HTML with anchors, ordered talks, and bulleted resources', () => {
    const { html, plain } = generateMeetupFollowUpEmail(sampleForm())
    const clip = buildMeetupFollowUpClipboardHtml(html)
    const shape = assertMeetupFollowUpClipboardHtmlShape(clip)

    expect(shape.hasAnchors).toBe(true)
    expect(shape.hasOrderedList).toBe(true)
    expect(shape.hasUnorderedList).toBe(true)
    expect(shape.hasParagraphs).toBe(true)
    expect(shape.hasSignatureBreak).toBe(true)
    expect(shape.excludesChecklist).toBe(true)
    expect(shape.excludesClassAttr).toBe(true)
    expect(shape.excludesScript).toBe(true)

    expect(clip).toContain('href="https://slides.example/search"')
    expect(clip).toContain('utm_campaign=meetup-followup-cm')
    expect(clip).toContain('utm_source=luma')
    expect(clip).toContain('utm_medium=nyc')
    expect(clip).toContain('<br>Olivia</p>')
    expect(clip.toLowerCase()).not.toContain('internal checklist')
    expect(plain).toContain('Olivia')
    expect(plain).toContain('1. Search 101')
  })

  it('copies text/html and text/plain when ClipboardItem is supported', async () => {
    const { html, plain } = generateMeetupFollowUpEmail(sampleForm())
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

    const mode = await copyMeetupFollowUpEmailToClipboard(
      { html, plain },
      { clipboard, ClipboardItem: FakeClipboardItem },
    )
    expect(mode).toBe('html')
    expect(clipboard.write).toHaveBeenCalledTimes(1)
    expect(clipboard.writeText).not.toHaveBeenCalled()

    const item = written[0][0]
    expect(item.items['text/html']).toBeInstanceOf(Blob)
    expect(item.items['text/plain']).toBeInstanceOf(Blob)
    const htmlText = await item.items['text/html'].text()
    expect(htmlText).toContain('<ol>')
    expect(htmlText).toContain('<ul>')
    expect(htmlText).toContain('<a href="')
    expect(htmlText.toLowerCase()).not.toContain('internal checklist')
  })

  it('falls back to plain text when rich clipboard write fails', async () => {
    const { html, plain } = generateMeetupFollowUpEmail(sampleForm())
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

    const mode = await copyMeetupFollowUpEmailToClipboard(
      { html, plain },
      { clipboard, ClipboardItem: FakeClipboardItem },
    )
    expect(mode).toBe('plain')
    expect(clipboard.writeText).toHaveBeenCalledWith(plain)
  })

  it('falls back to plain text when ClipboardItem is unavailable', async () => {
    const { html, plain } = generateMeetupFollowUpEmail(sampleForm())
    const clipboard = {
      write: vi.fn(),
      writeText: vi.fn(async () => {}),
    }
    const mode = await copyMeetupFollowUpEmailToClipboard(
      { html, plain },
      { clipboard, ClipboardItem: undefined },
    )
    expect(mode).toBe('plain')
    expect(clipboard.writeText).toHaveBeenCalledWith(plain)
    expect(clipboard.write).not.toHaveBeenCalled()
  })
})
