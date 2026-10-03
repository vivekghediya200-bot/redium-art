import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromHeader, signToken } from '@/lib/auth'
import {
  verifyAdminPassword,
  updateAdminPassword,
  getAdminByEmail,
  createAdmin,
} from '@/lib/mockdb'

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request.headers.get('authorization'))

    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)

    if (!decoded || !decoded.email) {
      return NextResponse.json(
        { message: 'Invalid or expired session' },
        { status: 401 }
      )
    }

    const admin = await getAdminByEmail(decoded.email)

    if (!admin) {
      return NextResponse.json(
        { message: 'Admin account not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      email: admin.email,
      updatedAt: admin.updatedAt,
      isCloudSynced: true,
      activeDevicesSupported: true,
    })
  } catch (error) {
    console.error('Get admin profile error:', error)

    return NextResponse.json(
      { message: 'Error fetching admin profile' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request.headers.get('authorization'))

    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)

    if (!decoded || !decoded.email || !decoded.id) {
      return NextResponse.json(
        { message: 'Invalid or expired session' },
        { status: 401 }
      )
    }

    const body = await request.json()

    const currentPassword = body.currentPassword
      ? String(body.currentPassword)
      : ''

    const newEmail = body.newEmail
      ? String(body.newEmail).trim().toLowerCase()
      : ''

    const newPassword = body.newPassword
      ? String(body.newPassword)
      : ''

    if (!currentPassword) {
      return NextResponse.json(
        { message: 'Current password is required to save changes' },
        { status: 400 }
      )
    }

    if (!newEmail && !newPassword) {
      return NextResponse.json(
        {
          message:
            'Please provide either a new email ID or a new password to update',
        },
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

    const admin = await verifyAdminPassword(
      decoded.email,
      currentPassword
    )

    if (!admin) {
      return NextResponse.json(
        { message: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    let updatedAdmin = admin

    // Update email if requested
    if (newEmail && newEmail !== admin.email.toLowerCase()) {
      const existingAdmin = await getAdminByEmail(newEmail)

      if (existingAdmin && existingAdmin.id !== admin.id) {
        return NextResponse.json(
          { message: 'This email address is already in use' },
          { status: 400 }
        )
      }

      // Update email in mockdb
      const { getAllAdmins, saveCloudAdminCredentials } = await import('@/lib/mockdb')
      const admins = await getAllAdmins()
      const adminIndex = admins.findIndex((a: any) => a.id === admin.id)
      if (adminIndex !== -1) {
        admins[adminIndex].email = newEmail
        admins[adminIndex].updatedAt = new Date().toISOString()
        updatedAdmin = admins[adminIndex]
        // Save to file and cloud
        const fs = await import('fs')
        const path = await import('path')
        const DATA_DIR = path.join(process.cwd(), 'data')
        const ADMINS_FILE = path.join(DATA_DIR, 'admins.json')
        fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2), 'utf-8')
        await saveCloudAdminCredentials(admins)
      }
    }

    // Update password if requested
    if (newPassword) {
      const success = await updateAdminPassword(
        updatedAdmin.id,
        newPassword
      )
      if (!success) {
        return NextResponse.json(
          { message: 'Failed to update password' },
          { status: 500 }
        )
      }
      // Refresh admin data
      const refreshedAdmin = await getAdminByEmail(newEmail || admin.email)
      if (refreshedAdmin) {
        updatedAdmin = refreshedAdmin
      }
    }

    const newToken = signToken({
      email: updatedAdmin.email,
      id: updatedAdmin.id,
    })

    return NextResponse.json({
      message: 'Admin credentials updated successfully!',
      token: newToken,
      email: updatedAdmin.email,
      updatedAt: updatedAdmin.updatedAt,
      syncedToCloud: true,
    })
  } catch (error: any) {
    console.error('Change credentials error:', error)

    return NextResponse.json(
      {
        message:
          error?.message ||
          'An error occurred while updating credentials',
      },
      { status: 500 }
    )
  }
}