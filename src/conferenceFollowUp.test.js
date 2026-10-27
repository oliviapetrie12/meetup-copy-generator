import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FOLLOWUP_DESTINATIONS } from './meetupFollowUp.js'
import {
  CONFERENCE_FOLLOWUP_STORAGE_KEY,
  applyConferenceNameChange,
  buildConferenceResourceLinks,
  conferenceMediumFromName,
  copyConferenceFollowUpEmailToClipboard,
  defaultOpeningSentence,
  defaultSubject,
  generateConferenceFollowUpEmail,
  DEFAULT_UTM_CAMPAIGN,
  DEFAULT_UTM_SOURCE,
  getInitialConferenceFollowUpForm,
  htmlEmailToPlain,
  isConferenceFollowUpFormEmpty,
  loadConferenceFollowUpForm,
  saveConferenceFollowUpForm,
  validateConferenceFollowUpForm,
} from './conferenceFollowUp.js'

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
  const base = applyConferenceNameChange(getInitialConferenceFollowUpForm(), 'LangChain Interrupt')
  return {
    ...base,
    utmSource: 'luma',
    utmMedium: 'nyc',
    utmMediumManual: true,
    resources: [],
    ...overrides,
  }
}

function hrefs(html) {
  return [...String(html).matchAll(/href="([^"]*)"/g)].map((m) =>
    m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"'),
  )
}

describe('conference medium slug', () => {
  it('builds the medium from the conference name with the existing UTM slug rules', () => {
    expect(conferenceMediumFromName('LangChain Interrupt')).toBe('langchain-interrupt')
    expect(conferenceMediumFromName('  AI & Search / Summit  ')).toBe('ai-search-summit')
    expect(conferenceMediumFromName('KubeCon + CloudNativeCon')).toBe('kubecon-cloudnativecon')
    expect(conferenceMediumFromName('C++ Conf 2026!')).toBe('c-conf-2026')
    expect(conferenceMediumFromName('São Paulo Conf')).toBe('são-paulo-conf')
  })

  it('fills medium and opening from the name and keeps the static campaign', () => {
    const named = applyConferenceNameChange(getInitialConferenceFollowUpForm(), 'LangChain Interrupt')
    expect(named.utmSource).toBe('intuition')
    expect(named.utmMedium).toBe('langchain-interrupt')
    expect(named.utmCampaign).toBe(DEFAULT_UTM_CAMPAIGN)
    expect(named.openingSentence).toBe('Thank you for stopping by our booth at LangChain Interrupt!')
    expect(named.subject).toBe('Thanks for stopping by Elastic\u2019s booth at LangChain Interrupt!')

    const custom = applyConferenceNameChange(
      {
        ...named,
        utmMedium: 'booth',
        utmMediumManual: true,
        utmCampaign: 'spring-booth',
        utmCampaignManual: true,
        openingSentence: 'Hello from the booth.',
        openingManual: true,
        subject: 'Thanks for joining the workshop!',
        subjectManual: true,
      },
      'KubeCon Europe',
    )
    expect(custom.conferenceName).toBe('KubeCon Europe')
    expect(custom.utmMedium).toBe('booth')
    expect(custom.utmCampaign).toBe('spring-booth')
    expect(custom.openingSentence).toBe('Hello from the booth.')
    expect(custom.subject).toBe('Thanks for joining the workshop!')
  })
})

describe('conference resource links', () => {
  it('tags every standard destination and preserves existing query params and hashes', () => {
    const form = sampleForm({
      utmSource: 'booth email',
      utmMedium: 'q&a',
      resources: [
        {
          id: 'deck',
          label: 'Booth deck',
          url: 'https://www.elastic.co/guide/en/start/current/index.html?ref=booth&id=42&utm_source=old#query-dsl',
        },
      ],
    })
    const links = buildConferenceResourceLinks(form)

    expect(links.slack).toBe(FOLLOWUP_DESTINATIONS.slack)

    for (const [key, base] of Object.entries({
      training: FOLLOWUP_DESTINATIONS.training,
      newsletter: FOLLOWUP_DESTINATIONS.newsletter,
      discuss: FOLLOWUP_DESTINATIONS.discuss,
      sessionize: FOLLOWUP_DESTINATIONS.sessionize,
    })) {
      const tagged = new URL(links[key])
      const original = new URL(base)
      expect(tagged.origin + tagged.pathname).toBe(original.origin + original.pathname)
      expect(tagged.searchParams.get('utm_campaign')).toBe(DEFAULT_UTM_CAMPAIGN)
      expect(tagged.searchParams.get('utm_source')).toBe('booth email')
      expect(tagged.searchParams.get('utm_medium')).toBe('q&a')
    }

    const custom = new URL(links.custom[0].url)
    expect(custom.searchParams.get('ref')).toBe('booth')
    expect(custom.searchParams.get('id')).toBe('42')
    expect(custom.searchParams.get('utm_source')).toBe('booth email')
    expect(custom.searchParams.get('utm_campaign')).toBe(DEFAULT_UTM_CAMPAIGN)
    expect(custom.hash).toBe('#query-dsl')
    expect(links.custom[0].label).toBe('Booth deck')
  })

  it('uses the meetup-style defaults on elastic.co and sessionize, and leaves other domains alone', () => {
    const form = applyConferenceNameChange(getInitialConferenceFollowUpForm(), 'LangChain Interrupt')
    form.resources = [
      { id: 'deck', label: 'Deck', url: 'https://example.com/deck?x=1' },
      { id: 'guide', label: 'Guide', url: 'https://www.elastic.co/guide?x=1' },
    ]
    const links = buildConferenceResourceLinks(form)
    for (const href of [links.training, links.newsletter, links.discuss, links.sessionize, links.custom[1].url]) {
      const url = new URL(href)
      expect(url.searchParams.get('utm_source')).toBe(DEFAULT_UTM_SOURCE)
      expect(url.searchParams.get('utm_medium')).toBe('langchain-interrupt')
      expect(url.searchParams.get('utm_campaign')).toBe(DEFAULT_UTM_CAMPAIGN)
    }
    expect(links.slack).toBe(FOLLOWUP_DESTINATIONS.slack)
    const other = new URL(links.custom[0].url)
    expect(other.searchParams.get('x')).toBe('1')
    expect(other.searchParams.has('utm_source')).toBe(false)
    expect(other.searchParams.has('utm_medium')).toBe(false)
    expect(other.searchParams.has('utm_campaign')).toBe(false)
    expect(new URL(links.custom[1].url).searchParams.get('x')).toBe('1')
  })

  it('updates every applicable resource link when a UTM value changes', () => {
    const form = applyConferenceNameChange(getInitialConferenceFollowUpForm(), 'LangChain Interrupt')
    form.utmSource = 'salesforce'
    form.utmMedium = 'newsletter'
    form.utmCampaign = 'Q3 Booth'
    form.utmCampaignManual = true
    const links = buildConferenceResourceLinks(form)
    expect(links.slack).toBe(FOLLOWUP_DESTINATIONS.slack)
    for (const href of [links.training, links.newsletter, links.discuss, links.sessionize]) {
      const url = new URL(href)
      expect(url.searchParams.get('utm_source')).toBe('salesforce')
      expect(url.searchParams.get('utm_medium')).toBe('newsletter')
      expect(url.searchParams.get('utm_campaign')).toBe('Q3 Booth')
    }
    expect(links.training).toContain('utm_campaign=Q3+Booth')
  })
})

describe('conference follow-up email', () => {
  it('builds the subject, preview, and linked body', () => {
    const { subject, preview, html, plain, utm } = generateConferenceFollowUpEmail(sampleForm())
    expect(subject).toBe(defaultSubject('LangChain Interrupt'))
    expect(subject).toBe('Thanks for stopping by Elastic\u2019s booth at LangChain Interrupt!')
    expect(preview).toBe(
      'Explore Elastic training, connect with the community, and share what you\u2019re building.',
    )
    expect(utm).toEqual({
      utm_campaign: DEFAULT_UTM_CAMPAIGN,
      utm_source: 'luma',
      utm_medium: 'nyc',
    })

    expect(plain.startsWith(`${defaultOpeningSentence('LangChain Interrupt')}\n`)).toBe(true)
    expect(plain).not.toContain('Elastic @')
    expect(plain).toContain('We hope to see you at another event soon!')
    expect(plain.endsWith('The Elastic DevRel Team')).toBe(true)
    expect(html.startsWith(`<p>${defaultOpeningSentence('LangChain Interrupt')}</p>`)).toBe(true)
    expect(html).not.toContain('Elastic @')
    expect(html).toContain('If you\u2019d like to stay connected:')
    expect(html).toContain('<ul>')
    expect(html).toContain('>free and instructor-led training</a>')
    expect(html).toContain('>Subscribe to the Elastic community newsletter</a>')
    expect(html).toContain('>Slack</a>')
    expect(html).toContain('>Discuss</a>')
    expect(html).toContain('>Submit a session to speak at a future meetup</a>')
    expect(html).not.toContain('internal checklist')
    expect(html).not.toMatch(/\sclass\s*=/i)

    const urls = hrefs(html).map((href) => new URL(href))
    expect(urls).toHaveLength(5)
    const slack = urls.find((url) => url.hostname === 'ela.st')
    expect(slack.search).toBe('')
    for (const url of urls.filter((item) => item.hostname !== 'ela.st')) {
      expect(url.searchParams.get('utm_campaign')).toBe(DEFAULT_UTM_CAMPAIGN)
      expect(url.searchParams.get('utm_source')).toBe('luma')
      expect(url.searchParams.get('utm_medium')).toBe('nyc')
    }
    expect(urls.map((u) => u.hostname).sort()).toEqual(
      ['discuss.elastic.co', 'ela.st', 'sessionize.com', 'www.elastic.co', 'www.elastic.co'].sort(),
    )
  })

  it('uses an edited opening sentence and appends custom links in order', () => {
    const form = sampleForm({
      openingSentence: 'Great to meet you at the booth.',
      openingManual: true,
      resources: [
        { id: 'a', label: 'Deck', url: 'https://example.com/deck?x=1' },
        { id: 'b', label: 'Notes & clips', url: 'https://example.com/notes' },
        { id: 'c', label: '', url: '' },
      ],
    })
    const { html, plain } = generateConferenceFollowUpEmail(form)
    expect(html).toContain('<p>Great to meet you at the booth.</p>')
    expect(html).not.toContain('Thank you for stopping by')
    expect(plain).toContain('- Deck: https://example.com/deck?x=1')
    expect(html.indexOf('Deck')).toBeLessThan(html.indexOf('Notes &amp; clips'))
    const custom = hrefs(html).slice(5).map((href) => new URL(href))
    expect(custom[0].searchParams.get('x')).toBe('1')
    expect(custom[0].searchParams.has('utm_campaign')).toBe(false)
    expect(custom[1].pathname).toBe('/notes')
    expect(custom[1].search).toBe('')
  })

  it('escapes conference names in the HTML body', () => {
    const form = applyConferenceNameChange(getInitialConferenceFollowUpForm(), '<script>alert(1)</script>')
    const { html, plain } = generateConferenceFollowUpEmail(form)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(plain).toContain('<script>alert(1)</script>')
  })

  it('uses an edited subject and opening in the generated email', () => {
    const form = sampleForm({
      subject: 'Thanks for joining the workshop!',
      subjectManual: true,
      openingSentence: 'Glad you could make the workshop.',
      openingManual: true,
    })
    const { subject, html, plain } = generateConferenceFollowUpEmail(form)
    expect(subject).toBe('Thanks for joining the workshop!')
    expect(html).toContain('<p>Glad you could make the workshop.</p>')
    expect(plain).toContain('Glad you could make the workshop.')
    expect(html).not.toContain('Thank you for stopping by')
  })

  it('keeps the wording natural as standard resources are turned off', () => {
    const base = applyConferenceNameChange(getInitialConferenceFollowUpForm(), 'LangChain Interrupt')

    const slackOnly = generateConferenceFollowUpEmail({
      ...base,
      includedResources: { training: false, newsletter: false, slack: true, discuss: false, sessionize: false },
    })
    expect(slackOnly.plain).toContain('Ask technical questions on Slack (https://ela.st/slack)')
    expect(slackOnly.plain).not.toContain('or Discuss')
    expect(slackOnly.plain).not.toContain('free and instructor-led training')
    expect(slackOnly.html).not.toContain('www.elastic.co/training')
    expect(slackOnly.links.map((link) => link.id)).toEqual(['slack'])

    const discussOnly = generateConferenceFollowUpEmail({
      ...base,
      includedResources: { training: false, newsletter: false, slack: false, discuss: true, sessionize: false },
    })
    expect(discussOnly.plain).toContain('Ask technical questions on Discuss (')
    expect(discussOnly.plain).not.toContain('Slack')
    expect(discussOnly.html).toContain('utm_campaign=conference-followup-cm')
    expect(discussOnly.html).toContain('utm_medium=langchain-interrupt')

    const none = generateConferenceFollowUpEmail({
      ...base,
      includedResources: { training: false, newsletter: false, slack: false, discuss: false, sessionize: false },
    })
    expect(none.plain).not.toContain('stay connected')
    expect(none.html).not.toContain('<ul>')
    expect(none.html).not.toContain('free and instructor-led training')
    expect(none.plain).toContain('We hope to see you at another event soon!')
    expect(none.links).toEqual([])

    const customOnly = generateConferenceFollowUpEmail({
      ...base,
      includedResources: { training: false, newsletter: false, slack: false, discuss: false, sessionize: false },
      resources: [{ id: 'deck', label: 'Deck', url: 'https://example.com/deck' }],
    })
    expect(customOnly.plain).toContain("If you’d like to stay connected:")
    expect(customOnly.plain).toContain('- Deck: https://example.com/deck')
    expect(customOnly.html).not.toContain('Slack')
    expect(customOnly.html).not.toContain('newsletter')
  })

  it('turns the rich body back into plain text that keeps the links', () => {
    const { html } = generateConferenceFollowUpEmail(sampleForm())
    const plain = htmlEmailToPlain(html)
    expect(plain.startsWith(defaultOpeningSentence('LangChain Interrupt'))).toBe(true)
    expect(plain).not.toContain('Elastic @')
    expect(plain).toContain('free and instructor-led training (https://www.elastic.co/training?')
    expect(plain).toContain(`utm_campaign=${DEFAULT_UTM_CAMPAIGN}`)
    expect(plain).toContain('- Subscribe to the Elastic community newsletter (')
    expect(plain).toContain('The Elastic DevRel Team')
  })
})

describe('conference follow-up validation and storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })

  it('requires a conference name and complete custom links', () => {
    expect(isConferenceFollowUpFormEmpty(getInitialConferenceFollowUpForm())).toBe(true)
    const missing = validateConferenceFollowUpForm(getInitialConferenceFollowUpForm())
    expect(missing.ok).toBe(false)
    expect(missing.fieldErrors.conferenceName).toMatch(/required/i)

    const partial = validateConferenceFollowUpForm(
      sampleForm({ resources: [{ id: 'a', label: 'Deck', url: 'not-a-url' }] }),
    )
    expect(partial.ok).toBe(false)
    expect(partial.resourceErrors.a.url).toMatch(/valid http/i)

    const labelOnly = validateConferenceFollowUpForm(
      sampleForm({ resources: [{ id: 'a', label: '', url: 'https://example.com' }] }),
    )
    expect(labelOnly.resourceErrors.a.label).toMatch(/required/i)
  })

  it('round-trips the form and treats a saved custom campaign as manual', () => {
    saveConferenceFollowUpForm(
      sampleForm({
        utmCampaign: 'custom-camp',
        utmCampaignManual: true,
        openingSentence: 'Hello there.',
        openingManual: true,
        resources: [{ id: 'a', label: 'Deck', url: 'https://example.com/deck' }],
      }),
    )
    const loaded = loadConferenceFollowUpForm()
    expect(loaded.conferenceName).toBe('LangChain Interrupt')
    expect(loaded.utmCampaign).toBe('custom-camp')
    expect(loaded.utmCampaignManual).toBe(true)
    expect(loaded.openingSentence).toBe('Hello there.')
    expect(loaded.resources[0].url).toBe('https://example.com/deck')
    expect(localStorage.getItem(CONFERENCE_FOLLOWUP_STORAGE_KEY)).toContain('custom-camp')
  })

  it('restores program defaults when a saved draft left source and medium blank', () => {
    localStorage.setItem(
      CONFERENCE_FOLLOWUP_STORAGE_KEY,
      JSON.stringify({ conferenceName: 'LangChain Interrupt', utmSource: '', utmMedium: '  ' }),
    )
    const loaded = loadConferenceFollowUpForm()
    expect(loaded.utmSource).toBe(DEFAULT_UTM_SOURCE)
    expect(loaded.utmMedium).toBe('langchain-interrupt')
    expect(loaded.utmMediumManual).toBe(false)
    expect(loaded.utmCampaign).toBe(DEFAULT_UTM_CAMPAIGN)
  })

  it('moves an older email-medium draft onto the conference follow-up convention', () => {
    localStorage.setItem(
      CONFERENCE_FOLLOWUP_STORAGE_KEY,
      JSON.stringify({
        conferenceName: 'LangChain Interrupt',
        utmSource: 'intuition',
        utmMedium: 'email',
        utmCampaign: 'langchain-interrupt',
        utmCampaignManual: false,
      }),
    )
    const loaded = loadConferenceFollowUpForm()
    expect(loaded.utmCampaign).toBe(DEFAULT_UTM_CAMPAIGN)
    expect(loaded.utmCampaignManual).toBe(false)
    expect(loaded.utmMedium).toBe('langchain-interrupt')
    expect(loaded.utmMediumManual).toBe(false)
    expect(loaded.includedResources.training).toBe(true)
    expect(loaded.subject).toBe('Thanks for stopping by Elastic\u2019s booth at LangChain Interrupt!')
  })

  it('keeps a saved subject edit and a resource that was turned off', () => {
    saveConferenceFollowUpForm(
      sampleForm({
        subject: 'Thanks for joining the workshop!',
        subjectManual: true,
        includedResources: {
          training: false,
          newsletter: true,
          slack: true,
          discuss: true,
          sessionize: true,
        },
      }),
    )
    const loaded = loadConferenceFollowUpForm()
    expect(loaded.subject).toBe('Thanks for joining the workshop!')
    expect(loaded.subjectManual).toBe(true)
    expect(loaded.includedResources.training).toBe(false)
    expect(loaded.includedResources.newsletter).toBe(true)
    expect(isConferenceFollowUpFormEmpty({ ...getInitialConferenceFollowUpForm(), includedResources: loaded.includedResources })).toBe(
      false,
    )
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
    expect(loadConferenceFollowUpForm().conferenceName).toBe('')
    expect(() => saveConferenceFollowUpForm(sampleForm())).not.toThrow()
  })
})

describe('conference follow-up clipboard', () => {
  it('copies text/html and text/plain with the tracked links', async () => {
    const { html, plain } = generateConferenceFollowUpEmail(sampleForm())
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
    const mode = await copyConferenceFollowUpEmailToClipboard(
      { html, plain },
      { clipboard, ClipboardItem: FakeClipboardItem },
    )
    expect(mode).toBe('html')
    const htmlText = await written[0][0].items['text/html'].text()
    const plainText = await written[0][0].items['text/plain'].text()
    expect(htmlText).toContain('<a href="')
    expect(htmlText).toContain(`utm_campaign=${DEFAULT_UTM_CAMPAIGN}`)
    expect(htmlText).toContain('utm_medium=nyc')
    expect(plainText).toContain('https://www.elastic.co/training?')
    expect(plainText).toContain('https://ela.st/slack)')
    expect(plainText).not.toContain('https://ela.st/slack?')
  })

  it('falls back to plain text when rich clipboard write fails', async () => {
    const { html, plain } = generateConferenceFollowUpEmail(sampleForm())
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
    const mode = await copyConferenceFollowUpEmailToClipboard(
      { html, plain },
      { clipboard, ClipboardItem: FakeClipboardItem },
    )
    expect(mode).toBe('plain')
    expect(clipboard.writeText).toHaveBeenCalledWith(plain)
    expect(plain).toContain('utm_source=luma')
  })
})
