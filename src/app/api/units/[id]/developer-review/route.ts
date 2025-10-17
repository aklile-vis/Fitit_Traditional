import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { requireAgent } from '@/lib/serverAuth'

function cleanString(value: unknown) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAgent(request)
  if (!auth.ok) return auth.response

  const unit = await prisma.propertyUnit.findUnique({ where: { id: params.id } })
  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })

  const state = (unit.editorState as Record<string, unknown> | null)?.developerReview ?? null
  return NextResponse.json(state ?? { approved: false })
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAgent(request)
  if (!auth.ok) return auth.response

  const unit = await prisma.propertyUnit.findUnique({ where: { id: params.id } })
  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })

  const body = await request.json().catch(() => ({})) as {
    approved?: boolean
    reviewer?: string
    notes?: string
  }

  const approved = Boolean(body?.approved)
  const reviewer = cleanString(body?.reviewer)
  const notes = cleanString(body?.notes)

  const existing = (unit.editorState as Record<string, unknown> | null) ?? {}
  const prevReview = (existing.developerReview as Record<string, unknown> | null) ?? {}

  const now = new Date().toISOString()
  const reviewState = {
    approved,
    reviewer: reviewer ?? (typeof prevReview.reviewer === 'string' ? prevReview.reviewer : undefined) ?? null,
    notes: notes ?? (typeof prevReview.notes === 'string' ? prevReview.notes : undefined) ?? null,
    updatedAt: now,
    approvedAt: approved
      ? (typeof prevReview.approvedAt === 'string' && prevReview.approved === true ? prevReview.approvedAt : now)
      : null,
  }

  const nextEditorState = {
    ...existing,
    developerReview: reviewState,
  }

  await prisma.propertyUnit.update({
    where: { id: params.id },
    data: { editorState: nextEditorState },
  })

  return NextResponse.json(reviewState)
}
