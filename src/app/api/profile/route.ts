import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

import { prisma } from '@/lib/database'
import { verifyToken } from '@/lib/auth'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('mre_token')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (!auth) return unauthorized()

  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    include: { profile: true },
  })
  if (!user) return unauthorized()

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    profile: {
      phone: user.profile?.phone ?? null,
      jobTitle: user.profile?.jobTitle ?? null,
      agencyName: user.profile?.agencyName ?? null,
      avatarUrl: user.profile?.avatarUrl ?? null,
    },
  })
}

type PatchBody = {
  name?: string
  phone?: string
  jobTitle?: string
  agencyName?: string
  avatarDataUrl?: string | null
  removeAvatar?: boolean
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (!auth) return unauthorized()

  const body = (await request.json().catch(() => ({}))) as PatchBody
  const updatesUser: Record<string, unknown> = {}
  const updatesProfile: Record<string, unknown> = {}

  if (typeof body.name === 'string') {
    updatesUser.name = body.name.trim() || null
  }
  if (typeof body.phone === 'string') updatesProfile.phone = body.phone.trim()
  if (typeof body.jobTitle === 'string') updatesProfile.jobTitle = body.jobTitle.trim()
  if (typeof body.agencyName === 'string') updatesProfile.agencyName = body.agencyName.trim()

  // Handle avatar data URL upload
  if (body.removeAvatar) {
    updatesProfile.avatarUrl = null
  } else if (body.avatarDataUrl && body.avatarDataUrl.startsWith('data:image/')) {
    try {
      const [meta, data] = body.avatarDataUrl.split(',')
      const mime = meta.substring(5, meta.indexOf(';')) // image/png
      const ext = mime.split('/')[1] || 'png'
      const buffer = Buffer.from(data, 'base64')
      if (buffer.length > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Avatar too large (max 5MB)' }, { status: 400 })
      }
      const dir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
      fs.mkdirSync(dir, { recursive: true })
      const filename = `${auth.id}_${Date.now()}.${ext}`
      const outPath = path.join(dir, filename)
      fs.writeFileSync(outPath, buffer)
      updatesProfile.avatarUrl = `/uploads/avatars/${filename}`
    } catch (e) {
      return NextResponse.json({ error: 'Failed to process avatar' }, { status: 400 })
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    if (Object.keys(updatesUser).length > 0) {
      await tx.user.update({ where: { id: auth.id }, data: updatesUser })
    }
    const existing = await tx.userProfile.findUnique({ where: { userId: auth.id } })
    if (existing) {
      if (Object.keys(updatesProfile).length > 0) {
        await tx.userProfile.update({ where: { userId: auth.id }, data: updatesProfile })
      }
    } else {
      await tx.userProfile.create({
        data: { userId: auth.id, ...updatesProfile },
      })
    }

    const updated = await tx.user.findUnique({ where: { id: auth.id }, include: { profile: true } })
    return updated
  })

  if (!result) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({
    id: result.id,
    email: result.email,
    name: result.name,
    role: result.role,
    profile: {
      phone: result.profile?.phone ?? null,
      jobTitle: result.profile?.jobTitle ?? null,
      agencyName: result.profile?.agencyName ?? null,
      avatarUrl: result.profile?.avatarUrl ?? null,
    },
  })
}

