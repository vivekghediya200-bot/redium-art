import { NextRequest, NextResponse } from 'next/server'
import { getInvoiceById, initializeDatabase } from '@/lib/mockdb'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase()
    const invoice = await getInvoiceById(params.id)

    if (!invoice) {
      return NextResponse.json(
        { message: 'Invoice not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Error fetching public invoice:', error)
    return NextResponse.json(
      { message: 'Error fetching invoice' },
      { status: 500 }
    )
  }
}

