// ============================================================
// Meta Marketing API — Ad Account Insights & Lead Forms
// Uses the same access token as CAPI (needs ads_read permission)
// ============================================================

const ACCESS_TOKEN = process.env.META_CAPI_TOKEN || ''
const API_VERSION = 'v21.0'
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`

// --- Types ---

export interface AdInsights {
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

export interface CampaignInsight {
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

export interface LeadFormInfo {
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

export interface AdsAuditResult {
  accountName: string
  accountId: string
  currency: string
  insights: AdInsights | null
  campaigns: CampaignInsight[]
  leadForms: LeadFormInfo[]
  checks: AdsAuditCheck[]
  score: number
  error?: string
}

export interface AdsAuditCheck {
  category: string
  name: string
  passed: boolean
  severity: 'critical' | 'warning' | 'info'
  message: string
  points: number
}

// --- API Helpers ---

async function graphGet(path: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const url = new URL(`${BASE_URL}${path}`)
  url.searchParams.set('access_token', ACCESS_TOKEN)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Graph API ${res.status}: ${body}`)
  }

  return res.json() as Promise<Record<string, unknown>>
}

// --- Fetch Ad Account Insights (last 30 days) ---

async function fetchAccountInsights(adAccountId: string): Promise<{ insights: AdInsights | null; accountName: string; currency: string }> {
  // Get account info
  const accountInfo = await graphGet(`/${adAccountId}`, {
    fields: 'name,currency,account_status',
  })

  const accountName = (accountInfo.name as string) || adAccountId
  const currency = (accountInfo.currency as string) || 'BRL'

  // Get insights for last 30 days
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const dateStart = thirtyDaysAgo.toISOString().split('T')[0]
  const dateEnd = today.toISOString().split('T')[0]

  try {
    const insightsRes = await graphGet(`/${adAccountId}/insights`, {
      fields: 'spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type',
      time_range: JSON.stringify({ since: dateStart, until: dateEnd }),
      level: 'account',
    })

    const data = (insightsRes.data as Record<string, unknown>[])?.[0]
    if (!data) {
      return { insights: null, accountName, currency }
    }

    // Extract lead actions
    const actions = (data.actions as Array<{ action_type: string; value: string }>) || []
    const costPerAction = (data.cost_per_action_type as Array<{ action_type: string; value: string }>) || []

    const leadAction = actions.find(a => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped')
    const leadCost = costPerAction.find(a => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped')

    const totalConversions = actions
      .filter(a => a.action_type.startsWith('offsite_conversion') || a.action_type === 'lead')
      .reduce((sum, a) => sum + parseFloat(a.value), 0)

    const insights: AdInsights = {
      spend: parseFloat(data.spend as string) || 0,
      impressions: parseInt(data.impressions as string) || 0,
      clicks: parseInt(data.clicks as string) || 0,
      ctr: parseFloat(data.ctr as string) || 0,
      cpc: parseFloat(data.cpc as string) || 0,
      cpm: parseFloat(data.cpm as string) || 0,
      reach: parseInt(data.reach as string) || 0,
      frequency: parseFloat(data.frequency as string) || 0,
      leads: leadAction ? parseInt(leadAction.value) : 0,
      costPerLead: leadCost ? parseFloat(leadCost.value) : 0,
      conversions: totalConversions,
      dateRange: { start: dateStart, end: dateEnd },
    }

    return { insights, accountName, currency }
  } catch {
    return { insights: null, accountName, currency }
  }
}

// --- Fetch Campaign-level Insights ---

async function fetchCampaignInsights(adAccountId: string): Promise<CampaignInsight[]> {
  try {
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const res = await graphGet(`/${adAccountId}/campaigns`, {
      fields: 'name,objective,status,insights.time_range({"since":"' +
        thirtyDaysAgo.toISOString().split('T')[0] + '","until":"' +
        today.toISOString().split('T')[0] + '"}){spend,impressions,clicks,ctr,actions,cost_per_action_type}',
      limit: '20',
    })

    const campaigns = (res.data as Array<Record<string, unknown>>) || []

    return campaigns
      .filter(c => c.status === 'ACTIVE' || c.status === 'PAUSED')
      .map(c => {
        const insightsData = (c.insights as Record<string, unknown>)
        const data = insightsData ? ((insightsData.data as Array<Record<string, unknown>>)?.[0]) : null

        const actions = (data?.actions as Array<{ action_type: string; value: string }>) || []
        const costPerAction = (data?.cost_per_action_type as Array<{ action_type: string; value: string }>) || []
        const leadAction = actions.find(a => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped')
        const leadCost = costPerAction.find(a => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped')

        return {
          campaignName: c.name as string,
          objective: c.objective as string,
          status: c.status as string,
          spend: data ? parseFloat(data.spend as string) || 0 : 0,
          impressions: data ? parseInt(data.impressions as string) || 0 : 0,
          clicks: data ? parseInt(data.clicks as string) || 0 : 0,
          ctr: data ? parseFloat(data.ctr as string) || 0 : 0,
          leads: leadAction ? parseInt(leadAction.value) : 0,
          costPerLead: leadCost ? parseFloat(leadCost.value) : 0,
        }
      })
      .slice(0, 10)
  } catch {
    return []
  }
}

// --- Fetch Lead Forms ---

async function fetchLeadForms(adAccountId: string): Promise<LeadFormInfo[]> {
  try {
    // Get pages associated with the ad account
    const pagesRes = await graphGet(`/${adAccountId}/promote_pages`, {
      fields: 'id,name',
      limit: '5',
    })

    const pages = (pagesRes.data as Array<{ id: string; name: string }>) || []
    const forms: LeadFormInfo[] = []

    for (const page of pages.slice(0, 3)) {
      try {
        const formsRes = await graphGet(`/${page.id}/leadgen_forms`, {
          fields: 'id,name,status,questions,privacy_policy,created_time,leads_count',
          limit: '10',
        })

        const pageForms = (formsRes.data as Array<Record<string, unknown>>) || []

        for (const form of pageForms) {
          const questions = (form.questions as Array<{ key: string; label: string; type: string }>) || []
          const privacyPolicy = form.privacy_policy as Record<string, unknown> | undefined

          forms.push({
            id: form.id as string,
            name: form.name as string,
            status: form.status as string,
            questionCount: questions.length,
            questions: questions.map(q => q.label || q.key),
            hasCustomDisclaimer: !!privacyPolicy?.link_text,
            hasContextCard: !!(form as Record<string, unknown>).context_card,
            leadsCount: parseInt(form.leads_count as string) || 0,
            createdTime: form.created_time as string,
          })
        }
      } catch {
        // Skip pages without leadgen access
      }
    }

    return forms
  } catch {
    return []
  }
}

// --- Audit Checks for Ads ---

function runAdsChecks(insights: AdInsights | null, campaigns: CampaignInsight[], leadForms: LeadFormInfo[]): AdsAuditCheck[] {
  const checks: AdsAuditCheck[] = []

  if (insights) {
    // 1. CTR check (industry avg ~1%)
    checks.push({
      category: 'Facebook Ads',
      name: 'Taxa de Cliques (CTR)',
      passed: insights.ctr >= 1.0,
      severity: 'critical',
      message: insights.ctr >= 2.0
        ? `CTR excelente de ${insights.ctr.toFixed(2)}% — seus anuncios estao chamando atencao`
        : insights.ctr >= 1.0
          ? `CTR de ${insights.ctr.toFixed(2)}% — bom, acima da media do mercado`
          : `CTR de ${insights.ctr.toFixed(2)}% — abaixo da media de 1%. Seus anuncios precisam de criativos mais atrativos`,
      points: 10,
    })

    // 2. CPM check (Brazil avg ~R$15-30)
    checks.push({
      category: 'Facebook Ads',
      name: 'Custo por Mil (CPM)',
      passed: insights.cpm <= 35,
      severity: 'warning',
      message: insights.cpm <= 15
        ? `CPM de R$${insights.cpm.toFixed(2)} — otimo custo de alcance`
        : insights.cpm <= 35
          ? `CPM de R$${insights.cpm.toFixed(2)} — dentro da media do mercado`
          : `CPM de R$${insights.cpm.toFixed(2)} — acima da media. Revise segmentacao e qualidade dos anuncios`,
      points: 7,
    })

    // 3. Frequency check (>3 = ad fatigue)
    checks.push({
      category: 'Facebook Ads',
      name: 'Frequencia de Exibicao',
      passed: insights.frequency <= 3,
      severity: 'warning',
      message: insights.frequency <= 2
        ? `Frequencia de ${insights.frequency.toFixed(1)} — equilibrio saudavel`
        : insights.frequency <= 3
          ? `Frequencia de ${insights.frequency.toFixed(1)} — fique atento, pode gerar fadiga`
          : `Frequencia de ${insights.frequency.toFixed(1)} — muito alta! Seu publico ja esta cansado dos anuncios. Atualize os criativos`,
      points: 8,
    })

    // 4. Cost per Lead check (Brazil avg varies, but R$20-50 is typical for clinics)
    if (insights.leads > 0) {
      checks.push({
        category: 'Facebook Ads',
        name: 'Custo por Lead (CPL)',
        passed: insights.costPerLead <= 50,
        severity: 'critical',
        message: insights.costPerLead <= 20
          ? `CPL de R$${insights.costPerLead.toFixed(2)} — excelente eficiencia de aquisicao`
          : insights.costPerLead <= 50
            ? `CPL de R$${insights.costPerLead.toFixed(2)} — dentro da media do mercado`
            : `CPL de R$${insights.costPerLead.toFixed(2)} — alto demais. Otimize formularios e segmentacao para reduzir`,
        points: 12,
      })
    }

    // 5. Active spend check
    checks.push({
      category: 'Facebook Ads',
      name: 'Investimento Ativo',
      passed: insights.spend > 0,
      severity: 'info',
      message: insights.spend > 0
        ? `R$${insights.spend.toFixed(2)} investidos nos ultimos 30 dias com ${insights.impressions.toLocaleString()} impressoes`
        : 'Sem investimento nos ultimos 30 dias — seus anuncios estao pausados',
      points: 5,
    })
  }

  // 6. Campaign diversity (multiple campaigns = better testing)
  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE')
  checks.push({
    category: 'Facebook Ads',
    name: 'Campanhas Ativas',
    passed: activeCampaigns.length >= 2,
    severity: 'warning',
    message: activeCampaigns.length === 0
      ? 'Nenhuma campanha ativa — voce nao esta gerando leads pelo Facebook'
      : activeCampaigns.length === 1
        ? '1 campanha ativa — teste mais campanhas para descobrir o que funciona melhor'
        : `${activeCampaigns.length} campanhas ativas — bom para comparacao e otimizacao`,
    points: 5,
  })

  // 7. Lead generation objective check
  const hasLeadCampaign = campaigns.some(c =>
    c.objective === 'LEAD_GENERATION' || c.objective === 'OUTCOME_LEADS'
  )
  checks.push({
    category: 'Facebook Ads',
    name: 'Objetivo de Lead Generation',
    passed: hasLeadCampaign,
    severity: 'critical',
    message: hasLeadCampaign
      ? 'Voce tem campanhas com objetivo de geracao de leads — o algoritmo do Facebook otimiza para leads'
      : 'Nenhuma campanha com objetivo de leads — use o objetivo "Lead Generation" para que o Facebook encontre pessoas mais propensas a converter',
    points: 10,
  })

  // Lead Form checks
  if (leadForms.length > 0) {
    // 8. Form question count (fewer = higher conversion)
    const avgQuestions = leadForms.reduce((sum, f) => sum + f.questionCount, 0) / leadForms.length
    checks.push({
      category: 'Formularios de Lead',
      name: 'Quantidade de Perguntas',
      passed: avgQuestions <= 5,
      severity: 'warning',
      message: avgQuestions <= 3
        ? `Media de ${avgQuestions.toFixed(0)} perguntas por formulario — formularios curtos convertem mais`
        : avgQuestions <= 5
          ? `Media de ${avgQuestions.toFixed(0)} perguntas — bom equilibrio entre dados e conversao`
          : `Media de ${avgQuestions.toFixed(0)} perguntas — formularios longos reduzem a taxa de preenchimento. Simplifique!`,
      points: 8,
    })

    // 9. Context card usage
    const hasContextCard = leadForms.some(f => f.hasContextCard)
    checks.push({
      category: 'Formularios de Lead',
      name: 'Cartao de Contexto',
      passed: hasContextCard,
      severity: 'info',
      message: hasContextCard
        ? 'Formulario com cartao de contexto — ajuda a qualificar leads antes de preencherem'
        : 'Nenhum formulario usa cartao de contexto — adicione para explicar a oferta e filtrar leads de baixa qualidade',
      points: 5,
    })

    // 10. Number of active forms
    const activeForms = leadForms.filter(f => f.status === 'ACTIVE')
    checks.push({
      category: 'Formularios de Lead',
      name: 'Formularios Ativos',
      passed: activeForms.length >= 1,
      severity: 'warning',
      message: activeForms.length === 0
        ? 'Nenhum formulario de lead ativo — crie formularios para captar leads diretamente no Facebook'
        : activeForms.length === 1
          ? '1 formulario ativo — considere testar formularios diferentes (A/B test)'
          : `${activeForms.length} formularios ativos — otimo para testes A/B`,
      points: 7,
    })
  } else {
    checks.push({
      category: 'Formularios de Lead',
      name: 'Formularios de Lead Ads',
      passed: false,
      severity: 'critical',
      message: 'Nenhum formulario de Lead Ads encontrado — Lead Ads captam contatos direto no Facebook sem precisar de site',
      points: 10,
    })
  }

  return checks
}

// --- Main Export ---

export async function runFacebookAdsAudit(adAccountId: string): Promise<AdsAuditResult> {
  if (!ACCESS_TOKEN) {
    return {
      accountName: '',
      accountId: adAccountId,
      currency: 'BRL',
      insights: null,
      campaigns: [],
      leadForms: [],
      checks: [],
      score: 0,
      error: 'Token de acesso Meta nao configurado',
    }
  }

  // Normalize ad account ID (add act_ prefix if missing)
  const normalizedId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`

  try {
    // Fetch all data in parallel
    const [accountData, campaigns, leadForms] = await Promise.all([
      fetchAccountInsights(normalizedId),
      fetchCampaignInsights(normalizedId),
      fetchLeadForms(normalizedId),
    ])

    const checks = runAdsChecks(accountData.insights, campaigns, leadForms)

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0)
    const earnedPoints = checks.filter(c => c.passed).reduce((sum, c) => sum + c.points, 0)
    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0

    return {
      accountName: accountData.accountName,
      accountId: normalizedId,
      currency: accountData.currency,
      insights: accountData.insights,
      campaigns,
      leadForms,
      checks,
      score,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return {
      accountName: '',
      accountId: normalizedId,
      currency: 'BRL',
      insights: null,
      campaigns: [],
      leadForms: [],
      checks: [],
      score: 0,
      error: `Erro ao acessar conta de anuncios: ${message}`,
    }
  }
}
