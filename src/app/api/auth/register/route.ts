import { NextRequest, NextResponse } from 'next/server'

import { createUser, findUserByEmail } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role, inviteCode } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    let finalRole: 'USER' | 'AGENT' | 'ADMIN' = 'USER'
    const requestedRole = typeof role === 'string' ? role.toUpperCase() : 'USER'
    if (requestedRole === 'AGENT' || requestedRole === 'ADMIN') {
      const envKey = requestedRole === 'AGENT' ? process.env.AGENT_INVITE_CODE : process.env.ADMIN_INVITE_CODE
      if (!envKey || inviteCode !== envKey) {
        return NextResponse.json(
          { error: `${requestedRole} invite code required` },
          { status: 403 }
        )
      }
      finalRole = requestedRole
    }

    const user = await createUser(email, password, name, finalRole)
    
    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
