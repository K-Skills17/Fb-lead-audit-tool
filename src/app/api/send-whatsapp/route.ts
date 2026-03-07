import { NextRequest, NextResponse } from 'next/server'

interface SendRequest {
  name: string
  phone: string
  clinicName: string
  siteUrl: string
  score: number
  topIssues: string[]
  reportUrl: string
}

function formatPhone(phone: string): string {
  // Remove everything except digits
  const digits = phone.replace(/\D/g, '')
  // If it starts with 55, keep it. Otherwise prepend 55 (Brazil)
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits
  }
  // If 11 digits (DDD + 9-digit mobile), prepend 55
  if (digits.length === 11) {
    return '55' + digits
  }
  // If 10 digits (DDD + 8-digit landline), prepend 55
  if (digits.length === 10) {
    return '55' + digits
  }
  return digits
}

function buildMessage(data: SendRequest): string {
  const issuesList = data.topIssues
    .slice(0, 5)
    .map((issue, i) => `   ${i + 1}. ${issue}`)
    .join('\n')

  return [
    `Ola ${data.name}! 👋`,
    ``,
    `Obrigado por usar nosso audit de sites. Aqui esta o resultado da analise do site da *${data.clinicName}*:`,
    ``,
    `🏆 *Nota: ${data.score}/100*`,
    ``,
    data.topIssues.length > 0 ? `⚠️ *Principais pontos para melhorar:*` : '',
    data.topIssues.length > 0 ? issuesList : '',
    data.topIssues.length > 0 ? `` : '',
    `📊 *Relatorio completo:*`,
    data.reportUrl,
    ``,
    `Se quiser, podemos te ajudar a corrigir tudo isso e atrair mais pacientes para a ${data.clinicName}. E so responder essa mensagem! 😊`,
  ].filter(line => line !== undefined).join('\n')
}

export async function POST(request: NextRequest) {
  try {
    const body: SendRequest = await request.json()
    const { name, phone, clinicName, siteUrl, score, topIssues, reportUrl } = body

    if (!name || !phone || !clinicName) {
      return NextResponse.json({ error: 'Nome, telefone e nome da clinica sao obrigatorios' }, { status: 400 })
    }

    const formattedPhone = formatPhone(phone)
    if (formattedPhone.length < 10) {
      return NextResponse.json({ error: 'Numero de telefone invalido' }, { status: 400 })
    }

    const message = buildMessage({ name, phone, clinicName, siteUrl, score, topIssues, reportUrl })

    const apiUrl = process.env.EVOLUTION_API_URL
    const instance = process.env.EVOLUTION_API_INSTANCE
    const apiKey = process.env.EVOLUTION_API_KEY

    if (!apiUrl || !instance || !apiKey) {
      console.error('Evolution API environment variables not configured')
      return NextResponse.json({ error: 'Servico de mensagens nao configurado' }, { status: 500 })
    }

    const evolutionRes = await fetch(`${apiUrl}/message/sendText/${instance}`, {
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

    if (!evolutionRes.ok) {
      const errText = await evolutionRes.text()
      console.error('Evolution API error:', evolutionRes.status, errText)
      // Don't block the user from seeing their report even if message fails
      return NextResponse.json({ success: true, messageSent: false, warning: 'Relatorio pronto, mas nao conseguimos enviar a mensagem' })
    }

    return NextResponse.json({ success: true, messageSent: true })
  } catch (err) {
    console.error('Error sending WhatsApp:', err)
    return NextResponse.json({ success: true, messageSent: false, warning: 'Erro ao enviar mensagem' })
  }
}
