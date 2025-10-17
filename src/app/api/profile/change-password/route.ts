import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { verifyPassword, hashPassword, verifyToken } from '@/lib/auth'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('mre_token')?.value
  if (!token) return unauthorized()
  const auth = verifyToken(token)
  if (!auth) return unauthorized()

  const { currentPassword, newPassword } = await request.json().catch(() => ({}))
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return NextResponse.json({ error: 'New password too short' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: auth.id } })
  if (!user) return unauthorized()

  const ok = await verifyPassword(currentPassword, user.password)
  if (!ok) {
    return NextResponse.json({ error: 'Invalid current password' }, { status: 401 })
  }

  const hashed = await hashPassword(newPassword)
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })
  return NextResponse.json({ success: true })
}

