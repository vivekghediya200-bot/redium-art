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

      {/* Main Grid: Customer List & Customer Detail Timeline */}
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

