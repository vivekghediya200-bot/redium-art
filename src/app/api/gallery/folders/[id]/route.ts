import { NextRequest, NextResponse } from 'next/server'
import {
  updateGalleryFolder,
  deleteGalleryFolder,
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

// PUT /api/gallery/folders/[id] (Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = checkAuth(request)
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initializeDatabase()
    const folderId = decodeURIComponent(params.id || '').trim()
    const body = await request.json()
    const { name, isPrivate } = body

    const updated = updateGalleryFolder(folderId, {
      name: typeof name === 'string' ? name : undefined,
      isPrivate: typeof isPrivate === 'boolean' ? isPrivate : undefined,
    })

    if (!updated) {
      return NextResponse.json(
        { message: 'Folder not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: 'Folder updated successfully',
      folder: updated,
    })
  } catch (error) {
    console.error('Error updating folder:', error)
    return NextResponse.json(
      { message: 'Error updating folder' },
      { status: 500 }
    )
  }
}

// DELETE /api/gallery/folders/[id] (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = checkAuth(request)
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initializeDatabase()
    const folderId = decodeURIComponent(params.id || '').trim()
    const { searchParams } = new URL(request.url)
    const deletePhotos = searchParams.get('deletePhotos') === 'true'

    const success = deleteGalleryFolder(folderId, deletePhotos)
    if (!success) {
      return NextResponse.json(
        { message: 'Folder not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: 'Folder deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting folder:', error)
    return NextResponse.json(
      { message: 'Error deleting folder' },
      { status: 500 }
    )
  }
}

