import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ADVOCATE_NAME_STORAGE_KEY,
  MEETUP_FOLLOWUP_STORAGE_KEY,
  assertMeetupFollowUpClipboardHtmlShape,
  buildMeetupFollowUpClipboardHtml,
  copyMeetupFollowUpEmailToClipboard,
  generateMeetupFollowUpEmail,
  getResetMeetupFollowUpForm,
  loadMeetupFollowUpForm,
  loadSavedAdvocateName,
  saveMeetupFollowUpForm,
  saveSavedAdvocateName,
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
    })

    const reset = getResetMeetupFollowUpForm()
    expect(reset.meetupCity).toBe('')
    expect(reset.meetupName).toBe('')
    expect(reset.registrationPlatform).toBe('luma')
    expect(reset.advocateName).toBe('Sam')
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

describe('follow-up clipboard HTML', () => {
  const sampleForm = {
    meetupCity: 'NYC',
    meetupName: 'Elastic NYC Meetup',
    registrationPlatform: 'luma',
    advocateName: 'Olivia',
    talks: [
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
    ],
  }

  it('generates semantic HTML with anchors, ordered talks, and bulleted resources', () => {
    const { html, plain } = generateMeetupFollowUpEmail(sampleForm)
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
    const { html, plain } = generateMeetupFollowUpEmail(sampleForm)
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
    const { html, plain } = generateMeetupFollowUpEmail(sampleForm)
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
    const { html, plain } = generateMeetupFollowUpEmail(sampleForm)
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
