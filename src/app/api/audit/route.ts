import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export const maxDuration = 60

interface AuditCheck {
  category: string
  name: string
  passed: boolean
  severity: 'critical' | 'warning' | 'info'
  message: string
  points: number
}

function normalizeUrl(input: string): string {
  let url = input.trim()
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url
  }
  return url
}

async function fetchPage(url: string): Promise<{ html: string; headers: Headers; finalUrl: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebAuditBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    const html = await res.text()
    return { html, headers: res.headers, finalUrl: res.url }
  } finally {
    clearTimeout(timeout)
  }
}

function checkSEO($: cheerio.CheerioAPI, url: string): AuditCheck[] {
  const checks: AuditCheck[] = []

  // Title tag
  const title = $('title').text().trim()
  checks.push({
    category: 'SEO',
    name: 'Titulo da Pagina',
    passed: title.length > 0 && title.length <= 70,
    severity: 'critical',
    message: !title
      ? 'Tag de titulo ausente — essencial para o ranqueamento nos buscadores'
      : title.length > 70
        ? `Titulo muito longo (${title.length} caracteres). Mantenha abaixo de 70 caracteres`
        : `Tag de titulo encontrada: "${title.substring(0, 50)}${title.length > 50 ? '...' : ''}"`,
    points: 10,
  })

  // Meta description
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() || ''
  checks.push({
    category: 'SEO',
    name: 'Meta Descricao',
    passed: metaDesc.length >= 50 && metaDesc.length <= 160,
    severity: 'critical',
    message: !metaDesc
      ? 'Meta descricao ausente — buscadores usam isso nos resultados'
      : metaDesc.length < 50
        ? `Meta descricao muito curta (${metaDesc.length} caracteres). Ideal entre 50 e 160 caracteres`
        : metaDesc.length > 160
          ? `Meta descricao muito longa (${metaDesc.length} caracteres). Mantenha abaixo de 160 caracteres`
          : 'Meta descricao bem otimizada',
    points: 10,
  })

  // H1 tag
  const h1Count = $('h1').length
  checks.push({
    category: 'SEO',
    name: 'Titulo H1',
    passed: h1Count === 1,
    severity: 'warning',
    message: h1Count === 0
      ? 'Nenhum titulo H1 encontrado — toda pagina deve ter exatamente um H1'
      : h1Count > 1
        ? `Encontrados ${h1Count} titulos H1 — use apenas um H1 por pagina`
        : 'Titulo H1 unico encontrado — boa estrutura',
    points: 8,
  })

  // Image alt tags
  const images = $('img')
  const imagesWithoutAlt = images.filter((_, el) => {
    const alt = $(el).attr('alt')
    return !alt || alt.trim() === ''
  })
  const altRatio = images.length > 0 ? (images.length - imagesWithoutAlt.length) / images.length : 1
  checks.push({
    category: 'SEO',
    name: 'Alt Tags de Imagens',
    passed: altRatio >= 0.8,
    severity: 'warning',
    message: images.length === 0
      ? 'Nenhuma imagem encontrada na pagina'
      : imagesWithoutAlt.length === 0
        ? `Todas as ${images.length} imagens possuem texto alternativo`
        : `${imagesWithoutAlt.length} de ${images.length} imagens estao sem texto alternativo`,
    points: 7,
  })

  // Canonical tag
  const canonical = $('link[rel="canonical"]').attr('href')
  checks.push({
    category: 'SEO',
    name: 'Tag Canonica',
    passed: !!canonical,
    severity: 'info',
    message: canonical
      ? 'URL canonica configurada'
      : 'Tag canonica ausente — ajuda a evitar problemas de conteudo duplicado',
    points: 5,
  })

  // Open Graph tags
  const ogTitle = $('meta[property="og:title"]').attr('content')
  const ogDesc = $('meta[property="og:description"]').attr('content')
  const ogImage = $('meta[property="og:image"]').attr('content')
  const ogScore = [ogTitle, ogDesc, ogImage].filter(Boolean).length
  checks.push({
    category: 'SEO',
    name: 'Tags de Redes Sociais',
    passed: ogScore >= 2,
    severity: 'info',
    message: ogScore === 3
      ? 'Tags Open Graph completas (titulo, descricao, imagem)'
      : ogScore === 0
        ? 'Nenhuma tag Open Graph encontrada — links compartilhados em redes sociais ficam sem preview'
        : `Tags Open Graph parciais (${ogScore}/3). Faltando: ${[!ogTitle && 'og:title', !ogDesc && 'og:description', !ogImage && 'og:image'].filter(Boolean).join(', ')}`,
    points: 5,
  })

  return checks
}

function checkContactForm($: cheerio.CheerioAPI): AuditCheck[] {
  const checks: AuditCheck[] = []

  // Contact form detection
  const forms = $('form')
  const hasContactForm = forms.toArray().some(form => {
    const $form = $(form)
    const formText = ($form.attr('id') || '') + ($form.attr('class') || '') + ($form.attr('action') || '') + $form.text()
    const lowerText = formText.toLowerCase()
    return lowerText.includes('contact') ||
      lowerText.includes('contato') ||
      lowerText.includes('enquir') ||
      lowerText.includes('inquir') ||
      lowerText.includes('get in touch') ||
      lowerText.includes('fale conosco') ||
      lowerText.includes('entre em contato') ||
      lowerText.includes('message') ||
      lowerText.includes('mensagem') ||
      lowerText.includes('reach') ||
      ($form.find('input[type="email"]').length > 0 && $form.find('textarea').length > 0)
  })

  const hasContactPage = $('a').toArray().some(a => {
    const text = $(a).text().toLowerCase()
    const href = ($(a).attr('href') || '').toLowerCase()
    return text.includes('contact') || text.includes('contato') || text.includes('fale conosco') ||
      href.includes('contact') || href.includes('contato')
  })

  checks.push({
    category: 'Captacao de Leads',
    name: 'Formulario de Contato',
    passed: hasContactForm || hasContactPage,
    severity: 'critical',
    message: hasContactForm
      ? 'Formulario de contato detectado na pagina'
      : hasContactPage
        ? 'Link para pagina de contato encontrado, mas sem formulario na homepage — considere adicionar um'
        : 'Nenhum formulario de contato encontrado — voce esta perdendo leads potenciais',
    points: 12,
  })

  // Email link
  const hasEmail = $('a[href^="mailto:"]').length > 0
  checks.push({
    category: 'Captacao de Leads',
    name: 'Link de E-mail',
    passed: hasEmail,
    severity: 'warning',
    message: hasEmail
      ? 'Link de e-mail clicavel encontrado'
      : 'Nenhum link de e-mail clicavel — facilite o contato dos visitantes',
    points: 3,
  })

  // Phone number
  const hasPhone = $('a[href^="tel:"]').length > 0
  checks.push({
    category: 'Captacao de Leads',
    name: 'Numero de Telefone',
    passed: hasPhone,
    severity: 'warning',
    message: hasPhone
      ? 'Numero de telefone clicavel encontrado'
      : 'Nenhum link de telefone clicavel — usuarios mobile esperam tocar para ligar',
    points: 3,
  })

  return checks
}

function checkWhatsApp($: cheerio.CheerioAPI, html: string): AuditCheck[] {
  const lowerHtml = html.toLowerCase()
  const hasWhatsApp =
    $('a[href*="wa.me"], a[href*="whatsapp"], a[href*="api.whatsapp"]').length > 0 ||
    lowerHtml.includes('whatsapp') ||
    lowerHtml.includes('wa.me')

  return [{
    category: 'Captacao de Leads',
    name: 'Integracao WhatsApp',
    passed: hasWhatsApp,
    severity: 'warning',
    message: hasWhatsApp
      ? 'Integracao com WhatsApp detectada'
      : 'Nenhuma integracao com WhatsApp encontrada — o WhatsApp pode aumentar conversoes em ate 40%',
    points: 8,
  }]
}

function checkCTA($: cheerio.CheerioAPI): AuditCheck[] {
  const checks: AuditCheck[] = []

  // CTA buttons (English + Portuguese keywords)
  const ctaKeywords = [
    'get started', 'sign up', 'buy', 'order', 'book', 'schedule', 'free', 'trial',
    'demo', 'quote', 'consultation', 'learn more', 'shop now', 'add to cart',
    'subscribe', 'join', 'download', 'register', 'apply', 'enquire', 'inquire',
    'request', 'call now', 'contact us', 'get in touch', 'start',
    'comecar', 'cadastre', 'comprar', 'pedir', 'agendar', 'gratis', 'teste',
    'orcamento', 'consultoria', 'saiba mais', 'compre agora', 'adicionar ao carrinho',
    'assinar', 'participar', 'baixar', 'registrar', 'solicitar', 'ligue agora',
    'fale conosco', 'entre em contato', 'iniciar', 'quero', 'contratar'
  ]

  const buttons = $('a, button').toArray()
  const ctaButtons = buttons.filter(el => {
    const text = $(el).text().toLowerCase().trim()
    const cls = ($(el).attr('class') || '').toLowerCase()
    return ctaKeywords.some(kw => text.includes(kw)) ||
      cls.includes('cta') || cls.includes('btn-primary') || cls.includes('button-primary')
  })

  checks.push({
    category: 'Conversao',
    name: 'Botoes de Acao (CTA)',
    passed: ctaButtons.length >= 1,
    severity: 'critical',
    message: ctaButtons.length === 0
      ? 'Nenhum botao de acao claro encontrado — visitantes precisam de um proximo passo claro'
      : ctaButtons.length === 1
        ? '1 botao de CTA encontrado — considere adicionar mais ao longo da pagina'
        : `${ctaButtons.length} botoes de CTA encontrados — boa visibilidade`,
    points: 12,
  })

  // Above-the-fold CTA
  const heroSection = $('header, .hero, .banner, [class*="hero"], section:first-of-type').first()
  const heroCTA = heroSection.find('a, button').toArray().some(el => {
    const text = $(el).text().toLowerCase()
    return ctaKeywords.some(kw => text.includes(kw))
  })

  checks.push({
    category: 'Conversao',
    name: 'CTA na Secao Principal',
    passed: heroCTA,
    severity: 'warning',
    message: heroCTA
      ? 'CTA encontrado na secao hero/header — visitantes veem imediatamente'
      : 'Nenhum CTA na secao principal — a primeira coisa que visitantes veem deve ter uma acao clara',
    points: 5,
  })

  return checks
}

function checkMobile($: cheerio.CheerioAPI): AuditCheck[] {
  const checks: AuditCheck[] = []

  // Viewport meta tag
  const viewport = $('meta[name="viewport"]').attr('content') || ''
  checks.push({
    category: 'Mobile',
    name: 'Tag Meta Viewport',
    passed: viewport.includes('width=device-width'),
    severity: 'critical',
    message: viewport.includes('width=device-width')
      ? 'Tag meta viewport configurada corretamente'
      : 'Tag meta viewport ausente ou incorreta — a pagina nao sera exibida corretamente no celular',
    points: 10,
  })

  // Font size
  const hasSmallText = $('[style*="font-size"]').toArray().some(el => {
    const style = $(el).attr('style') || ''
    const match = style.match(/font-size:\s*(\d+)px/)
    return match && parseInt(match[1]) < 12
  })

  checks.push({
    category: 'Mobile',
    name: 'Tamanho de Fonte Legivel',
    passed: !hasSmallText,
    severity: 'info',
    message: hasSmallText
      ? 'Algum texto parece ser menor que 12px — pode ser dificil de ler no celular'
      : 'Nenhuma fonte obviamente pequena detectada nos estilos inline',
    points: 2,
  })

  return checks
}

function checkAIVisibility($: cheerio.CheerioAPI, html: string, finalUrl: string): AuditCheck[] {
  const checks: AuditCheck[] = []

  // 1. Structured Data (JSON-LD / Schema.org)
  const jsonLdScripts = $('script[type="application/ld+json"]')
  const hasStructuredData = jsonLdScripts.length > 0
  let structuredTypes: string[] = []
  jsonLdScripts.each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '')
      const type = data['@type'] || (Array.isArray(data['@graph']) ? data['@graph'].map((g: Record<string, string>) => g['@type']).join(', ') : '')
      if (type) structuredTypes.push(type)
    } catch { /* invalid JSON-LD */ }
  })

  // Also check for microdata
  const hasMicrodata = $('[itemscope]').length > 0

  checks.push({
    category: 'Visibilidade IA',
    name: 'Dados Estruturados (Schema.org)',
    passed: hasStructuredData || hasMicrodata,
    severity: 'critical',
    message: hasStructuredData
      ? `Dados estruturados encontrados (JSON-LD): ${structuredTypes.slice(0, 3).join(', ')}${structuredTypes.length > 3 ? '...' : ''}`
      : hasMicrodata
        ? 'Microdata encontrado — considere tambem usar JSON-LD para melhor compatibilidade com IA'
        : 'Nenhum dado estruturado encontrado — IAs como ChatGPT e Google AI usam Schema.org para entender seu conteudo',
    points: 10,
  })

  // 2. FAQ Schema
  let hasFaqSchema = false
  jsonLdScripts.each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '')
      const type = data['@type'] || ''
      if (type === 'FAQPage' || (Array.isArray(data['@graph']) && data['@graph'].some((g: Record<string, string>) => g['@type'] === 'FAQPage'))) {
        hasFaqSchema = true
      }
    } catch { /* skip */ }
  })

  // Also check for visible FAQ sections
  const hasFaqSection = $('h1, h2, h3, h4').toArray().some(el => {
    const text = $(el).text().toLowerCase()
    return text.includes('faq') || text.includes('perguntas frequentes') || text.includes('frequently asked') || text.includes('duvidas')
  })

  checks.push({
    category: 'Visibilidade IA',
    name: 'Secao de FAQ',
    passed: hasFaqSchema || hasFaqSection,
    severity: 'warning',
    message: hasFaqSchema
      ? 'FAQ com Schema.org detectado — IAs conseguem extrair perguntas e respostas diretamente'
      : hasFaqSection
        ? 'Secao de FAQ encontrada, mas sem Schema FAQPage — adicione dados estruturados para melhor visibilidade em IA'
        : 'Nenhuma secao de FAQ encontrada — perguntas e respostas sao o conteudo mais citado por IAs',
    points: 8,
  })

  // 3. Heading hierarchy (clear content structure)
  const h1 = $('h1').length
  const h2 = $('h2').length
  const h3 = $('h3').length
  const hasGoodHierarchy = h1 >= 1 && h2 >= 2

  checks.push({
    category: 'Visibilidade IA',
    name: 'Hierarquia de Conteudo',
    passed: hasGoodHierarchy,
    severity: 'warning',
    message: hasGoodHierarchy
      ? `Boa estrutura de headings: ${h1} H1, ${h2} H2, ${h3} H3 — IAs conseguem navegar seu conteudo facilmente`
      : h2 < 2
        ? `Poucos subtitulos (${h2} H2) — adicione mais headings H2/H3 para que IAs entendam a estrutura do conteudo`
        : 'Estrutura de headings precisa ser melhorada para leitura por IA',
    points: 7,
  })

  // 4. About / Authority page
  const hasAboutPage = $('a').toArray().some(a => {
    const text = $(a).text().toLowerCase()
    const href = ($(a).attr('href') || '').toLowerCase()
    return text.includes('sobre') || text.includes('about') || text.includes('quem somos') ||
      href.includes('/sobre') || href.includes('/about') || href.includes('/quem-somos')
  })

  // Check for author/organization schema
  let hasAuthorSchema = false
  jsonLdScripts.each((_, el) => {
    try {
      const raw = $(el).html() || ''
      if (raw.includes('Organization') || raw.includes('Person') || raw.includes('LocalBusiness')) {
        hasAuthorSchema = true
      }
    } catch { /* skip */ }
  })

  checks.push({
    category: 'Visibilidade IA',
    name: 'Autoridade e Credibilidade',
    passed: hasAboutPage || hasAuthorSchema,
    severity: 'warning',
    message: hasAuthorSchema && hasAboutPage
      ? 'Pagina "Sobre" e Schema de organizacao encontrados — fortalece credibilidade para citacoes por IA'
      : hasAboutPage
        ? 'Pagina "Sobre" encontrada — adicione Schema Organization/LocalBusiness para reforcar autoridade'
        : hasAuthorSchema
          ? 'Schema de organizacao encontrado, mas sem pagina "Sobre" visivel'
          : 'Nenhuma pagina "Sobre" ou Schema de autoridade — IAs priorizam fontes com credibilidade clara',
    points: 5,
  })

  // 5. Sitemap check (fetch /sitemap.xml)
  // We check for sitemap reference in HTML or robots meta
  const hasSitemapLink = html.toLowerCase().includes('sitemap.xml') ||
    $('link[rel="sitemap"]').length > 0

  checks.push({
    category: 'Visibilidade IA',
    name: 'Sitemap XML',
    passed: hasSitemapLink,
    severity: 'info',
    message: hasSitemapLink
      ? 'Referencia ao sitemap.xml encontrada — ajuda bots de IA a descobrir todo o conteudo'
      : 'Nenhuma referencia ao sitemap.xml encontrada — crie um sitemap para que bots de IA indexem todas as paginas',
    points: 5,
  })

  // 6. AI bot access (check for meta robots blocking)
  const robotsMeta = $('meta[name="robots"]').attr('content')?.toLowerCase() || ''
  const hasNoIndex = robotsMeta.includes('noindex')
  const hasNoFollow = robotsMeta.includes('nofollow')

  // Check for AI-specific blocking meta tags
  const gptBotMeta = $('meta[name="GPTBot"], meta[name="gptbot"]').attr('content')?.toLowerCase() || ''
  const claudeBotMeta = $('meta[name="ClaudeBot"], meta[name="claudebot"]').attr('content')?.toLowerCase() || ''
  const blocksAI = gptBotMeta.includes('noindex') || claudeBotMeta.includes('noindex') ||
    gptBotMeta.includes('nofollow') || claudeBotMeta.includes('nofollow')

  checks.push({
    category: 'Visibilidade IA',
    name: 'Acesso de Bots de IA',
    passed: !hasNoIndex && !blocksAI,
    severity: 'critical',
    message: blocksAI
      ? 'Bots de IA (GPTBot/ClaudeBot) estao sendo bloqueados — seu site nao aparecera em respostas de IA'
      : hasNoIndex
        ? 'Meta robots com "noindex" — buscadores e IAs nao vao indexar esta pagina'
        : hasNoFollow
          ? 'Meta robots com "nofollow" — bots nao seguirao links, mas a pagina pode ser indexada'
          : 'Nenhum bloqueio de bots de IA detectado — seu conteudo esta acessivel para indexacao por IA',
    points: 8,
  })

  return checks
}

function checkPerformance($: cheerio.CheerioAPI, html: string): AuditCheck[] {
  const checks: AuditCheck[] = []

  // Favicon
  const hasFavicon = $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').length > 0
  checks.push({
    category: 'Tecnico',
    name: 'Favicon',
    passed: hasFavicon,
    severity: 'info',
    message: hasFavicon
      ? 'Favicon configurado'
      : 'Nenhum favicon encontrado — faz seu site parecer pouco profissional nas abas do navegador',
    points: 2,
  })

  // Language attribute
  const hasLang = $('html').attr('lang')
  checks.push({
    category: 'Tecnico',
    name: 'Atributo de Idioma',
    passed: !!hasLang,
    severity: 'info',
    message: hasLang
      ? `Idioma definido como "${hasLang}"`
      : 'Atributo lang ausente no <html> — ajuda na acessibilidade e SEO',
    points: 2,
  })

  // Mixed content
  const hasHttpLinks = $('a[href^="http://"], script[src^="http://"], link[href^="http://"], img[src^="http://"]').length
  checks.push({
    category: 'Tecnico',
    name: 'Conteudo Misto',
    passed: hasHttpLinks === 0,
    severity: 'warning',
    message: hasHttpLinks === 0
      ? 'Nenhum conteudo misto (recursos HTTP em pagina HTTPS) detectado'
      : `${hasHttpLinks} recursos carregados via HTTP inseguro — navegadores podem bloquear`,
    points: 3,
  })

  return checks
}

async function checkPageSpeed(url: string): Promise<AuditCheck[]> {
  const checks: AuditCheck[] = []

  try {
    const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || ''
    const keyParam = apiKey ? `&key=${apiKey}` : ''
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance${keyParam}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const res = await fetch(apiUrl, { signal: controller.signal })
    clearTimeout(timeout)

    if (!res.ok) {
      throw new Error(`PageSpeed API returned ${res.status}`)
    }

    const data = await res.json()
    const lighthouse = data.lighthouseResult

    if (!lighthouse) {
      throw new Error('No lighthouse data returned')
    }

    // Overall performance score (0-1 from API, convert to 0-100)
    const perfScore = Math.round((lighthouse.categories?.performance?.score ?? 0) * 100)
    checks.push({
      category: 'Velocidade',
      name: 'Pontuacao de Performance',
      passed: perfScore >= 50,
      severity: perfScore < 50 ? 'critical' : 'warning',
      message: perfScore >= 90
        ? `Excelente! Performance ${perfScore}/100 — seu site carrega rapido`
        : perfScore >= 50
          ? `Performance ${perfScore}/100 — pode melhorar para nao perder visitantes`
          : `Performance ${perfScore}/100 — site lento afasta clientes, especialmente no celular`,
      points: 12,
    })

    // Largest Contentful Paint (LCP) - good < 2.5s, needs improvement < 4s, poor >= 4s
    const lcpMs = lighthouse.audits?.['largest-contentful-paint']?.numericValue
    if (lcpMs !== undefined) {
      const lcpSec = (lcpMs / 1000).toFixed(1)
      checks.push({
        category: 'Velocidade',
        name: 'Carregamento do Conteudo Principal (LCP)',
        passed: lcpMs < 4000,
        severity: lcpMs >= 4000 ? 'critical' : 'warning',
        message: lcpMs < 2500
          ? `Otimo! Conteudo principal carrega em ${lcpSec}s — rapido para o visitante`
          : lcpMs < 4000
            ? `Conteudo principal carrega em ${lcpSec}s — ideal seria abaixo de 2.5s`
            : `Conteudo principal demora ${lcpSec}s para carregar — muito lento, visitantes desistem antes de ver seu site`,
        points: 10,
      })
    }

    // First Contentful Paint (FCP) - good < 1.8s, needs improvement < 3s, poor >= 3s
    const fcpMs = lighthouse.audits?.['first-contentful-paint']?.numericValue
    if (fcpMs !== undefined) {
      const fcpSec = (fcpMs / 1000).toFixed(1)
      checks.push({
        category: 'Velocidade',
        name: 'Primeira Exibicao de Conteudo (FCP)',
        passed: fcpMs < 3000,
        severity: fcpMs >= 3000 ? 'critical' : 'warning',
        message: fcpMs < 1800
          ? `Otimo! Primeira exibicao em ${fcpSec}s — visitante ve algo rapido`
          : fcpMs < 3000
            ? `Primeira exibicao em ${fcpSec}s — ideal seria abaixo de 1.8s`
            : `Primeira exibicao demora ${fcpSec}s — visitante fica olhando tela branca`,
        points: 8,
      })
    }

    // Cumulative Layout Shift (CLS) - good < 0.1, needs improvement < 0.25, poor >= 0.25
    const clsValue = lighthouse.audits?.['cumulative-layout-shift']?.numericValue
    if (clsValue !== undefined) {
      const clsFormatted = clsValue.toFixed(3)
      checks.push({
        category: 'Velocidade',
        name: 'Estabilidade Visual (CLS)',
        passed: clsValue < 0.25,
        severity: clsValue >= 0.25 ? 'warning' : 'info',
        message: clsValue < 0.1
          ? `Otimo! Estabilidade visual ${clsFormatted} — pagina nao "pula" ao carregar`
          : clsValue < 0.25
            ? `Estabilidade visual ${clsFormatted} — elementos se movem um pouco ao carregar, pode confundir o visitante`
            : `Estabilidade visual ${clsFormatted} — pagina "pula" muito ao carregar, visitantes podem clicar no lugar errado`,
        points: 7,
      })
    }

    // Total Blocking Time (TBT) - good < 200ms, needs improvement < 600ms, poor >= 600ms
    const tbtMs = lighthouse.audits?.['total-blocking-time']?.numericValue
    if (tbtMs !== undefined) {
      const tbtFormatted = tbtMs < 1000 ? `${Math.round(tbtMs)}ms` : `${(tbtMs / 1000).toFixed(1)}s`
      checks.push({
        category: 'Velocidade',
        name: 'Tempo de Bloqueio (TBT)',
        passed: tbtMs < 600,
        severity: tbtMs >= 600 ? 'critical' : 'warning',
        message: tbtMs < 200
          ? `Otimo! Tempo de bloqueio ${tbtFormatted} — site responde rapido aos toques`
          : tbtMs < 600
            ? `Tempo de bloqueio ${tbtFormatted} — site pode demorar para responder a toques e cliques`
            : `Tempo de bloqueio ${tbtFormatted} — site trava ao interagir, visitantes pensam que esta quebrado`,
        points: 8,
      })
    }

  } catch (err) {
    console.warn('PageSpeed API check failed:', err)
    // Add a single informational check indicating speed test couldn't run
    checks.push({
      category: 'Velocidade',
      name: 'Teste de Velocidade',
      passed: false,
      severity: 'warning',
      message: 'Nao foi possivel testar a velocidade do site — o Google PageSpeed nao conseguiu acessar a pagina',
      points: 10,
    })
  }

  return checks
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url: rawUrl } = body

    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json({ error: 'URL e obrigatoria' }, { status: 400 })
    }

    const url = normalizeUrl(rawUrl)

    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'Formato de URL invalido' }, { status: 400 })
    }

    const startTime = Date.now()
    let html: string
    let finalUrl: string

    // Run HTML fetch and PageSpeed API in parallel
    const pageSpeedPromise = checkPageSpeed(url)

    try {
      const result = await fetchPage(url)
      html = result.html
      finalUrl = result.finalUrl
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      return NextResponse.json({
        error: `Nao foi possivel acessar o site. ${message.includes('abort') ? 'O site demorou muito para responder.' : 'Verifique a URL e tente novamente.'}`,
      }, { status: 422 })
    }

    const $ = cheerio.load(html)
    const pageSpeedChecks = await pageSpeedPromise
    const auditTime = Date.now() - startTime

    const allChecks: AuditCheck[] = [
      ...checkSEO($, url),
      ...checkContactForm($),
      ...checkWhatsApp($, html),
      ...checkCTA($),
      ...checkMobile($),
      ...checkAIVisibility($, html, finalUrl),
      ...checkPerformance($, html),
      ...pageSpeedChecks,
    ]

    const totalPoints = allChecks.reduce((sum, c) => sum + c.points, 0)
    const earnedPoints = allChecks.filter(c => c.passed).reduce((sum, c) => sum + c.points, 0)
    const score = Math.round((earnedPoints / totalPoints) * 100)

    const usesHttps = finalUrl.startsWith('https://')
    allChecks.push({
      category: 'Tecnico',
      name: 'HTTPS / SSL',
      passed: usesHttps,
      severity: 'critical',
      message: usesHttps
        ? 'Site servido via HTTPS — conexao segura'
        : 'Site nao usa HTTPS — navegadores vao avisar que o site e inseguro',
      points: 0,
    })

    const categories = allChecks.reduce((acc, check) => {
      if (!acc[check.category]) acc[check.category] = []
      acc[check.category].push(check)
      return acc
    }, {} as Record<string, AuditCheck[]>)

    const passed = allChecks.filter(c => c.passed).length
    const failed = allChecks.filter(c => !c.passed).length
    const critical = allChecks.filter(c => !c.passed && c.severity === 'critical').length

    return NextResponse.json({
      url: finalUrl,
      score,
      auditTime,
      summary: { total: allChecks.length, passed, failed, critical },
      categories,
      checks: allChecks,
    })
  } catch (err: unknown) {
    console.error('Erro na auditoria:', err)
    return NextResponse.json({ error: 'Ocorreu um erro inesperado durante a auditoria' }, { status: 500 })
  }
}
