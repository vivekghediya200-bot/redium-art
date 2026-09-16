'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export interface InvoiceItemForm {
  sr: number
  description: string
  qty: number | string
  rate: number | string
  total: number
}

interface InvoiceModalProps {
  initialCustomerName?: string
  initialCustomerMobile?: string
  existingInvoice?: any
  onClose: () => void
  onSuccess: () => void
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

export default function InvoiceModal({
  initialCustomerName = '',
  initialCustomerMobile = '',
  existingInvoice,
  onClose,
  onSuccess,
}: InvoiceModalProps) {
  const [customerName, setCustomerName] = useState(
    existingInvoice ? existingInvoice.customerName : initialCustomerName
  )
  const [customerMobile, setCustomerMobile] = useState(
    existingInvoice ? existingInvoice.customerMobile : initialCustomerMobile
  )
  const [knownCustomers, setKnownCustomers] = useState<
    Array<{ name: string; mobile: string; totalSpent: number }>
  >([])
  const [isNameFocused, setIsNameFocused] = useState(false)
  const customerInputRef = useRef<HTMLDivElement>(null)

  const [date, setDate] = useState(
    existingInvoice
      ? existingInvoice.date
      : new Date().toISOString().split('T')[0]
  )
  const [items, setItems] = useState<InvoiceItemForm[]>(
    existingInvoice && existingInvoice.items?.length > 0
      ? existingInvoice.items
      : [
          { sr: 1, description: '', qty: 1, rate: '', total: 0 },
          { sr: 2, description: '', qty: 1, rate: '', total: 0 },
          { sr: 3, description: '', qty: 1, rate: '', total: 0 },
        ]
  )
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareNotice, setShareNotice] = useState<string | null>(null)

  const pdfTemplateRef = useRef<HTMLDivElement>(null)

  // Fetch customers for fast autocomplete in customer name field
  useEffect(() => {
    const fetchKnown = async () => {
      try {
        const token = localStorage.getItem('adminToken')
        const res = await fetch('/api/admin/customers', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setKnownCustomers(
            data.map((c: any) => ({
              name: c.name || '',
              mobile: c.mobile || '',
              totalSpent: c.totalSpent || 0,
            }))
          )
        }
      } catch (err) {
        console.error('Error loading customers for autocomplete:', err)
      }
    }
    fetchKnown()
  }, [])

  // Close customer name suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        customerInputRef.current &&
        !customerInputRef.current.contains(e.target as Node)
      ) {
        setIsNameFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Dynamic suggestions matching typed text (e.g. 'vi')
  const nameSuggestions = useMemo(() => {
    const q = customerName.trim().toLowerCase()
    if (!q || existingInvoice) return []
    return knownCustomers
      .filter(
        (c) =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.mobile || '').includes(q)
      )
      .sort((a, b) => {
        const aExact = a.name.toLowerCase().startsWith(q)
        const bExact = b.name.toLowerCase().startsWith(q)
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        return b.totalSpent - a.totalSpent
      })
      .slice(0, 5)
  }, [customerName, knownCustomers, existingInvoice])

  // Sync state if existingInvoice changes
  useEffect(() => {
    if (existingInvoice) {
      setCustomerName(existingInvoice.customerName || '')
      setCustomerMobile(existingInvoice.customerMobile || '')
      setDate(
        existingInvoice.date || new Date().toISOString().split('T')[0]
      )
      if (existingInvoice.items && existingInvoice.items.length > 0) {
        setItems(existingInvoice.items)
      }
    }
  }, [existingInvoice])

  // Recalculate item totals
  const handleItemChange = (
    index: number,
    field: keyof InvoiceItemForm,
    value: any
  ) => {
    const updated = [...items]
    const item = { ...updated[index], [field]: value }

    const qty = parseFloat(String(item.qty)) || 0
    const rate = parseFloat(String(item.rate)) || 0
    item.total = Number((qty * rate).toFixed(2))

    updated[index] = item
    setItems(updated)
  }

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      { sr: prev.length + 1, description: '', qty: 1, rate: '', total: 0 },
    ])
  }

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return
    const filtered = items.filter((_, i) => i !== index)
    const reindexed = filtered.map((it, idx) => ({ ...it, sr: idx + 1 }))
    setItems(reindexed)
  }

  const grandTotal = items.reduce((acc, it) => acc + (it.total || 0), 0)

  // Generate & Download PDF using high-resolution structured template
  const handleDownloadPDF = async (): Promise<{
    fileName: string
    blob: Blob
  } | null> => {
    setPdfLoading(true)
    setError(null)
    try {
      // Auto-save bill to history if new
      const validItems = items.filter(
        (it) => it.description && it.description.trim() !== ''
      )
      if (customerName.trim() && validItems.length > 0 && !existingInvoice?.id) {
        try {
          const token = localStorage.getItem('adminToken')
          await fetch('/api/admin/invoices', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              customerName: customerName.trim(),
              customerMobile: customerMobile.trim(),
              date,
              items: validItems.map((it) => ({
                description: it.description.trim(),
                qty: Number(it.qty) || 1,
                rate: Number(it.rate) || 0,
              })),
            }),
          })
          onSuccess()
        } catch (saveErr) {
          console.error('Auto-save error:', saveErr)
        }
      }

      const element = document.getElementById('invoice-pdf-render-zone')
      if (!element) {
        throw new Error('Printable invoice template not found')
      }

      // Wait for any images inside the template to load (with timeout safety)
      const images = Array.from(element.getElementsByTagName('img'))
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve()
          return new Promise((resolve) => {
            img.onload = resolve
            img.onerror = resolve
            setTimeout(resolve, 600)
          })
        })
      )

      const canvas = await html2canvas(element, {
        scale: 2, // High resolution crisp export
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 800,
        windowWidth: 800,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('invoice-pdf-render-zone')
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

      const margin = 6 // 6mm margin
      const contentWidth = pageWidth - margin * 2
      const contentHeight = (canvas.height * contentWidth) / canvas.width

      if (contentHeight <= pageHeight - margin * 2) {
        // Fits comfortably on a single A4 page
        pdf.addImage(
          imgData,
          'JPEG',
          margin,
          margin,
          contentWidth,
          contentHeight
        )
      } else {
        // Multi-page export if invoice has many items
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

      const billId = existingInvoice?.id || 'BILL'
      const cleanName = (customerName || 'Customer').replace(
        /[^a-zA-Z0-9]/g,
        '_'
      )
      const fileName = `${billId}_${cleanName}.pdf`

      const blob = pdf.output('blob')
      await saveOrDownloadBlob(blob, fileName)
      return { fileName, blob }
    } catch (err: any) {
      console.error('PDF generation error:', err)
      setError(`Failed to generate PDF: ${err?.message || 'Error occurred'}`)
      return null
    } finally {
      setPdfLoading(false)
    }
  }

  // Share Directly to WhatsApp with pre-filled manual bill & selected folder PDF save
  const handleShareWhatsApp = async () => {
    if (!customerName.trim()) {
      setError('Please provide customer name')
      return
    }

    setShareNotice(null)

    // 1. Prompt folder selector and save PDF first!
    let savedPdfName = ''
    try {
      const result = await handleDownloadPDF()
      if (result) {
        savedPdfName = result.fileName
      }
    } catch (pdfErr) {
      console.error('Error generating PDF for WhatsApp share:', pdfErr)
    }

    // 2. Format detailed manual bill text for WhatsApp
    const billId = existingInvoice?.id || 'NEW_BILL'
    const validItems = items.filter(
      (it) => it.description && it.description.trim() !== ''
    )

    const itemsText = validItems
      .map(
        (it, i) =>
          `${i + 1}. *${it.description}*\n   Qty: ${it.qty} × ₹${Number(
            it.rate
          ).toFixed(2)} = ₹${Number(it.total).toFixed(2)}`
      )
      .join('\n')

    const message = `🧾 *JAY MATAJI REDIUM ART & TRUCK SHOW FITTING*
📍 Porbandar Khambhaliya highway bokhira, Near Vachhrajdada Temple, Porbandar 360575
📞 Contact: 6353016927
━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 *BILL / INVOICE: ${billId}*
📅 *Date:* ${date}
👤 *Customer:* ${customerName}
${customerMobile ? `📱 *Mobile:* ${customerMobile}\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━
*ITEMIZED BILL:*
${itemsText || '1. Redium Artwork & Vehicle Fitting Services - ₹' + grandTotal.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *GRAND TOTAL:* ₹${grandTotal.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🙏 *Thank you for choosing Jay Mataji Redium Art!*
📄 _Your official PDF invoice has been saved to your selected folder._`

    let phone = (customerMobile || '').replace(/\D/g, '')
    if (phone.length === 10) {
      phone = '91' + phone
    }

    // 3. Attempt to copy bill image to clipboard for instant Ctrl+V into WhatsApp
    try {
      const element = document.getElementById('invoice-pdf-render-zone')
      if (element && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const canvas = await html2canvas(element, { scale: 1.5, backgroundColor: '#ffffff', logging: false, width: 800 })
        canvas.toBlob(async (imgBlob) => {
          if (imgBlob) {
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': imgBlob })
              ])
            } catch (cErr) {
              console.warn('Clipboard write error:', cErr)
            }
          }
        }, 'image/png')
      }
    } catch (e) {
      console.warn('Clipboard image preparation warning:', e)
    }

    // 4. Open WhatsApp Application directly using whatsapp:// URI scheme
    const waAppUrl = phone
      ? `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`
      : `whatsapp://send?text=${encodeURIComponent(message)}`

    const waLink = document.createElement('a')
    waLink.href = waAppUrl
    document.body.appendChild(waLink)
    waLink.click()
    document.body.removeChild(waLink)

    setShareNotice(
      `✅ PDF ${savedPdfName ? `"${savedPdfName}"` : ''} saved to your selected folder! WhatsApp Application opened. In WhatsApp, press Ctrl+V to send the bill image, or attach the saved PDF!`
    )
  }

  const handleSave = async () => {
    if (!customerName.trim()) {
      setError('Customer name is required')
      return
    }

    const validItems = items.filter(
      (it) => it.description && it.description.trim() !== ''
    )
    if (validItems.length === 0) {
      setError('Please add at least one item description')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem('adminToken')
      if (!token) {
        setError('Admin session expired. Please log in again.')
        setTimeout(() => {
          window.location.href = '/admin'
        }, 1500)
        return
      }

      const url = existingInvoice?.id
        ? `/api/admin/invoices/${existingInvoice.id}`
        : '/api/admin/invoices'
      const method = existingInvoice?.id ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerMobile: customerMobile.trim(),
          date,
          items: validItems.map((it) => ({
            description: it.description.trim(),
            qty: Number(it.qty) || 1,
            rate: Number(it.rate) || 0,
          })),
        }),
      })

      if (response.status === 401) {
        localStorage.removeItem('adminToken')
        setError('Admin session expired. Please log in again.')
        setTimeout(() => {
          window.location.href = '/admin'
        }, 1500)
        return
      }

      if (response.ok) {
        onSuccess()
        onClose()
      } else {
        const data = await response.json().catch(() => ({}))
        setError(data.message || 'Failed to save bill')
      }
    } catch (err: any) {
      console.error('Error saving invoice:', err)
      setError(`Failed to save bill: ${err?.message || 'Network error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* =========================================================================
          1. DEDICATED OFF-SCREEN A4 TEMPLATE FOR PIXEL-PERFECT PDF GENERATION
          - Fixed 800px width (Standard A4 ratio)
          - No inputs, no scrollbars, no responsive collapses
          - Guaranteed no hidden rows, columns, or words
          - High resolution brand logo included
         ========================================================================= */}
      <div
        id="invoice-pdf-render-zone"
        ref={pdfTemplateRef}
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
        {/* Invoice Top Header */}
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
                  backgroundColor: '#000000',
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
                    letterSpacing: '0.5px',
                  }}
                >
                  <span style={{ color: '#dc2626' }}>J</span>AY{' '}
                  <span style={{ color: '#dc2626' }}>M</span>ATAJI{' '}
                  <span style={{ color: '#dc2626' }}>R</span>EDIUM ART &amp;
                </h1>
                <h2
                  style={{
                    fontSize: '18px',
                    fontWeight: '800',
                    margin: '3px 0 0 0',
                    color: '#374151',
                    letterSpacing: '1px',
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
                    letterSpacing: '0.8px',
                  }}
                >
                  Truck Show Fitting • Vehicle Wraps • Radium Art • Number Plates
                </p>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontSize: '26px',
                  fontWeight: '900',
                  color: '#075985',
                  letterSpacing: '2px',
                }}
              >
                INVOICE
              </div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#4b5563',
                  marginTop: '4px',
                }}
              >
                Bill No:{' '}
                <span style={{ color: '#111827' }}>
                  {existingInvoice?.id || 'BILL'}
                </span>
              </div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#4b5563',
                }}
              >
                Date:{' '}
                <span style={{ color: '#111827' }}>
                  {date}
                </span>
              </div>
            </div>
          </div>

          {/* Shop Details Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#374151',
              marginTop: '14px',
              paddingTop: '12px',
              borderTop: '1px solid #e5e7eb',
            }}
          >
            <div>
              <strong>Mobile No.:</strong>{' '}
              <span style={{ fontWeight: '800', color: '#111827' }}>
                6353016927
              </span>
            </div>
            <div style={{ textAlign: 'right', maxWidth: '440px' }}>
              <strong>Address:</strong> Porbandar Khambhaliya highway, Near
              Vachhrajdada Temple, Bokhira, Porbandar - 360575
            </div>
          </div>
        </div>

        {/* Customer Information Box */}
        <div
          style={{
            backgroundColor: '#f9fafb',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            padding: '12px 18px',
            marginBottom: '18px',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '13px',
          }}
        >
          <div>
            <span
              style={{
                color: '#6b7280',
                fontWeight: '700',
                textTransform: 'uppercase',
                fontSize: '11px',
                display: 'block',
              }}
            >
              Billed To (Customer Name):
            </span>
            <span
              style={{
                fontSize: '15px',
                fontWeight: '800',
                color: '#111827',
                marginTop: '2px',
                display: 'block',
              }}
            >
              {customerName || 'Customer'}
            </span>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                color: '#6b7280',
                fontWeight: '700',
                textTransform: 'uppercase',
                fontSize: '11px',
                display: 'block',
              }}
            >
              Customer Mobile:
            </span>
            <span
              style={{
                fontSize: '15px',
                fontWeight: '800',
                color: '#111827',
                marginTop: '2px',
                display: 'block',
              }}
            >
              {customerMobile || 'Not Provided'}
            </span>
          </div>
        </div>

        {/* Structured Table: All columns strictly sized so nothing is hidden */}
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
                  padding: '10px 6px',
                  textAlign: 'center',
                  borderRight: '1px solid #9ca3af',
                }}
              >
                Sr
              </th>
              <th
                style={{
                  width: '50%',
                  padding: '10px 12px',
                  textAlign: 'left',
                  borderRight: '1px solid #9ca3af',
                }}
              >
                Description of Work / Items
              </th>
              <th
                style={{
                  width: '12%',
                  padding: '10px 8px',
                  textAlign: 'center',
                  borderRight: '1px solid #9ca3af',
                }}
              >
                Qty
              </th>
              <th
                style={{
                  width: '15%',
                  padding: '10px 10px',
                  textAlign: 'right',
                  borderRight: '1px solid #9ca3af',
                }}
              >
                Rate (₹)
              </th>
              <th
                style={{
                  width: '15%',
                  padding: '10px 12px',
                  textAlign: 'right',
                }}
              >
                Total (₹)
              </th>
            </tr>
          </thead>
          <tbody>
            {items
              .filter((it) => it.description && it.description.trim() !== '')
              .map((item, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid #d1d5db',
                    fontSize: '13px',
                    color: '#1f2937',
                  }}
                >
                  <td
                    style={{
                      padding: '10px 6px',
                      textAlign: 'center',
                      fontWeight: '700',
                      borderRight: '1px solid #e5e7eb',
                    }}
                  >
                    {item.sr || idx + 1}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontWeight: '700',
                      borderRight: '1px solid #e5e7eb',
                      wordBreak: 'break-word',
                      lineHeight: '1.4',
                    }}
                  >
                    {item.description}
                  </td>
                  <td
                    style={{
                      padding: '10px 8px',
                      textAlign: 'center',
                      borderRight: '1px solid #e5e7eb',
                      fontWeight: '600',
                    }}
                  >
                    {item.qty}
                  </td>
                  <td
                    style={{
                      padding: '10px 10px',
                      textAlign: 'right',
                      borderRight: '1px solid #e5e7eb',
                      fontWeight: '600',
                    }}
                  >
                    ₹{Number(item.rate || 0).toFixed(2)}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      fontWeight: '800',
                      color: '#111827',
                    }}
                  >
                    ₹{Number(item.total || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
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
                colSpan={3}
                style={{
                  padding: '12px 14px',
                  fontWeight: '800',
                  fontSize: '13px',
                  textAlign: 'right',
                  textTransform: 'uppercase',
                  borderRight: '1px solid #d1d5db',
                  color: '#374151',
                }}
              >
                Grand Total Amount:
              </td>
              <td
                colSpan={2}
                style={{
                  padding: '12px 14px',
                  textAlign: 'right',
                  fontWeight: '900',
                  fontSize: '18px',
                  color: '#ea580c',
                }}
              >
                ₹
                {grandTotal.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Footer & Terms */}
        <div
          style={{
            marginTop: '28px',
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
                fontWeight: '700',
                color: '#111827',
                margin: '0 0 3px 0',
              }}
            >
              Terms &amp; Conditions:
            </p>
            <p style={{ margin: '0 0 2px 0' }}>
              • Goods once sold will not be returned or exchanged.
            </p>
            <p style={{ margin: '0 0 4px 0' }}>
              • Specialised in Custom Radium Fitting, Reflective Decals &amp; Truck Art.
            </p>
            <p
              style={{
                margin: 0,
                color: '#ea580c',
                fontWeight: '700',
                fontSize: '12px',
              }}
            >
              🙏 Thank you for choosing Jay Mataji Redium Art!
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
          2. INTERACTIVE MODAL DIALOG (FOR ON-SCREEN EDITING)
         ========================================================================= */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:h-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-auto flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:w-full print:rounded-none overflow-hidden">
          {/* Modal Toolbar */}
          <div className="p-4 border-b flex flex-wrap justify-between items-center bg-gray-50 rounded-t-2xl gap-3 print:hidden">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🧾</span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                  {existingInvoice
                    ? `Bill No: ${existingInvoice.id}`
                    : 'Create New Bill / Invoice'}
                </h2>
                <p className="text-xs text-gray-500">
                  Jay Mataji Redium Art &amp; Show Fitting
                </p>
              </div>
            </div>

            {/* Action Buttons: WhatsApp Share & Download PDF */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleShareWhatsApp}
                disabled={pdfLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <span>📲</span>
                <span>
                  {pdfLoading ? 'Generating...' : 'Share on WhatsApp (PDF)'}
                </span>
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
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2 ml-1"
                title="Close"
              >
                ×
              </button>
            </div>
          </div>

          {error && (
            <div className="m-4 mb-0 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl print:hidden flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {shareNotice && (
            <div className="m-4 mb-0 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <span>{shareNotice}</span>
              </div>
              <button
                onClick={() => setShareNotice(null)}
                className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
              >
                ×
              </button>
            </div>
          )}

          {/* Interactive Screen Editing Area */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 font-sans text-gray-900 bg-white">
            {/* Header Box with Brand Logo */}
            <div className="border-b-2 border-gray-800 pb-4 mb-4">
              <div className="flex justify-between items-start flex-wrap gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-black flex items-center justify-center p-1 border border-gray-200 shadow-sm flex-shrink-0">
                    <img
                      src="/images/logo.png"
                      alt="Jay Mataji Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-xl font-extrabold tracking-wide text-gray-900 leading-tight">
                      <span className="text-red-600">J</span>AY{' '}
                      <span className="text-red-600">M</span>ATAJI{' '}
                      <span className="text-red-600">R</span>EDIUM ART &amp;
                    </h1>
                    <h2 className="text-base sm:text-lg font-bold tracking-wider text-gray-800">
                      SHOW FITTING
                    </h2>
                    <p className="text-[10px] text-primary font-bold uppercase tracking-wider">
                      Porbandar, Gujarat • 6353016927
                    </p>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <span className="text-xl sm:text-2xl font-black tracking-widest text-sky-800 uppercase">
                    INVOICE
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs font-bold text-gray-700">DATE:</span>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="font-bold border border-gray-300 rounded-lg px-2 py-0.5 text-xs text-gray-900 focus:outline-none focus:border-primary"
                    />
                  </div>
                  {existingInvoice?.id && (
                    <p className="text-xs font-semibold text-gray-500 mt-1">
                      Bill No: {existingInvoice.id}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Customer Input Fields */}
            <div className="grid sm:grid-cols-2 gap-3 mb-5 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
              <div ref={customerInputRef} className="relative">
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Customer Name:
                </label>
                <input
                  type="text"
                  placeholder="Enter Customer Name (e.g. type 'vi')"
                  value={customerName}
                  onFocus={() => setIsNameFocused(true)}
                  onChange={(e) => {
                    setCustomerName(e.target.value)
                    setIsNameFocused(true)
                  }}
                  className="w-full font-bold text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 focus:border-primary focus:outline-none text-sm bg-white shadow-sm"
                />

                {/* Live Client Autocomplete Dropdown */}
                {isNameFocused && nameSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-orange-200 overflow-hidden z-50 divide-y divide-gray-100">
                    <div className="px-3 py-1 bg-orange-50/90 text-[10px] font-bold text-orange-900 flex justify-between items-center">
                      <span>Existing Customers</span>
                      <span className="text-[9px] text-orange-700">Click to autofill</span>
                    </div>
                    {nameSuggestions.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setCustomerName(sug.name)
                          if (sug.mobile) setCustomerMobile(sug.mobile)
                          setIsNameFocused(false)
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-orange-50 flex items-center justify-between text-xs transition"
                      >
                        <span className="font-bold text-gray-900">{sug.name}</span>
                        <span className="text-gray-500 text-[11px]">
                          {sug.mobile ? `📞 ${sug.mobile}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Mobile Number:
                </label>
                <input
                  type="text"
                  placeholder="Enter Mobile No."
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                  className="w-full font-semibold text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 focus:border-primary focus:outline-none text-sm bg-white"
                />
              </div>
            </div>

            {/* Itemized Table */}
            <div className="border border-gray-800 rounded-lg overflow-hidden mb-3">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-200 border-b border-gray-800 text-gray-900 font-bold uppercase">
                    <th className="py-2.5 px-2 border-r border-gray-800 w-12 text-center">
                      Sr
                    </th>
                    <th className="py-2.5 px-3 border-r border-gray-800">
                      DESCRIPTION OF WORK
                    </th>
                    <th className="py-2.5 px-2 border-r border-gray-800 w-20 text-center">
                      QTY
                    </th>
                    <th className="py-2.5 px-3 border-r border-gray-800 w-28 text-right">
                      RATE (₹)
                    </th>
                    <th className="py-2.5 px-3 w-32 text-right">
                      TOTAL (₹)
                    </th>
                    <th className="py-2.5 px-2 w-10 text-center print:hidden"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-300 hover:bg-gray-50/80"
                    >
                      <td className="py-1.5 px-2 border-r border-gray-800 text-center font-bold text-gray-700">
                        {item.sr}
                      </td>
                      <td className="py-1 px-2 border-r border-gray-800">
                        <input
                          type="text"
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              'description',
                              e.target.value
                            )
                          }
                          className="w-full px-2 py-1 font-semibold text-gray-900 border border-gray-200 focus:border-primary focus:outline-none rounded"
                        />
                      </td>
                      <td className="py-1 px-1 border-r border-gray-800 text-center">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.qty}
                          onChange={(e) =>
                            handleItemChange(index, 'qty', e.target.value)
                          }
                          className="w-full text-center px-1 py-1 font-bold text-gray-900 border border-gray-200 focus:border-primary focus:outline-none rounded"
                        />
                      </td>
                      <td className="py-1 px-2 border-r border-gray-800 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.00"
                          value={item.rate}
                          onChange={(e) =>
                            handleItemChange(index, 'rate', e.target.value)
                          }
                          className="w-full text-right px-1 py-1 font-bold text-gray-900 border border-gray-200 focus:border-primary focus:outline-none rounded"
                        />
                      </td>
                      <td className="py-1.5 px-3 text-right font-black text-gray-900">
                        ₹
                        {item.total > 0
                          ? item.total.toFixed(2)
                          : '0.00'}
                      </td>
                      <td className="py-1 px-1 text-center print:hidden">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItemRow(index)}
                            className="text-red-500 hover:text-red-700 font-bold px-1.5 py-0.5 rounded hover:bg-red-50"
                            title="Delete row"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add Row Button */}
            <div className="mb-4 flex justify-between items-center print:hidden">
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs font-bold text-primary hover:text-secondary flex items-center gap-1.5 border border-dashed border-primary px-3 py-1.5 rounded-lg transition hover:bg-orange-50"
              >
                <span>➕</span> Add Another Item Row
              </button>
              <span className="text-xs text-gray-500">
                Qty × Rate calculates automatically
              </span>
            </div>

            {/* Grand Total Summary Box */}
            <div className="flex justify-end mt-4">
              <div className="w-72 border-2 border-gray-800 rounded-xl p-3.5 bg-gray-50">
                <div className="flex justify-between items-center text-sm font-bold text-primary">
                  <span className="text-sm uppercase tracking-wider text-gray-700 font-extrabold">
                    Grand Total:
                  </span>
                  <span className="text-2xl font-black text-orange-600">
                    ₹
                    {grandTotal.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Actions Footer */}
          <div className="p-4 border-t bg-gray-50 flex flex-wrap sm:flex-nowrap gap-3 rounded-b-2xl print:hidden">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || pdfLoading}
              className="w-full sm:w-auto px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition text-sm"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={loading || pdfLoading}
              className="flex-1 py-2.5 bg-primary hover:bg-orange-700 text-white font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 text-sm disabled:opacity-50"
            >
              <span>💾</span>
              <span>{loading ? 'Saving...' : 'Save Bill'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={loading || pdfLoading}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 text-sm disabled:opacity-50"
            >
              <span>📥</span>
              <span>{pdfLoading ? 'Generating...' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={loading || pdfLoading}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 text-sm disabled:opacity-50"
            >
              <span>📲</span>
              <span>Share on WhatsApp (PDF)</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
