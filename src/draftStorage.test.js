import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  conferenceKbygHasContent,
  loadConferenceKbygDraft,
  saveConferenceKbygDraft,
} from './ConferenceKnowBeforeYouGo.jsx'
import { draftsEqual, mergeDraftRecord, readDraft, writeDraft } from './draftStorage.js'

function memoryStorage() {
  const store = new Map()
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('draft storage', () => {
  it('round-trips a draft and ignores corrupt data', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    expect(writeDraft('event-promotion-form-v1', { form: { eventTitle: 'March Meetup' } })).toBe(true)
    expect(readDraft('event-promotion-form-v1').form.eventTitle).toBe('March Meetup')
    localStorage.setItem('event-promotion-form-v1', '{not json')
    expect(readDraft('event-promotion-form-v1')).toBeNull()
  })

  it('keeps each generator draft under its own key', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    writeDraft('utm-url-builder-form-v1', { baseUrl: 'https://www.elastic.co' })
    writeDraft('qr-code-generator-form-v1', { qrLink: 'https://www.elastic.co/qr' })
    expect(readDraft('utm-url-builder-form-v1').baseUrl).toBe('https://www.elastic.co')
    expect(readDraft('qr-code-generator-form-v1').qrLink).toBe('https://www.elastic.co/qr')
  })

  it('merges only known fields and treats defaults as equal', () => {
    const initial = { title: '', emoji: true, notes: { a: true } }
    const merged = mergeDraftRecord(initial, { title: 'Hello', emoji: 'yes', extra: 'no', notes: { a: false } })
    expect(merged).toEqual({ title: 'Hello', emoji: true, notes: { a: false } })
    expect(draftsEqual(mergeDraftRecord(initial, { emoji: true, title: '' }), initial)).toBe(true)
  })

  it('does not throw when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(readDraft('event-promotion-form-v1')).toBeNull()
    expect(writeDraft('event-promotion-form-v1', { form: {} })).toBe(false)
  })
})

describe('conference know before you go draft', () => {
  it('treats a fresh form as empty and restores entered details', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    const fresh = loadConferenceKbygDraft()
    expect(conferenceKbygHasContent(fresh)).toBe(false)

    saveConferenceKbygDraft({
      ...fresh,
      form: { ...fresh.form, conferenceName: 'All Things Open' },
      subjectLine: 'Custom subject',
      subjectManuallyEdited: true,
    })

    const restored = loadConferenceKbygDraft()
    expect(restored.form.conferenceName).toBe('All Things Open')
    expect(restored.subjectLine).toBe('Custom subject')
    expect(restored.subjectManuallyEdited).toBe(true)
    expect(conferenceKbygHasContent(restored)).toBe(true)
  })
})
