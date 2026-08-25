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
  { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@Elastic' },
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
    'Elastic supports developers and technical communities through events, meetups, workshops, and educational resources designed to help practitioners explore search, observability, security, and AI.',
  areasOfFocusHeading: 'Areas of Focus',
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
  focusAreas: {
    general:
      'The Elastic Search AI Platform helps developers and technical communities search, observe, and protect data at scale. Teams build on Elasticsearch, Kibana, and Elastic’s search, observability, and security solutions — a shared foundation used by thousands of companies.',
    search:
      'Elasticsearch and the Elastic Search AI Platform help developers build search experiences, retrieval-augmented generation (RAG) applications, and vector and semantic search over their own data — from site search and workplace search to custom retrieval pipelines.',
    observability:
      'Elastic Observability unifies logs, metrics, traces, and profiling so developers and SREs can understand application and infrastructure health in real time, investigate issues faster, and keep systems reliable at scale.',
    security:
      'Elastic Security brings SIEM, security analytics, and detection and investigation workflows together on the Search AI Platform so practitioners can search across security data to detect, investigate, and respond.',
    ai: 'Elastic helps developers ground AI applications in their own data using vector search, semantic retrieval, and Elasticsearch as a context engine for retrieval-augmented generation (RAG) and other Search AI workloads.',
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
    'A Elastic apoia desenvolvedores e comunidades técnicas por meio de eventos, meetups, workshops e recursos educacionais que ajudam profissionais a explorar soluções de busca, observabilidade, segurança e inteligência artificial.',
  areasOfFocusHeading: 'Áreas de foco',
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
  focusAreas: {
    general:
      'A Elastic Search AI Platform ajuda desenvolvedores e comunidades técnicas a buscar, observar e proteger dados em escala. Equipes constroem sobre o Elasticsearch, o Kibana e as soluções de busca, observabilidade e segurança da Elastic — uma base compartilhada utilizada por milhares de empresas.',
    search:
      'O Elasticsearch e a Elastic Search AI Platform ajudam desenvolvedores a criar experiências de busca, aplicações de geração aumentada por recuperação (RAG) e busca vetorial e semântica sobre os próprios dados — de site search e workplace search a pipelines de recuperação personalizados.',
    observability:
      'O Elastic Observability unifica logs, métricas, traces e profiling para que desenvolvedores e SREs entendam a saúde de aplicações e da infraestrutura em tempo real, investiguem problemas com mais rapidez e mantenham sistemas confiáveis em escala.',
    security:
      'O Elastic Security reúne SIEM, analytics de segurança e fluxos de detecção e investigação na Search AI Platform, para que profissionais possam buscar dados de segurança a fim de detectar, investigar e responder a ameaças.',
    ai: 'A Elastic ajuda desenvolvedores a fundamentar aplicações de inteligência artificial nos próprios dados, usando busca vetorial, recuperação semântica e o Elasticsearch como motor de contexto para geração aumentada por recuperação (RAG) e outros workloads de Search AI.',
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
