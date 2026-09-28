import { NextRequest, NextResponse } from 'next/server'
import {
  getAllCustomers,
  getAllInvoices,
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
    const customers = await getAllCustomers()
    const allInvoices = await getAllInvoices()
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.toLowerCase() || ''

    // Enrich each customer with their invoices and summary stats
    const enriched = customers.map((cust) => {
      const cleanId = (cust.id || '').trim().toLowerCase()
      const custName = (cust.name || '').trim().toLowerCase()
      const invoices = allInvoices.filter((inv) => {
        const invCustId = (inv.customerId || '').trim().toLowerCase()
        if (invCustId === cleanId) return true
        if (custName && (inv.customerName || '').trim().toLowerCase() === custName) return true
        return false
      })
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

    if (query) {
      filtered.sort((a, b) => {
        const aName = (a.name || '').toLowerCase()
        const bName = (b.name || '').toLowerCase()

        // 1. Exact name prefix match (e.g. 'vi' matches 'Vivek')
        const aPrefix = aName.startsWith(query)
        const bPrefix = bName.startsWith(query)
        if (aPrefix && !bPrefix) return -1
        if (!aPrefix && bPrefix) return 1

        // 2. Word prefix match (e.g. 'vi' matches 'Patel Vivek')
        const aWord = aName.split(/\s+/).some((w) => w.startsWith(query))
        const bWord = bName.split(/\s+/).some((w) => w.startsWith(query))
        if (aWord && !bWord) return -1
        if (!aWord && bWord) return 1

        // 3. Priority: highest total spent first (best customer priority)
        if (b.totalSpent !== a.totalSpent) {
          return b.totalSpent - a.totalSpent
        }

        // 4. Most visits
        if (b.visitCount !== a.visitCount) {
          return b.visitCount - a.visitCount
        }

        return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
      })
    } else {
      // Sort customers by last visit date descending
      filtered.sort(
        (a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
      )
    }

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      { message: 'Error fetching customers' },
      { status: 500 }
    )
  }
}

