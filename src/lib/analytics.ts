// ============================================================
// Analytics Configuration
// GA4 and Meta Pixel are managed via GTM (GTM-WKQ6FX8D)
// These helpers push custom events to the dataLayer for GTM
// ============================================================

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[]
    fbq: (...args: unknown[]) => void
  }
}

function pushEvent(event: string, params: Record<string, unknown> = {}) {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event, ...params })
  }
}

function fbqTrack(eventName: string, params: Record<string, unknown> = {}) {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', eventName, params)
  }
}

function fbqTrackCustom(eventName: string, params: Record<string, unknown> = {}) {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('trackCustom', eventName, params)
  }
}

// ---------- Tracking events ----------

/** User submits the audit form on the home page (interest, not a lead yet) */
export function trackAuditSubmit(url: string) {
  pushEvent('audit_submit', {
    event_category: 'engagement',
    event_label: url,
  })
  fbqTrackCustom('AuditSubmit', { url })
}

/** User fills in contact info on the lead capture form (real lead) */
export function trackLeadCapture(clinicName: string, score: number) {
  pushEvent('lead_capture', {
    event_category: 'conversion',
    event_label: clinicName,
    value: score,
  })
  fbqTrack('Lead', { content_name: clinicName, value: score })
}

/** Audit result is loaded on the report page */
export function trackAuditResult(url: string, score: number) {
  pushEvent('audit_result', {
    event_category: 'engagement',
    event_label: url,
    value: score,
  })
  fbqTrack('ViewContent', { content_name: url, value: score })
}

/** User clicks the WhatsApp CTA button */
export function trackWhatsAppClick(score: number) {
  pushEvent('whatsapp_click', {
    event_category: 'conversion',
    event_label: 'WhatsApp CTA',
    value: score,
  })
  fbqTrack('Contact', { value: score })
}

/** User clicks the Calendly CTA button */
export function trackCalendlyClick(score: number) {
  pushEvent('calendly_click', {
    event_category: 'conversion',
    event_label: 'Calendly CTA',
    value: score,
  })
  fbqTrack('Schedule', { value: score })
}

/** User copies the share link */
export function trackShareCopy(url: string) {
  pushEvent('share_copy', {
    event_category: 'engagement',
    event_label: url,
  })
}
