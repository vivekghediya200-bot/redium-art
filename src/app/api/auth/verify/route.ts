import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = getTokenFromHeader(authHeader)

    if (!token) {
      return NextResponse.json(
        { valid: false, message: 'No authorization token provided' },
        { status: 401 }
      )
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json(
        { valid: false, message: 'Token is invalid or expired' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      valid: true,
      admin: {
        id: decoded.id,
        email: decoded.email,
      },
    })
  } catch (error) {
    console.error('Token verification error:', error)
    return NextResponse.json(
      { valid: false, message: 'Verification failed' },
      { status: 500 }
    )
  }
}
