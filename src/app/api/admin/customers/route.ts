import { NextRequest, NextResponse } from 'next/server'
import {
  getAllCustomers,
  getInvoicesByCustomerId,
  initializeDatabase,
} from '@/lib/mockdb'
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
    const customers = getAllCustomers()
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.toLowerCase() || ''

    // Enrich each customer with their invoices and summary stats
    const enriched = customers.map((cust) => {
      const invoices = getInvoicesByCustomerId(cust.id)
      // Sort invoices by date descending (newest first)
      const sortedInvoices = [...invoices].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      const totalSpent = invoices.reduce((acc, inv) => acc + (inv.grandTotal || 0), 0)
      const visitCount = invoices.length
      const lastVisit = sortedInvoices[0]?.date || cust.createdAt

      return {
        ...cust,
        invoices: sortedInvoices,
        visitCount,
        totalSpent,
        lastVisit,
      }
    })

    // Filter if query provided
    const filtered = query
      ? enriched.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            c.mobile.toLowerCase().includes(query)
        )
      : enriched

    // Sort customers by last visit date descending
    filtered.sort(
      (a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
    )

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      { message: 'Error fetching customers' },
      { status: 500 }
    )
  }
}

