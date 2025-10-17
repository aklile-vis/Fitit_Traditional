import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { requireAgent } from '@/lib/serverAuth'

export async function GET(request: NextRequest) {
  const auth = requireAgent(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)

  const logs = await prisma.exportLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: { select: { id: true, email: true, name: true } },
      unit: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ logs })
}
