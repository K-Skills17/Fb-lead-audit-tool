import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export const maxDuration = 30

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
    const auditTime = Date.now() - startTime

    const allChecks: AuditCheck[] = [
      ...checkSEO($, url),
      ...checkContactForm($),
      ...checkWhatsApp($, html),
      ...checkCTA($),
      ...checkMobile($),
      ...checkPerformance($, html),
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
