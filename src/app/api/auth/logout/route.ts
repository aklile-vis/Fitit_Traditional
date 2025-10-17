import { NextRequest, NextResponse } from 'next/server'

function clearAuthCookie(response: NextResponse) {
  response.cookies.set({
    name: 'mre_token',
    value: '',
    maxAge: 0,
    path: '/',
  })
}

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ success: true })
  clearAuthCookie(response)
  return response
}

export async function GET(request: NextRequest) {
  return POST(request)
}
