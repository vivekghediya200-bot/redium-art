import { NextRequest, NextResponse } from 'next/server'
import {
  deleteProduct,
  updateProduct,
  initializeDatabase,
} from '@/lib/mongodb'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'

function checkAuth(request: NextRequest) {
  const token = getTokenFromHeader(request.headers.get('authorization'))
  if (!token || !verifyToken(token)) {
    return null
  }
  return verifyToken(token)
}

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
    const success = deleteProduct(params.id)

    if (!success) {
      return NextResponse.json(
        { message: 'Product not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Product deleted successfully' })
  } catch (error) {
    return NextResponse.json(
      { message: 'Error deleting product' },
      { status: 500 }
    )
  }
}

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
    const body = await request.json()

    const product = updateProduct(params.id, body)

    if (!product) {
      return NextResponse.json(
        { message: 'Product not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: 'Product updated successfully',
      product,
    })
  } catch (error) {
    return NextResponse.json(
      { message: 'Error updating product' },
      { status: 500 }
    )
  }
}
