'use client'

import { useState, useEffect } from 'react'
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
  }>
}

export default function CustomerHistoryView() {
  const [customers, setCustomers] = useState<CustomerData[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Modals state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showCustomerReportModal, setShowCustomerReportModal] = useState(false)
  const [showShopReportModal, setShowShopReportModal] = useState(false)
  const [activeInvoiceForPrint, setActiveInvoiceForPrint] = useState<any | null>(null)
  const [prefilledCustomer, setPrefilledCustomer] = useState<{
    name: string
    mobile: string
  } | null>(null)

  useEffect(() => {
    fetchCustomers()
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchCustomers(searchQuery)
  }

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm(`Are you sure you want to delete bill ${invoiceId}?`)) return

    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        fetchCustomers(searchQuery)
      }
    } catch (err) {
      console.error('Error deleting invoice:', err)
    }
  }

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)

  return (
    <div className="space-y-6">
      {/* Top Controls: Search & New Bill Button */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search customer by name or phone (e.g. Vivek)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-gray-800 text-white text-sm font-semibold rounded-lg hover:bg-gray-900 transition"
          >
            Search
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                fetchCustomers('')
              }}
              className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
            >
              Clear
            </button>
          )}
        </form>

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
                      <h3 className="text-xl font-extrabold text-gray-900">
                        {selectedCustomer.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600">
                        Mobile: {selectedCustomer.mobile || 'Not recorded'} • Customer ID: {selectedCustomer.id}
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
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded border border-red-200 transition"
                            >
                              Delete
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
    </div>
  )
}

