'use client'

import { useState, useMemo, useRef } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { CustomerData } from './CustomerHistoryView'

interface ShopReportModalProps {
  customers: CustomerData[]
  onClose: () => void
}

type PeriodFilter = 'lifetime' | 'today' | 'this_week' | 'this_month' | 'this_year' | 'custom'

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

export default function ShopReportModal({
  customers,
  onClose,
}: ShopReportModalProps) {
  const [period, setPeriod] = useState<PeriodFilter>('lifetime')
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [pdfLoading, setPdfLoading] = useState(false)
  const [shareNotice, setShareNotice] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'ledger' | 'best_clients'>('ledger')
  const pdfRef = useRef<HTMLDivElement>(null)

  // Flatten all invoices across all customers
  const allInvoices = useMemo(() => {
    const list: Array<{
      id: string
      date: string
      customerName: string
      customerMobile: string
      grandTotal: number
      paymentStatus?: 'PAID' | 'PENDING'
      paymentMethod?: 'CASH' | 'UPI' | 'CARD'
      items: Array<{
        description: string
        qty: number
        rate: number
        total: number
      }>
    }> = []

    customers.forEach((cust) => {
      cust.invoices.forEach((inv) => {
        list.push({
          id: inv.id,
          date: inv.date,
          customerName: cust.name,
          customerMobile: cust.mobile,
          grandTotal: inv.grandTotal,
          paymentStatus: inv.paymentStatus || 'PAID',
          paymentMethod: inv.paymentMethod || 'UPI',
          items: inv.items,
        })
      })
    })

    return list.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [customers])

  // Filter invoices based on selected period
  const filteredInvoices = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    const now = new Date()

    if (period === 'lifetime') {
      return allInvoices
    }

    if (period === 'today') {
      return allInvoices.filter((inv) => inv.date === todayStr)
    }

    if (period === 'this_week') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      return allInvoices.filter((inv) => new Date(inv.date) >= sevenDaysAgo)
    }

    if (period === 'this_month') {
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() // 0-indexed
      return allInvoices.filter((inv) => {
        const d = new Date(inv.date)
        return (
          d.getFullYear() === currentYear && d.getMonth() === currentMonth
        )
      })
    }

    if (period === 'this_year') {
      const currentYear = now.getFullYear()
      return allInvoices.filter((inv) => {
        const d = new Date(inv.date)
        return d.getFullYear() === currentYear
      })
    }

    if (period === 'custom') {
      return allInvoices.filter((inv) => {
        return inv.date >= startDate && inv.date <= endDate
      })
    }

    return allInvoices
  }, [allInvoices, period, startDate, endDate])

  // Aggregated Stats
  const totalRevenue = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0)
  }, [filteredInvoices])

  const totalBills = filteredInvoices.length
  const avgBillValue = totalBills > 0 ? totalRevenue / totalBills : 0

  const uniqueCustomersCount = useMemo(() => {
    const set = new Set<string>()
    filteredInvoices.forEach((inv) => set.add(inv.customerName.toLowerCase()))
    return set.size
  }, [filteredInvoices])

  // Structured Collection Breakdown (Paid, Pending, UPI, Cash, Card)
  const collectionStats = useMemo(() => {
    let totalPaid = 0
    let paidCount = 0
    let totalPending = 0
    let pendingCount = 0
    let upiTotal = 0
    let upiCount = 0
    let cashTotal = 0
    let cashCount = 0
    let cardTotal = 0
    let cardCount = 0

    filteredInvoices.forEach((inv) => {
      const amount = inv.grandTotal || 0
      const status = inv.paymentStatus || 'PAID'
      const method = inv.paymentMethod || 'UPI'

      if (status === 'PAID') {
        totalPaid += amount
        paidCount++
        if (method === 'UPI') {
          upiTotal += amount
          upiCount++
        } else if (method === 'CASH') {
          cashTotal += amount
          cashCount++
        } else if (method === 'CARD') {
          cardTotal += amount
          cardCount++
        }
      } else {
        totalPending += amount
        pendingCount++
      }
    })

    return {
      totalPaid,
      paidCount,
      totalPending,
      pendingCount,
      upiTotal,
      upiCount,
      cashTotal,
      cashCount,
      cardTotal,
      cardCount,
    }
  }, [filteredInvoices])

  // Top services / items breakdown
  const topItems = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {}
    filteredInvoices.forEach((inv) => {
      inv.items.forEach((item) => {
        const name = (item.description || 'Artwork Work').trim()
        if (!map[name]) map[name] = { count: 0, revenue: 0 }
        map[name].count += Number(item.qty) || 1
        map[name].revenue += Number(item.total) || 0
      })
    })

    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [filteredInvoices])

  // Best Clients in the selected period (ranked by total spent)
  const bestClients = useMemo(() => {
    const map: Record<
      string,
      {
        name: string
        mobile: string
        totalSpent: number
        visitCount: number
        lastVisit: string
      }
    > = {}

    filteredInvoices.forEach((inv) => {
      const key = (inv.customerMobile || inv.customerName).toLowerCase().trim()
      if (!map[key]) {
        map[key] = {
          name: inv.customerName,
          mobile: inv.customerMobile || 'Not recorded',
          totalSpent: 0,
          visitCount: 0,
          lastVisit: inv.date,
        }
      }
      map[key].totalSpent += inv.grandTotal || 0
      map[key].visitCount += 1
      if (inv.date > map[key].lastVisit) {
        map[key].lastVisit = inv.date
      }
    })

    return Object.values(map).sort((a, b) => b.totalSpent - a.totalSpent)
  }, [filteredInvoices])

  // Scope label for display
  const scopeLabel = useMemo(() => {
    switch (period) {
      case 'lifetime':
        return 'Lifetime (All-Time Full Shop Report)'
      case 'today':
        return `Today (${new Date().toLocaleDateString('en-GB')})`
      case 'this_week':
        return 'Past 7 Days'
      case 'this_month':
        return `Current Month (${new Date().toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        })})`
      case 'this_year':
        return `Current Year (${new Date().getFullYear()})`
      case 'custom':
        return `Custom Period: ${startDate} to ${endDate}`
    }
  }, [period, startDate, endDate])

  // Generate & Download PDF
  const handleDownloadPDF = async (): Promise<{
    fileName: string
    blob: Blob
  } | null> => {
    setPdfLoading(true)
    try {
      const element = document.getElementById('shop-report-pdf-zone')
      if (!element) throw new Error('Report template not found')

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
          const el = clonedDoc.getElementById('shop-report-pdf-zone')
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

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
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

      const fileName = `JayMataji_ShopReport_${period}_${new Date()
        .toISOString()
        .split('T')[0]}.pdf`
      const blob = pdf.output('blob')
      await saveOrDownloadBlob(blob, fileName)
      return { fileName, blob }
    } catch (err) {
      console.error('Shop report PDF generation error:', err)
      return null
    } finally {
      setPdfLoading(false)
    }
  }

  // Share via WhatsApp with executive summary and automatic PDF download
  const handleShareWhatsApp = async () => {
    let savedFileName = ''
    try {
      const result = await handleDownloadPDF()
      if (result) {
        savedFileName = result.fileName
      }
    } catch (pdfErr) {
      console.error('Shop report PDF error during share:', pdfErr)
    }

    const message = `📊 *JAY MATAJI REDIUM ART - BUSINESS PERFORMANCE & COLLECTION REPORT*
*Scope:* ${scopeLabel}
━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *Total Gross Revenue:* ₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
💳 *Paid Collection:* ₹${collectionStats.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${collectionStats.paidCount} Bills)
⏳ *Pending (Udhar):* ₹${collectionStats.totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${collectionStats.pendingCount} Bills)
━━━━━━━━━━━━━━━━━━━━━━━━━━
*STRUCTURE-WISE COLLECTIONS:*
📱 *UPI:* ₹${collectionStats.upiTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${collectionStats.upiCount} Bills)
💵 *Cash:* ₹${collectionStats.cashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${collectionStats.cashCount} Bills)
💳 *Card:* ₹${collectionStats.cardTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${collectionStats.cardCount} Bills)
━━━━━━━━━━━━━━━━━━━━━━━━━━
🧾 *Total Bills Issued:* ${totalBills}
👥 *Unique Customers:* ${uniqueCustomersCount}
📈 *Average Sale / Bill:* ₹${avgBillValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
${bestClients.length > 0 ? `⭐ *Top Client:* ${bestClients[0].name} (₹${bestClients[0].totalSpent.toLocaleString('en-IN')})\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Owner:* Vivek Ghediya | 📞 Contact: 6353016927
📸 *Instagram:* https://www.instagram.com/jay_mataji_truck_body_builder/?hl=en
📍 *Location:* https://maps.google.com/?q=21°39'33.9%22N+69°36'22.1%22E`

    const waAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
    window.open(waAppUrl, '_blank')

    setShareNotice(
      `✅ Report ${savedFileName ? `"${savedFileName}"` : ''} downloaded! Executive report opened in WhatsApp.`
    )
  }

  return (
    <>
      {/* =========================================================================
          1. DEDICATED OFF-SCREEN A4 REPORT TEMPLATE (FOR HIGH-RES PDF)
         ========================================================================= */}
      <div
        id="shop-report-pdf-zone"
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
        {/* Header */}
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
                  fontSize: '19px',
                  fontWeight: '900',
                  color: '#075985',
                  letterSpacing: '1px',
                }}
              >
                BUSINESS PERFORMANCE REPORT
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#4b5563',
                  marginTop: '4px',
                }}
              >
                Date:{' '}
                <span style={{ color: '#111827' }}>
                  {new Date().toLocaleDateString('en-GB')}
                </span>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#ea580c',
                }}
              >
                {scopeLabel}
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
                <strong>Shop Contact:</strong>{' '}
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

        {/* Executive Metrics Grid */}
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
              border: '1.5px solid #fdba74',
              borderRadius: '8px',
              padding: '12px 14px',
              backgroundColor: '#fff7ed',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: '800',
                color: '#c2410c',
                textTransform: 'uppercase',
              }}
            >
              Total Gross Revenue
            </div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: '900',
                color: '#ea580c',
                marginTop: '3px',
              }}
            >
              ₹
              {totalRevenue.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px 14px',
              backgroundColor: '#f9fafb',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#4b5563',
                textTransform: 'uppercase',
              }}
            >
              Total Bills Issued
            </div>
            <div
              style={{
                fontSize: '20px',
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
              padding: '12px 14px',
              backgroundColor: '#f9fafb',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#4b5563',
                textTransform: 'uppercase',
              }}
            >
              Unique Customers
            </div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: '900',
                color: '#111827',
                marginTop: '3px',
              }}
            >
              {uniqueCustomersCount}
            </div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px 14px',
              backgroundColor: '#f9fafb',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#4b5563',
                textTransform: 'uppercase',
              }}
            >
              Avg. Invoice Value
            </div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: '900',
                color: '#111827',
                marginTop: '3px',
              }}
            >
              ₹
              {avgBillValue.toLocaleString('en-IN', {
                minimumFractionDigits: 0,
              })}
            </div>
          </div>
        </div>

        {/* STRUCTURE-WISE COLLECTION CARDS IN PDF */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '10px',
            marginBottom: '18px',
          }}
        >
          <div
            style={{
              border: '1.5px solid #10b981',
              borderRadius: '8px',
              padding: '10px',
              backgroundColor: '#ecfdf5',
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#047857', textTransform: 'uppercase' }}>
              Paid Collection
            </div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#065f46', marginTop: '2px' }}>
              ₹{collectionStats.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '9px', color: '#047857', marginTop: '2px', fontWeight: '600' }}>
              {collectionStats.paidCount} Paid Bills
            </div>
          </div>

          <div
            style={{
              border: '1.5px solid #f59e0b',
              borderRadius: '8px',
              padding: '10px',
              backgroundColor: '#fffbeb',
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#b45309', textTransform: 'uppercase' }}>
              Pending (Udhar)
            </div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#92400e', marginTop: '2px' }}>
              ₹{collectionStats.totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '9px', color: '#b45309', marginTop: '2px', fontWeight: '600' }}>
              {collectionStats.pendingCount} Pending Bills
            </div>
          </div>

          <div
            style={{
              border: '1.5px solid #8b5cf6',
              borderRadius: '8px',
              padding: '10px',
              backgroundColor: '#f5f3ff',
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#6d28d9', textTransform: 'uppercase' }}>
              UPI Collection
            </div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#5b21b6', marginTop: '2px' }}>
              ₹{collectionStats.upiTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '9px', color: '#6d28d9', marginTop: '2px', fontWeight: '600' }}>
              {collectionStats.upiCount} UPI Bills
            </div>
          </div>

          <div
            style={{
              border: '1.5px solid #0284c7',
              borderRadius: '8px',
              padding: '10px',
              backgroundColor: '#f0f9ff',
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase' }}>
              Cash (&quot;Case&quot;)
            </div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#075985', marginTop: '2px' }}>
              ₹{collectionStats.cashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '9px', color: '#0369a1', marginTop: '2px', fontWeight: '600' }}>
              {collectionStats.cashCount} Cash Bills
            </div>
          </div>

          <div
            style={{
              border: '1.5px solid #64748b',
              borderRadius: '8px',
              padding: '10px',
              backgroundColor: '#f8fafc',
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#334155', textTransform: 'uppercase' }}>
              Card Collection
            </div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#1e293b', marginTop: '2px' }}>
              ₹{collectionStats.cardTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '9px', color: '#334155', marginTop: '2px', fontWeight: '600' }}>
              {collectionStats.cardCount} Card Bills
            </div>
          </div>
        </div>

        {/* Top & Best Clients Section in PDF */}
        {bestClients.length > 0 && (
          <div style={{ marginBottom: '22px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: '800',
                color: '#111827',
                textTransform: 'uppercase',
                marginBottom: '8px',
                letterSpacing: '0.5px',
                borderBottom: '2px solid #e5e7eb',
                paddingBottom: '4px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>⭐ Top &amp; Best Clients ({scopeLabel})</span>
              <span style={{ fontSize: '10px', color: '#6b7280', fontWeight: '600' }}>
                Ranked by Total Purchases
              </span>
            </div>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
                fontSize: '11px',
                marginBottom: '8px',
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: '#f3f4f6',
                    borderTop: '1px solid #d1d5db',
                    borderBottom: '1px solid #d1d5db',
                    fontWeight: '700',
                    color: '#374151',
                  }}
                >
                  <th style={{ width: '10%', padding: '6px', textAlign: 'center' }}>Rank</th>
                  <th style={{ width: '38%', padding: '6px 8px', textAlign: 'left' }}>Client Name</th>
                  <th style={{ width: '24%', padding: '6px 8px', textAlign: 'left' }}>Mobile No</th>
                  <th style={{ width: '13%', padding: '6px 8px', textAlign: 'center' }}>Visits</th>
                  <th style={{ width: '15%', padding: '6px 8px', textAlign: 'right' }}>Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {bestClients.slice(0, 8).map((client, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      color: '#1f2937',
                    }}
                  >
                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: '700' }}>
                      {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '700' }}>
                      {client.name}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'left', color: '#4b5563' }}>
                      {client.mobile}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '600' }}>
                      {client.visitCount}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: '#c2410c' }}>
                      ₹{client.totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Transactions Table */}
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
                  width: '7%',
                  padding: '9px 6px',
                  textAlign: 'center',
                  borderRight: '1px solid #9ca3af',
                }}
              >
                Sr
              </th>
              <th
                style={{
                  width: '13%',
                  padding: '9px 8px',
                  textAlign: 'center',
                  borderRight: '1px solid #9ca3af',
                }}
              >
                Date
              </th>
              <th
                style={{
                  width: '15%',
                  padding: '9px 8px',
                  textAlign: 'center',
                  borderRight: '1px solid #9ca3af',
                }}
              >
                Bill ID
              </th>
              <th
                style={{
                  width: '23%',
                  padding: '9px 10px',
                  textAlign: 'left',
                  borderRight: '1px solid #9ca3af',
                }}
              >
                Customer Name &amp; Phone
              </th>
              <th
                style={{
                  width: '27%',
                  padding: '9px 10px',
                  textAlign: 'left',
                  borderRight: '1px solid #9ca3af',
                }}
              >
                Items / Work Done
              </th>
              <th
                style={{
                  width: '15%',
                  padding: '9px 10px',
                  textAlign: 'right',
                }}
              >
                Total (₹)
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((inv, idx) => {
              const itemsList = inv.items
                .map((it) => `${it.description} (${it.qty})`)
                .join(', ')

              return (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid #d1d5db',
                    fontSize: '12px',
                    color: '#1f2937',
                  }}
                >
                  <td
                    style={{
                      padding: '8px 6px',
                      textAlign: 'center',
                      fontWeight: '700',
                      borderRight: '1px solid #e5e7eb',
                    }}
                  >
                    {idx + 1}
                  </td>
                  <td
                    style={{
                      padding: '8px 8px',
                      textAlign: 'center',
                      fontWeight: '600',
                      borderRight: '1px solid #e5e7eb',
                    }}
                  >
                    {inv.date}
                  </td>
                  <td
                    style={{
                      padding: '8px 8px',
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
                      padding: '8px 10px',
                      textAlign: 'left',
                      fontWeight: '700',
                      borderRight: '1px solid #e5e7eb',
                    }}
                  >
                    <div>{inv.customerName}</div>
                    <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '500' }}>
                      {inv.customerMobile || 'No phone'}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: '8px 10px',
                      textAlign: 'left',
                      borderRight: '1px solid #e5e7eb',
                      wordBreak: 'break-word',
                      fontSize: '11px',
                      color: '#4b5563',
                    }}
                  >
                    {itemsList || 'Radium Artwork'}
                  </td>
                  <td
                    style={{
                      padding: '8px 10px',
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
                colSpan={5}
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
                Total Period Revenue:
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
                {totalRevenue.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Footer */}
        <div
          style={{
            marginTop: '24px',
            paddingTop: '14px',
            borderTop: '1px dashed #9ca3af',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            fontSize: '11px',
            color: '#4b5563',
          }}
        >
          <div>
            <p style={{ fontWeight: '800', color: '#111827', margin: '0 0 2px 0' }}>
              Jay Mataji Redium Art &amp; Truck Show Fitting
            </p>
            <p style={{ margin: '0 0 2px 0' }}>
              Official Business Intelligence &amp; Revenue Ledger Statement
            </p>
            <p style={{ margin: 0, color: '#ea580c', fontWeight: '700' }}>
              Generated on {new Date().toLocaleString('en-GB')}
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
        <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full my-auto flex flex-col max-h-[94vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
                  Full Shop Business &amp; Sales Report
                </h2>
                <p className="text-xs text-primary font-bold uppercase tracking-wider">
                  Jay Mataji Redium Art • {scopeLabel}
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
                <span>{pdfLoading ? 'Preparing...' : 'Share Summary'}</span>
              </button>

              <button
                onClick={handleDownloadPDF}
                disabled={pdfLoading}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <span>📥</span>
                <span>{pdfLoading ? 'Generating...' : 'Download PDF Report'}</span>
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

          {/* Controls: Time Period Filter Tabs */}
          <div className="p-4 bg-gray-50 border-b flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-gray-500 mr-1">
              Select Period:
            </span>

            <button
              onClick={() => setPeriod('lifetime')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                period === 'lifetime'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              🌟 Lifetime (All Time)
            </button>

            <button
              onClick={() => setPeriod('today')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                period === 'today'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              📅 Today
            </button>

            <button
              onClick={() => setPeriod('this_week')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                period === 'this_week'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              📆 Past 7 Days
            </button>

            <button
              onClick={() => setPeriod('this_month')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                period === 'this_month'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              🗓️ This Month
            </button>

            <button
              onClick={() => setPeriod('this_year')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                period === 'this_year'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              📊 This Year
            </button>

            <button
              onClick={() => setPeriod('custom')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                period === 'custom'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              ⚙️ Custom Date Range
            </button>

            {period === 'custom' && (
              <div className="flex items-center gap-2 mt-2 sm:mt-0 ml-auto bg-white px-3 py-1 rounded-lg border border-gray-200">
                <span className="text-xs font-bold text-gray-600">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs border rounded px-2 py-0.5"
                />
                <span className="text-xs font-bold text-gray-600">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs border rounded px-2 py-0.5"
                />
              </div>
            )}
          </div>

          {/* Main Body */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
            {/* KPI Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-2xl bg-orange-50/90 border border-orange-200">
                <span className="text-[11px] font-bold uppercase text-orange-700 tracking-wider block">
                  Total Gross Revenue
                </span>
                <span className="text-xl sm:text-2xl font-black text-orange-600 mt-1 block">
                  ₹
                  {totalRevenue.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/90 border border-blue-200">
                <span className="text-[11px] font-bold uppercase text-blue-700 tracking-wider block">
                  Total Invoices Issued
                </span>
                <span className="text-xl sm:text-2xl font-black text-blue-950 mt-1 block">
                  {totalBills} bills
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200">
                <span className="text-[11px] font-bold uppercase text-emerald-700 tracking-wider block">
                  Unique Customers
                </span>
                <span className="text-xl sm:text-2xl font-black text-emerald-900 mt-1 block">
                  {uniqueCustomersCount} clients
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-purple-50/90 border border-purple-200">
                <span className="text-[11px] font-bold uppercase text-purple-700 tracking-wider block">
                  Avg. Invoice Value
                </span>
                <span className="text-xl sm:text-2xl font-black text-purple-950 mt-1 block">
                  ₹
                  {avgBillValue.toLocaleString('en-IN', {
                    minimumFractionDigits: 0,
                  })}
                </span>
              </div>
            </div>

            {/* STRUCTURE-WISE COLLECTION CARDS ON SCREEN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="p-4 rounded-2xl bg-emerald-600 text-white shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-100">
                  Paid Collection
                </span>
                <span className="text-xl sm:text-2xl font-black mt-1 block">
                  ₹{collectionStats.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-emerald-100 font-semibold mt-1 block">
                  {collectionStats.paidCount} Paid Bills
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500 text-white shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider block text-amber-100">
                  Pending (Udhar)
                </span>
                <span className="text-xl sm:text-2xl font-black mt-1 block">
                  ₹{collectionStats.totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-amber-100 font-semibold mt-1 block">
                  {collectionStats.pendingCount} Pending Bills
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-purple-600 text-white shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider block text-purple-100">
                  UPI Collection
                </span>
                <span className="text-xl sm:text-2xl font-black mt-1 block">
                  ₹{collectionStats.upiTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-purple-100 font-semibold mt-1 block">
                  {collectionStats.upiCount} UPI Bills
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-blue-600 text-white shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider block text-blue-100">
                  Cash (&quot;Case&quot;)
                </span>
                <span className="text-xl sm:text-2xl font-black mt-1 block">
                  ₹{collectionStats.cashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-blue-100 font-semibold mt-1 block">
                  {collectionStats.cashCount} Cash Bills
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800 text-white shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider block text-gray-300">
                  Card Collection
                </span>
                <span className="text-xl sm:text-2xl font-black mt-1 block">
                  ₹{collectionStats.cardTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-gray-300 font-semibold mt-1 block">
                  {collectionStats.cardCount} Card Bills
                </span>
              </div>
            </div>

            {/* Top Performing Services / Items */}
            {topItems.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-1.5">
                  <span>🏆</span> Top Revenue Works in this Period
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {topItems.slice(0, 3).map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-3 rounded-xl border border-gray-200 flex justify-between items-center"
                    >
                      <div className="overflow-hidden pr-2">
                        <p className="text-xs font-bold text-gray-900 truncate">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Qty: {item.count} units
                        </p>
                      </div>
                      <span className="text-xs font-black text-primary whitespace-nowrap">
                        ₹{item.revenue.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View Switcher Tabs: Ledger vs Best Clients */}
            <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
              <button
                type="button"
                onClick={() => setActiveTab('ledger')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
                  activeTab === 'ledger'
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>📋</span> Detailed Sales Ledger ({filteredInvoices.length} Bills)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('best_clients')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
                  activeTab === 'best_clients'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <span>⭐</span> Our Best Clients ({bestClients.length})
              </button>
            </div>

            {/* View 1: Detailed Sales Ledger */}
            {activeTab === 'ledger' && (
              <div>
                <h4 className="text-sm font-extrabold uppercase tracking-wider text-gray-700 mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span>📋</span> Detailed Sales Ledger ({filteredInvoices.length} Bills)
                  </span>
                  <span className="text-xs font-semibold text-gray-500 lowercase">
                    sorted by date descending
                  </span>
                </h4>

                <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-xs sm:text-sm text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase text-[11px]">
                        <th className="py-3 px-3 w-12 text-center">#</th>
                        <th className="py-3 px-3 w-28 text-center">Date</th>
                        <th className="py-3 px-3 w-28 text-center">Bill ID</th>
                        <th className="py-3 px-4 w-44">Customer</th>
                        <th className="py-3 px-4">Work / Items</th>
                        <th className="py-3 px-4 w-32 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredInvoices.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-12 text-center text-gray-400 font-medium"
                          >
                            No sales recorded in this period.
                          </td>
                        </tr>
                      ) : (
                        filteredInvoices.map((inv, idx) => (
                          <tr
                            key={inv.id}
                            className="hover:bg-gray-50/70 transition"
                          >
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
                            <td className="py-3 px-4">
                              <p className="font-bold text-gray-900">
                                {inv.customerName}
                              </p>
                              <p className="text-[11px] text-gray-500">
                                {inv.customerMobile || 'No phone'}
                              </p>
                            </td>
                            <td className="py-3 px-4 text-gray-700">
                              <div className="line-clamp-2">
                                {inv.items
                                  .map((it) => `${it.description} (${it.qty})`)
                                  .join(', ')}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-black text-gray-900 text-sm">
                              ₹
                              {inv.grandTotal.toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-orange-50 font-bold border-t-2 border-orange-200">
                        <td
                          colSpan={5}
                          className="py-3 px-4 text-right text-xs uppercase tracking-wider text-orange-900 font-extrabold"
                        >
                          Total Period Revenue:
                        </td>
                        <td className="py-3 px-4 text-right text-base font-black text-orange-600">
                          ₹
                          {totalRevenue.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* View 2: Our Best Clients (Top Customers) */}
            {activeTab === 'best_clients' && (
              <div>
                <h4 className="text-sm font-extrabold uppercase tracking-wider text-gray-700 mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span>⭐</span> Ranked Top Clients &amp; Repeat Customers ({bestClients.length})
                  </span>
                  <span className="text-xs font-semibold text-gray-500">
                    Highest spenders for {scopeLabel}
                  </span>
                </h4>

                <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-xs sm:text-sm text-left border-collapse">
                    <thead>
                      <tr className="bg-amber-50 border-b border-amber-200 text-amber-950 font-bold uppercase text-[11px]">
                        <th className="py-3 px-3 w-16 text-center">Rank</th>
                        <th className="py-3 px-4 w-48">Client Name</th>
                        <th className="py-3 px-4 w-36">Mobile No</th>
                        <th className="py-3 px-3 w-24 text-center">Visits / Bills</th>
                        <th className="py-3 px-4 w-32 text-center">Last Purchase</th>
                        <th className="py-3 px-3 w-28 text-center">% Revenue</th>
                        <th className="py-3 px-4 w-36 text-right">Total Purchases (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bestClients.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-12 text-center text-gray-400 font-medium"
                          >
                            No client transactions recorded in this period.
                          </td>
                        </tr>
                      ) : (
                        bestClients.map((client, idx) => {
                          const revenuePercent =
                            totalRevenue > 0
                              ? ((client.totalSpent / totalRevenue) * 100).toFixed(1)
                              : '0.0'

                          return (
                            <tr
                              key={idx}
                              className={`transition ${
                                idx === 0
                                  ? 'bg-amber-50/40 hover:bg-amber-50/70 font-semibold'
                                  : idx === 1
                                  ? 'bg-orange-50/20 hover:bg-orange-50/50'
                                  : 'hover:bg-gray-50/70'
                              }`}
                            >
                              <td className="py-3 px-3 text-center font-bold">
                                {idx === 0 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-400 text-amber-950 shadow-sm">
                                    🥇 #1
                                  </span>
                                ) : idx === 1 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold bg-slate-300 text-slate-800 shadow-sm">
                                    🥈 #2
                                  </span>
                                ) : idx === 2 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-700/20 text-amber-900 shadow-sm">
                                    🥉 #3
                                  </span>
                                ) : (
                                  <span className="text-gray-500 font-bold text-xs">
                                    #{idx + 1}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-bold text-gray-900 text-sm">
                                {client.name}
                              </td>
                              <td className="py-3 px-4 font-semibold text-gray-600">
                                {client.mobile !== 'Not recorded' ? (
                                  <a
                                    href={`https://wa.me/91${client.mobile.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-700 hover:underline flex items-center gap-1 font-bold"
                                  >
                                    <span>💬</span> {client.mobile}
                                  </a>
                                ) : (
                                  <span className="text-gray-400 font-normal">N/A</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="px-2.5 py-1 bg-gray-100 rounded-full font-bold text-xs text-gray-800">
                                  {client.visitCount} visit{client.visitCount !== 1 ? 's' : ''}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center text-xs font-medium text-gray-600">
                                {client.lastVisit}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-800 font-extrabold rounded-md text-xs">
                                  {revenuePercent}%
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-black text-orange-600 text-sm">
                                ₹
                                {client.totalSpent.toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-amber-100/60 font-bold border-t-2 border-amber-300">
                        <td
                          colSpan={6}
                          className="py-3 px-4 text-right text-xs uppercase tracking-wider text-amber-950 font-extrabold"
                        >
                          Total Revenue from Top Clients:
                        </td>
                        <td className="py-3 px-4 text-right text-base font-black text-amber-800">
                          ₹
                          {totalRevenue.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
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
              <span>{pdfLoading ? 'Generating...' : 'Download Shop Report (PDF)'}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

