'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import InvoiceModal from './InvoiceModal'
import CustomerReportModal from './CustomerReportModal'
import ShopReportModal from './ShopReportModal'

export interface CustomerData {
  id: string
  name: string
  mobile: string
  visitCount: number
  totalSpent: number
  lastVisit: string
  createdAt: string
  invoices: Array<{
    id: string
    date: string
    items: Array<{
      sr: number
      description: string
      qty: number
      rate: number
      total: number
    }>
    grandTotal: number
    viaCustomer?: string
    paymentStatus?: 'PAID' | 'PENDING'
    paymentMethod?: 'CASH' | 'UPI' | 'CARD'
  }>
}

export default function CustomerHistoryView() {
  const [customers, setCustomers] = useState<CustomerData[]>([])
  const [allCustomers, setAllCustomers] = useState<CustomerData[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)

  // Edit / Delete customer states
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false)
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null)
  const [editCustomerName, setEditCustomerName] = useState('')
  const [editCustomerMobile, setEditCustomerMobile] = useState('')
  const [isSavingCustomer, setIsSavingCustomer] = useState(false)
  const [isDeletingCustomer, setIsDeletingCustomer] = useState<string | null>(null)

  // Modals state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showCustomerReportModal, setShowCustomerReportModal] = useState(false)
  const [showShopReportModal, setShowShopReportModal] = useState(false)
  const [activeInvoiceForPrint, setActiveInvoiceForPrint] = useState<any | null>(null)
  const [prefilledCustomer, setPrefilledCustomer] = useState<{
    name: string
    mobile: string
  } | null>(null)

  // View Mode: 'collection' (Structure-wise All Bills & Collection) vs 'directory' (Customers Directory)
  const [viewMode, setViewMode] = useState<'collection' | 'directory'>('collection')

  // Date Range and Filter states for structured collection
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom'>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL')
  const [methodFilter, setMethodFilter] = useState<'ALL' | 'UPI' | 'CASH' | 'CARD'>('ALL')

  const applyDatePreset = (preset: 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom') => {
    setDatePreset(preset)
    const today = new Date().toISOString().split('T')[0]
    if (preset === 'today') {
      setStartDate(today)
      setEndDate(today)
    } else if (preset === 'yesterday') {
      const y = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      setStartDate(y)
      setEndDate(y)
    } else if (preset === 'this_week') {
      const w = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      setStartDate(w)
      setEndDate(today)
    } else if (preset === 'this_month') {
      const d = new Date()
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
      setStartDate(mStart)
      setEndDate(today)
    } else if (preset === 'all') {
      setStartDate('')
      setEndDate('')
    }
  }

  const searchBoxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchCustomers()
  }, [])

  // Close suggestions if clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchCustomers = async (query = '') => {
    try {
      setLoading(true)
      const token = localStorage.getItem('adminToken')
      const url = query
        ? `/api/admin/customers?q=${encodeURIComponent(query)}`
        : '/api/admin/customers'
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        localStorage.removeItem('adminToken')
        window.location.href = '/admin'
        return
      }
      if (res.ok) {
        const data = await res.json()
        setCustomers(data)
        if (!query) {
          setAllCustomers(data)
        }
        if (data.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(data[0].id)
        }
      }
    } catch (err) {
      console.error('Error fetching customers:', err)
    } finally {
      setLoading(false)
    }
  }

  // Live matching client suggestions prioritizing prefix and best clients
  const liveSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    const pool = allCustomers.length > 0 ? allCustomers : customers
    return pool
      .filter(
        (c) =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.mobile || '').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const aName = (a.name || '').toLowerCase()
        const bName = (b.name || '').toLowerCase()

        // 1. Exact name prefix match (e.g. 'vi' matches 'Vivek')
        const aExact = aName.startsWith(q)
        const bExact = bName.startsWith(q)
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1

        // 2. Word prefix match
        const aWord = aName.split(/\s+/).some((w) => w.startsWith(q))
        const bWord = bName.split(/\s+/).some((w) => w.startsWith(q))
        if (aWord && !bWord) return -1
        if (!aWord && bWord) return 1

        // 3. Priority: Highest lifetime spenders
        if (b.totalSpent !== a.totalSpent) {
          return b.totalSpent - a.totalSpent
        }
        return b.visitCount - a.visitCount
      })
      .slice(0, 6)
  }, [searchQuery, allCustomers, customers])

  const handleSelectSuggestion = (c: CustomerData) => {
    setSearchQuery(c.name)
    setSelectedCustomerId(c.id)
    setIsSearchFocused(false)
    fetchCustomers(c.name)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSearchFocused(false)
    fetchCustomers(searchQuery)
  }

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm(`Are you sure you want to delete bill ${invoiceId}? This cannot be undone.`)) return

    try {
      setDeleteLoading(invoiceId)
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        // Optimistically remove invoice from UI
        setCustomers((prev) =>
          prev.map((cust) => {
            const hasInv = cust.invoices.some((inv) => inv.id === invoiceId)
            if (!hasInv) return cust
            const updatedInvoices = cust.invoices.filter((inv) => inv.id !== invoiceId)
            const updatedSpent = updatedInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0)
            return {
              ...cust,
              invoices: updatedInvoices,
              visitCount: updatedInvoices.length,
              totalSpent: updatedSpent,
            }
          })
        )
        setAllCustomers((prev) =>
          prev.map((cust) => {
            const hasInv = cust.invoices.some((inv) => inv.id === invoiceId)
            if (!hasInv) return cust
            const updatedInvoices = cust.invoices.filter((inv) => inv.id !== invoiceId)
            const updatedSpent = updatedInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0)
            return {
              ...cust,
              invoices: updatedInvoices,
              visitCount: updatedInvoices.length,
              totalSpent: updatedSpent,
            }
          })
        )
        fetchCustomers(searchQuery)
      } else {
        const errData = await res.json().catch(() => ({}))
        alert(errData.message || 'Failed to delete invoice')
      }
    } catch (err) {
      console.error('Error deleting invoice:', err)
      alert('Error occurred while deleting invoice')
    } finally {
      setDeleteLoading(null)
    }
  }

  const handleDeleteCustomer = async (cust: CustomerData) => {
    const billCount = cust.invoices.length
    const confirmMessage =
      billCount > 0
        ? `Are you sure you want to permanently delete client "${cust.name}" and all ${billCount} bill(s)? This cannot be undone.`
        : `Are you sure you want to permanently delete client "${cust.name}"? This cannot be undone.`

    if (!window.confirm(confirmMessage)) return

    try {
      setIsDeletingCustomer(cust.id)
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/admin/customers/${cust.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const remaining = customers.filter((c) => c.id !== cust.id)
        setCustomers(remaining)
        setAllCustomers((prev) => prev.filter((c) => c.id !== cust.id))
        if (selectedCustomerId === cust.id) {
          setSelectedCustomerId(remaining.length > 0 ? remaining[0].id : null)
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        alert(errData.message || 'Failed to delete customer')
      }
    } catch (err) {
      console.error('Error deleting customer:', err)
      alert('Error occurred while deleting customer')
    } finally {
      setIsDeletingCustomer(null)
    }
  }

  const handleSaveCustomerEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editCustomerId) return
    const trimmedName = editCustomerName.trim()
    const trimmedMobile = editCustomerMobile.trim()

    if (!trimmedName) {
      alert('Please enter a customer name')
      return
    }

    try {
      setIsSavingCustomer(true)
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/admin/customers/${editCustomerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: trimmedName, mobile: trimmedMobile }),
      })

      if (res.ok) {
        const data = await res.json()
        const updated = data.customer

        const updateList = (list: CustomerData[]) =>
          list.map((c) => {
            if (c.id !== editCustomerId) return c
            return {
              ...c,
              name: updated.name,
              mobile: updated.mobile,
              invoices: c.invoices.map((inv) => ({
                ...inv,
                customerName: updated.name,
                customerMobile: updated.mobile,
              })),
            }
          })

        setCustomers(updateList)
        setAllCustomers(updateList)
        setShowEditCustomerModal(false)
      } else {
        const errData = await res.json().catch(() => ({}))
        alert(errData.message || 'Failed to update customer')
      }
    } catch (err) {
      console.error('Error updating customer:', err)
      alert('Error occurred while updating customer')
    } finally {
      setIsSavingCustomer(false)
    }
  }

  // Flatten all invoices across customers with complete customer metadata
  const allInvoices = useMemo(() => {
    const list: Array<{
      id: string
      date: string
      customerId: string
      customerName: string
      customerMobile: string
      viaCustomer?: string
      grandTotal: number
      paymentStatus?: 'PAID' | 'PENDING'
      paymentMethod?: 'CASH' | 'UPI' | 'CARD'
      items: Array<{
        sr: number
        description: string
        qty: number
        rate: number
        total: number
      }>
    }> = []

    const pool = allCustomers.length > 0 ? allCustomers : customers
    pool.forEach((c) => {
      (c.invoices || []).forEach((inv) => {
        list.push({
          id: inv.id,
          date: inv.date,
          customerId: c.id,
          customerName: c.name,
          customerMobile: c.mobile,
          viaCustomer: inv.viaCustomer,
          grandTotal: inv.grandTotal || 0,
          paymentStatus: inv.paymentStatus || 'PAID',
          paymentMethod: inv.paymentMethod || 'UPI',
          items: inv.items || [],
        })
      })
    })

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [allCustomers, customers])

  // Filter invoices based on date range, status, payment method, and search
  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return allInvoices.filter((inv) => {
      if (startDate && inv.date < startDate) return false
      if (endDate && inv.date > endDate) return false

      if (statusFilter !== 'ALL') {
        const invStatus = inv.paymentStatus || 'PAID'
        if (invStatus !== statusFilter) return false
      }

      if (methodFilter !== 'ALL') {
        if (inv.paymentStatus === 'PENDING') return false
        const invMethod = inv.paymentMethod || 'UPI'
        if (invMethod !== methodFilter) return false
      }

      if (q) {
        const nameMatch = (inv.customerName || '').toLowerCase().includes(q)
        const phoneMatch = (inv.customerMobile || '').toLowerCase().includes(q)
        const idMatch = (inv.id || '').toLowerCase().includes(q)
        if (!nameMatch && !phoneMatch && !idMatch) return false
      }

      return true
    })
  }, [allInvoices, startDate, endDate, statusFilter, methodFilter, searchQuery])

  // Structured Collection Metrics in the selected date interval
  const collectionMetrics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const inRange = allInvoices.filter((inv) => {
      if (startDate && inv.date < startDate) return false
      if (endDate && inv.date > endDate) return false
      if (q) {
        const nameMatch = (inv.customerName || '').toLowerCase().includes(q)
        const phoneMatch = (inv.customerMobile || '').toLowerCase().includes(q)
        const idMatch = (inv.id || '').toLowerCase().includes(q)
        if (!nameMatch && !phoneMatch && !idMatch) return false
      }
      return true
    })

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

    inRange.forEach((inv) => {
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
      totalBills: inRange.length,
    }
  }, [allInvoices, startDate, endDate, searchQuery])

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)

  return (
    <div className="space-y-6">
      {/* Top Controls: Search & New Bill Button */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div ref={searchBoxRef} className="relative flex-1 max-w-md">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search customer (e.g. type 'vi')..."
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setIsSearchFocused(true)
                }}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-bold rounded-xl transition shadow-sm"
            >
              Search
            </button>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setIsSearchFocused(false)
                  fetchCustomers('')
                }}
                className="px-3 py-2.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-300 transition"
              >
                Clear
              </button>
            )}
          </form>

          {/* Live Autocomplete Dropdown */}
          {isSearchFocused && liveSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-2xl border border-orange-200 overflow-hidden z-50 divide-y divide-gray-100">
              <div className="px-3 py-1.5 bg-orange-50/80 text-[11px] font-bold text-orange-900 flex justify-between items-center">
                <span>Matching Clients (Prioritized)</span>
                <span className="text-[10px] text-orange-700 font-normal">Click to open customer</span>
              </div>
              {liveSuggestions.map((sug) => {
                const isTopSpender = sug.totalSpent >= 5000
                return (
                  <button
                    key={sug.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(sug)}
                    className="w-full text-left px-4 py-2.5 hover:bg-orange-50 flex items-center justify-between gap-3 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">
                          {sug.name}
                        </span>
                        {isTopSpender && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded">
                            ⭐ Top Client
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        📞 {sug.mobile || 'No phone'} • {sug.visitCount} visit{sug.visitCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-black text-primary">
                        ₹{sug.totalSpent.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-gray-400">Total Spent</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => setShowShopReportModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-2 text-xs sm:text-sm"
          >
            <span>📊</span> Full Shop Sales Report
          </button>

          <button
            onClick={() => {
              setPrefilledCustomer(null)
              setActiveInvoiceForPrint(null)
              setShowInvoiceModal(true)
            }}
            className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-secondary transition shadow-sm flex items-center justify-center gap-2 text-xs sm:text-sm"
          >
            <span>🧾</span> + Create New Bill
          </button>
        </div>
      </div>

      {/* View Mode Toggle: Structured Collection vs Customer Directory */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('collection')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              viewMode === 'collection'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <span>📊</span> All Bills &amp; Collection Ledger
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                viewMode === 'collection'
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              {allInvoices.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('directory')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              viewMode === 'directory'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <span>👥</span> Customer Directory
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                viewMode === 'directory'
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              {customers.length}
            </span>
          </button>
        </div>

        <div className="text-xs text-gray-500 font-medium">
          {viewMode === 'collection'
            ? '📊 Structure-wise UPI, Cash & Card collection from date to date'
            : '👥 Customer-wise visit histories, statements & client records'}
        </div>
      </div>

      {/* =========================================================================
          VIEW 1: STRUCTURE-WISE ALL BILLS & COLLECTION DASHBOARD
         ========================================================================= */}
      {viewMode === 'collection' && (
        <div className="space-y-6">
          {/* Date Range Selector & Period Quick Presets */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span>📅</span> Filter Collection by Date (Last Date to Current Date)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select start date and end date to see exact UPI, Cash, and Card collections
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { id: 'all', label: 'All Time' },
                    { id: 'today', label: 'Today' },
                    { id: 'yesterday', label: 'Yesterday' },
                    { id: 'this_week', label: 'This Week' },
                    { id: 'this_month', label: 'This Month' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyDatePreset(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      datePreset === p.id
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  From Date:
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setDatePreset('custom')
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  To Date (Current Date):
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setDatePreset('custom')
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="flex items-end">
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => applyDatePreset('all')}
                    className="w-full sm:w-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition"
                  >
                    Reset to All Dates
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* STRUCTURE-WISE COLLECTION CARDS (5 Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Total Paid Collection */}
            <div className="bg-gradient-to-br from-emerald-600 to-green-700 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider text-emerald-100">
                    Total Paid Collection
                  </div>
                  <div className="text-2xl font-black mt-2">
                    ₹{collectionMetrics.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <span className="text-3xl opacity-80">💰</span>
              </div>
              <div className="mt-3 text-xs text-emerald-100 font-semibold flex items-center gap-1">
                <span>✓</span> {collectionMetrics.paidCount} Paid Bill(s)
              </div>
            </div>

            {/* 2. Total Pending (Udhar) */}
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider text-amber-100">
                    Pending Bills (Udhar)
                  </div>
                  <div className="text-2xl font-black mt-2">
                    ₹{collectionMetrics.totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <span className="text-3xl opacity-80">⏳</span>
              </div>
              <div className="mt-3 text-xs text-amber-100 font-semibold flex items-center gap-1">
                <span>⚠️</span> {collectionMetrics.pendingCount} Pending Bill(s)
              </div>
            </div>

            {/* 3. UPI Collection */}
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider text-purple-100">
                    UPI Collection
                  </div>
                  <div className="text-2xl font-black mt-2">
                    ₹{collectionMetrics.upiTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <span className="text-3xl opacity-80">📱</span>
              </div>
              <div className="mt-3 text-xs text-purple-100 font-semibold">
                {collectionMetrics.upiCount} UPI Bill(s)
              </div>
            </div>

            {/* 4. Cash Collection ("Case") */}
            <div className="bg-gradient-to-br from-blue-600 to-cyan-700 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider text-blue-100">
                    Cash (&quot;Case&quot;) Collection
                  </div>
                  <div className="text-2xl font-black mt-2">
                    ₹{collectionMetrics.cashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <span className="text-3xl opacity-80">💵</span>
              </div>
              <div className="mt-3 text-xs text-blue-100 font-semibold">
                {collectionMetrics.cashCount} Cash Bill(s)
              </div>
            </div>

            {/* 5. Card Collection */}
            <div className="bg-gradient-to-br from-slate-700 to-gray-900 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider text-gray-300">
                    Card Collection
                  </div>
                  <div className="text-2xl font-black mt-2">
                    ₹{collectionMetrics.cardTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <span className="text-3xl opacity-80">💳</span>
              </div>
              <div className="mt-3 text-xs text-gray-300 font-semibold">
                {collectionMetrics.cardCount} Card Bill(s)
              </div>
            </div>
          </div>

          {/* Filter Tabs: Payment Status & Payment Method */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Status Tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-gray-600 mr-1">Status:</span>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    statusFilter === 'ALL'
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  All Bills ({collectionMetrics.totalBills})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('PAID')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                    statusFilter === 'PAID'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  <span>✓</span> PAID ({collectionMetrics.paidCount})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('PENDING')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                    statusFilter === 'PENDING'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  <span>⏳</span> PENDING ({collectionMetrics.pendingCount})
                </button>
              </div>

              {/* Method Tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-gray-600 mr-1">Method:</span>
                {(
                  [
                    { id: 'ALL', label: 'All Methods' },
                    { id: 'UPI', label: `📱 UPI (${collectionMetrics.upiCount})` },
                    { id: 'CASH', label: `💵 Cash (${collectionMetrics.cashCount})` },
                    { id: 'CARD', label: `💳 Card (${collectionMetrics.cardCount})` },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethodFilter(m.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      methodFilter === m.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* STRUCTURE-WISE BILLS LEDGER TABLE */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 text-base">
                  Recorded Bills ({filteredInvoices.length})
                </h3>
                {startDate && endDate && (
                  <span className="text-xs bg-gray-200 text-gray-800 px-2.5 py-0.5 rounded-full font-semibold">
                    {startDate} to {endDate}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setPrefilledCustomer(null)
                  setActiveInvoiceForPrint(null)
                  setShowInvoiceModal(true)
                }}
                className="px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-secondary transition flex items-center gap-1 shadow-sm"
              >
                <span>+</span> New Bill
              </button>
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-400">Loading bills...</div>
            ) : filteredInvoices.length === 0 ? (
              <div className="p-16 text-center text-gray-400">
                <span className="text-4xl block mb-2">🧾</span>
                <p className="font-bold text-gray-700">No bills match the selected filters or date range.</p>
                <p className="text-xs text-gray-500 mt-1">
                  Try clearing the date filter or creating a new bill.
                </p>
                <button
                  onClick={() => applyDatePreset('all')}
                  className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold"
                >
                  Show All Bills
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-700 text-xs uppercase font-extrabold tracking-wider">
                      <th className="py-3.5 px-4">Bill No</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Work / Items</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Payment Method</th>
                      <th className="py-3.5 px-4 text-right">Grand Total</th>
                      <th className="py-3.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-orange-50/40 transition">
                        {/* Bill No */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 bg-sky-100 text-sky-900 rounded font-extrabold text-xs">
                            {inv.id}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 text-gray-600 text-xs whitespace-nowrap font-medium">
                          {inv.date}
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-gray-900">{inv.customerName}</div>
                          {inv.viaCustomer && (
                            <div className="mt-0.5">
                              <span className="inline-block px-1.5 py-0.5 bg-orange-100 text-orange-800 text-[10px] font-black rounded border border-orange-200">
                                🤝 Via: {inv.viaCustomer}
                              </span>
                            </div>
                          )}
                          {inv.customerMobile ? (
                            <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                              <span>📞 {inv.customerMobile}</span>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">No phone</div>
                          )}
                        </td>

                        {/* Items */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="text-xs text-gray-700 font-medium truncate">
                            {(inv.items || [])
                              .map((it) => `${it.description || 'Work'} (${it.qty || 1})`)
                              .join(', ') || 'No item descriptions'}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {inv.paymentStatus === 'PAID' ? (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-extrabold text-[11px] inline-flex items-center gap-1">
                              <span>✓</span> PAID
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded font-extrabold text-[11px] inline-flex items-center gap-1">
                              <span>⏳</span> PENDING
                            </span>
                          )}
                        </td>

                        {/* Payment Method */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {inv.paymentStatus === 'PAID' ? (
                            inv.paymentMethod === 'UPI' ? (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 font-bold rounded text-xs">
                                📱 UPI
                              </span>
                            ) : inv.paymentMethod === 'CASH' ? (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded text-xs">
                                💵 CASH
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-bold rounded text-xs">
                                💳 CARD
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">—</span>
                          )}
                        </td>

                        {/* Grand Total */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className="font-extrabold text-gray-900 text-sm">
                            ₹{(inv.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveInvoiceForPrint(inv)
                                setShowInvoiceModal(true)
                              }}
                              className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold rounded border border-green-200 transition"
                              title="Share PDF on WhatsApp"
                            >
                              📲 WhatsApp
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveInvoiceForPrint(inv)
                                setShowInvoiceModal(true)
                              }}
                              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded transition"
                              title="View and Print Bill"
                            >
                              🖨️ View
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteInvoice(inv.id)}
                              disabled={deleteLoading === inv.id}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded border border-red-200 transition disabled:opacity-50"
                              title="Delete bill permanently"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: CUSTOMER DIRECTORY & LIFETIME HISTORIES
         ========================================================================= */}
      {viewMode === 'directory' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Customer Directory (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[700px]">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="font-bold text-gray-800">
              Customers ({customers.length})
            </h3>
            <span className="text-xs text-gray-500 font-medium">
              Click to view history
            </span>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading customers...</div>
            ) : customers.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <p>No customers found.</p>
                <p className="text-xs mt-1 text-gray-500">
                  Create a new bill to register your first customer!
                </p>
              </div>
            ) : (
              customers.map((customer) => {
                const isSelected = customer.id === selectedCustomerId
                return (
                  <div
                    key={customer.id}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    className={`p-4 cursor-pointer transition ${
                      isSelected
                        ? 'bg-orange-50/80 border-l-4 border-primary'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-gray-900 text-base">
                          {customer.name}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          📞 {customer.mobile || 'No phone'}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded-full font-semibold text-gray-700">
                        {customer.visitCount} visit{customer.visitCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100 text-xs">
                      <span className="text-gray-500">
                        Last: {customer.lastVisit || 'N/A'}
                      </span>
                      <span className="font-bold text-primary">
                        Total: ₹{customer.totalSpent.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Customer Profile & Visit Timeline (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-[700px] overflow-hidden">
          {selectedCustomer ? (
            <div className="flex flex-col h-full overflow-hidden">
              
              {/* Selected Customer Header Banner */}
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-5 rounded-xl border border-orange-200 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg">
                      {selectedCustomer.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xl font-extrabold text-gray-900">
                          {selectedCustomer.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            setEditCustomerId(selectedCustomer.id)
                            setEditCustomerName(selectedCustomer.name)
                            setEditCustomerMobile(selectedCustomer.mobile || '')
                            setShowEditCustomerModal(true)
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition flex items-center gap-1 shadow-sm"
                          title="Edit Customer Details"
                        >
                          <span>✏️</span> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomer(selectedCustomer)}
                          disabled={isDeletingCustomer === selectedCustomer.id}
                          className="px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition flex items-center gap-1 shadow-sm disabled:opacity-50"
                          title="Delete Client & All Invoices"
                        >
                          <span>🗑️</span> {isDeletingCustomer === selectedCustomer.id ? 'Deleting...' : 'Delete Client'}
                        </button>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600">
                        Mobile: {selectedCustomer.mobile || 'Not recorded'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                  <div className="text-right sm:mr-2">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Lifetime Purchases
                    </p>
                    <p className="text-lg font-black text-primary">
                      ₹{selectedCustomer.totalSpent.toLocaleString('en-IN')}
                    </p>
                  </div>

                  <button
                    onClick={() => setShowCustomerReportModal(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span>📄</span> Lifetime Statement (PDF)
                  </button>

                  <button
                    onClick={() => {
                      setPrefilledCustomer({
                        name: selectedCustomer.name,
                        mobile: selectedCustomer.mobile,
                      })
                      setActiveInvoiceForPrint(null)
                      setShowInvoiceModal(true)
                    }}
                    className="px-4 py-2 bg-primary text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-secondary transition shadow-sm whitespace-nowrap"
                  >
                    + New Bill for {selectedCustomer.name}
                  </button>
                </div>
              </div>

              {/* Billing Timeline / History */}
              <div className="flex-1 overflow-y-auto pr-1">
                <h4 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>📅</span> Billing &amp; Visit History ({selectedCustomer.invoices.length} Bills)
                </h4>

                {selectedCustomer.invoices.length === 0 ? (
                  <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-500">No bills recorded for this customer yet.</p>
                    <button
                      onClick={() => {
                        setPrefilledCustomer({
                          name: selectedCustomer.name,
                          mobile: selectedCustomer.mobile,
                        })
                        setActiveInvoiceForPrint(null)
                        setShowInvoiceModal(true)
                      }}
                      className="mt-3 px-4 py-2 bg-primary text-white text-sm rounded-lg"
                    >
                      Create First Bill
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedCustomer.invoices.map((inv, idx) => (
                      <div
                        key={inv.id}
                        className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 p-5 shadow-sm transition"
                      >
                        {/* Bill Header */}
                        <div className="flex flex-wrap justify-between items-center pb-3 border-b border-gray-100 gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-sky-100 text-sky-800 text-xs font-bold rounded">
                              {inv.id}
                            </span>
                            <span className="font-bold text-gray-800 text-sm">
                              Date: {inv.date}
                            </span>
                            {inv.paymentStatus === 'PAID' ? (
                              <span className="text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-extrabold flex items-center gap-0.5">
                                <span>✓</span> PAID ({inv.paymentMethod || 'UPI'})
                              </span>
                            ) : (
                              <span className="text-[11px] bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-extrabold flex items-center gap-0.5">
                                <span>⏳</span> PENDING
                              </span>
                            )}
                            {inv.viaCustomer && (
                              <span className="text-[11px] bg-orange-100 text-orange-800 border border-orange-200 px-2 py-0.5 rounded font-extrabold flex items-center gap-0.5">
                                <span>🤝</span> Via: {inv.viaCustomer}
                              </span>
                            )}
                            {idx === 0 && (
                              <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-semibold">
                                Latest Visit
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">
                              ₹{inv.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <button
                              onClick={() => {
                                setActiveInvoiceForPrint(inv)
                                setShowInvoiceModal(true)
                              }}
                              className="px-3 py-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold rounded border border-green-200 transition flex items-center gap-1"
                            >
                              <span>📲</span> WhatsApp PDF / View
                            </button>
                            <button
                              onClick={() => handleDeleteInvoice(inv.id)}
                              disabled={deleteLoading === inv.id}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded border border-red-200 transition disabled:opacity-50"
                            >
                              {deleteLoading === inv.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>

                        {/* Items Table for this Bill */}
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="text-gray-500 border-b">
                                <th className="pb-1.5 font-medium w-8">#</th>
                                <th className="pb-1.5 font-medium">Item Description</th>
                                <th className="pb-1.5 font-medium text-center w-16">Qty</th>
                                <th className="pb-1.5 font-medium text-right w-24">Rate (₹)</th>
                                <th className="pb-1.5 font-medium text-right w-24">Total (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-gray-800 font-medium">
                              {inv.items.map((item, i) => (
                                <tr key={i} className="hover:bg-gray-50/50">
                                  <td className="py-1.5 text-gray-400">{item.sr || i + 1}</td>
                                  <td className="py-1.5 font-semibold text-gray-900">
                                    {item.description}
                                  </td>
                                  <td className="py-1.5 text-center">{item.qty}</td>
                                  <td className="py-1.5 text-right">
                                    ₹{Number(item.rate).toFixed(2)}
                                  </td>
                                  <td className="py-1.5 text-right font-bold text-gray-900">
                                    ₹{Number(item.total).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <span className="text-5xl mb-3">👤</span>
              <p className="text-base font-semibold">Select a customer from the left list</p>
              <p className="text-xs text-gray-500 mt-1">
                View previous visits and add today&apos;s bill
              </p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Invoice Modal for Creating or Printing a Bill */}
      {showInvoiceModal && (
        <InvoiceModal
          initialCustomerName={prefilledCustomer ? prefilledCustomer.name : ''}
          initialCustomerMobile={prefilledCustomer ? prefilledCustomer.mobile : ''}
          existingInvoice={activeInvoiceForPrint}
          onClose={() => {
            setShowInvoiceModal(false)
            setActiveInvoiceForPrint(null)
            setPrefilledCustomer(null)
          }}
          onSuccess={() => {
            fetchCustomers(searchQuery)
          }}
        />
      )}

      {/* Customer Lifetime Purchase Statement Modal */}
      {showCustomerReportModal && selectedCustomer && (
        <CustomerReportModal
          customer={selectedCustomer}
          onClose={() => setShowCustomerReportModal(false)}
        />
      )}

      {/* Full Shop Sales & Performance Report Modal */}
      {showShopReportModal && (
        <ShopReportModal
          customers={customers}
          onClose={() => setShowShopReportModal(false)}
        />
      )}

      {/* Edit Customer Details Modal */}
      {showEditCustomerModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>✏️</span> Edit Client Details
              </h3>
              <button
                type="button"
                onClick={() => setShowEditCustomerModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1 leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomerEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Customer / Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Mobile Number (Optional)
                </label>
                <input
                  type="text"
                  value={editCustomerMobile}
                  onChange={(e) => setEditCustomerMobile(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                />
              </div>

              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-800 leading-relaxed">
                ℹ️ <strong>Note:</strong> Updating the customer name and phone here will automatically update all previous bills associated with this customer.
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditCustomerModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="px-5 py-2 bg-primary hover:bg-secondary text-white text-sm font-bold rounded-xl transition shadow-sm disabled:opacity-50"
                >
                  {isSavingCustomer ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

