// ============================================================
// Analytics Configuration
// Replace these placeholder IDs with your real ones:
//
// GA4:        Go to https://analytics.google.com → Admin → Data Streams → your stream → Measurement ID
// Meta Pixel: Go to https://business.facebook.com → Events Manager → your Pixel → Settings
// ============================================================

export const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'       // ← Replace with your GA4 ID
export const META_PIXEL_ID = '000000000000000'         // ← Replace with your Meta Pixel ID

// ---------- GA4 helpers ----------

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
    dataLayer: unknown[]
    fbq: (...args: unknown[]) => void
  }
}

function gtag(...args: unknown[]) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag(...args)
  }
}

// ---------- Meta Pixel helpers ----------

function fbq(...args: unknown[]) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq(...args)
  }
}

// ---------- Tracking events ----------

/** User submits the audit form on the home page */
export function trackAuditSubmit(url: string) {
  gtag('event', 'audit_submit', {
    event_category: 'engagement',
    event_label: url,
  })
  fbq('track', 'Lead', {
    content_name: 'Audit Submit',
    content_category: 'audit',
    value: url,
  })
}

/** Audit result is loaded on the report page */
export function trackAuditResult(url: string, score: number) {
  gtag('event', 'audit_result', {
    event_category: 'engagement',
    event_label: url,
    value: score,
  })
  fbq('track', 'ViewContent', {
    content_name: 'Audit Result',
    content_category: 'audit',
    value: score,
  })
}

/** User clicks the WhatsApp CTA button */
export function trackWhatsAppClick(score: number) {
  gtag('event', 'whatsapp_click', {
    event_category: 'conversion',
    event_label: 'WhatsApp CTA',
    value: score,
  })
  fbq('track', 'Contact', {
    content_name: 'WhatsApp Click',
    value: score,
  })
}

/** User clicks the Calendly CTA button */
export function trackCalendlyClick(score: number) {
  gtag('event', 'calendly_click', {
    event_category: 'conversion',
    event_label: 'Calendly CTA',
    value: score,
  })
  fbq('track', 'Schedule', {
    content_name: 'Calendly Click',
    value: score,
  })
}

/** User copies the share link */
export function trackShareCopy(url: string) {
  gtag('event', 'share_copy', {
    event_category: 'engagement',
    event_label: url,
  })
  fbq('track', 'CustomizeProduct', {
    content_name: 'Share Link Copy',
  })
}
