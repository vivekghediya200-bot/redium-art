import { NextRequest, NextResponse } from 'next/server'
import {
  getDeletedPhotosStats,
  initializeDatabase,
} from '@/lib/mongodb'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function checkAuth(request: NextRequest) {
  const token = getTokenFromHeader(request.headers.get('authorization'))
  if (!token || !verifyToken(token)) {
    return null
  }
  return verifyToken(token)
}

// GET /api/gallery/deleted (Admin only) - Live tracking of deleted photos
export async function GET(request: NextRequest) {
  const auth = checkAuth(request)
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initializeDatabase()
    const stats = await getDeletedPhotosStats()
    return new NextResponse(JSON.stringify(stats), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error) {
    console.error('Error fetching deleted photos stats:', error)
    return NextResponse.json(
      { message: 'Error fetching deleted photos tracker' },
      { status: 500 }
    )
  }
}

