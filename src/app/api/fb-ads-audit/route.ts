import { NextRequest, NextResponse } from 'next/server'
import { runFacebookAdsAudit } from '@/lib/meta-marketing'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adAccountId } = body

    if (!adAccountId || typeof adAccountId !== 'string') {
      return NextResponse.json({ error: 'ID da conta de anuncios e obrigatorio' }, { status: 400 })
    }

    const result = await runFacebookAdsAudit(adAccountId.trim())

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 422 })
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('Erro na auditoria de ads:', err)
    return NextResponse.json({ error: 'Erro inesperado ao analisar conta de anuncios' }, { status: 500 })
  }
}
