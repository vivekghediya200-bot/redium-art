import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminPassword, initializeDatabase } from '@/lib/mockdb'
import { signToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = body.email ? String(body.email).trim() : ''
    const password = body.password ? String(body.password) : ''

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Initialize database
    await initializeDatabase()

    // Verify admin credentials
    const admin = await verifyAdminPassword(email, password)

    if (!admin) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Generate token
    const token = signToken({ id: admin.id, email: admin.email })

    return NextResponse.json({
      message: 'Login successful',
      token,
      admin: { id: admin.id, email: admin.email },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { message: 'An error occurred during login' },
      { status: 500 }
    )
  }
}
