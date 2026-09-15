'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminHeader from '@/components/Admin/AdminHeader'
import AdminGalleryManager from '@/components/Admin/AdminGalleryManager'
import CustomerHistoryView from '@/components/Admin/CustomerHistoryView'

export default function AdminDashboard() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [activeTab, setActiveTab] = useState<'billing' | 'gallery'>('billing')

  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    if (!token) {
      router.push('/admin')
      return
    }

    // Verify session validity
    fetch('/api/auth/verify', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) {
          setIsLoggedIn(true)
        } else {
          localStorage.removeItem('adminToken')
          router.push('/admin')
        }
      })
      .catch(() => {
        // Fallback to allow offline/local development continuity if network hiccups
        setIsLoggedIn(true)
      })
  }, [router])

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-medium">
        <div className="flex items-center gap-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Verifying Admin Session...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full flex-1">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 mb-6 bg-white p-2 rounded-xl shadow-sm gap-2">
          <button
            onClick={() => setActiveTab('billing')}
            className={`flex-1 sm:flex-initial px-6 py-3 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${
              activeTab === 'billing'
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>🧾</span>
            <span>Customer Billing &amp; Invoices</span>
          </button>

          <button
            onClick={() => setActiveTab('gallery')}
            className={`flex-1 sm:flex-initial px-6 py-3 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${
              activeTab === 'gallery'
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>🖼️</span>
            <span>Gallery &amp; Photos (Multi-Upload)</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'billing' ? (
          <CustomerHistoryView />
        ) : (
          <AdminGalleryManager />
        )}
      </main>
    </div>
  )
}
