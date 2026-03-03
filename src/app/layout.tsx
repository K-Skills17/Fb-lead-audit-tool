import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WebAudit Pro — Free Website Audit Tool',
  description: 'Get a free instant audit of your website. Check for SEO issues, missing contact forms, mobile responsiveness, and more.',
  openGraph: {
    title: 'WebAudit Pro — Free Website Audit Tool',
    description: 'Get a free instant audit of your website.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        {children}
      </body>
    </html>
  )
}
