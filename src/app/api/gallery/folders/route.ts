import { NextRequest, NextResponse } from 'next/server'
import {
  getAllGalleryFolders,
  createGalleryFolder,
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

// GET /api/gallery/folders
// Public visitors see only public folders; authenticated admin sees all folders (public + private)
export async function GET(request: NextRequest) {
  try {
    await initializeDatabase()
    const auth = checkAuth(request)
    const { searchParams } = new URL(request.url)
    const publicOnlyParam = searchParams.get('publicOnly')

    const isPublicOnly = !auth || publicOnlyParam === 'true'
    const folders = await getAllGalleryFolders(isPublicOnly)

    return new NextResponse(JSON.stringify(folders), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error) {
    console.error('Error fetching gallery folders:', error)
    return NextResponse.json(
      { message: 'Error fetching folders' },
      { status: 500 }
    )
  }
}

// POST /api/gallery/folders (Admin only)
export async function POST(request: NextRequest) {
  const auth = checkAuth(request)
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initializeDatabase()
    const body = await request.json()
    const { name, isPrivate } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { message: 'Folder name is required' },
        { status: 400 }
      )
    }

    const newFolder = await createGalleryFolder(name, Boolean(isPrivate))
    return NextResponse.json(
      {
        message: 'Folder created successfully',
        folder: newFolder,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating gallery folder:', error)
    return NextResponse.json(
      { message: 'Error creating folder' },
      { status: 500 }
    )
  }
}

