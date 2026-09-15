import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'
import {
  getAdminByEmail,
  verifyAdminPassword,
  updateAdminPassword,
  initializeDatabase,
} from '@/lib/mockdb'

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded || !decoded.email) {
      return NextResponse.json({ message: 'Invalid or expired session' }, { status: 401 })
    }

    const body = await request.json()
    const currentPassword = body.currentPassword ? String(body.currentPassword) : ''
    const newPassword = body.newPassword ? String(body.newPassword) : ''

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { message: 'Current password and new password are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { message: 'New password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    await initializeDatabase()

    // Verify existing password
    const admin = await verifyAdminPassword(decoded.email, currentPassword)
    if (!admin) {
      return NextResponse.json(
        { message: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    // Update to new password
    const updated = await updateAdminPassword(admin.id, newPassword)
    if (!updated) {
      return NextResponse.json(
        { message: 'Failed to update password' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Password changed successfully',
    })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { message: 'An error occurred while changing password' },
      { status: 500 }
    )
  }
}

