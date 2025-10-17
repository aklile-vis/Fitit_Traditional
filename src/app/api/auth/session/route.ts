import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { verifyToken } from '@/lib/auth'

function clearCookie(response: NextResponse) {
  response.cookies.set({
    name: 'mre_token',
    value: '',
    maxAge: 0,
    path: '/',
  })
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get('mre_token')?.value
  if (!token) {
    return NextResponse.json({ authenticated: false })
  }

  const decoded = verifyToken(token)
  if (!decoded) {
    const response = NextResponse.json({ authenticated: false })
    clearCookie(response)
    return response
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    include: { profile: { select: { avatarUrl: true } } },
  })

  if (!user) {
    const response = NextResponse.json({ authenticated: false })
    clearCookie(response)
    return response
  }

  return NextResponse.json({
    authenticated: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.profile?.avatarUrl ?? null,
    },
  })
}
