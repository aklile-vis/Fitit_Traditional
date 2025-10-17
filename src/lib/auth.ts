import bcrypt from 'bcryptjs'
import jwt, { type JwtPayload } from 'jsonwebtoken'

import { prisma } from './database'

const rawSecret = process.env.JWT_SECRET
const insecureSecrets = new Set([
  'your-secret-key-change-in-production',
  'change-me',
  'change-me-in-production',
])

if (!rawSecret) {
  throw new Error('[auth] JWT_SECRET env variable is required. Set JWT_SECRET in your environment configuration.')
}

if (insecureSecrets.has(rawSecret)) {
  throw new Error('[auth] JWT_SECRET uses an insecure placeholder. Provide a strong unique secret before starting the app.')
}

const JWT_SECRET = rawSecret

export interface User {
  id: string
  email: string
  name: string | null
  role: 'USER' | 'AGENT' | 'ADMIN'
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function generateToken(user: User): string {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

export function verifyToken(token: string): User | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    if (!decoded || typeof decoded !== 'object') return null

    const payload = decoded as JwtPayload & Partial<User>
    if (typeof payload.id !== 'string' || typeof payload.email !== 'string') {
      return null
    }
    const role = payload.role ?? 'USER'
    if (role !== 'USER' && role !== 'AGENT' && role !== 'ADMIN') {
      return null
    }

    return {
      id: payload.id,
      email: payload.email,
      name: typeof payload.name === 'string' ? payload.name : null,
      role,
    }
  } catch {
    return null
  }
}

export async function createUser(email: string, password: string, name?: string, role: 'USER' | 'AGENT' | 'ADMIN' = 'USER') {
  const hashedPassword = await hashPassword(password)
  
  return prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role
    }
  })
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email }
  })
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id }
  })
}
