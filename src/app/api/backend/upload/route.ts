import { NextRequest, NextResponse } from 'next/server'

import { requireAgent } from '@/lib/serverAuth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const url = new URL(request.url)
    const userId = url.searchParams.get('user_id') || auth.user.id
    const form = await request.formData()

    const res = await fetch(`${BACKEND}/upload?user_id=${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: form,
    })

    const text = await res.text()
    const isJson = res.headers.get('content-type')?.includes('application/json')
    const payload = isJson ? JSON.parse(text) : { raw: text }
    return NextResponse.json(payload, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Proxy upload failed' }, { status: 500 })
  }
}
