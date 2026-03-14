import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

const GTM_ID = 'GTM-WKQ6FX8D'

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
        {/* Google Tag Manager */}
        <Script id="gtm-init" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GTM_ID}');
          `}
        </Script>
      </head>
      <body className="min-h-screen bg-slate-50">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {children}
      </body>
    </html>
  )
}
