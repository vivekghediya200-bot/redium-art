import { NextRequest, NextResponse } from 'next/server'
import {
  moveGalleryImagesToFolder,
  initializeDatabase,
} from '@/lib/mockdb'
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

// POST /api/gallery/move (Admin only)
export async function POST(request: NextRequest) {
  const auth = checkAuth(request)
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initializeDatabase()
    const body = await request.json()
    const { imageIds, targetFolderId } = body

    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      return NextResponse.json(
        { message: 'No images specified to move' },
        { status: 400 }
      )
    }

    const updatedCount = moveGalleryImagesToFolder(imageIds, targetFolderId)
    return NextResponse.json({
      message: `Moved ${updatedCount} image(s) successfully`,
      count: updatedCount,
    })
  } catch (error) {
    console.error('Error moving images to folder:', error)
    return NextResponse.json(
      { message: 'Error moving images' },
      { status: 500 }
    )
  }
}

