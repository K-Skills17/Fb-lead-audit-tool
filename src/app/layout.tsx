import type { Metadata } from 'next'
import './globals.css'

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
      <body className="min-h-screen bg-slate-50">
        {children}
      </body>
    </html>
  )
}
