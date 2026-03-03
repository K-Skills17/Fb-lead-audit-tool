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
    name: 'Page Title',
    passed: title.length > 0 && title.length <= 70,
    severity: 'critical',
    message: !title
      ? 'Missing page title tag — critical for search rankings'
      : title.length > 70
        ? `Title is too long (${title.length} chars). Keep it under 70 characters`
        : `Title tag found: "${title.substring(0, 50)}${title.length > 50 ? '...' : ''}"`,
    points: 10,
  })

  // Meta description
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() || ''
  checks.push({
    category: 'SEO',
    name: 'Meta Description',
    passed: metaDesc.length >= 50 && metaDesc.length <= 160,
    severity: 'critical',
    message: !metaDesc
      ? 'Missing meta description — search engines use this in results'
      : metaDesc.length < 50
        ? `Meta description is too short (${metaDesc.length} chars). Aim for 50–160 characters`
        : metaDesc.length > 160
          ? `Meta description is too long (${metaDesc.length} chars). Keep it under 160 characters`
          : 'Meta description is well-optimized',
    points: 10,
  })

  // H1 tag
  const h1Count = $('h1').length
  checks.push({
    category: 'SEO',
    name: 'H1 Heading',
    passed: h1Count === 1,
    severity: 'warning',
    message: h1Count === 0
      ? 'No H1 heading found — every page should have exactly one H1'
      : h1Count > 1
        ? `Found ${h1Count} H1 headings — use only one H1 per page`
        : 'Single H1 heading found — good structure',
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
    name: 'Image Alt Tags',
    passed: altRatio >= 0.8,
    severity: 'warning',
    message: images.length === 0
      ? 'No images found on the page'
      : imagesWithoutAlt.length === 0
        ? `All ${images.length} images have alt text`
        : `${imagesWithoutAlt.length} of ${images.length} images are missing alt text`,
    points: 7,
  })

  // Canonical tag
  const canonical = $('link[rel="canonical"]').attr('href')
  checks.push({
    category: 'SEO',
    name: 'Canonical Tag',
    passed: !!canonical,
    severity: 'info',
    message: canonical
      ? 'Canonical URL is set'
      : 'Missing canonical tag — helps prevent duplicate content issues',
    points: 5,
  })

  // Open Graph tags
  const ogTitle = $('meta[property="og:title"]').attr('content')
  const ogDesc = $('meta[property="og:description"]').attr('content')
  const ogImage = $('meta[property="og:image"]').attr('content')
  const ogScore = [ogTitle, ogDesc, ogImage].filter(Boolean).length
  checks.push({
    category: 'SEO',
    name: 'Social Media Tags',
    passed: ogScore >= 2,
    severity: 'info',
    message: ogScore === 3
      ? 'Open Graph tags are complete (title, description, image)'
      : ogScore === 0
        ? 'No Open Graph tags found — links shared on social media will look plain'
        : `Partial Open Graph tags (${ogScore}/3). Missing: ${[!ogTitle && 'og:title', !ogDesc && 'og:description', !ogImage && 'og:image'].filter(Boolean).join(', ')}`,
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
      lowerText.includes('enquir') ||
      lowerText.includes('inquir') ||
      lowerText.includes('get in touch') ||
      lowerText.includes('message') ||
      lowerText.includes('reach') ||
      ($form.find('input[type="email"]').length > 0 && $form.find('textarea').length > 0)
  })

  // Also check for contact links
  const contactLinks = $('a[href*="contact"], a[href*="mailto:"]').length > 0
  const hasContactPage = $('a').toArray().some(a => {
    const text = $(a).text().toLowerCase()
    const href = ($(a).attr('href') || '').toLowerCase()
    return text.includes('contact') || href.includes('contact')
  })

  checks.push({
    category: 'Lead Capture',
    name: 'Contact Form',
    passed: hasContactForm || hasContactPage,
    severity: 'critical',
    message: hasContactForm
      ? 'Contact form detected on the page'
      : hasContactPage
        ? 'Contact page link found, but no inline form on homepage — consider adding one'
        : 'No contact form or contact page link found — you are losing potential leads',
    points: 12,
  })

  // Email link
  const hasEmail = $('a[href^="mailto:"]').length > 0
  checks.push({
    category: 'Lead Capture',
    name: 'Email Link',
    passed: hasEmail,
    severity: 'warning',
    message: hasEmail
      ? 'Clickable email link found'
      : 'No clickable email link — make it easy for visitors to reach you',
    points: 3,
  })

  // Phone number
  const hasPhone = $('a[href^="tel:"]').length > 0
  checks.push({
    category: 'Lead Capture',
    name: 'Phone Number',
    passed: hasPhone,
    severity: 'warning',
    message: hasPhone
      ? 'Clickable phone number found'
      : 'No clickable phone link — mobile users expect tap-to-call',
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
    category: 'Lead Capture',
    name: 'WhatsApp Integration',
    passed: hasWhatsApp,
    severity: 'warning',
    message: hasWhatsApp
      ? 'WhatsApp integration detected'
      : 'No WhatsApp integration found — WhatsApp chat can increase conversions by up to 40%',
    points: 8,
  }]
}

function checkCTA($: cheerio.CheerioAPI): AuditCheck[] {
  const checks: AuditCheck[] = []

  // CTA buttons
  const ctaKeywords = ['get started', 'sign up', 'buy', 'order', 'book', 'schedule', 'free', 'trial',
    'demo', 'quote', 'consultation', 'learn more', 'shop now', 'add to cart',
    'subscribe', 'join', 'download', 'register', 'apply', 'enquire', 'inquire',
    'request', 'call now', 'contact us', 'get in touch', 'start']

  const buttons = $('a, button').toArray()
  const ctaButtons = buttons.filter(el => {
    const text = $(el).text().toLowerCase().trim()
    const cls = ($(el).attr('class') || '').toLowerCase()
    return ctaKeywords.some(kw => text.includes(kw)) ||
      cls.includes('cta') || cls.includes('btn-primary') || cls.includes('button-primary')
  })

  checks.push({
    category: 'Conversion',
    name: 'Call-to-Action Buttons',
    passed: ctaButtons.length >= 1,
    severity: 'critical',
    message: ctaButtons.length === 0
      ? 'No clear call-to-action buttons found — visitors need a clear next step'
      : ctaButtons.length === 1
        ? '1 CTA button found — consider adding more throughout the page'
        : `${ctaButtons.length} CTA buttons found — good visibility`,
    points: 12,
  })

  // Above-the-fold CTA (heuristic: check first 3 elements or hero-like sections)
  const heroSection = $('header, .hero, .banner, [class*="hero"], section:first-of-type').first()
  const heroCTA = heroSection.find('a, button').toArray().some(el => {
    const text = $(el).text().toLowerCase()
    return ctaKeywords.some(kw => text.includes(kw))
  })

  checks.push({
    category: 'Conversion',
    name: 'Hero Section CTA',
    passed: heroCTA,
    severity: 'warning',
    message: heroCTA
      ? 'CTA found in the hero/header area — visitors see it immediately'
      : 'No CTA in the hero section — the first thing visitors see should have a clear action',
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
    name: 'Viewport Meta Tag',
    passed: viewport.includes('width=device-width'),
    severity: 'critical',
    message: viewport.includes('width=device-width')
      ? 'Viewport meta tag is properly configured'
      : 'Missing or incorrect viewport meta tag — page will not render properly on mobile',
    points: 10,
  })

  // Font size (check for very small text)
  const hasSmallText = $('[style*="font-size"]').toArray().some(el => {
    const style = $(el).attr('style') || ''
    const match = style.match(/font-size:\s*(\d+)px/)
    return match && parseInt(match[1]) < 12
  })

  checks.push({
    category: 'Mobile',
    name: 'Readable Font Sizes',
    passed: !hasSmallText,
    severity: 'info',
    message: hasSmallText
      ? 'Some text appears to be smaller than 12px — may be hard to read on mobile'
      : 'No obviously small font sizes detected in inline styles',
    points: 2,
  })

  return checks
}

function checkPerformance($: cheerio.CheerioAPI, html: string): AuditCheck[] {
  const checks: AuditCheck[] = []

  // HTTPS
  // Checked via the final URL in the caller

  // Favicon
  const hasFavicon = $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').length > 0
  checks.push({
    category: 'Technical',
    name: 'Favicon',
    passed: hasFavicon,
    severity: 'info',
    message: hasFavicon
      ? 'Favicon is set'
      : 'No favicon found — makes your site look unprofessional in browser tabs',
    points: 2,
  })

  // Language attribute
  const hasLang = $('html').attr('lang')
  checks.push({
    category: 'Technical',
    name: 'Language Attribute',
    passed: !!hasLang,
    severity: 'info',
    message: hasLang
      ? `Language set to "${hasLang}"`
      : 'Missing lang attribute on <html> — helps accessibility and SEO',
    points: 2,
  })

  // SSL check (basic)
  const hasHttpLinks = $('a[href^="http://"], script[src^="http://"], link[href^="http://"], img[src^="http://"]').length
  checks.push({
    category: 'Technical',
    name: 'Mixed Content',
    passed: hasHttpLinks === 0,
    severity: 'warning',
    message: hasHttpLinks === 0
      ? 'No mixed content (HTTP resources on HTTPS page) detected'
      : `${hasHttpLinks} resources loaded over insecure HTTP — browsers may block these`,
    points: 3,
  })

  return checks
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url: rawUrl } = body

    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const url = normalizeUrl(rawUrl)

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    const startTime = Date.now()
    let html: string
    let finalUrl: string

    try {
      const result = await fetchPage(url)
      html = result.html
      finalUrl = result.finalUrl
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json({
        error: `Could not reach the website. ${message.includes('abort') ? 'The site took too long to respond.' : 'Please check the URL and try again.'}`,
      }, { status: 422 })
    }

    const $ = cheerio.load(html)
    const auditTime = Date.now() - startTime

    // Run all checks
    const allChecks: AuditCheck[] = [
      ...checkSEO($, url),
      ...checkContactForm($),
      ...checkWhatsApp($, html),
      ...checkCTA($),
      ...checkMobile($),
      ...checkPerformance($, html),
    ]

    // Calculate score
    const totalPoints = allChecks.reduce((sum, c) => sum + c.points, 0)
    const earnedPoints = allChecks.filter(c => c.passed).reduce((sum, c) => sum + c.points, 0)
    const score = Math.round((earnedPoints / totalPoints) * 100)

    // Check if site uses HTTPS
    const usesHttps = finalUrl.startsWith('https://')
    allChecks.push({
      category: 'Technical',
      name: 'HTTPS / SSL',
      passed: usesHttps,
      severity: 'critical',
      message: usesHttps
        ? 'Site is served over HTTPS — secure connection'
        : 'Site is not using HTTPS — browsers will warn visitors the site is insecure',
      points: 0, // Already counted in total
    })

    // Group by category
    const categories = allChecks.reduce((acc, check) => {
      if (!acc[check.category]) acc[check.category] = []
      acc[check.category].push(check)
      return acc
    }, {} as Record<string, AuditCheck[]>)

    // Summary stats
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
    console.error('Audit error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred during the audit' }, { status: 500 })
  }
}
