import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromHeader, signToken } from '@/lib/auth'
import {
  verifyAdminPassword,
  updateAdminCredentials,
  getAdminSyncStatus,
  initializeDatabase,
} from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded || !decoded.email) {
      return NextResponse.json({ message: 'Invalid or expired session' }, { status: 401 })
    }

    await initializeDatabase()
    const syncStatus = await getAdminSyncStatus()

    return NextResponse.json({
      email: syncStatus.email || decoded.email,
      updatedAt: syncStatus.updatedAt,
      isCloudSynced: syncStatus.isCloudSynced,
      activeDevicesSupported: syncStatus.activeDevicesSupported,
    })
  } catch (error) {
    return NextResponse.json({ message: 'Error fetching admin profile' }, { status: 500 })
  }
}

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
    const newEmail = body.newEmail ? String(body.newEmail).trim().toLowerCase() : ''
    const newPassword = body.newPassword ? String(body.newPassword) : ''

    if (!currentPassword) {
      return NextResponse.json(
        { message: 'Current password is required to save changes' },
        { status: 400 }
      )
    }

    if (!newEmail && !newPassword) {
      return NextResponse.json(
        { message: 'Please provide either a new email ID or a new password to update' },
        { status: 400 }
      )
    }

    if (newEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(newEmail)) {
        return NextResponse.json(
          { message: 'Please enter a valid email address' },
          { status: 400 }
        )
      }
    }

    if (newPassword && newPassword.length < 6) {
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

    // Update credentials
    const updates: { newEmail?: string; newPassword?: string } = {}
    if (newEmail && newEmail !== decoded.email.toLowerCase()) {
      updates.newEmail = newEmail
    }
    if (newPassword) {
      updates.newPassword = newPassword
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { message: 'No changes detected. The new email matches your current email.' },
        { status: 400 }
      )
    }

    const result = await updateAdminCredentials(admin.id, updates)
    if (!result.success || !result.admin) {
      return NextResponse.json(
        { message: result.message || 'Failed to update credentials' },
        { status: 400 }
      )
    }

    // Generate new token with updated email
    const updatedEmail = result.admin.email
    const newToken = signToken({ email: updatedEmail, id: result.admin.id })

    return NextResponse.json({
      message: 'Admin credentials updated and live-synced across Laptop & Mobile!',
      token: newToken,
      email: updatedEmail,
      updatedAt: result.admin.updatedAt,
      syncedToCloud: result.syncedToCloud,
    })
  } catch (error) {
    console.error('Change credentials error:', error)
    return NextResponse.json(
      { message: 'An error occurred while updating credentials' },
      { status: 500 }
    )
  }
}
