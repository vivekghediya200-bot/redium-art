'use client'

import { useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { CustomerData } from './CustomerHistoryView'

interface CustomerReportModalProps {
  customer: CustomerData
  onClose: () => void
}

async function saveOrDownloadBlob(blob: Blob, suggestedName: string): Promise<boolean> {
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'PDF Document (*.pdf)',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return true
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return false
      }
      console.warn('showSaveFilePicker failed or cancelled, falling back to download:', err)
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

export default function CustomerReportModal({
  customer,
  onClose,
}: CustomerReportModalProps) {
  const [pdfLoading, setPdfLoading] = useState(false)
  const [shareNotice, setShareNotice] = useState<string | null>(null)
  const pdfRef = useRef<HTMLDivElement>(null)

  // Compute customer lifetime stats
  const totalSpent = customer.totalSpent || 0
  const totalBills = customer.invoices?.length || 0
  const avgSpend = totalBills > 0 ? totalSpent / totalBills : 0

  const sortedInvoices = [...(customer.invoices || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const firstVisit =
    sortedInvoices.length > 0
      ? sortedInvoices[sortedInvoices.length - 1].date
      : customer.createdAt?.split('T')[0] || 'N/A'
  const lastVisit =
    sortedInvoices.length > 0 ? sortedInvoices[0].date : 'N/A'

  const totalItemsCount = sortedInvoices.reduce(
    (acc, inv) =>
      acc +
      inv.items.reduce(
        (sum, item) => sum + (Number(item.qty) || 1),
        0
      ),
    0
  )

  // Generate & Download Lifetime Statement PDF
  const handleDownloadPDF = async (): Promise<{
    fileName: string
    blob: Blob
  } | null> => {
    setPdfLoading(true)
    try {
      const element = document.getElementById('customer-statement-pdf-zone')
      if (!element) throw new Error('Statement template not found')

      const images = Array.from(element.getElementsByTagName('img'))
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve()
          return new Promise((res) => {
            img.onload = res
            img.onerror = res
            setTimeout(res, 600)
          })
        })
      )

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 800,
        windowWidth: 800,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('customer-statement-pdf-zone')
          if (el) {
            el.style.opacity = '1'
            el.style.zIndex = '99999'
            el.style.left = '0px'
            el.style.top = '0px'
            el.style.position = 'static'
            el.style.display = 'block'
          }
        },
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.98)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = pdf.internal.pageSize.getWidth() // 210mm
      const pageHeight = pdf.internal.pageSize.getHeight() // 297mm
      const margin = 6
      const contentWidth = pageWidth - margin * 2
      const contentHeight = (canvas.height * contentWidth) / canvas.width

      if (contentHeight <= pageHeight - margin * 2) {
        pdf.addImage(
          imgData,
          'JPEG',
          margin,
          margin,
          contentWidth,
          contentHeight
        )
      } else {
        let heightLeft = contentHeight
        let position = margin

        pdf.addImage(
          imgData,
          'JPEG',
          margin,
          position,
          contentWidth,
          contentHeight
        )
        heightLeft -= pageHeight - margin * 2

        while (heightLeft > 0) {
          position = heightLeft - contentHeight
          pdf.addPage()
          pdf.addImage(
            imgData,
            'JPEG',
            margin,
            position,
            contentWidth,
            contentHeight
          )
          heightLeft -= pageHeight
        }
      }

      const cleanName = customer.name.replace(/[^a-zA-Z0-9]/g, '_')
      const fileName = `Statement_${cleanName}_Lifetime.pdf`
      const blob = pdf.output('blob')
      await saveOrDownloadBlob(blob, fileName)
      return { fileName, blob }
    } catch (err) {
      console.error('Customer statement PDF error:', err)
      return null
    } finally {
      setPdfLoading(false)
    }
  }

  // Share Statement via WhatsApp
  const handleShareWhatsApp = async () => {
    const result = await handleDownloadPDF()
    if (!result) return

    const { fileName, blob } = result

    // If Web Share API supports sending actual files, share the real PDF document!
    if (typeof navigator !== 'undefined' && navigator.canShare) {
      try {
        const pdfFile = new File([blob], fileName, { type: 'application/pdf' })
        if (navigator.canShare({ files: [pdfFile] })) {
          await navigator.share({
            files: [pdfFile],
            title: `Account Statement - ${customer.name}`,
            text: `Customer Statement for ${customer.name} - Jay Mataji Redium Art`,
          })
          setShareNotice(`✅ Actual PDF Statement attached and sent to WhatsApp!`)
          return
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return
        console.warn('Share error:', err)
      }
    }

    const message = `📊 *JAY MATAJI REDIUM ART & SHOW FITTING*
*CUSTOMER LIFETIME ACCOUNT STATEMENT*
--------------------------------
👤 *Customer:* ${customer.name}
📞 *Mobile:* ${customer.mobile || 'N/A'}
📅 *Member Since:* ${firstVisit}
🗓️ *Latest Visit:* ${lastVisit}
--------------------------------
🧾 *Total Bills / Visits:* ${totalBills}
📦 *Total Items Serviced:* ${totalItemsCount}
💰 *Lifetime Purchases:* ₹${totalSpent.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
    })}
📈 *Average Spend / Visit:* ₹${avgSpend.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
    })}
--------------------------------
📍 Porbandar Khambhaliya highway bokhira, Near Vachhrajdada Temple, Porbandar 360575
📞 Mobile: 6353016927

🙏 *Thank you for your valued patronage with us!*
📄 _(Lifetime Statement PDF saved to selected folder: ${fileName})_`

    let phone = (customer.mobile || '').replace(/\D/g, '')
    if (phone.length === 10) phone = '91' + phone

    const waAppUrl = phone
      ? `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`
      : `whatsapp://send?text=${encodeURIComponent(message)}`

    const waLink = document.createElement('a')
    waLink.href = waAppUrl
    document.body.appendChild(waLink)
    waLink.click()
    document.body.removeChild(waLink)

    setShareNotice(
      `✅ Statement saved to your folder as "${fileName}"! WhatsApp Application opened for ${customer.name}.`
    )
  }

  return (
    <>
      {/* =========================================================================
          1. DEDICATED OFF-SCREEN A4 STATEMENT TEMPLATE (FOR HIGH-RES PDF)
         ========================================================================= */}
      <div
        id="customer-statement-pdf-zone"
        ref={pdfRef}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: '800px',
          backgroundColor: '#ffffff',
          color: '#111827',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          padding: '36px 40px',
          boxSizing: 'border-box',
          zIndex: -100,
          opacity: 0.005,
          pointerEvents: 'none',
        }}
      >
        {/* Header with Brand Logo */}
        <div
          style={{
            borderBottom: '3px solid #1f2937',
            paddingBottom: '16px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #d1d5db',
                  flexShrink: 0,
                }}
              >
                <img
                  src="/images/logo.png"
                  alt="Logo"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
              </div>
              <div>
                <h1
                  style={{
                    fontSize: '22px',
                    fontWeight: '900',
                    margin: 0,
                    lineHeight: '1.2',
                    color: '#111827',
                  }}
                >
                  <span style={{ color: '#dc2626' }}>J</span>AY{' '}
                  <span style={{ color: '#dc2626' }}>M</span>ATAJI{' '}
                  <span style={{ color: '#dc2626' }}>R</span>EDIUM ART &amp;
                </h1>
                <h2
                  style={{
                    fontSize: '17px',
                    fontWeight: '800',
                    margin: '3px 0 0 0',
                    color: '#374151',
                  }}
                >
                  SHOW FITTING
                </h2>
                <p
                  style={{
                    fontSize: '11px',
                    margin: '4px 0 0 0',
                    color: '#ea580c',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                  }}
                >
                  Truck Show Fitting • Vehicle Wraps • Radium Art • Number Plates
                </p>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: '900',
                  color: '#075985',
                  letterSpacing: '1px',
                }}
              >
                LIFETIME STATEMENT
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#4b5563',
                  marginTop: '4px',
                }}
              >
                Generated:{' '}
                <span style={{ color: '#111827' }}>
                  {new Date().toLocaleDateString('en-GB')}
                </span>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#4b5563',
                }}
              >
                Scope:{' '}
                <span style={{ color: '#ea580c' }}>LIFETIME PURCHASE REPORT</span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#374151',
              marginTop: '12px',
              paddingTop: '10px',
              borderTop: '1px solid #e5e7eb',
            }}
          >
            <div>
              <div>
                <strong>Mobile No.:</strong>{' '}
                <span style={{ fontWeight: '800', color: '#111827' }}>
                  6353016927
                </span>
              </div>
              <div style={{ marginTop: '2px' }}>
                <strong>Owner:</strong>{' '}
                <span style={{ fontWeight: '700', color: '#111827' }}>
                  Vivek Ghediya
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right', maxWidth: '440px' }}>
              <div>
                <strong>Address:</strong> Porbandar Khambhaliya highway, Near
                Vachhrajdada Temple, Bokhira, Porbandar - 360575
              </div>
              <div style={{ marginTop: '2px', color: '#db2777', fontWeight: '700', fontSize: '11px' }}>
                📸 Instagram: @jay_mataji_truck_body_builder
              </div>
            </div>
          </div>
        </div>

        {/* Customer Profile Banner */}
        <div
          style={{
            backgroundColor: '#fff7ed',
            border: '1.5px solid #fdba74',
            borderRadius: '10px',
            padding: '14px 20px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '800',
                color: '#c2410c',
                textTransform: 'uppercase',
              }}
            >
              Customer Profile &amp; Account
            </span>
            <div
              style={{
                fontSize: '18px',
                fontWeight: '900',
                color: '#111827',
                marginTop: '2px',
              }}
            >
              {customer.name}
            </div>
            <div
              style={{ fontSize: '13px', color: '#4b5563', marginTop: '2px' }}
            >
              📞 Mobile: <strong>{customer.mobile || 'Not Provided'}</strong> •
              Cust ID: #{customer.id}
            </div>
          </div>

          <div style={{ textAlign: 'right', fontSize: '12px', color: '#4b5563' }}>
            <div>
              First Visit: <strong>{firstVisit}</strong>
            </div>
            <div style={{ marginTop: '3px' }}>
              Latest Visit: <strong>{lastVisit}</strong>
            </div>
          </div>
        </div>

        {/* Executive Metrics Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            marginBottom: '18px',
          }}
        >
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '10px 14px',
              backgroundColor: '#f9fafb',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#6b7280',
                textTransform: 'uppercase',
              }}
            >
              Total Lifetime Spent
            </div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: '900',
                color: '#ea580c',
                marginTop: '3px',
              }}
            >
              ₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '10px 14px',
              backgroundColor: '#f9fafb',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#6b7280',
                textTransform: 'uppercase',
              }}
            >
              Total Bills / Visits
            </div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: '900',
                color: '#111827',
                marginTop: '3px',
              }}
            >
              {totalBills}
            </div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '10px 14px',
              backgroundColor: '#f9fafb',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#6b7280',
                textTransform: 'uppercase',
              }}
            >
              Avg. Spend / Bill
            </div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: '900',
                color: '#111827',
                marginTop: '3px',
              }}
            >
              ₹{avgSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '10px 14px',
              backgroundColor: '#f9fafb',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#6b7280',
                textTransform: 'uppercase',
              }}
            >
              Total Items
            </div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: '900',
                color: '#111827',
                marginTop: '3px',
              }}
            >
              {totalItemsCount}
            </div>
          </div>
        </div>

        {/* Transaction History Table */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '18px',
            tableLayout: 'fixed',
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: '#e5e7eb',
                borderTop: '2px solid #1f2937',
                borderBottom: '2px solid #1f2937',
                fontSize: '12px',
                fontWeight: '800',
                color: '#111827',
                textTransform: 'uppercase',
              }}
            >
              <th
                style={{
                  width: '8%',
                  padding: '9px 6px',
                  textAlign: 'center',
                  borderRight: '1px solid #9ca3af',
                }}
              >
                Sr
              </th>
              <th
                style={{
                  width: '15%',
                  padding: '9px 10px',
                  textAlign: 'center',
                  borderRight: '1px solid #9ca3af',
                }}
              >
                Date
              </th>
              <th
                style={{
                  width: '17%',
                  padding: '9px 10px',
                  textAlign: 'center',
                  borderRight: '1px solid #9ca3af',
                }}
              >
                Bill ID
              </th>
              <th
                style={{
                  width: '42%',
                  padding: '9px 12px',
                  textAlign: 'left',
                  borderRight: '1px solid #9ca3af',
                }}
              >
                Items &amp; Services Breakdown
              </th>
              <th
                style={{
                  width: '18%',
                  padding: '9px 12px',
                  textAlign: 'right',
                }}
              >
                Amount (₹)
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedInvoices.map((inv, idx) => {
              const itemsSummary = inv.items
                .map(
                  (it) =>
                    `${it.description} (${it.qty} × ₹${Number(it.rate).toFixed(
                      0
                    )})`
                )
                .join(', ')

              return (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid #d1d5db',
                    fontSize: '12.5px',
                    color: '#1f2937',
                  }}
                >
                  <td
                    style={{
                      padding: '9px 6px',
                      textAlign: 'center',
                      fontWeight: '700',
                      borderRight: '1px solid #e5e7eb',
                    }}
                  >
                    {idx + 1}
                  </td>
                  <td
                    style={{
                      padding: '9px 10px',
                      textAlign: 'center',
                      fontWeight: '600',
                      borderRight: '1px solid #e5e7eb',
                    }}
                  >
                    {inv.date}
                  </td>
                  <td
                    style={{
                      padding: '9px 10px',
                      textAlign: 'center',
                      fontWeight: '700',
                      color: '#0369a1',
                      borderRight: '1px solid #e5e7eb',
                    }}
                  >
                    {inv.id}
                  </td>
                  <td
                    style={{
                      padding: '9px 12px',
                      textAlign: 'left',
                      fontWeight: '500',
                      borderRight: '1px solid #e5e7eb',
                      wordBreak: 'break-word',
                      lineHeight: '1.35',
                    }}
                  >
                    {itemsSummary || 'Artwork & Fitting Work'}
                  </td>
                  <td
                    style={{
                      padding: '9px 12px',
                      textAlign: 'right',
                      fontWeight: '800',
                      color: '#111827',
                    }}
                  >
                    ₹
                    {Number(inv.grandTotal).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr
              style={{
                backgroundColor: '#f3f4f6',
                borderTop: '2px solid #1f2937',
                borderBottom: '2px solid #1f2937',
              }}
            >
              <td
                colSpan={4}
                style={{
                  padding: '11px 14px',
                  fontWeight: '800',
                  fontSize: '13px',
                  textAlign: 'right',
                  textTransform: 'uppercase',
                  borderRight: '1px solid #d1d5db',
                  color: '#374151',
                }}
              >
                Total Lifetime Purchases:
              </td>
              <td
                style={{
                  padding: '11px 14px',
                  textAlign: 'right',
                  fontWeight: '900',
                  fontSize: '17px',
                  color: '#ea580c',
                }}
              >
                ₹
                {totalSpent.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Footer & Authorized Signatory */}
        <div
          style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px dashed #9ca3af',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            fontSize: '11px',
            color: '#4b5563',
          }}
        >
          <div>
            <p
              style={{
                fontWeight: '800',
                color: '#111827',
                margin: '0 0 3px 0',
              }}
            >
              Certified Customer Statement
            </p>
            <p style={{ margin: '0 0 2px 0' }}>
              • Official historical purchase record of Jay Mataji Redium Art &amp; Show Fitting.
            </p>
            <p
              style={{
                margin: 0,
                color: '#ea580c',
                fontWeight: '700',
                fontSize: '12px',
              }}
            >
              🙏 Thank you {customer.name} for being our valued customer!
            </p>
          </div>

          <div style={{ textAlign: 'center', width: '180px' }}>
            <div style={{ height: '50px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '2px' }}>
              <img
                src="/images/signature.png"
                alt="Authorized Signatory"
                style={{ maxHeight: '46px', maxWidth: '145px', objectFit: 'contain' }}
              />
            </div>
            <div
              style={{
                borderTop: '1px solid #1f2937',
                paddingTop: '4px',
                fontWeight: '700',
                color: '#111827',
              }}
            >
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. INTERACTIVE MODAL DIALOG (ON SCREEN)
         ========================================================================= */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full my-auto flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Top Bar */}
          <div className="p-4 sm:p-5 border-b flex flex-wrap justify-between items-center bg-gradient-to-r from-orange-50 to-amber-50 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-black flex items-center justify-center p-1 border border-primary/20 shadow-sm flex-shrink-0">
                <img
                  src="/images/logo.png"
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 leading-tight">
                  Lifetime Purchase Report
                </h2>
                <p className="text-xs text-primary font-bold uppercase tracking-wider">
                  Customer: {customer.name} • {customer.mobile || 'No Mobile'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleShareWhatsApp}
                disabled={pdfLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <span>📲</span>
                <span>{pdfLoading ? 'Preparing...' : 'Share on WhatsApp'}</span>
              </button>

              <button
                onClick={handleDownloadPDF}
                disabled={pdfLoading}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <span>📥</span>
                <span>{pdfLoading ? 'Generating...' : 'Download PDF'}</span>
              </button>

              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold px-2 py-1 leading-none ml-1"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {shareNotice && (
            <div className="m-4 mb-0 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center justify-between">
              <span>{shareNotice}</span>
              <button
                onClick={() => setShareNotice(null)}
                className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
              >
                ×
              </button>
            </div>
          )}

          {/* Body Content */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-2xl bg-orange-50/80 border border-orange-200">
                <span className="text-[11px] font-bold uppercase text-orange-700 tracking-wider block">
                  Lifetime Total Spend
                </span>
                <span className="text-xl sm:text-2xl font-black text-orange-600 mt-1 block">
                  ₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200">
                <span className="text-[11px] font-bold uppercase text-blue-700 tracking-wider block">
                  Total Visits / Bills
                </span>
                <span className="text-xl sm:text-2xl font-black text-blue-900 mt-1 block">
                  {totalBills} bills
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200">
                <span className="text-[11px] font-bold uppercase text-emerald-700 tracking-wider block">
                  Avg. Spend / Bill
                </span>
                <span className="text-xl sm:text-2xl font-black text-emerald-800 mt-1 block">
                  ₹{avgSpend.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200">
                <span className="text-[11px] font-bold uppercase text-purple-700 tracking-wider block">
                  Total Items Serviced
                </span>
                <span className="text-xl sm:text-2xl font-black text-purple-900 mt-1 block">
                  {totalItemsCount} items
                </span>
              </div>
            </div>

            {/* Invoices List Table */}
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-2">
                <span>📋</span> Complete Transaction History ({sortedInvoices.length} Invoices)
              </h3>

              <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-xs sm:text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase text-[11px]">
                      <th className="py-3 px-3 w-12 text-center">#</th>
                      <th className="py-3 px-3 w-28 text-center">Date</th>
                      <th className="py-3 px-3 w-28 text-center">Bill ID</th>
                      <th className="py-3 px-4">Items Summary</th>
                      <th className="py-3 px-4 w-32 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedInvoices.map((inv, idx) => (
                      <tr key={inv.id} className="hover:bg-gray-50/70 transition">
                        <td className="py-3 px-3 text-center font-bold text-gray-500">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-gray-700">
                          {inv.date}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2.5 py-1 bg-sky-100 text-sky-800 rounded-md font-bold text-xs">
                            {inv.id}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-800">
                          <div className="space-y-0.5">
                            {inv.items.map((it, i) => (
                              <div key={i} className="text-xs text-gray-700">
                                <span className="font-semibold text-gray-900">
                                  {it.description}
                                </span>{' '}
                                <span className="text-gray-500">
                                  ({it.qty} × ₹{Number(it.rate).toFixed(2)})
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-gray-900 text-sm">
                          ₹{inv.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-orange-50 font-bold border-t-2 border-orange-200">
                      <td colSpan={4} className="py-3 px-4 text-right text-xs uppercase tracking-wider text-orange-900 font-extrabold">
                        Lifetime Grand Total:
                      </td>
                      <td className="py-3 px-4 text-right text-base font-black text-orange-600">
                        ₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="p-4 border-t bg-gray-50 flex justify-end gap-2.5">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold text-sm transition"
            >
              Close
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition shadow-sm flex items-center gap-2"
            >
              <span>📥</span>
              <span>{pdfLoading ? 'Generating...' : 'Download Statement PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

