'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setLoading(false)
        return
      }

      // Store results and navigate
      sessionStorage.setItem('auditResult', JSON.stringify(data))
      const encodedUrl = encodeURIComponent(url.trim())
      router.push(`/report?url=${encodedUrl}`)
    } catch {
      setError('Network error. Please check your connection and try again.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <div className="gradient-bg text-white">
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Free instant audit — no signup required
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Is Your Website
            <span className="block gradient-accent bg-clip-text text-transparent">
              Losing You Leads?
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-300 mb-12 max-w-2xl mx-auto">
            Get a free instant audit of your website. We check for SEO gaps,
            missing contact forms, mobile issues, and more — in seconds.
          </p>

          {/* URL Input Form */}
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter your website URL (e.g. example.com)"
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-white text-slate-900 text-lg
                    placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400
                    shadow-lg"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="gradient-accent px-8 py-4 rounded-xl text-lg font-semibold
                  hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                  shadow-lg whitespace-nowrap"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Auditing...
                  </span>
                ) : 'Audit My Site'}
              </button>
            </div>

            {error && (
              <div className="mt-4 bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-3 text-red-200 text-sm">
                {error}
              </div>
            )}
          </form>

          <p className="mt-6 text-sm text-slate-400">
            Takes 5–15 seconds. We check SEO, contact forms, WhatsApp, CTAs, and mobile readiness.
          </p>
        </div>
      </div>

      {/* What We Check */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-4">
            What We Check
          </h2>
          <p className="text-center text-slate-500 mb-12 max-w-2xl mx-auto">
            Our audit covers the most important factors that determine whether your website converts visitors into customers.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: '🔍',
                title: 'SEO Basics',
                desc: 'Title tags, meta descriptions, headings, alt tags, Open Graph tags, and canonical URLs.',
              },
              {
                icon: '📱',
                title: 'Mobile Readiness',
                desc: 'Viewport configuration, responsive setup, and readable font sizes.',
              },
              {
                icon: '📝',
                title: 'Contact & Lead Capture',
                desc: 'Contact forms, email links, phone links, and enquiry paths.',
              },
              {
                icon: '💬',
                title: 'WhatsApp Integration',
                desc: 'WhatsApp chat buttons and links for instant customer communication.',
              },
              {
                icon: '🎯',
                title: 'Call-to-Action',
                desc: 'Prominent CTA buttons above the fold and throughout the page.',
              },
              {
                icon: '🔒',
                title: 'Technical Health',
                desc: 'HTTPS, favicons, language tags, and mixed content warnings.',
              },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-semibold text-slate-800 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-4">
        <div className="max-w-5xl mx-auto text-center text-sm text-slate-400">
          <p>WebAudit Pro — Free Website Audit Tool</p>
        </div>
      </footer>
    </main>
  )
}
