import { NextRequest, NextResponse } from 'next/server'

import { createUser, findUserByEmail } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role, inviteCode, phone, agencyName } = await request.json()

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

    // Validate agent-specific required fields
    if (finalRole === 'AGENT') {
      if (!phone || typeof phone !== 'string' || !phone.trim()) {
        return NextResponse.json(
          { error: 'Phone number is required for agents' },
          { status: 400 }
        )
      }
      if (!agencyName || typeof agencyName !== 'string' || !agencyName.trim()) {
        return NextResponse.json(
          { error: 'Agency name is required for agents' },
          { status: 400 }
        )
      }
    }

    const user = await createUser(email, password, name, finalRole, phone?.trim(), agencyName?.trim())
    
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
