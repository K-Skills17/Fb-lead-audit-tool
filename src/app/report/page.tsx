'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { trackAuditResult, trackLeadCapture, trackWhatsAppClick, trackCalendlyClick, trackShareCopy } from '@/lib/analytics'

interface AuditCheck {
  category: string
  name: string
  passed: boolean
  severity: 'critical' | 'warning' | 'info'
  message: string
  points: number
}

interface AdInsights {
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  cpm: number
  reach: number
  frequency: number
  leads: number
  costPerLead: number
  conversions: number
  dateRange: { start: string; end: string }
}

interface CampaignInsight {
  campaignName: string
  objective: string
  status: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  leads: number
  costPerLead: number
}

interface LeadFormInfo {
  id: string
  name: string
  status: string
  questionCount: number
  questions: string[]
  hasCustomDisclaimer: boolean
  hasContextCard: boolean
  leadsCount: number
  createdTime: string
}

interface AdsAuditResult {
  accountName: string
  accountId: string
  currency: string
  insights: AdInsights | null
  campaigns: CampaignInsight[]
  leadForms: LeadFormInfo[]
  checks: AuditCheck[]
  score: number
}

interface AuditResult {
  url: string
  score: number
  auditTime: number
  summary: { total: number; passed: number; failed: number; critical: number }
  categories: Record<string, AuditCheck[]>
  checks: AuditCheck[]
  adsAudit?: AdsAuditResult
}

// --- Plain-language mappings for non-technical users ---

const categoryMeta: Record<string, { icon: string; label: string; description: string }> = {
  'SEO': {
    icon: '🔍',
    label: 'Aparecendo no Google',
    description: 'Seu site aparece quando clientes buscam por voce?',
  },
  'Captacao de Leads': {
    icon: '📩',
    label: 'Formas de Contato',
    description: 'Clientes conseguem entrar em contato facilmente?',
  },
  'Conversao': {
    icon: '🎯',
    label: 'Chamadas para Acao',
    description: 'Seu site guia os visitantes para o proximo passo?',
  },
  'Mobile': {
    icon: '📱',
    label: 'Experiencia no Celular',
    description: 'Seu site funciona bem no celular?',
  },
  'Visibilidade IA': {
    icon: '🤖',
    label: 'Visibilidade em IAs',
    description: 'ChatGPT e outras IAs recomendam seu negocio?',
  },
  'Tecnico': {
    icon: '🔧',
    label: 'Saude Tecnica',
    description: 'O basico do seu site esta funcionando corretamente?',
  },
  'Facebook Ads': {
    icon: '📊',
    label: 'Facebook Ads',
    description: 'Seus anuncios estao gerando resultados?',
  },
  'Formularios de Lead': {
    icon: '📝',
    label: 'Formularios de Lead Ads',
    description: 'Seus formularios de captacao estao otimizados?',
  },
}

const friendlyCheckNames: Record<string, string> = {
  'Titulo da Pagina': 'Titulo do site no Google',
  'Meta Descricao': 'Descricao nos resultados do Google',
  'Titulo H1': 'Titulo principal da pagina',
  'Alt Tags de Imagens': 'Descricao das imagens',
  'Tag Canonica': 'URL preferida para buscadores',
  'Tags de Redes Sociais': 'Preview ao compartilhar em redes',
  'Formulario de Contato': 'Formulario para clientes',
  'Link de E-mail': 'E-mail clicavel',
  'Numero de Telefone': 'Telefone clicavel',
  'Integracao WhatsApp': 'Botao do WhatsApp',
  'Botoes de Acao (CTA)': 'Botoes tipo "Fale Conosco" ou "Comprar"',
  'CTA na Secao Principal': 'Botao de acao logo no inicio',
  'Tag Meta Viewport': 'Adaptacao para tela do celular',
  'Tamanho de Fonte Legivel': 'Texto legivel no celular',
  'Dados Estruturados (Schema.org)': 'Informacoes para buscadores e IAs',
  'Secao de FAQ': 'Perguntas frequentes',
  'Hierarquia de Conteudo': 'Organizacao do conteudo',
  'Autoridade e Credibilidade': 'Pagina "Sobre Nos"',
  'Sitemap XML': 'Mapa do site para buscadores',
  'Acesso de Bots de IA': 'Permissao para IAs acessarem',
  'HTTPS / SSL': 'Conexao segura (cadeado)',
  'Favicon': 'Icone na aba do navegador',
  'Atributo de Idioma': 'Idioma da pagina definido',
  'Conteudo Misto': 'Seguranca dos recursos da pagina',
  // Facebook Ads checks
  'Taxa de Cliques (CTR)': 'Quantas pessoas clicam nos seus anuncios',
  'Custo por Mil (CPM)': 'Quanto custa alcançar 1.000 pessoas',
  'Frequencia de Exibicao': 'Quantas vezes cada pessoa ve seu anuncio',
  'Custo por Lead (CPL)': 'Quanto custa cada novo contato',
  'Investimento Ativo': 'Investimento recente em anuncios',
  'Campanhas Ativas': 'Quantidade de campanhas rodando',
  'Objetivo de Lead Generation': 'Campanhas otimizadas para leads',
  // Lead Form checks
  'Quantidade de Perguntas': 'Tamanho do formulario',
  'Cartao de Contexto': 'Informacao antes do formulario',
  'Formularios Ativos': 'Formularios disponiveis',
  'Formularios de Lead Ads': 'Captacao de leads no Facebook',
}

const friendlyMessages: Record<string, { good: string; bad: string }> = {
  'Titulo da Pagina': {
    good: 'Seu site tem um bom titulo que aparece no Google.',
    bad: 'Seu site nao tem um titulo adequado — e isso que aparece no Google quando alguem busca por voce.',
  },
  'Meta Descricao': {
    good: 'A descricao que aparece no Google esta bem feita.',
    bad: 'A descricao do seu site no Google esta faltando ou precisa melhorar. Isso afeta se as pessoas clicam no seu link.',
  },
  'Titulo H1': {
    good: 'Sua pagina tem um titulo principal claro.',
    bad: 'Sua pagina nao tem um titulo principal claro, o que confunde o Google e seus visitantes.',
  },
  'Alt Tags de Imagens': {
    good: 'Suas imagens estao bem descritas para buscadores.',
    bad: 'Algumas imagens nao tem descricao — o Google nao consegue "ver" essas imagens.',
  },
  'Tag Canonica': {
    good: 'Buscadores sabem qual e a versao principal desta pagina.',
    bad: 'Sem indicacao de URL preferida — pode causar conteudo duplicado no Google.',
  },
  'Tags de Redes Sociais': {
    good: 'Quando alguem compartilha seu site, aparece um preview bonito.',
    bad: 'Quando alguem compartilha seu link no WhatsApp ou Instagram, nao aparece preview — fica feio e ninguem clica.',
  },
  'Formulario de Contato': {
    good: 'Clientes podem entrar em contato diretamente pelo site.',
    bad: 'Nao tem formulario de contato — voce esta perdendo clientes que querem falar com voce!',
  },
  'Link de E-mail': {
    good: 'Visitantes podem clicar no e-mail para enviar mensagem.',
    bad: 'Nao tem e-mail clicavel — dificulta o contato, especialmente no celular.',
  },
  'Numero de Telefone': {
    good: 'Clientes podem tocar no telefone para ligar direto.',
    bad: 'Nao tem telefone clicavel — no celular, as pessoas esperam tocar e ligar.',
  },
  'Integracao WhatsApp': {
    good: 'Botao do WhatsApp detectado — otimo para o Brasil!',
    bad: 'Sem botao do WhatsApp — no Brasil, WhatsApp pode aumentar seus contatos em ate 40%.',
  },
  'Botoes de Acao (CTA)': {
    good: 'Seu site tem botoes claros dizendo ao visitante o que fazer.',
    bad: 'Sem botoes claros de acao — visitantes entram no site e nao sabem o que fazer a seguir.',
  },
  'CTA na Secao Principal': {
    good: 'Logo no inicio do site ja tem um botao de acao — otimo!',
    bad: 'O inicio do site nao tem botao de acao — a maioria dos visitantes nao rola a pagina, entao precisa chamar atencao logo.',
  },
  'Tag Meta Viewport': {
    good: 'Seu site se adapta bem a tela do celular.',
    bad: 'Seu site nao esta configurado para celular — vai aparecer pequeno e dificil de usar.',
  },
  'Tamanho de Fonte Legivel': {
    good: 'O texto esta num tamanho bom para leitura.',
    bad: 'Parte do texto esta muito pequena para ler no celular.',
  },
  'Dados Estruturados (Schema.org)': {
    good: 'Google e IAs entendem bem do que se trata seu negocio.',
    bad: 'Google e IAs como ChatGPT nao conseguem entender seu negocio direito — adicionar dados estruturados ajuda muito.',
  },
  'Secao de FAQ': {
    good: 'Voce tem perguntas frequentes — IAs adoram citar isso!',
    bad: 'Sem secao de perguntas frequentes — e o tipo de conteudo que IAs mais citam e recomendam.',
  },
  'Hierarquia de Conteudo': {
    good: 'Seu conteudo esta bem organizado com titulos e subtitulos.',
    bad: 'Seu conteudo precisa de mais organizacao com subtitulos — fica dificil para Google e IAs entenderem.',
  },
  'Autoridade e Credibilidade': {
    good: 'Seu site mostra quem esta por tras do negocio — isso gera confianca.',
    bad: 'Sem pagina "Sobre Nos" — visitantes e IAs nao sabem quem voce e, o que reduz a confianca.',
  },
  'Sitemap XML': {
    good: 'Buscadores e IAs conseguem encontrar todas as suas paginas.',
    bad: 'Sem mapa do site — buscadores podem nao encontrar todas as suas paginas.',
  },
  'Acesso de Bots de IA': {
    good: 'IAs podem acessar e recomendar seu site normalmente.',
    bad: 'Seu site esta bloqueando IAs — ChatGPT e outros nao vao recomendar voce.',
  },
  'HTTPS / SSL': {
    good: 'Seu site tem conexao segura (cadeado verde).',
    bad: 'Seu site nao tem conexao segura — navegadores vao avisar "site nao seguro" para seus visitantes.',
  },
  'Favicon': {
    good: 'Seu site tem icone na aba do navegador.',
    bad: 'Sem icone na aba do navegador — parece pouco profissional.',
  },
  'Atributo de Idioma': {
    good: 'O idioma da pagina esta definido corretamente.',
    bad: 'O idioma da pagina nao esta definido — pode afetar acessibilidade e SEO.',
  },
  'Conteudo Misto': {
    good: 'Todos os recursos carregam de forma segura.',
    bad: 'Alguns recursos carregam de forma insegura — navegadores podem bloquear partes do seu site.',
  },
}

// --- Components ---

function ScoreRing({ score }: { score: number }) {
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="180" height="180" className="-rotate-90">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
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

function ScoreVerdict({ score }: { score: number }) {
  if (score >= 80) return (
    <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-300 px-4 py-2 rounded-full text-sm font-semibold">
      <span className="w-2 h-2 bg-green-400 rounded-full" />
      Otimo! Seu site esta bem configurado
    </div>
  )
  if (score >= 50) return (
    <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 px-4 py-2 rounded-full text-sm font-semibold">
      <span className="w-2 h-2 bg-amber-400 rounded-full" />
      Bom, mas pode melhorar bastante
    </div>
  )
  return (
    <div className="inline-flex items-center gap-2 bg-red-500/20 text-red-300 px-4 py-2 rounded-full text-sm font-semibold">
      <span className="w-2 h-2 bg-red-400 rounded-full" />
      Precisa de atencao urgente
    </div>
  )
}

function CategoryProgress({ checks }: { checks: AuditCheck[] }) {
  const passed = checks.filter(c => c.passed).length
  const total = checks.length
  const pct = Math.round((passed / total) * 100)
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-slate-600 whitespace-nowrap">{passed}/{total}</span>
    </div>
  )
}

function CheckItem({ check }: { check: AuditCheck }) {
  const friendly = friendlyMessages[check.name]
  const displayName = friendlyCheckNames[check.name] || check.name
  const displayMessage = friendly
    ? (check.passed ? friendly.good : friendly.bad)
    : check.message

  return (
    <div className={`px-5 py-4 flex items-start gap-4 ${!check.passed ? 'bg-red-50/50' : ''}`}>
      <div className={`mt-1 w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center
        ${check.passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
        {check.passed ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`font-medium ${check.passed ? 'text-slate-700' : 'text-slate-800'}`}>
            {displayName}
          </span>
          {!check.passed && check.severity === 'critical' && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              Importante
            </span>
          )}
        </div>
        <p className={`text-sm leading-relaxed ${check.passed ? 'text-slate-500' : 'text-slate-600'}`}>
          {displayMessage}
        </p>
      </div>
    </div>
  )
}

function CategoryCard({ name, checks }: { name: string; checks: AuditCheck[] }) {
  const meta = categoryMeta[name] || { icon: '📋', label: name, description: '' }
  const failedChecks = checks.filter(c => !c.passed)
  const passedChecks = checks.filter(c => c.passed)
  const allPassed = failedChecks.length === 0

  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${allPassed ? 'border-green-100' : 'border-slate-200'}`}>
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{meta.icon}</span>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">{meta.label}</h3>
              <p className="text-sm text-slate-500">{meta.description}</p>
            </div>
          </div>
          {allPassed && (
            <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
              Tudo certo!
            </span>
          )}
        </div>
        <CategoryProgress checks={checks} />
      </div>
      <div className="divide-y divide-slate-100">
        {failedChecks.map((check, i) => (
          <CheckItem key={`fail-${i}`} check={check} />
        ))}
        {passedChecks.map((check, i) => (
          <CheckItem key={`pass-${i}`} check={check} />
        ))}
      </div>
    </div>
  )
}

function TopPriorities({ checks }: { checks: AuditCheck[] }) {
  const critical = checks
    .filter(c => !c.passed && c.severity === 'critical')
    .slice(0, 5)

  if (critical.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-red-100 bg-red-50">
        <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
          <span className="text-xl">⚡</span>
          Prioridades — Corrija Primeiro
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Estes itens tem o maior impacto no seu negocio. Corrigir eles pode trazer mais clientes rapidamente.
        </p>
      </div>
      <div className="divide-y divide-red-50">
        {critical.map((check, i) => {
          const displayName = friendlyCheckNames[check.name] || check.name
          const friendly = friendlyMessages[check.name]
          const displayMessage = friendly ? friendly.bad : check.message
          const catMeta = categoryMeta[check.category]

          return (
            <div key={i} className="px-6 py-4 flex items-start gap-4">
              <div className="mt-1 w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-slate-800">{displayName}</span>
                  {catMeta && (
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {catMeta.icon} {catMeta.label}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{displayMessage}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QuickSummaryCards({ result }: { result: AuditResult }) {
  const cats = Object.entries(result.categories)
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {cats.map(([name, checks]) => {
        const meta = categoryMeta[name] || { icon: '📋', label: name }
        const passed = checks.filter(c => c.passed).length
        const total = checks.length
        const pct = Math.round((passed / total) * 100)
        const color = pct >= 80 ? 'text-green-600 bg-green-50 border-green-100' : pct >= 50 ? 'text-amber-600 bg-amber-50 border-amber-100' : 'text-red-600 bg-red-50 border-red-100'

        return (
          <div key={name} className={`rounded-xl border p-4 text-center ${color}`}>
            <div className="text-2xl mb-1">{meta.icon}</div>
            <div className="text-2xl font-bold">{pct}%</div>
            <div className="text-xs font-medium mt-1 opacity-80">{meta.label}</div>
          </div>
        )
      })}
    </div>
  )
}

// --- Facebook Ads Components ---

function AdsOverviewCard({ insights, currency }: { insights: AdInsights; currency: string }) {
  const metrics = [
    { label: 'Investimento', value: `${currency === 'BRL' ? 'R$' : currency}${insights.spend.toFixed(2)}`, sub: 'ultimos 30 dias' },
    { label: 'Alcance', value: insights.reach.toLocaleString(), sub: 'pessoas' },
    { label: 'Cliques', value: insights.clicks.toLocaleString(), sub: `CTR: ${insights.ctr.toFixed(2)}%` },
    { label: 'CPM', value: `R$${insights.cpm.toFixed(2)}`, sub: 'custo por 1k views' },
    { label: 'Leads', value: insights.leads.toLocaleString(), sub: insights.leads > 0 ? `CPL: R$${insights.costPerLead.toFixed(2)}` : 'sem leads' },
    { label: 'Frequencia', value: insights.frequency.toFixed(1), sub: 'vezes por pessoa' },
  ]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 bg-blue-50">
        <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
          <span className="text-xl">📊</span>
          Desempenho dos Anuncios — Ultimos 30 Dias
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          {insights.dateRange.start} a {insights.dateRange.end}
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-slate-100">
        {metrics.map(m => (
          <div key={m.label} className="bg-white p-5 text-center">
            <div className="text-2xl font-bold text-slate-800">{m.value}</div>
            <div className="text-sm font-medium text-slate-600 mt-1">{m.label}</div>
            <div className="text-xs text-slate-400 mt-0.5">{m.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CampaignsTable({ campaigns }: { campaigns: CampaignInsight[] }) {
  if (campaigns.length === 0) return null

  const objectiveLabels: Record<string, string> = {
    'LEAD_GENERATION': 'Leads',
    'OUTCOME_LEADS': 'Leads',
    'LINK_CLICKS': 'Cliques',
    'OUTCOME_TRAFFIC': 'Trafego',
    'CONVERSIONS': 'Conversoes',
    'OUTCOME_ENGAGEMENT': 'Engajamento',
    'REACH': 'Alcance',
    'OUTCOME_AWARENESS': 'Reconhecimento',
    'BRAND_AWARENESS': 'Reconhecimento',
    'POST_ENGAGEMENT': 'Engajamento',
    'MESSAGES': 'Mensagens',
    'OUTCOME_SALES': 'Vendas',
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100">
        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
          <span className="text-xl">🎯</span>
          Suas Campanhas
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th className="px-5 py-3 font-semibold">Campanha</th>
              <th className="px-5 py-3 font-semibold">Objetivo</th>
              <th className="px-5 py-3 font-semibold text-right">Gasto</th>
              <th className="px-5 py-3 font-semibold text-right">CTR</th>
              <th className="px-5 py-3 font-semibold text-right">Leads</th>
              <th className="px-5 py-3 font-semibold text-right">CPL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campaigns.map((c, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="font-medium text-slate-800 truncate max-w-[200px]">{c.campaignName}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {c.status === 'ACTIVE' ? 'Ativa' : 'Pausada'}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-600">{objectiveLabels[c.objective] || c.objective}</td>
                <td className="px-5 py-3 text-right text-slate-800">R${c.spend.toFixed(2)}</td>
                <td className="px-5 py-3 text-right">
                  <span className={c.ctr >= 1 ? 'text-green-600' : 'text-red-500'}>{c.ctr.toFixed(2)}%</span>
                </td>
                <td className="px-5 py-3 text-right text-slate-800">{c.leads}</td>
                <td className="px-5 py-3 text-right text-slate-800">
                  {c.costPerLead > 0 ? `R$${c.costPerLead.toFixed(2)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LeadFormsCard({ forms }: { forms: LeadFormInfo[] }) {
  if (forms.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100">
        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
          <span className="text-xl">📝</span>
          Seus Formularios de Lead Ads
        </h3>
      </div>
      <div className="divide-y divide-slate-100">
        {forms.map((form) => (
          <div key={form.id} className="px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800">{form.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${form.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {form.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <span className="text-sm text-slate-500">{form.leadsCount} leads</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className={`text-xs px-2 py-1 rounded-lg ${form.questionCount <= 3 ? 'bg-green-50 text-green-700' : form.questionCount <= 5 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                {form.questionCount} perguntas
              </span>
              {form.hasContextCard && (
                <span className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700">Com contexto</span>
              )}
              {form.hasCustomDisclaimer && (
                <span className="text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-700">Disclaimer personalizado</span>
              )}
            </div>
            {form.questions.length > 0 && (
              <div className="text-xs text-slate-500">
                Campos: {form.questions.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Lead Capture Gate ---

function LeadCaptureForm({ result, onComplete }: { result: AuditResult; onComplete: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  function formatPhoneInput(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (!name.trim() || digits.length < 10 || !clinicName.trim()) {
      setFormError('Preencha todos os campos corretamente.')
      return
    }

    setSubmitting(true)
    setFormError('')

    const reportUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/report?url=${encodeURIComponent(result.url)}`
      : ''

    const topIssues = result.checks
      .filter(c => !c.passed && c.severity === 'critical')
      .slice(0, 5)
      .map(c => friendlyCheckNames[c.name] || c.name)

    try {
      const res = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: digits,
          clinicName: clinicName.trim(),
          siteUrl: result.url,
          score: result.score,
          topIssues,
          checks: result.checks,
          reportUrl,
        }),
      })
      const data = await res.json()
      if (data.whatsappError) {
        console.warn('WhatsApp send failed:', data.whatsappError)
      }
    } catch (err) {
      console.warn('WhatsApp API call failed:', err)
    }

    trackLeadCapture(clinicName.trim(), result.score)
    onComplete()
  }

  const scoreColor = result.score >= 80 ? '#22c55e' : result.score >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Score teaser */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-4 mb-4"
            style={{ borderColor: scoreColor }}>
            <span className="text-3xl font-bold" style={{ color: scoreColor }}>{result.score}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Sua analise esta pronta!
          </h1>
          <p className="text-slate-300 text-lg">
            Seu site tirou <strong style={{ color: scoreColor }}>{result.score}/100</strong>.
            {result.summary.critical > 0 && (
              <span className="text-red-300"> Encontramos {result.summary.critical} problema{result.summary.critical > 1 ? 's' : ''} importante{result.summary.critical > 1 ? 's' : ''}.</span>
            )}
          </p>
          <p className="text-slate-400 text-sm mt-2">
            Preencha abaixo para ver o relatorio completo. Enviaremos tambem uma copia no seu WhatsApp.
          </p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 md:p-8 space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Seu nome
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Maria Silva"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800
                placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-1.5">
              WhatsApp / Telefone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
              placeholder="(11) 99999-9999"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800
                placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="clinic" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Nome da clinica
            </label>
            <input
              id="clinic"
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="Ex: Clinica Sorriso"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800
                placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              disabled={submitting}
            />
          </div>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{formError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full gradient-accent text-white py-4 rounded-xl text-lg font-semibold
              hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed
              shadow-lg"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Liberando relatorio...
              </span>
            ) : (
              'Ver Meu Relatorio Completo'
            )}
          </button>

          <p className="text-xs text-center text-slate-400">
            Seus dados ficam seguros. Usamos apenas para enviar o relatorio.
          </p>
        </form>
      </div>
    </div>
  )
}

// --- Main Report ---

function ReportContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [result, setResult] = useState<AuditResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [leadCaptured, setLeadCaptured] = useState(false)

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
        <div className="text-center text-white px-4">
          <svg className="animate-spin w-12 h-12 mx-auto mb-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <h2 className="text-2xl font-bold mb-2">Analisando seu site...</h2>
          <p className="text-slate-300 text-lg">Estamos verificando tudo para voce</p>
          <p className="text-slate-400 text-sm mt-2">Isso leva de 5 a 15 segundos</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 mx-auto mb-6 bg-amber-100 rounded-2xl flex items-center justify-center">
            <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Nao conseguimos analisar</h2>
          <p className="text-slate-500 mb-8 text-lg">{error}</p>
          <button onClick={() => router.push('/')} className="gradient-accent text-white px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition text-lg">
            Tentar Outra URL
          </button>
        </div>
      </div>
    )
  }

  if (!result) return null

  // Show lead capture form before revealing the report
  if (!leadCaptured) {
    return (
      <LeadCaptureForm
        result={result}
        onComplete={() => {
          setLeadCaptured(true)
          trackAuditResult(result.url, result.score)
        }}
      />
    )
  }

  // Merge ads checks into quick summary if available
  const allCategories = { ...result.categories }
  if (result.adsAudit?.checks) {
    for (const check of result.adsAudit.checks) {
      if (!allCategories[check.category]) allCategories[check.category] = []
      allCategories[check.category].push(check)
    }
  }

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/report?url=${encodeURIComponent(urlParam || '')}`
    : ''

  const whatsappMessage = encodeURIComponent(
    `Oi! Acabei de fazer uma auditoria no meu site ${result.url} e tirei ${result.score}/100. Gostaria de ajuda para melhorar meu site. Podemos conversar?`
  )
  const whatsappLink = `https://wa.me/11959041799?text=${whatsappMessage}`
  const calendlyLink = 'https://calendly.com/contato-lkdigital/30min'

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    trackShareCopy(result?.url || '')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="gradient-bg text-white">
        <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
          <button onClick={() => router.push('/')} className="flex items-center gap-1 text-slate-400 hover:text-white transition mb-8 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Nova Auditoria
          </button>

          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <ScoreRing score={result.score} />
            <div className="text-center md:text-left flex-1">
              <h1 className="text-3xl md:text-4xl font-bold mb-3">Resultado da Analise</h1>
              <p className="text-slate-300 mb-4 break-all text-sm">{result.url}</p>
              <ScoreVerdict score={result.score} />

              <div className="flex flex-wrap gap-4 mt-6 justify-center md:justify-start text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="text-slate-300"><strong className="text-white">{result.summary.passed}</strong> itens OK</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full" />
                  <span className="text-slate-300"><strong className="text-white">{result.summary.failed}</strong> para corrigir</span>
                </div>
                {result.summary.critical > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-red-400 rounded-full animate-pulse" />
                    <span className="text-red-300"><strong className="text-white">{result.summary.critical}</strong> urgentes</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 -mt-6">
        {/* Quick Summary */}
        <div className="mb-8">
          <QuickSummaryCards result={{ ...result, categories: allCategories }} />
        </div>

        {/* Top Priorities */}
        <div className="mb-8">
          <TopPriorities checks={result.checks} />
        </div>

        {/* Facebook Ads Section (if available) */}
        {result.adsAudit && (
          <div className="space-y-6 mb-8">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              📊 Auditoria Facebook Ads
              <span className="text-sm font-normal text-slate-500">— {result.adsAudit.accountName}</span>
            </h2>

            {result.adsAudit.insights && (
              <AdsOverviewCard insights={result.adsAudit.insights} currency={result.adsAudit.currency} />
            )}

            <CampaignsTable campaigns={result.adsAudit.campaigns} />
            <LeadFormsCard forms={result.adsAudit.leadForms} />

            {/* Ads audit check cards */}
            {(() => {
              const adsCategories = result.adsAudit.checks.reduce((acc, check) => {
                if (!acc[check.category]) acc[check.category] = []
                acc[check.category].push(check)
                return acc
              }, {} as Record<string, AuditCheck[]>)

              return Object.entries(adsCategories).map(([cat, checks]) => (
                <CategoryCard key={cat} name={cat} checks={checks} />
              ))
            })()}
          </div>
        )}

        {/* Detail Sections */}
        <div className="space-y-6 mb-10">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            Analise do Site
          </h2>
          {Object.entries(result.categories).map(([cat, checks]) => (
            <CategoryCard key={cat} name={cat} checks={checks} />
          ))}
        </div>

        {/* Share */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-10">
          <p className="text-sm font-medium text-slate-700 mb-3">Compartilhar este relatorio</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600 w-full"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={handleCopy}
              className={`px-6 py-3 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}
            >
              {copied ? 'Copiado!' : 'Copiar Link'}
            </button>
          </div>
        </div>

        {/* CTA Section */}
        <div className="rounded-2xl shadow-lg overflow-hidden mb-10">
          <div className="gradient-bg p-8 md:p-12 text-center text-white">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              {result.score < 70
                ? 'Quer que a gente resolva isso pra voce?'
                : 'Quer turbinar seu site ainda mais?'}
            </h2>
            <p className="text-slate-300 mb-8 max-w-xl mx-auto text-lg leading-relaxed">
              {result.score < 70
                ? 'Nossa equipe pode corrigir tudo e deixar seu site pronto para atrair mais clientes.'
                : 'Nossos especialistas podem levar seu site ao proximo nivel.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick(result.score)}
                className="inline-flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#20bd5a]
                  text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all
                  shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Chamar no WhatsApp
              </a>

              <a
                href={calendlyLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackCalendlyClick(result.score)}
                className="inline-flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20
                  text-white border border-white/30 px-8 py-4 rounded-xl text-lg font-semibold transition-all
                  hover:-translate-y-0.5"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Agendar Consultoria Gratis
              </a>
            </div>

            <p className="mt-6 text-sm text-slate-400">
              Sem compromisso — a gente so quer te ajudar a crescer.
            </p>
          </div>
        </div>

        {/* Run Another Audit */}
        <div className="text-center pb-12">
          <button
            onClick={() => router.push('/')}
            className="text-slate-500 hover:text-slate-800 font-medium transition text-lg"
          >
            ← Analisar Outro Site
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-4">
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
