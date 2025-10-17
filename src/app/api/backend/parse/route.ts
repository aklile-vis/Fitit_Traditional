import { NextRequest, NextResponse } from 'next/server'

import { requireAgent } from '@/lib/serverAuth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const payload = {
      ...body,
      userId: body?.userId || auth.user.id,
    }

    const res = await fetch(`${BACKEND}/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const text = await res.text()
    const isJson = res.headers.get('content-type')?.includes('application/json')
    const responsePayload = isJson ? JSON.parse(text) : { raw: text }
    return NextResponse.json(responsePayload, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Proxy parse failed' }, { status: 500 })
  }
}
