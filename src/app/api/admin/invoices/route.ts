import { NextRequest, NextResponse } from 'next/server'
import {
  getAllInvoices,
  getInvoicesByCustomerId,
  createInvoice,
  initializeDatabase,
} from '@/lib/mongodb'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'

export const dynamic = 'force-dynamic'

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
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    let invoices = customerId
      ? await getInvoicesByCustomerId(customerId)
      : await getAllInvoices()

    // Sort by date descending
    invoices.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    return NextResponse.json(invoices)
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { message: 'Error fetching invoices' },
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
    const body = await request.json()
    const { customerName, customerMobile, viaCustomer, date, items, notes, paymentStatus, paymentMethod } = body

    if (!customerName || !customerName.trim()) {
      return NextResponse.json(
        { message: 'Customer name is required' },
        { status: 400 }
      )
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { message: 'At least one item is required on the invoice' },
        { status: 400 }
      )
    }

    const invoice = await createInvoice({
      customerName,
      customerMobile: customerMobile || '',
      viaCustomer: viaCustomer || '',
      date,
      items,
      notes,
      paymentStatus,
      paymentMethod,
    })

    return NextResponse.json(
      { message: 'Invoice created successfully', invoice },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating invoice:', error)
    return NextResponse.json(
      { message: 'Error creating invoice' },
      { status: 500 }
    )
  }
}

