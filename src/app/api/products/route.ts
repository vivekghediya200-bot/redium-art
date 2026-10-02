import { NextRequest, NextResponse } from 'next/server'
import { getAllProducts, initializeDatabase } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase()
    const products = getAllProducts()
    return NextResponse.json(products)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { message: 'Error fetching products' },
      { status: 500 }
    )
  }
}
