/**
 * Centralized copy dictionary for DevRel Event Assets.
 * Add a new language by copying an existing locale object and registering it here.
 * Document strings only — user-entered free text is never translated.
 */

export const EVENT_ASSETS_LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Portuguese (Brazil)' },
]

export const EVENT_ASSETS_HTML_LANG = {
  en: 'en',
  pt: 'pt-BR',
}

export const BRAND_ASSET_LINKS = {
  logo: 'https://brand.elastic.co/302f66895/p/06c73c-our-logo/b/35d033',
  brandGuidelines: 'https://brand.elastic.co/302f66895/p/2424b6-elastic-brand-guide',
}

/**
 * Approved Elastic social / community channels.
 * Edit this list to add or remove channels. The Official Social Channels
 * section is omitted when the list is empty or every entry lacks a URL.
 * Do not invent handles — only include official Elastic properties.
 */
export const APPROVED_SOCIAL_CHANNELS = [
  { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/company/elastic-co/' },
  { id: 'x', label: 'X', url: 'https://x.com/elastic' },
  { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@OfficialElasticCommunity' },
  { id: 'github', label: 'GitHub', url: 'https://github.com/elastic' },
]

const EN = {
  documentTitle: 'Elastic | Event Information',
  eventLabel: 'Event',
  eventTypeLabel: 'Event type',
  aboutElasticHeading: 'About Elastic',
  aboutElasticBody:
    'Elastic, the Search AI Company, enables everyone to find the answers they need in real time, using all their data, at scale. Elastic’s solutions for search, observability, and security are built on the Elastic Search AI Platform — the development platform used by thousands of companies, including more than 50% of the Fortune 500.',
  developerRelationsHeading: 'Elastic Developer Relations',
  developerRelationsBody:
    'The Elastic DevRel team supports developers and technical communities through events, meetups, workshops, and educational resources designed to help practitioners explore search, observability, security, and AI.',
  eventParticipationHeading: 'Event Participation',
  speakerInformationHeading: 'Speaker Information',
  speakerNameLabel: 'Name',
  speakerTitleLabel: 'Title',
  speakerBioLabel: 'Bio',
  sessionInformationHeading: 'Session Information',
  sessionTitleLabel: 'Title',
  sessionDescriptionLabel: 'Description',
  logoAndBrandAssetsHeading: 'Logo and Brand Assets',
  elasticLogoLabel: 'Elastic logo',
  elasticBrandGuidelinesLabel: 'Elastic brand guidelines',
  officialSocialChannelsHeading: 'Official Social Channels',
  eventContactHeading: 'Event Contact',
  contactNameLabel: 'Name',
  contactEmailLabel: 'Email',
  eventTypes: {
    conference: 'Conference',
    meetup: 'Meetup',
    hackathon: 'Hackathon',
    community_event: 'Community event',
  },
}

const PT = {
  documentTitle: 'Elastic | Informações do evento',
  eventLabel: 'Evento',
  eventTypeLabel: 'Tipo de evento',
  aboutElasticHeading: 'Sobre a Elastic',
  aboutElasticBody:
    'A Elastic, a empresa de Search AI, ajuda pessoas e organizações a encontrar as respostas de que precisam em tempo real, utilizando todos os seus dados em escala. Suas soluções de busca, observabilidade e segurança são desenvolvidas com a Elastic Search AI Platform, uma plataforma utilizada por milhares de empresas, incluindo mais de 50% das companhias da Fortune 500.',
  developerRelationsHeading: 'Developer Relations da Elastic',
  developerRelationsBody:
    'A equipe de DevRel da Elastic apoia desenvolvedores e comunidades técnicas por meio de eventos, meetups, workshops e recursos educacionais que ajudam profissionais a explorar busca, observabilidade, segurança e inteligência artificial.',
  eventParticipationHeading: 'Participação no evento',
  speakerInformationHeading: 'Informações do palestrante',
  speakerNameLabel: 'Nome',
  speakerTitleLabel: 'Cargo',
  speakerBioLabel: 'Bio',
  sessionInformationHeading: 'Informações da sessão',
  sessionTitleLabel: 'Título',
  sessionDescriptionLabel: 'Descrição',
  logoAndBrandAssetsHeading: 'Logo e ativos de marca',
  elasticLogoLabel: 'Logo da Elastic',
  elasticBrandGuidelinesLabel: 'Diretrizes de marca da Elastic',
  officialSocialChannelsHeading: 'Canais oficiais nas redes sociais',
  eventContactHeading: 'Contato do evento',
  contactNameLabel: 'Nome',
  contactEmailLabel: 'E-mail',
  eventTypes: {
    conference: 'Conferência',
    meetup: 'Meetup',
    hackathon: 'Hackathon',
    community_event: 'Evento comunitário',
  },
}

/** @type {Record<string, typeof EN>} */
export const EVENT_ASSETS_I18N = {
  en: EN,
  pt: PT,
}

export function normalizeEventAssetsLanguage(lang) {
  if (lang === 'pt') return 'pt'
  return 'en'
}

export function getEventAssetsStrings(lang) {
  const key = normalizeEventAssetsLanguage(lang)
  return EVENT_ASSETS_I18N[key] || EVENT_ASSETS_I18N.en
}
