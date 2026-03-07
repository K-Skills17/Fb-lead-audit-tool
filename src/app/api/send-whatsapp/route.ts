import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

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
    // Don't block the flow
  }
}

// --- Main handler ---

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

    // Save lead to Google Sheets (non-blocking)
    const sheetPromise = appendToSheet(body)

    // Send WhatsApp message via Evolution API
    let messageSent = false
    const apiUrl = process.env.EVOLUTION_API_URL
    const instance = process.env.EVOLUTION_API_INSTANCE
    const apiKey = process.env.EVOLUTION_API_KEY

    if (apiUrl && instance && apiKey) {
      try {
        const evolutionRes = await fetch(`${apiUrl}/message/sendText/${instance}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey,
          },
          body: JSON.stringify({
            number: formattedPhone,
            textMessage: {
              text: message,
            },
          }),
        })

        if (evolutionRes.ok) {
          messageSent = true
        } else {
          const errText = await evolutionRes.text()
          console.error('Evolution API error:', evolutionRes.status, errText)
        }
      } catch (err) {
        console.error('Evolution API fetch error:', err)
      }
    } else {
      console.error('Evolution API environment variables not configured')
    }

    // Wait for sheet write to finish
    await sheetPromise

    return NextResponse.json({ success: true, messageSent })
  } catch (err) {
    console.error('Error in send-whatsapp:', err)
    return NextResponse.json({ success: true, messageSent: false })
  }
}
