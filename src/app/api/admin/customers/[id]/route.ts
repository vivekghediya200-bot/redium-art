import { NextRequest, NextResponse } from 'next/server'
import { updateCustomer, deleteCustomer, getAllCustomers, initializeDatabase } from '@/lib/mongodb'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function checkAuth(request: NextRequest) {
  const token = getTokenFromHeader(request.headers.get('authorization'))
  if (!token || !verifyToken(token)) {
    return null
  }
  return verifyToken(token)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = checkAuth(request)
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initializeDatabase()
    const customers = await getAllCustomers()
    const customer = customers.find((c) => c.id === params.id)

    if (!customer) {
      return NextResponse.json(
        { message: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(customer)
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { message: 'Error fetching customer' },
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
    const { name, mobile } = body

    if (!name && !mobile) {
      return NextResponse.json(
        { message: 'Please provide a name or mobile number to update' },
        { status: 400 }
      )
    }

    const updated = await updateCustomer(params.id, { name, mobile })

    if (!updated) {
      return NextResponse.json(
        { message: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: 'Customer updated successfully',
      customer: updated,
    })
  } catch (error) {
    console.error('Error updating customer:', error)
    return NextResponse.json(
      { message: 'Error updating customer' },
      { status: 500 }
    )
  }
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
    const success = await deleteCustomer(params.id)

    if (!success) {
      return NextResponse.json(
        { message: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Customer and related invoices deleted successfully' })
  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json(
      { message: 'Error deleting customer' },
      { status: 500 }
    )
  }
}

