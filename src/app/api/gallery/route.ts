import { NextRequest, NextResponse } from 'next/server'
import {
  getAllGalleryImages,
  addGalleryImages,
  initializeDatabase,
} from '@/lib/mockdb'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'

function checkAuth(request: NextRequest) {
  const token = getTokenFromHeader(request.headers.get('authorization'))
  if (!token || !verifyToken(token)) {
    return null
  }
  return verifyToken(token)
}

// Public GET for gallery items with pagination and CDN edge caching
export async function GET(request: NextRequest) {
  try {
    await initializeDatabase()
    const images = getAllGalleryImages()

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const pageParam = searchParams.get('page')

    let result = images
    if (limitParam) {
      const limit = parseInt(limitParam, 10)
      const page = pageParam ? parseInt(pageParam, 10) : 1
      const start = (page - 1) * limit
      result = images.slice(start, start + limit)
    }

    return new NextResponse(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Error fetching gallery images:', error)
    return NextResponse.json(
      { message: 'Error fetching gallery images' },
      { status: 500 }
    )
  }
}

// Protected POST for admin multiple image upload
export async function POST(request: NextRequest) {
  const auth = checkAuth(request)
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initializeDatabase()

    const formData = await request.formData()
    // Support multiple files with field name 'images' or 'image'
    const files = formData.getAll('images') as File[]
    const fallbackFiles = formData.getAll('image') as File[]
    const allFiles = files.length > 0 ? files : fallbackFiles

    if (!allFiles || allFiles.length === 0) {
      return NextResponse.json(
        { message: 'No images provided for upload' },
        { status: 400 }
      )
    }

    const base64Images: string[] = []

    for (const file of allFiles) {
      if (file && typeof file.arrayBuffer === 'function') {
        const buffer = await file.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const dataUri = `data:${file.type || 'image/jpeg'};base64,${base64}`
        base64Images.push(dataUri)
      }
    }

    if (base64Images.length === 0) {
      return NextResponse.json(
        { message: 'Invalid image files' },
        { status: 400 }
      )
    }

    const addedItems = addGalleryImages(base64Images)

    return NextResponse.json(
      {
        message: `${addedItems.length} image(s) uploaded successfully`,
        items: addedItems,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error uploading gallery images:', error)
    return NextResponse.json(
      { message: 'Error uploading gallery images' },
      { status: 500 }
    )
  }
}

