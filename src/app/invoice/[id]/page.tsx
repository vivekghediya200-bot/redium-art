'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

interface InvoiceData {
  id: string
  customerId: string
  customerName: string
  customerMobile?: string
  date: string
  items: Array<{
    sr: number
    description: string
    qty: number
    rate: number
    total: number
  }>
  grandTotal: number
  notes?: string
}

export default function PublicInvoicePage() {
  const params = useParams()
  const id = params?.id as string

  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [shareNotice, setShareNotice] = useState<string | null>(null)

  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    const fetchInvoice = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/invoices/${id}`)
        if (!res.ok) {
          setError('Invoice not found or no longer available.')
          return
        }
        const data = await res.json()
        setInvoice(data)
      } catch (err) {
        console.error('Error fetching invoice:', err)
        setError('Failed to load invoice.')
      } finally {
        setLoading(false)
      }
    }
    fetchInvoice()
  }, [id])

  const generatePDFBlob = async (): Promise<{ fileName: string; blob: Blob } | null> => {
    if (!printRef.current || !invoice) return null
    try {
      setPdfLoading(true)
      const element = printRef.current
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.98)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      const contentWidth = pageWidth - margin * 2
      const contentHeight = (canvas.height * contentWidth) / canvas.width

      if (contentHeight <= pageHeight - margin * 2) {
        pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight)
      } else {
        let heightLeft = contentHeight
        let position = margin

        pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight)
        heightLeft -= pageHeight - margin * 2

        while (heightLeft > 0) {
          position = heightLeft - contentHeight
          pdf.addPage()
          pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight)
          heightLeft -= pageHeight
        }
      }

      const fileName = `${invoice.id}_${(invoice.customerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      const blob = pdf.output('blob')
      return { fileName, blob }
    } catch (err) {
      console.error('PDF error:', err)
      return null
    } finally {
      setPdfLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    const result = await generatePDFBlob()
    if (!result) return
    const { fileName, blob } = result

    // Save or download
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: 'PDF Document (*.pdf)', accept: { 'application/pdf': ['.pdf'] } }],
        })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
        return
      } catch (err: any) {
        if (err.name === 'AbortError') return
      }
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handleShareWhatsApp = async () => {
    if (!invoice) return
    const result = await generatePDFBlob()
    if (!result) return
    const { fileName, blob } = result

    const pdfFile = new File([blob], fileName, { type: 'application/pdf' })

    // Native Web Share API with actual PDF file
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: `Invoice ${invoice.id} - Jay Mataji Redium Art`,
          text: `Official Invoice ${invoice.id} for ${invoice.customerName}`,
        })
        setShareNotice('✅ Actual PDF Invoice shared successfully!')
        return
      } catch (err: any) {
        if (err.name === 'AbortError') return
      }
    }

    // Direct WhatsApp share with download link
    let phone = (invoice.customerMobile || '').replace(/\D/g, '')
    if (phone.length === 10) phone = '91' + phone

    const downloadUrl = `${window.location.origin}/invoice/${invoice.id}`
    const message = `📄 *OFFICIAL INVOICE PDF: ${invoice.id}*
👤 *Customer:* ${invoice.customerName}
💰 *Total Amount:* ₹${invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}

📥 *Download / View Official PDF Invoice:*
${downloadUrl}

🙏 *Jay Mataji Redium Art & Truck Show Fitting*
📍 Porbandar | 📞 Contact: 6353016927`

    const waAppUrl = phone
      ? `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`
      : `whatsapp://send?text=${encodeURIComponent(message)}`

    window.open(waAppUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        <div className="flex items-center gap-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Loading official invoice...</span>
        </div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-md w-full text-center">
          <span className="text-4xl">❌</span>
          <h2 className="text-xl font-bold text-gray-900 mt-3">Invoice Not Found</h2>
          <p className="text-sm text-gray-500 mt-1">{error || 'This invoice does not exist or has been removed.'}</p>
          <Link href="/" className="mt-5 inline-block px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl">
            Go to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4">
      {/* Action Bar */}
      <div className="max-w-4xl mx-auto mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-extrabold text-gray-900 text-lg sm:text-xl">
            Official Invoice {invoice.id}
          </h1>
          <p className="text-xs text-gray-500">Customer: {invoice.customerName}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="px-4 py-2 bg-primary hover:bg-secondary text-white font-bold rounded-xl text-xs sm:text-sm transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <span>📥</span> {pdfLoading ? 'Generating PDF...' : 'Download Official PDF'}
          </button>

          <button
            onClick={handleShareWhatsApp}
            disabled={pdfLoading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <span>📲</span> Send on WhatsApp
          </button>

          <button
            onClick={() => window.print()}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs sm:text-sm transition flex items-center gap-1.5"
          >
            <span>🖨️</span> Print
          </button>
        </div>
      </div>

      {shareNotice && (
        <div className="max-w-4xl mx-auto mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 font-medium">
          {shareNotice}
        </div>
      )}

      {/* Printable / PDF Template */}
      <div className="max-w-4xl mx-auto bg-white p-6 sm:p-10 rounded-2xl shadow-lg border border-gray-200 overflow-x-auto">
        <div ref={printRef} className="bg-white min-w-[700px] p-6 text-gray-900 font-sans">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl bg-black p-1 flex items-center justify-center border border-gray-300">
                <img src="/images/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-xl font-black text-gray-900 leading-tight">
                  <span className="text-red-600">J</span>AY <span className="text-red-600">M</span>ATAJI <span className="text-red-600">R</span>EDIUM ART &amp;
                </h1>
                <h2 className="text-base font-extrabold text-gray-800 tracking-wider">SHOW FITTING</h2>
                <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
                  Truck Show Fitting • Vehicle Wraps • Radium Art • Number Plates
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-black text-sky-900 tracking-wider">INVOICE</div>
              <div className="text-xs font-bold text-gray-600 mt-1">
                Bill No: <span className="text-gray-900 font-extrabold">{invoice.id}</span>
              </div>
              <div className="text-xs font-bold text-gray-600">
                Date: <span className="text-gray-900">{invoice.date}</span>
              </div>
            </div>
          </div>

          {/* Shop Bar */}
          <div className="flex justify-between text-xs text-gray-700 py-2.5 border-b border-gray-200">
            <div>
              <strong>Mobile No.:</strong> <span className="font-extrabold text-gray-900">6353016927</span>
            </div>
            <div className="text-right max-w-md">
              <strong>Address:</strong> Porbandar Khambhaliya highway, Near Vachhrajdada Temple, Bokhira, Porbandar - 360575
            </div>
          </div>

          {/* Customer Bar */}
          <div className="my-4 p-3 bg-gray-50 rounded-xl border border-gray-200 flex justify-between items-center text-xs">
            <div>
              <span className="text-gray-500 font-bold uppercase block text-[10px]">Billed To:</span>
              <span className="text-sm font-extrabold text-gray-900">{invoice.customerName}</span>
            </div>
            <div className="text-right">
              <span className="text-gray-500 font-bold uppercase block text-[10px]">Contact:</span>
              <span className="text-xs font-bold text-gray-800">{invoice.customerMobile || 'Not Provided'}</span>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-xs text-left border-collapse my-4">
            <thead>
              <tr className="bg-gray-100 border-y border-gray-300 text-gray-800">
                <th className="py-2 px-3 w-10 text-center font-bold">#</th>
                <th className="py-2 px-3 font-bold">Item Description</th>
                <th className="py-2 px-3 w-16 text-center font-bold">Qty</th>
                <th className="py-2 px-3 w-28 text-right font-bold">Rate (₹)</th>
                <th className="py-2 px-3 w-28 text-right font-bold">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoice.items.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="py-2 px-3 text-center text-gray-500">{item.sr || idx + 1}</td>
                  <td className="py-2 px-3 font-semibold text-gray-900">{item.description}</td>
                  <td className="py-2 px-3 text-center font-medium">{item.qty}</td>
                  <td className="py-2 px-3 text-right font-medium">₹{Number(item.rate).toFixed(2)}</td>
                  <td className="py-2 px-3 text-right font-bold text-gray-900">₹{Number(item.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-900 bg-gray-50 font-bold text-sm">
                <td colSpan={4} className="py-2.5 px-3 text-right uppercase tracking-wider">
                  Grand Total:
                </td>
                <td className="py-2.5 px-3 text-right text-primary font-black">
                  ₹{invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Footer with Signature */}
          <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-end text-xs">
            <div className="max-w-xs text-gray-500 text-[11px] leading-relaxed">
              <p className="font-bold text-gray-700">Terms &amp; Conditions:</p>
              <p>1. Goods once sold will not be taken back or exchanged.</p>
              <p>2. Payment strictly upon completion of fitment or delivery.</p>
              <p className="mt-2 text-primary font-bold">🙏 Jay Mataji • Visit Again!</p>
            </div>

            <div className="text-center w-48">
              <div className="h-16 flex items-center justify-center">
                <img
                  src="/images/signature.png"
                  alt="Authorized Signature"
                  className="max-h-14 max-w-full object-contain"
                />
              </div>
              <div className="border-t border-gray-400 pt-1 font-bold text-gray-900 text-xs uppercase">
                Authorized Signatory
              </div>
              <div className="text-[10px] text-gray-500">Jay Mataji Redium Art</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
