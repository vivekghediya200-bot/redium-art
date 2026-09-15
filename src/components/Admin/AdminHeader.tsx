'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminHeader() {
  const router = useRouter()
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    router.push('/admin')
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatusMsg(null)

    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: 'error', text: 'New passwords do not match' })
      return
    }

    if (newPassword.length < 6) {
      setStatusMsg({ type: 'error', text: 'New password must be at least 6 characters' })
      return
    }

    try {
      setSavingPassword(true)
      const token = localStorage.getItem('adminToken')
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json()
      if (res.ok) {
        setStatusMsg({ type: 'success', text: 'Password changed successfully!' })
        setTimeout(() => {
          setShowPasswordModal(false)
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
          setStatusMsg(null)
        }, 1500)
      } else {
        setStatusMsg({ type: 'error', text: data.message || 'Failed to change password' })
      }
    } catch (err) {
      console.error('Password change error:', err)
      setStatusMsg({ type: 'error', text: 'An unexpected error occurred' })
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <>
      <header className="bg-primary text-white shadow-md print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-black flex items-center justify-center p-0.5 border border-white/20 shadow-sm flex-shrink-0">
              <img
                src="/images/logo.png"
                alt="Jay Mataji Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold leading-tight">
                Jay Mataji - Admin Panel
              </h1>
              <p className="text-[10px] text-amber-200 tracking-wider font-semibold uppercase">
                Billing, Customers &amp; Gallery Management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-xs font-semibold flex items-center gap-1.5"
            >
              <span>🌐</span>
              <span className="hidden sm:inline">View Storefront</span>
            </Link>

            <button
              onClick={() => {
                setShowPasswordModal(true)
                setStatusMsg(null)
              }}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-xs font-semibold flex items-center gap-1.5"
            >
              <span>🔒</span>
              <span className="hidden sm:inline">Change Password</span>
            </button>

            <button
              onClick={handleLogout}
              className="px-4 py-1.5 bg-secondary hover:bg-orange-700 rounded-lg transition font-semibold text-xs shadow-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-gray-800 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center mb-5 border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>🔐</span> Change Admin Password
              </h2>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1 leading-none"
              >
                ✕
              </button>
            </div>

            {statusMsg && (
              <div
                className={`p-3 rounded-xl text-sm mb-4 font-medium flex items-center gap-2 ${
                  statusMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                <span>{statusMsg.type === 'success' ? '✅' : '⚠️'}</span>
                <span>{statusMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                  required
                  disabled={savingPassword}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                  required
                  minLength={6}
                  disabled={savingPassword}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                  required
                  minLength={6}
                  disabled={savingPassword}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition"
                  disabled={savingPassword}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-5 py-2 text-sm font-semibold bg-primary hover:bg-orange-700 text-white rounded-lg transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {savingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
