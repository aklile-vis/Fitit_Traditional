import { NextRequest, NextResponse } from 'next/server'
import { aiSuggestLayerMapping } from '@/lib/ai'

export async function POST(request: NextRequest) {
  try {
    if (process.env.LLM_ENABLE !== 'true') return NextResponse.json({ error: 'LLM disabled' }, { status: 400 })
    const body = await request.json()
    const task = body.task as string
    if (task === 'layer-mapping') {
      const layers: string[] = Array.isArray(body.layers) ? body.layers : []
      const res = await aiSuggestLayerMapping(layers)
      return NextResponse.json({ suggestions: res })
    }
    return NextResponse.json({ error: 'Unknown task' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'AI request failed' }, { status: 500 })
  }
}

