import { NextRequest, NextResponse } from 'next/server'
import { deleteGalleryImage, initializeDatabase } from '@/lib/mockdb'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'

function checkAuth(request: NextRequest) {
  const token = getTokenFromHeader(request.headers.get('authorization'))
  if (!token || !verifyToken(token)) {
    return null
  }
  return verifyToken(token)
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
    const success = deleteGalleryImage(params.id)

    if (!success) {
      return NextResponse.json(
        { message: 'Image not found in gallery' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Image deleted successfully' })
  } catch (error) {
    console.error('Error deleting gallery image:', error)
    return NextResponse.json(
      { message: 'Error deleting image' },
      { status: 500 }
    )
  }
}

