'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

interface AuditCheck {
  category: string
  name: string
  passed: boolean
  severity: 'critical' | 'warning' | 'info'
  message: string
  points: number
}

interface AuditResult {
  url: string
  score: number
  auditTime: number
  summary: { total: number; passed: number; failed: number; critical: number }
  categories: Record<string, AuditCheck[]>
  checks: AuditCheck[]
}

function ScoreRing({ score }: { score: number }) {
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="180" height="180" className="-rotate-90">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle
          cx="90" cy="90" r={radius} fill="none"
          stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-5xl font-bold" style={{ color }}>{score}</div>
        <div className="text-sm text-slate-400 font-medium">de 100</div>
      </div>
    </div>
  )
}

const severityLabels: Record<string, string> = {
  critical: 'critico',
  warning: 'alerta',
  info: 'info',
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[severity] || styles.info}`}>
      {severityLabels[severity] || severity}
    </span>
  )
}

const categoryLabels: Record<string, string> = {
  'SEO': 'SEO',
  'Captacao de Leads': 'Captacao de Leads',
  'Conversao': 'Conversao',
  'Mobile': 'Mobile',
  'Tecnico': 'Tecnico',
}

function CategorySection({ name, checks }: { name: string; checks: AuditCheck[] }) {
  const passed = checks.filter(c => c.passed).length
  const total = checks.length

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{categoryLabels[name] || name}</h3>
        <span className="text-sm text-slate-500">{passed}/{total} aprovados</span>
      </div>
      <div className="divide-y divide-slate-100">
        {checks.map((check, i) => (
          <div key={i} className="px-6 py-4 flex items-start gap-3">
            <div className={`mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center
              ${check.passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
              {check.passed ? (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-slate-800">{check.name}</span>
                {!check.passed && <SeverityBadge severity={check.severity} />}
              </div>
              <p className="text-sm text-slate-500">{check.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReportContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [result, setResult] = useState<AuditResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const urlParam = searchParams.get('url')

  useEffect(() => {
    async function loadOrFetch() {
      if (!urlParam) {
        router.push('/')
        return
      }

      const cached = sessionStorage.getItem('auditResult')
      if (cached) {
        try {
          const data = JSON.parse(cached)
          setResult(data)
          setLoading(false)
          sessionStorage.removeItem('auditResult')
          return
        } catch { /* fall through to fetch */ }
      }

      try {
        const res = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlParam }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'A auditoria falhou')
        } else {
          setResult(data)
        }
      } catch {
        setError('Falha ao carregar a auditoria. Tente novamente.')
      }
      setLoading(false)
    }

    loadOrFetch()
  }, [urlParam, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="text-center text-white">
          <svg className="animate-spin w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <h2 className="text-xl font-semibold mb-2">Analisando seu site...</h2>
          <p className="text-slate-300">Isso geralmente leva de 5 a 15 segundos</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Auditoria Falhou</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <button onClick={() => router.push('/')} className="gradient-accent text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition">
            Tentar Outra URL
          </button>
        </div>
      </div>
    )
  }

  if (!result) return null

  const scoreLabel = result.score >= 80 ? 'Otimo' : result.score >= 50 ? 'Precisa Melhorar' : 'Fraco'
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/report?url=${encodeURIComponent(urlParam || '')}`
    : ''

  const whatsappMessage = encodeURIComponent(
    `Oi! Acabei de fazer uma auditoria no meu site ${result.url} e tirei ${result.score}/100. Gostaria de ajuda para melhorar meu site. Podemos conversar?`
  )
  const whatsappLink = `https://wa.me/11959041799?text=${whatsappMessage}`
  const calendlyLink = 'https://calendly.com/contato-lkdigital/30min'

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="gradient-bg text-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.push('/')} className="flex items-center gap-1 text-slate-300 hover:text-white transition mb-6 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Nova Auditoria
          </button>

          <div className="flex flex-col md:flex-row items-center gap-8">
            <ScoreRing score={result.score} />
            <div className="text-center md:text-left">
              <h1 className="text-3xl font-bold mb-2">Relatorio de Auditoria</h1>
              <p className="text-slate-300 mb-1 break-all">{result.url}</p>
              <p className="text-sm text-slate-400">
                Nota: <strong className="text-white">{result.score}/100</strong> — {scoreLabel}
                {' '} · Concluido em {(result.auditTime / 1000).toFixed(1)}s
              </p>

              {/* Summary pills */}
              <div className="flex flex-wrap gap-3 mt-4 justify-center md:justify-start">
                <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-sm">
                  {result.summary.passed} aprovados
                </span>
                <span className="bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-sm">
                  {result.summary.failed} reprovados
                </span>
                {result.summary.critical > 0 && (
                  <span className="bg-red-500/30 text-red-200 px-3 py-1 rounded-full text-sm font-medium">
                    {result.summary.critical} criticos
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Share bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-8 flex flex-col sm:flex-row items-center gap-3">
          <span className="text-sm text-slate-500">Compartilhar este relatorio:</span>
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 w-full"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={() => { navigator.clipboard.writeText(shareUrl) }}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition whitespace-nowrap"
          >
            Copiar Link
          </button>
        </div>

        {/* Category sections */}
        <div className="space-y-6">
          {Object.entries(result.categories).map(([cat, checks]) => (
            <CategorySection key={cat} name={cat} checks={checks} />
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-12 bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          <div className="gradient-bg p-8 md:p-12 text-center text-white">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              {result.score < 70
                ? 'Seu Site Precisa de Atencao'
                : 'Quer Uma Nota Ainda Maior?'}
            </h2>
            <p className="text-slate-300 mb-8 max-w-xl mx-auto">
              {result.score < 70
                ? 'Nossa equipe pode corrigir esses problemas e otimizar seu site para converter mais visitantes em clientes pagantes.'
                : 'Nossos especialistas podem ajustar seu site para performance maxima e geracao de leads.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#20bd5a]
                  text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all
                  shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Falar com um Profissional
              </a>

              <a
                href={calendlyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-3 bg-white hover:bg-slate-50
                  text-slate-800 px-8 py-4 rounded-xl text-lg font-semibold transition-all
                  shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Agendar uma Consultoria
              </a>
            </div>

            <p className="mt-6 text-sm text-slate-400">
              Consultoria gratuita — sem compromisso. Deixe-nos ajudar voce a crescer.
            </p>
          </div>
        </div>

        {/* Run Another Audit */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-slate-500 hover:text-slate-800 font-medium transition"
          >
            ← Fazer Outra Auditoria
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-4 mt-8">
        <div className="max-w-5xl mx-auto text-center text-sm text-slate-400">
          <p>WebAudit Pro — Ferramenta Gratuita de Auditoria de Sites</p>
        </div>
      </footer>
    </main>
  )
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="text-center text-white">
          <svg className="animate-spin w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-xl">Carregando relatorio...</p>
        </div>
      </div>
    }>
      <ReportContent />
    </Suspense>
  )
}
