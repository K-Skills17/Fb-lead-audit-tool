import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import Anthropic from '@anthropic-ai/sdk'

interface AuditCheck {
  category: string
  name: string
  passed: boolean
  severity: 'critical' | 'warning' | 'info'
  message: string
  points: number
}

interface SendRequest {
  name: string
  phone: string
  clinicName: string
  siteUrl: string
  score: number
  topIssues: string[]
  checks: AuditCheck[]
  reportUrl: string
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits
  }
  if (digits.length === 11) {
    return '55' + digits
  }
  if (digits.length === 10) {
    return '55' + digits
  }
  return digits
}

// --- Claude AI analysis ---

async function generateActionPlan(data: SendRequest): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY not configured — skipping AI analysis')
    return null
  }

  const failedChecks = data.checks
    .filter(c => !c.passed)
    .map(c => `- [${c.severity.toUpperCase()}] ${c.name}: ${c.message}`)
    .join('\n')

  const passedChecks = data.checks
    .filter(c => c.passed)
    .map(c => `- ${c.name}: ${c.message}`)
    .join('\n')

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Voce e um consultor de marketing digital especializado em clinicas e negocios locais no Brasil. Analise os resultados dessa auditoria de site e crie um plano de acao personalizado.

DADOS DO LEAD:
- Nome: ${data.name}
- Clinica: ${data.clinicName}
- Site: ${data.siteUrl}
- Nota: ${data.score}/100

PROBLEMAS ENCONTRADOS:
${failedChecks || 'Nenhum problema critico encontrado.'}

O QUE ESTA BOM:
${passedChecks || 'Nenhum item aprovado.'}

INSTRUCOES:
- Escreva em portugues brasileiro, tom profissional mas amigavel
- Maximo 3-4 acoes prioritarias, cada uma com 1-2 frases curtas
- Foque nas acoes que trariam mais pacientes/clientes
- Seja especifico para o contexto de clinica/negocio local
- NAO use markdown. Use formatacao WhatsApp: *negrito* para destaques
- Mantenha CURTO — maximo 400 caracteres no total do plano
- Retorne APENAS o plano de acao, sem introducao ou conclusao`
      }
    ]
  })

  const textBlock = response.content.find(b => b.type === 'text')
  return textBlock ? textBlock.text : null
}

// --- Message builder ---

function buildMessage(data: SendRequest, actionPlan: string | null): string {
  const lines: string[] = [
    `Ola ${data.name}! 👋`,
    ``,
    `Aqui esta a analise completa do site da *${data.clinicName}*:`,
    ``,
    `🏆 *Nota: ${data.score}/100*`,
  ]

  if (actionPlan) {
    lines.push(
      ``,
      `📋 *Seu plano de acao personalizado:*`,
      ``,
      actionPlan,
    )
  } else {
    // Fallback: show top issues if AI is not available
    const issuesList = data.topIssues
      .slice(0, 5)
      .map((issue, i) => `   ${i + 1}. ${issue}`)
      .join('\n')

    if (data.topIssues.length > 0) {
      lines.push(
        ``,
        `⚠️ *Principais pontos para melhorar:*`,
        issuesList,
      )
    }
  }

  lines.push(
    ``,
    `📊 *Relatorio completo:*`,
    data.reportUrl,
    ``,
    `---`,
    ``,
    `Quer corrigir esses pontos e atrair mais pacientes para a *${data.clinicName}*?`,
    ``,
    `Me conta: qual desses pontos voce sente que mais impacta o seu negocio hoje? 😊`,
  )

  return lines.join('\n')
}

// --- Google Sheets ---

async function appendToSheet(data: SendRequest) {
  const sheetId = process.env.GOOGLE_SHEET_ID
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!sheetId || !clientEmail || !privateKey) {
    console.warn('Google Sheets not configured — skipping lead storage')
    return
  }

  try {
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const issues = data.topIssues.join(', ')

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:G',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          now,
          data.name,
          data.phone,
          data.clinicName,
          data.siteUrl,
          data.score,
          issues,
        ]],
      },
    })
  } catch (err) {
    console.error('Google Sheets error:', err)
  }
}

// --- Main handler ---

export async function POST(request: NextRequest) {
  try {
    const body: SendRequest = await request.json()
    const { name, phone, clinicName } = body

    if (!name || !phone || !clinicName) {
      return NextResponse.json({ error: 'Nome, telefone e nome da clinica sao obrigatorios' }, { status: 400 })
    }

    const formattedPhone = formatPhone(phone)
    if (formattedPhone.length < 10) {
      return NextResponse.json({ error: 'Numero de telefone invalido' }, { status: 400 })
    }

    // Run AI analysis and sheet save in parallel
    const [actionPlan] = await Promise.all([
      generateActionPlan(body).catch(err => {
        console.error('Claude AI error:', err)
        return null
      }),
      appendToSheet(body),
    ])

    const message = buildMessage(body, actionPlan)

    // Send via LK Chatbot webhook (preferred — gives chatbot conversation context)
    // Falls back to direct Evolution API if chatbot webhook is not configured or fails
    let messageSent = false
    let whatsappError = ''

    const chatbotUrl = process.env.LK_CHATBOT_URL
    const chatbotApiKey = process.env.LK_CHATBOT_API_KEY
    const chatbotTenantId = process.env.LK_CHATBOT_TENANT_ID

    if (chatbotUrl && chatbotApiKey && chatbotTenantId) {
      try {
        const webhookUrl = `${chatbotUrl}/webhook/audit-lead`
        console.log('Chatbot webhook request:', { url: webhookUrl, phone: formattedPhone })

        const chatbotRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': chatbotApiKey,
          },
          body: JSON.stringify({
            phone: formattedPhone,
            name: body.name,
            reportMessage: message,
            tenantId: chatbotTenantId,
            auditData: {
              siteUrl: body.siteUrl,
              overallScore: body.score,
              keyFindings: body.topIssues.slice(0, 5),
              recommendations: body.checks
                .filter(c => !c.passed)
                .slice(0, 5)
                .map(c => c.message),
            },
          }),
        })

        const responseText = await chatbotRes.text()
        console.log('Chatbot webhook response:', chatbotRes.status, responseText)

        if (chatbotRes.ok) {
          messageSent = true
        } else {
          whatsappError = `Chatbot webhook ${chatbotRes.status}: ${responseText}`
          console.error('Chatbot webhook error:', whatsappError)
        }
      } catch (err) {
        whatsappError = `Chatbot webhook fetch error: ${err instanceof Error ? err.message : String(err)}`
        console.error('Chatbot webhook error:', err)
      }
    }

    // Fallback: send directly via Evolution API if chatbot webhook failed or not configured
    if (!messageSent) {
      const apiUrl = process.env.EVOLUTION_API_URL
      const instance = process.env.EVOLUTION_API_INSTANCE
      const apiKey = process.env.EVOLUTION_API_KEY

      if (apiUrl && instance && apiKey) {
        try {
          const evoUrl = `${apiUrl}/message/sendText/${instance}`
          console.log('Evolution API fallback request:', { url: evoUrl, phone: formattedPhone })

          const evolutionRes = await fetch(evoUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiKey,
            },
            body: JSON.stringify({
              number: formattedPhone,
              text: message,
            }),
          })

          const responseText = await evolutionRes.text()
          console.log('Evolution API response:', evolutionRes.status, responseText)

          if (evolutionRes.ok) {
            messageSent = true
            whatsappError = ''
          } else {
            whatsappError = `Evolution API ${evolutionRes.status}: ${responseText}`
            console.error('Evolution API error:', whatsappError)
          }
        } catch (err) {
          whatsappError = `Fetch error: ${err instanceof Error ? err.message : String(err)}`
          console.error('Evolution API fetch error:', err)
        }
      } else if (!whatsappError) {
        whatsappError = `No messaging service configured`
        console.error('Neither chatbot webhook nor Evolution API configured')
      }
    }

    return NextResponse.json({ success: true, messageSent, whatsappError: messageSent ? undefined : whatsappError })
  } catch (err) {
    console.error('Error in send-whatsapp:', err)
    return NextResponse.json({ success: true, messageSent: false })
  }
}
