import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { GA_MEASUREMENT_ID, META_PIXEL_ID } from '@/lib/analytics'

export const metadata: Metadata = {
  title: 'WebAudit Pro — Auditoria Gratuita de Sites',
  description: 'Receba uma auditoria instantanea e gratuita do seu site. Verifique problemas de SEO, formularios de contato ausentes, responsividade mobile e muito mais.',
  openGraph: {
    title: 'WebAudit Pro — Auditoria Gratuita de Sites',
    description: 'Receba uma auditoria instantanea e gratuita do seu site.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Google Analytics (GA4) */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_auto_event: true,
              send_page_view: true
            });
          `}
        </Script>

        {/* Meta Pixel (Facebook) */}
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
      </head>
      <body className="min-h-screen bg-slate-50">
        {children}
      </body>
    </html>
  )
}
