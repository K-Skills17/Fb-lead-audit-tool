// ============================================================
// Meta Conversions API (CAPI) — Server-side event tracking
// Sends events directly to Meta without GTM or client-side pixel
// ============================================================

import { createHash } from 'crypto'

const PIXEL_ID = process.env.META_PIXEL_ID || ''
const ACCESS_TOKEN = process.env.META_CAPI_TOKEN || ''
const API_VERSION = 'v21.0'

function isConfigured(): boolean {
  return !!(PIXEL_ID && ACCESS_TOKEN)
}

/** Hash PII fields using SHA-256 as required by Meta */
function hash(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return undefined
  return createHash('sha256').update(trimmed).digest('hex')
}

interface UserData {
  email?: string
  phone?: string
  firstName?: string
  clientIpAddress?: string
  clientUserAgent?: string
  fbc?: string  // _fbc cookie
  fbp?: string  // _fbp cookie
}

interface CustomData {
  value?: number
  currency?: string
  contentName?: string
  contentCategory?: string
  [key: string]: unknown
}

interface EventParams {
  eventName: string
  eventId?: string
  sourceUrl?: string
  userData?: UserData
  customData?: CustomData
}

/**
 * Send a single event to Meta Conversions API.
 * Fails silently with a console warning if not configured or if the request fails.
 */
export async function sendMetaEvent(params: EventParams): Promise<void> {
  if (!isConfigured()) {
    console.warn('Meta CAPI not configured — skipping event:', params.eventName)
    return
  }

  const { eventName, eventId, sourceUrl, userData, customData } = params

  const event: Record<string, unknown> = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_id: eventId || `${eventName}_${Date.now()}`,
    user_data: {
      em: hash(userData?.email),
      ph: hash(userData?.phone),
      fn: hash(userData?.firstName),
      client_ip_address: userData?.clientIpAddress,
      client_user_agent: userData?.clientUserAgent,
      fbc: userData?.fbc,
      fbp: userData?.fbp,
    },
  }

  if (sourceUrl) {
    event.event_source_url = sourceUrl
  }

  if (customData) {
    event.custom_data = customData
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event] }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('Meta CAPI error:', res.status, body)
    }
  } catch (err) {
    console.error('Meta CAPI fetch error:', err)
  }
}

// ---- Convenience helpers matching your existing analytics events ----

/** Lead event — user fills in the contact form */
export function trackLeadServer(opts: {
  phone: string
  firstName: string
  clinicName: string
  score: number
  siteUrl: string
  ip?: string
  userAgent?: string
}) {
  return sendMetaEvent({
    eventName: 'Lead',
    sourceUrl: opts.siteUrl,
    userData: {
      phone: opts.phone,
      firstName: opts.firstName,
      clientIpAddress: opts.ip,
      clientUserAgent: opts.userAgent,
    },
    customData: {
      value: opts.score,
      currency: 'BRL',
      contentName: opts.clinicName,
      contentCategory: 'audit_lead',
    },
  })
}

/** Contact event — user receives WhatsApp message */
export function trackContactServer(opts: {
  phone: string
  firstName: string
  siteUrl: string
  ip?: string
  userAgent?: string
}) {
  return sendMetaEvent({
    eventName: 'Contact',
    sourceUrl: opts.siteUrl,
    userData: {
      phone: opts.phone,
      firstName: opts.firstName,
      clientIpAddress: opts.ip,
      clientUserAgent: opts.userAgent,
    },
  })
}

/** ViewContent event — audit is performed on a URL */
export function trackViewContentServer(opts: {
  siteUrl: string
  ip?: string
  userAgent?: string
}) {
  return sendMetaEvent({
    eventName: 'ViewContent',
    sourceUrl: opts.siteUrl,
    userData: {
      clientIpAddress: opts.ip,
      clientUserAgent: opts.userAgent,
    },
    customData: {
      contentName: opts.siteUrl,
      contentCategory: 'audit',
    },
  })
}
