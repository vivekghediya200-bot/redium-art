'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminHeader() {
  const router = useRouter()
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [currentEmail, setCurrentEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [syncInfo, setSyncInfo] = useState<{
    updatedAt?: string
    isCloudSynced?: boolean
    activeDevicesSupported?: string[]
  } | null>(null)

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    router.push('/admin')
  }

  // Fetch current admin profile info
  const fetchAdminProfile = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      if (!token) return
      const res = await fetch('/api/admin/change-password', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.email) {
          setCurrentEmail(data.email)
          setNewEmail(data.email)
        }
        setSyncInfo({
          updatedAt: data.updatedAt,
          isCloudSynced: data.isCloudSynced ?? true,
          activeDevicesSupported: data.activeDevicesSupported || ['Laptop', 'Mobile Phone'],
        })
      }
    } catch (e) {
      console.error('Error fetching admin profile:', e)
    }
  }

  const handleOpenSettings = () => {
    setStatusMsg(null)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    fetchAdminProfile()
    setShowSettingsModal(true)
  }

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatusMsg(null)

    if (!currentPassword) {
      setStatusMsg({ type: 'error', text: 'Current password is required to save changes' })
      return
    }

    if (newPassword && newPassword !== confirmPassword) {
      setStatusMsg({ type: 'error', text: 'New passwords do not match' })
      return
    }

    if (newPassword && newPassword.length < 6) {
      setStatusMsg({ type: 'error', text: 'New password must be at least 6 characters' })
      return
    }

    const emailChanged = newEmail.trim().toLowerCase() !== currentEmail.toLowerCase()
    if (!emailChanged && !newPassword) {
      setStatusMsg({
        type: 'error',
        text: 'Please enter a new email address or new password to update.',
      })
      return
    }

    try {
      setSavingSettings(true)
      const token = localStorage.getItem('adminToken')
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newEmail: emailChanged ? newEmail.trim() : undefined,
          newPassword: newPassword ? newPassword : undefined,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        if (data.token) {
          localStorage.setItem('adminToken', data.token)
        }
        if (data.email) {
          setCurrentEmail(data.email)
          setNewEmail(data.email)
        }
        if (data.updatedAt) {
          setSyncInfo((prev) => ({
            ...prev,
            updatedAt: data.updatedAt,
            isCloudSynced: true,
          }))
        }
        setStatusMsg({
          type: 'success',
          text: data.message || 'Credentials updated and live-synced across Laptop & Mobile!',
        })
        setTimeout(() => {
          setShowSettingsModal(false)
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
          setStatusMsg(null)
        }, 2200)
      } else {
        setStatusMsg({ type: 'error', text: data.message || 'Failed to update credentials' })
      }
    } catch (err) {
      console.error('Credential update error:', err)
      setStatusMsg({ type: 'error', text: 'An unexpected error occurred' })
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <>
      <header className="bg-primary text-white shadow-md print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex items-center justify-center p-0.5 shadow-sm flex-shrink-0">
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
              onClick={handleOpenSettings}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-xs font-semibold flex items-center gap-1.5"
            >
              <span>⚙️</span>
              <span>Change Email &amp; Password</span>
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

      {/* Change Email & Password Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-gray-800 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>🔐</span> Admin Account Credentials
              </h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1 leading-none"
              >
                ✕
              </button>
            </div>

            {/* Live Multi-Device Sync Banner */}
            <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-emerald-900 border border-emerald-700/60 rounded-xl p-3.5 mb-4 text-white shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
                    Live Multi-Device Sync Active
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-800/80 border border-emerald-600/60 font-extrabold text-emerald-200">
                  Laptop ↔ Mobile
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/90 leading-relaxed">
                When you update your email or password from this laptop, it is <strong>instantly saved to Vercel Cloud Storage</strong>. You can log in from your mobile phone immediately with the new password.
              </p>
              <div className="mt-2.5 pt-2 border-t border-emerald-800/60 flex items-center justify-between text-[10px] text-emerald-300/80 font-medium">
                <span>Active Account: <strong className="text-white">{currentEmail || 'admin@jaymataji.com'}</strong></span>
                <span>
                  Last Synced:{' '}
                  <strong className="text-white">
                    {syncInfo?.updatedAt ? new Date(syncInfo.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
                  </strong>
                </span>
              </div>
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

            <form onSubmit={handleUpdateCredentials} className="space-y-4">
              {/* Admin Email ID */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">
                  Admin Email Address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                  placeholder="Enter new admin email"
                  required
                  disabled={savingSettings}
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Current: <span className="font-semibold text-gray-700">{currentEmail || 'Loading...'}</span>
                </p>
              </div>

              {/* New Password (Optional) */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">
                  New Password <span className="text-gray-400 font-normal lowercase">(leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                  placeholder="Enter new password (optional)"
                  minLength={6}
                  disabled={savingSettings}
                />
              </div>

              {/* Confirm New Password */}
              {newPassword && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    placeholder="Repeat new password"
                    minLength={6}
                    required={!!newPassword}
                    disabled={savingSettings}
                  />
                </div>
              )}

              {/* Current Password Verification */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-900 mb-1 uppercase tracking-wide">
                  Verify Current Password *
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2 border border-orange-300 bg-orange-50/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                  placeholder="Enter your current password to confirm"
                  required
                  disabled={savingSettings}
                />
                <p className="text-[11px] text-orange-700 mt-1">
                  Required to authorize any credential changes.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition"
                  disabled={savingSettings}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-5 py-2 text-sm font-semibold bg-primary hover:bg-orange-700 text-white rounded-lg transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {savingSettings ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Syncing to Laptop &amp; Mobile...</span>
                    </>
                  ) : (
                    'Save & Sync Everywhere'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
