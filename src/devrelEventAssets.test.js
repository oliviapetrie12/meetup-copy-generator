import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APPROVED_SOCIAL_CHANNELS,
  BRAND_ASSET_LINKS,
  EVENT_ASSETS_STORAGE_KEY,
  assertEventAssetsClipboardHtmlShape,
  buildEventAssetsClipboardHtml,
  copyEventAssetsToClipboard,
  generateEventAssetsDocument,
  getEventAssetsStrings,
  getInitialEventAssetsForm,
  getResetEventAssetsForm,
  isEventAssetsFormEmpty,
  isValidContactEmail,
  loadEventAssetsForm,
  saveEventAssetsForm,
  validateEventAssetsForm,
} from './devrelEventAssets.js'

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
  }
}

function sampleForm(overrides = {}) {
  return {
    ...getInitialEventAssetsForm(),
    eventName: 'TDC São Paulo',
    language: 'en',
    eventType: 'conference',
    ...overrides,
  }
}

describe('event assets form persistence', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })

  it('saves and loads form state', () => {
    saveEventAssetsForm(sampleForm({ speakerName: 'Ada' }))
    expect(localStorage.getItem(EVENT_ASSETS_STORAGE_KEY)).toBeTruthy()
    const loaded = loadEventAssetsForm()
    expect(loaded.eventName).toBe('TDC São Paulo')
    expect(loaded.speakerName).toBe('Ada')
    expect(loaded).not.toHaveProperty('focusArea')
  })

  it('falls back to defaults for unknown language and type', () => {
    saveEventAssetsForm(sampleForm({ language: 'es', eventType: 'gala' }))
    const loaded = loadEventAssetsForm()
    expect(loaded.language).toBe('en')
    expect(loaded.eventType).toBe('conference')
  })

  it('reset returns empty defaults and empty-form detection works', () => {
    expect(isEventAssetsFormEmpty(getResetEventAssetsForm())).toBe(true)
    expect(isEventAssetsFormEmpty(sampleForm())).toBe(false)
  })
})

describe('event assets validation', () => {
  it('requires an event name', () => {
    const v = validateEventAssetsForm(getInitialEventAssetsForm())
    expect(v.ok).toBe(false)
    expect(v.fieldErrors.eventName).toMatch(/required/i)
  })

  it('accepts empty email and rejects invalid email', () => {
    expect(isValidContactEmail('')).toBe(true)
    expect(isValidContactEmail('meetups@elastic.co')).toBe(true)
    expect(isValidContactEmail('not-an-email')).toBe(false)
    const v = validateEventAssetsForm(sampleForm({ contactEmail: 'nope' }))
    expect(v.ok).toBe(false)
    expect(v.fieldErrors.contactEmail).toMatch(/valid email/i)
  })
})

describe('event assets document generation', () => {
  it('includes required sections and brand links in English', () => {
    const { html, plain } = generateEventAssetsDocument(sampleForm())
    const t = getEventAssetsStrings('en')

    expect(html).toContain(`<h1>${t.documentTitle}</h1>`)
    expect(html).toContain('TDC São Paulo')
    expect(html).toContain('Conference')
    expect(html).toContain(t.aboutElasticHeading)
    expect(html).toContain(t.aboutElasticBody)
    expect(html).toContain(t.developerRelationsHeading)
    expect(html).toContain(t.developerRelationsBody)
    expect(html).not.toContain('Areas of Focus')
    expect(html).not.toContain('Áreas de foco')
    expect(html).toContain(BRAND_ASSET_LINKS.logo)
    expect(html).toContain(BRAND_ASSET_LINKS.brandGuidelines)
    expect(html).toContain(`href="${BRAND_ASSET_LINKS.logo}"`)
    expect(html).toContain(`<a href="${BRAND_ASSET_LINKS.logo}">${t.elasticLogoLabel}</a>`)
    expect(html).not.toContain(`>${BRAND_ASSET_LINKS.logo}</a>`)
    expect(html).toContain('lang="en"')

    expect(plain).toContain(t.documentTitle)
    expect(plain).toContain('Event: TDC São Paulo')
    expect(plain).toContain(BRAND_ASSET_LINKS.logo)
  })

  it('hides optional sections when their fields are empty', () => {
    const { html, plain } = generateEventAssetsDocument(sampleForm())
    const t = getEventAssetsStrings('en')
    expect(html).not.toContain(t.eventParticipationHeading)
    expect(html).not.toContain(t.speakerInformationHeading)
    expect(html).not.toContain(t.sessionInformationHeading)
    expect(html).not.toContain(t.eventContactHeading)
    expect(plain).not.toContain(t.eventParticipationHeading)
    expect(plain).not.toContain(t.speakerInformationHeading)
  })

  it('includes optional sections only when provided', () => {
    const { html, plain } = generateEventAssetsDocument(
      sampleForm({
        participationDetails: 'Gold sponsor and a workshop.',
        speakerName: 'Jane Smith',
        speakerTitle: 'Principal Developer Advocate',
        speakerBio: 'Works on search.',
        sessionTitle: 'Search AI 101',
        sessionDescription: 'A hands-on intro.',
        contactName: 'Olivia Petrie',
        contactEmail: 'meetups@elastic.co',
      }),
    )
    const t = getEventAssetsStrings('en')
    expect(html).toContain(t.eventParticipationHeading)
    expect(html).toContain('Gold sponsor and a workshop.')
    expect(html).toContain(t.speakerInformationHeading)
    expect(html).toContain('Jane Smith')
    expect(html).toContain('Principal Developer Advocate')
    expect(html).toContain(t.sessionInformationHeading)
    expect(html).toContain('Search AI 101')
    expect(html).toContain(t.eventContactHeading)
    expect(html).toContain('Olivia Petrie')
    expect(html).toContain('mailto:meetups@elastic.co')
    expect(plain).toContain('Gold sponsor and a workshop.')
    expect(plain).toContain('meetups@elastic.co')
  })

  it('does not translate user-entered free text when language is Portuguese', () => {
    const { html, plain } = generateEventAssetsDocument(
      sampleForm({
        language: 'pt',
        eventType: 'meetup',
        participationDetails: 'Booth + workshop on RAG.',
        speakerName: 'Jane Smith',
        sessionTitle: 'Grounding AI apps with Elasticsearch',
      }),
    )
    const t = getEventAssetsStrings('pt')
    expect(html).toContain(t.documentTitle)
    expect(html).toContain('Meetup')
    expect(html).toContain(t.aboutElasticBody)
    expect(html).toContain('lang="pt-BR"')
    expect(html).toContain('Booth + workshop on RAG.')
    expect(html).toContain('Jane Smith')
    expect(html).toContain('Grounding AI apps with Elasticsearch')
    expect(plain).toContain('Booth + workshop on RAG.')
    expect(plain).toContain('Jane Smith')
    expect(html).not.toContain('About Elastic')
    expect(html).toContain('Sobre a Elastic')
  })

  it('updates headings immediately when language changes and preserves accents', () => {
    const en = generateEventAssetsDocument(sampleForm({ language: 'en', eventType: 'community_event' }))
    const pt = generateEventAssetsDocument(sampleForm({ language: 'pt', eventType: 'community_event' }))
    expect(en.html).toContain('Community event')
    expect(pt.html).toContain('Evento comunitário')
    expect(pt.html).not.toContain('Áreas de foco')
    expect(pt.plain).not.toContain('Áreas de foco')
    expect(pt.plain).toContain('Informações do evento')
    expect(pt.html).toContain('tempo real')
    expect(pt.html).toContain('Suas soluções de busca')
  })

  it('omits social section when no approved channels are configured', () => {
    const { html, plain } = generateEventAssetsDocument(sampleForm(), { socialChannels: [] })
    const t = getEventAssetsStrings('en')
    expect(html).not.toContain(t.officialSocialChannelsHeading)
    expect(plain).not.toContain(t.officialSocialChannelsHeading)
  })

  it('includes only approved social channels with urls', () => {
    const { html } = generateEventAssetsDocument(sampleForm(), {
      socialChannels: [
        { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/company/elastic-co/' },
        { id: 'empty', label: 'Missing', url: '' },
      ],
    })
    const t = getEventAssetsStrings('en')
    expect(html).toContain(t.officialSocialChannelsHeading)
    expect(html).toContain('https://www.linkedin.com/company/elastic-co/')
    expect(html).not.toContain('Missing')
  })

  it('uses the configured approved social list by default', () => {
    const { html } = generateEventAssetsDocument(sampleForm())
    if (APPROVED_SOCIAL_CHANNELS.length === 0) {
      expect(html).not.toContain(getEventAssetsStrings('en').officialSocialChannelsHeading)
    } else {
      expect(html).toContain(APPROVED_SOCIAL_CHANNELS[0].url)
    }
  })

  it('omits invalid contact email from the document', () => {
    const { html } = generateEventAssetsDocument(
      sampleForm({ contactName: 'Olivia', contactEmail: 'not-valid' }),
    )
    expect(html).toContain('Olivia')
    expect(html).not.toContain('not-valid')
    expect(html).not.toContain('mailto:not-valid')
  })

  it('escapes user-entered HTML', () => {
    const { html } = generateEventAssetsDocument(
      sampleForm({ eventName: '<script>alert(1)</script>', speakerBio: '<img src=x>' }),
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img src=x&gt;')
  })

  it('always includes brand asset links even without optional fields', () => {
    const { html } = generateEventAssetsDocument(sampleForm())
    const t = getEventAssetsStrings('en')
    expect(html).toContain(t.logoAndBrandAssetsHeading)
    expect(html).toContain(t.elasticLogoLabel)
    expect(html).toContain(t.elasticBrandGuidelinesLabel)
  })

  it('groups event name and type beneath the document title', () => {
    const { html } = generateEventAssetsDocument(sampleForm())
    const t = getEventAssetsStrings('en')
    expect(html).toContain(
      `<h1>${t.documentTitle}</h1><div><p><strong>${t.eventLabel}:</strong> TDC São Paulo</p><p><strong>${t.eventTypeLabel}:</strong> Conference</p></div>`,
    )
  })

  it('renders brand and social links with descriptive labels as link text', () => {
    const { html, plain } = generateEventAssetsDocument(sampleForm())
    const t = getEventAssetsStrings('en')
    expect(html).toContain(`<a href="${BRAND_ASSET_LINKS.brandGuidelines}">${t.elasticBrandGuidelinesLabel}</a>`)
    expect(html).toContain(`<a href="${APPROVED_SOCIAL_CHANNELS[0].url}">${APPROVED_SOCIAL_CHANNELS[0].label}</a>`)
    expect(html).not.toContain(`>${APPROVED_SOCIAL_CHANNELS[0].url}</a>`)
    expect(plain).toContain(`${APPROVED_SOCIAL_CHANNELS[0].label}: ${APPROVED_SOCIAL_CHANNELS[0].url}`)
  })
})

describe('event assets clipboard', () => {
  it('wraps semantic HTML with utf-8 charset and no UI chrome', () => {
    const { html } = generateEventAssetsDocument(sampleForm({ speakerName: 'Ada' }))
    const clip = buildEventAssetsClipboardHtml(html)
    const shape = assertEventAssetsClipboardHtmlShape(clip)
    expect(shape.hasHeadings).toBe(true)
    expect(shape.hasParagraphs).toBe(true)
    expect(shape.hasLists).toBe(true)
    expect(shape.hasAnchors).toBe(true)
    expect(shape.hasCharset).toBe(true)
    expect(shape.excludesClassAttr).toBe(true)
    expect(shape.excludesScript).toBe(true)
    expect(shape.excludesButton).toBe(true)
    expect(clip.toLowerCase()).not.toContain('copy for google docs')
    expect(clip).toContain('<meta charset="utf-8">')
  })

  it('preserves Portuguese accents in clipboard HTML', () => {
    const { html, plain } = generateEventAssetsDocument(sampleForm({ language: 'pt' }))
    const clip = buildEventAssetsClipboardHtml(html)
    expect(clip).toContain('Informações do evento')
    expect(clip).not.toContain('Áreas de foco')
    expect(plain).toContain('Informações do evento')
    expect(plain).not.toContain('Áreas de foco')
  })

  it('copies text/html and text/plain when ClipboardItem is supported', async () => {
    const { html, plain } = generateEventAssetsDocument(sampleForm())
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

    const mode = await copyEventAssetsToClipboard(
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
    expect(htmlText).toContain('<h1>')
    expect(htmlText).toContain('<a href="')
    expect(htmlText).toContain('charset="utf-8"')
    const plainText = await item.items['text/plain'].text()
    expect(plainText).toContain('TDC São Paulo')
  })

  it('falls back to plain text when rich clipboard write fails', async () => {
    const { html, plain } = generateEventAssetsDocument(sampleForm())
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
    const mode = await copyEventAssetsToClipboard(
      { html, plain },
      { clipboard, ClipboardItem: FakeClipboardItem },
    )
    expect(mode).toBe('plain')
    expect(clipboard.writeText).toHaveBeenCalledWith(plain)
  })

  it('falls back to plain text when ClipboardItem is unavailable', async () => {
    const { html, plain } = generateEventAssetsDocument(sampleForm())
    const clipboard = {
      write: vi.fn(),
      writeText: vi.fn(async () => {}),
    }
    const mode = await copyEventAssetsToClipboard(
      { html, plain },
      { clipboard, ClipboardItem: undefined },
    )
    expect(mode).toBe('plain')
    expect(clipboard.writeText).toHaveBeenCalledWith(plain)
    expect(clipboard.write).not.toHaveBeenCalled()
  })
})
