import { NextRequest, NextResponse } from 'next/server'

import { verifyToken } from './auth'

type Role = 'USER' | 'AGENT' | 'ADMIN'

export interface AuthenticatedUser {
  id: string
  email: string
  name: string | null
  role: Role
}

export interface AuthResult {
  ok: true
  user: AuthenticatedUser
  token: string
}

export interface AuthFailure {
  ok: false
  response: NextResponse
}

type GuardOptions = {
  roles?: Role[]
  allowAnonymous?: boolean
  allowQueryToken?: boolean
}

function normalizeRole(value: unknown): Role | null {
  if (!value) return null
  const upper = String(value).toUpperCase()
  if (upper === 'USER' || upper === 'AGENT' || upper === 'ADMIN') return upper
  return null
}

export function extractToken(request: NextRequest, allowQuery = false): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7).trim() || null
  }
  const cookieToken = request.cookies.get('mre_token')?.value
  if (cookieToken) {
    return cookieToken
  }
  if (allowQuery) {
    const tokenParam = new URL(request.url).searchParams.get('token')
    if (tokenParam) {
      return tokenParam
    }
  }
  return null
}

export function authenticateRequest(request: NextRequest, options?: GuardOptions): AuthResult | AuthFailure {
  const opts = options || {}
  const token = extractToken(request, opts.allowQueryToken)

  if (!token) {
    if (opts.allowAnonymous) {
      return { ok: false, response: NextResponse.next() }
    }
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    }
  }

  const decoded = verifyToken(token)
  if (!decoded) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid token' }, { status: 401 }),
    }
  }

  const role = normalizeRole(decoded.role)
  if (!role) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid role' }, { status: 403 }),
    }
  }

  if (opts.roles && !opts.roles.includes(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return {
    ok: true,
    user: {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name ?? null,
      role,
    },
    token,
  }
}

export function requireAgent(request: NextRequest, options?: Omit<GuardOptions, 'roles'>): AuthResult | AuthFailure {
  return authenticateRequest(request, { ...options, roles: ['AGENT', 'ADMIN'] })
}

export function requireUser(request: NextRequest, options?: GuardOptions): AuthResult | AuthFailure {
  return authenticateRequest(request, options)
}

export function getOptionalUser(request: NextRequest, allowQuery = true): AuthenticatedUser | null {
  const token = extractToken(request, allowQuery)
  if (!token) return null
  const decoded = verifyToken(token)
  const role = normalizeRole(decoded?.role)
  if (!decoded || !role) return null
  return {
    id: decoded.id,
    email: decoded.email,
    name: decoded.name ?? null,
    role,
  }
}
