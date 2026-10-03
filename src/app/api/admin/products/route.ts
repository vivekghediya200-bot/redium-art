import { NextRequest, NextResponse } from 'next/server'
import {
  getAllProducts,
  addProduct,
  initializeDatabase,
} from '@/lib/mongodb'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Middleware to check authentication
function checkAuth(request: NextRequest) {
  const token = getTokenFromHeader(request.headers.get('authorization'))
  if (!token || !verifyToken(token)) {
    return null
  }
  return verifyToken(token)
}

export async function GET(request: NextRequest) {
  const auth = checkAuth(request)
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initializeDatabase()
    const products = getAllProducts()
    return NextResponse.json(products)
  } catch (error) {
    return NextResponse.json(
      { message: 'Error fetching products' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = checkAuth(request)
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initializeDatabase()
    const formData = await request.formData()
    const name = formData.get('name') as string
    const price = parseFloat(formData.get('price') as string)
    const quantity = parseInt(formData.get('quantity') as string)
    const imageFile = formData.get('image') as File | null

    // Validation
    if (!name || !price || isNaN(quantity)) {
      return NextResponse.json(
        { message: 'Invalid product data' },
        { status: 400 }
      )
    }

    // Handle image upload - convert to base64 for demo
    let image = `https://via.placeholder.com/400x400?text=${encodeURIComponent(name)}`

    if (imageFile) {
      try {
        const buffer = await imageFile.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        image = `data:${imageFile.type};base64,${base64}`
      } catch (err) {
        console.log('Image processing skipped, using placeholder')
      }
    }

    const product = addProduct({
      name: name.trim(),
      image,
      price,
      quantity,
    })

    return NextResponse.json(
      { message: 'Product added successfully', product },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error adding product:', error)
    return NextResponse.json(
      { message: 'Error adding product' },
      { status: 500 }
    )
  }
}
