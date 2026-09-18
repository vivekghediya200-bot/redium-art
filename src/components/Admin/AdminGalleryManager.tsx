'use client'

import { useState, useEffect, useMemo } from 'react'
import MultiImageUploadModal from './MultiImageUploadModal'

export interface GalleryPhoto {
  id: string
  image: string
  folderId?: string
  isPrivate?: boolean
  createdAt: string
}

export interface GalleryFolder {
  id: string
  name: string
  isPrivate: boolean
  createdAt: string
  updatedAt: string
}

export interface DeletedStats {
  totalCount: number
  activeCount?: number
  totalHistorical?: number
  deletionPercentage?: number
  recentDeletions: Array<{ id: string; deletedAt: string }>
}

export interface DeleteProgressState {
  current: number
  total: number
  percentage: number
  isComplete: boolean
  currentBatchText: string
}

export default function AdminGalleryManager() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [folders, setFolders] = useState<GalleryFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Live Deletion Tracker state
  const [deletedStats, setDeletedStats] = useState<DeletedStats | null>(null)
  const [showDeletedModal, setShowDeletedModal] = useState(false)

  // Live Deletion Progress Modal state (the "show 65% delete like this" feature)
  const [deleteProgress, setDeleteProgress] = useState<DeleteProgressState | null>(null)

  // Folder creation state
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderIsPrivate, setNewFolderIsPrivate] = useState(false)
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false)

  // Folder rename state
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renamingFolder, setRenamingFolder] = useState<GalleryFolder | null>(null)
  const [renameInput, setRenameInput] = useState('')

  // Folder delete state
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false)
  const [deletingFolder, setDeletingFolder] = useState<GalleryFolder | null>(null)
  const [deleteFolderWithPhotos, setDeleteFolderWithPhotos] = useState(false)

  // Move photos state
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [targetMoveFolderId, setTargetMoveFolderId] = useState<string>('')
  const [isMoving, setIsMoving] = useState(false)

  // Client-side tombstone helpers
  const getClientDeletedIdSet = (): Set<string> => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('jaymataji_deleted_photo_ids') : null
      if (!raw) return new Set<string>()
      const arr = JSON.parse(raw)
      return new Set<string>(Array.isArray(arr) ? arr.map((x: any) => String(x).trim().toLowerCase()) : [])
    } catch {
      return new Set<string>()
    }
  }

  const recordClientDeletedIds = (ids: string[]) => {
    try {
      if (typeof window === 'undefined') return
      const raw = localStorage.getItem('jaymataji_deleted_photo_ids')
      const current = raw ? JSON.parse(raw) : []
      const set = new Set<string>(Array.isArray(current) ? current.map((x: any) => String(x).trim().toLowerCase()) : [])
      ids.forEach((id) => set.add(String(id).trim().toLowerCase()))
      localStorage.setItem('jaymataji_deleted_photo_ids', JSON.stringify(Array.from(set)))
    } catch (e) {
      console.error('Error saving deleted IDs to localStorage:', e)
    }
  }

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoading(true)
    await Promise.all([fetchPhotos(), fetchFolders(), fetchDeletedStats()])
    setLoading(false)
  }

  const fetchPhotos = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/gallery?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          Authorization: `Bearer ${token}`,
        },
      })
      if (res.ok) {
        const data = await res.json()
        const tombstoneSet = getClientDeletedIdSet()
        const filtered = Array.isArray(data)
          ? data.filter((p: any) => !tombstoneSet.has(String(p.id).trim().toLowerCase()))
          : []
        setPhotos(filtered)
      }
    } catch (err) {
      console.error('Error fetching gallery:', err)
    }
  }

  const fetchFolders = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/gallery/folders?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          Authorization: `Bearer ${token}`,
        },
      })
      if (res.ok) {
        const data = await res.json()
        setFolders(data)
      }
    } catch (err) {
      console.error('Error fetching folders:', err)
    }
  }

  const fetchDeletedStats = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/gallery/deleted?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          Authorization: `Bearer ${token}`,
        },
      })
      if (res.ok) {
        const data = await res.json()
        setDeletedStats(data)
      }
    } catch (err) {
      console.error('Error fetching deleted stats:', err)
    }
  }

  // Active folder details
  const activeFolder = useMemo(() => {
    if (selectedFolderId === 'all' || selectedFolderId === 'uncategorized') return null
    return folders.find((f) => f.id === selectedFolderId) || null
  }, [folders, selectedFolderId])

  // Photos filtered by currently selected folder tab
  const displayedPhotos = useMemo(() => {
    if (selectedFolderId === 'all') return photos
    if (selectedFolderId === 'uncategorized') {
      return photos.filter((p) => !p.folderId)
    }
    return photos.filter((p) => p.folderId === selectedFolderId)
  }, [photos, selectedFolderId])

  // Count photos per folder
  const photoCountsByFolder = useMemo(() => {
    const map: Record<string, number> = { all: photos.length, uncategorized: 0 }
    for (const p of photos) {
      if (p.folderId) {
        map[p.folderId] = (map[p.folderId] || 0) + 1
      } else {
        map.uncategorized = (map.uncategorized || 0) + 1
      }
    }
    return map
  }, [photos])

  // Single delete with live tracking
  const handleDeleteSingle = async (id: string) => {
    if (
      !confirm(
        'Are you sure you want to permanently delete this photo? It will be tracked in the deleted counter and never reappear.'
      )
    )
      return

    const token = localStorage.getItem('adminToken')
    setDeleteProgress({
      current: 0,
      total: 1,
      percentage: 0,
      isComplete: false,
      currentBatchText: 'Deleting photo from library...',
    })

    try {
      const res = await fetch(`/api/gallery/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        recordClientDeletedIds([id])
        setPhotos((prev) => prev.filter((p) => p.id !== id))
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        setDeleteProgress({
          current: 1,
          total: 1,
          percentage: 100,
          isComplete: true,
          currentBatchText: 'Photo permanently deleted (100% completed)!',
        })
        await fetchDeletedStats()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.message || 'Failed to delete image')
        setDeleteProgress(null)
      }
    } catch (err) {
      console.error('Error deleting photo:', err)
      alert('Error occurred while deleting photo')
      setDeleteProgress(null)
    }
  }

  // Batch delete with Live 65% Progress Bar Tracker
  const handleDeleteSelected = async (customIds?: string[] | React.MouseEvent) => {
    const targetIds = Array.isArray(customIds) ? customIds : Array.from(selectedIds)
    if (targetIds.length === 0) return
    if (
      !confirm(
        `Are you sure you want to permanently delete ${targetIds.length} selected image(s)? They will be tracked in the deleted counter and never reappear.`
      )
    )
      return

    const token = localStorage.getItem('adminToken')
    const total = targetIds.length
    let processed = 0

    // Initialize the live deletion progress modal (e.g. 0% -> 65% -> 100%)
    setDeleteProgress({
      current: 0,
      total,
      percentage: 0,
      isComplete: false,
      currentBatchText: `Preparing to delete ${total} artwork(s)...`,
    })

    const batchSize = 4
    try {
      for (let i = 0; i < total; i += batchSize) {
        const batch = targetIds.slice(i, i + batchSize)
        const res = await fetch('/api/gallery', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ids: batch }),
        })

        if (res.ok) {
          processed += batch.length
          const pct = Math.min(100, Math.round((processed / total) * 100))

          // Record in client localStorage tombstone
          recordClientDeletedIds(batch)

          // Update active photos state
          const batchSet = new Set(batch.map((b) => b.trim().toLowerCase()))
          setPhotos((prev) => prev.filter((p) => !batchSet.has(p.id.trim().toLowerCase())))
          setSelectedIds((prev) => {
            const next = new Set(prev)
            batch.forEach((id) => next.delete(id))
            return next
          })

          const isFinished = processed >= total
          setDeleteProgress({
            current: processed,
            total,
            percentage: pct,
            isComplete: isFinished,
            currentBatchText: isFinished
              ? `All ${total} photos permanently deleted and locked!`
              : `Deleting photo ${processed} of ${total} (${pct}% completed)...`,
          })

          // Smooth pacing for the progress bar animation
          if (!isFinished) {
            await new Promise((r) => setTimeout(r, 180))
          }
        } else {
          const err = await res.json().catch(() => ({}))
          alert(err.message || 'Error occurred during deletion batch')
          break
        }
      }

      await fetchDeletedStats()
    } catch (e) {
      console.error('Delete error:', e)
      alert('Error occurred while deleting images')
    }
  }

  // Clean any remaining stale demo quote photos
  const handlePurgeStaleQuotes = () => {
    const stalePhotos = photos.filter(
      (p) => !p.folderId || p.id.startsWith('1789') || p.id.startsWith('1773')
    )
    if (stalePhotos.length === 0) {
      alert('No stale sample quote photos detected in library.')
      return
    }
    handleDeleteSelected(stalePhotos.map((p) => p.id))
  }

  // Toggle selection
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const toggleSelectAll = () => {
    const currentDisplayedIds = displayedPhotos.map((p) => p.id)
    const allSelected = currentDisplayedIds.every((id) => selectedIds.has(id))
    const next = new Set(selectedIds)
    if (allSelected) {
      currentDisplayedIds.forEach((id) => next.delete(id))
    } else {
      currentDisplayedIds.forEach((id) => next.add(id))
    }
    setSelectedIds(next)
  }

  // Create folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return
    setIsSubmittingFolder(true)
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch('/api/gallery/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newFolderName.trim(),
          isPrivate: newFolderIsPrivate,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setFolders((prev) => [...prev, data.folder])
        setSelectedFolderId(data.folder.id)
        setNewFolderName('')
        setNewFolderIsPrivate(false)
        setShowCreateFolderModal(false)
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.message || 'Failed to create folder')
      }
    } catch (err) {
      console.error('Error creating folder:', err)
      alert('Error creating folder')
    } finally {
      setIsSubmittingFolder(false)
    }
  }

  // Toggle folder privacy (Public <-> Private)
  const handleTogglePrivacy = async (folder: GalleryFolder) => {
    try {
      const token = localStorage.getItem('adminToken')
      const newPrivateState = !folder.isPrivate
      const res = await fetch(`/api/gallery/folders/${encodeURIComponent(folder.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isPrivate: newPrivateState }),
      })
      if (res.ok) {
        const data = await res.json()
        setFolders((prev) =>
          prev.map((f) => (f.id === folder.id ? data.folder : f))
        )
        // Refresh photos to reflect updated isPrivate flags
        fetchPhotos()
      }
    } catch (err) {
      console.error('Error toggling folder privacy:', err)
      alert('Failed to update folder privacy')
    }
  }

  // Rename folder
  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renamingFolder || !renameInput.trim()) return
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/gallery/folders/${encodeURIComponent(renamingFolder.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: renameInput.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setFolders((prev) =>
          prev.map((f) => (f.id === renamingFolder.id ? data.folder : f))
        )
        setShowRenameModal(false)
        setRenamingFolder(null)
      }
    } catch (err) {
      console.error('Error renaming folder:', err)
      alert('Failed to rename folder')
    }
  }

  // Delete folder
  const handleDeleteFolder = async () => {
    if (!deletingFolder) return
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch(
        `/api/gallery/folders/${encodeURIComponent(deletingFolder.id)}?deletePhotos=${deleteFolderWithPhotos}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      if (res.ok) {
        setFolders((prev) => prev.filter((f) => f.id !== deletingFolder.id))
        setSelectedFolderId('all')
        setShowDeleteFolderModal(false)
        setDeletingFolder(null)
        fetchPhotos()
        fetchDeletedStats()
      }
    } catch (err) {
      console.error('Error deleting folder:', err)
      alert('Failed to delete folder')
    }
  }

  // Move selected photos to folder
  const handleMovePhotos = async () => {
    if (selectedIds.size === 0) return
    setIsMoving(true)
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch('/api/gallery/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageIds: Array.from(selectedIds),
          targetFolderId: targetMoveFolderId || undefined,
        }),
      })
      if (res.ok) {
        setShowMoveModal(false)
        setSelectedIds(new Set())
        fetchPhotos()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.message || 'Failed to move images')
      }
    } catch (err) {
      console.error('Error moving photos:', err)
      alert('Failed to move photos')
    } finally {
      setIsMoving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Live Deleted Photos Tracker Banner */}
      <div className="bg-gradient-to-r from-red-950 via-rose-950 to-red-900 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-red-800/60 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-red-800/60 flex items-center justify-center text-2xl shadow-inner border border-red-700/50">
              🗑️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white tracking-wide">
                  Live Deleted Photos Tracker
                </h3>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-extrabold text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  LIVE SYNC
                </span>
              </div>
              <p className="text-xs text-red-200 mt-0.5">
                Permanently deleted photos are tombstone-locked and guaranteed never to reappear on refresh or WhatsApp links.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-black/40 px-3 py-1.5 rounded-xl border border-red-700/40 text-center min-w-[75px]">
              <span className="text-[9px] text-red-300 font-bold uppercase block tracking-wider">
                Total Deleted
              </span>
              <span className="text-base sm:text-lg font-black text-white">
                {deletedStats?.totalCount ?? 0}
              </span>
            </div>

            <div className="bg-black/40 px-3 py-1.5 rounded-xl border border-red-700/40 text-center min-w-[75px]">
              <span className="text-[9px] text-red-300 font-bold uppercase block tracking-wider">
                Active Artworks
              </span>
              <span className="text-base sm:text-lg font-black text-emerald-300">
                {photos.length}
              </span>
            </div>

            <div className="bg-black/40 px-3 py-1.5 rounded-xl border border-red-700/40 text-center min-w-[75px]">
              <span className="text-[9px] text-amber-300 font-bold uppercase block tracking-wider">
                Deletion Rate
              </span>
              <span className="text-base sm:text-lg font-black text-amber-300">
                {(() => {
                  const total = (deletedStats?.totalCount ?? 0) + photos.length
                  return total > 0 ? Math.round(((deletedStats?.totalCount ?? 0) / total) * 100) : 0
                })()}%
              </span>
            </div>

            <button
              onClick={() => fetchInitialData()}
              title="Refresh live sync from database"
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/20 shadow-sm flex items-center gap-1"
            >
              🔄 Refresh
            </button>

            <button
              onClick={() => setShowDeletedModal(true)}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/20 shadow-sm flex items-center gap-1"
            >
              🔍 View Log
            </button>
          </div>
        </div>

        {/* Visual Progress Bar inside the Tracker Banner */}
        <div className="bg-black/30 p-2.5 rounded-xl border border-red-800/40">
          <div className="flex justify-between items-center text-[11px] font-bold text-red-200 mb-1.5">
            <span>Library Deletion & Cleanup Ratio</span>
            <span className="text-amber-300">
              {(() => {
                const total = (deletedStats?.totalCount ?? 0) + photos.length
                return total > 0 ? Math.round(((deletedStats?.totalCount ?? 0) / total) * 100) : 0
              })()}% Cleaned
            </span>
          </div>
          <div className="w-full bg-red-950/80 rounded-full h-2.5 p-0.5 border border-red-700/50 overflow-hidden shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-500 via-rose-400 to-emerald-400 transition-all duration-700 ease-out"
              style={{
                width: `${(() => {
                  const total = (deletedStats?.totalCount ?? 0) + photos.length
                  return total > 0 ? Math.min(100, Math.round(((deletedStats?.totalCount ?? 0) / total) * 100)) : 0
                })()}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Top Header */}
        <div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <span>🖼️ Artwork Library</span>
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                {photos.length} Total
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Organize artworks by folders, control public vs private visibility, and upload new designs
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowCreateFolderModal(true)}
              className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-gray-300 shadow-sm"
            >
              <span>+</span> New Folder
            </button>

            {photos.some((p) => !p.folderId || p.id.startsWith('1789') || p.id.startsWith('1773')) && (
              <button
                onClick={handlePurgeStaleQuotes}
                title="Wipe any legacy sample quote photos with the live progress tracker"
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-rose-200 shadow-sm"
              >
                <span>🧹</span> Clean Sample Quotes
              </button>
            )}

            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-primary hover:bg-secondary text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
            >
              <span>+</span> Upload Images
            </button>
          </div>
        </div>

        {/* Folder Navigation Tabs */}
        <div className="bg-gray-50/80 px-5 pt-3 border-b border-gray-200 flex items-center gap-2 overflow-x-auto scrollbar-thin">
          {/* All Photos Tab */}
          <button
            onClick={() => setSelectedFolderId('all')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition whitespace-nowrap flex items-center gap-1.5 border-t border-x ${
              selectedFolderId === 'all'
                ? 'bg-white text-primary border-gray-200 shadow-sm'
                : 'bg-transparent text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-200/50'
            }`}
          >
            <span>📁 All Photos</span>
            <span className="text-[10px] bg-gray-200 text-gray-700 font-extrabold px-1.5 py-0.5 rounded-full">
              {photoCountsByFolder.all || 0}
            </span>
          </button>

          {/* Individual Folder Tabs */}
          {folders.map((folder) => {
            const isSelected = selectedFolderId === folder.id
            const count = photoCountsByFolder[folder.id] || 0
            return (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition whitespace-nowrap flex items-center gap-1.5 border-t border-x ${
                  isSelected
                    ? 'bg-white text-primary border-gray-200 shadow-sm'
                    : 'bg-transparent text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                <span>{folder.isPrivate ? '🔒' : '🌐'}</span>
                <span>{folder.name}</span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                    folder.isPrivate
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}

          {/* Uncategorized Tab if any photos exist */}
          {(photoCountsByFolder.uncategorized || 0) > 0 && (
            <button
              onClick={() => setSelectedFolderId('uncategorized')}
              className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition whitespace-nowrap flex items-center gap-1.5 border-t border-x ${
                selectedFolderId === 'uncategorized'
                  ? 'bg-white text-primary border-gray-200 shadow-sm'
                  : 'bg-transparent text-gray-500 border-transparent hover:text-gray-800'
              }`}
            >
              <span>📁 Uncategorized</span>
              <span className="text-[10px] bg-gray-200 text-gray-700 font-extrabold px-1.5 py-0.5 rounded-full">
                {photoCountsByFolder.uncategorized}
              </span>
            </button>
          )}
        </div>

        {/* Sub-bar: Active Folder Info & Folder Controls */}
        <div className="p-4 bg-white border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-extrabold text-gray-900 text-sm">
              {activeFolder ? activeFolder.name : selectedFolderId === 'uncategorized' ? 'Uncategorized Photos' : 'All Artwork Photos'}
            </span>

            {activeFolder ? (
              <div className="flex items-center gap-2">
                {activeFolder.isPrivate ? (
                  <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 font-black rounded-full border border-purple-200 flex items-center gap-1">
                    <span>🔒</span> PRIVATE (Admin Only)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-black rounded-full border border-emerald-200 flex items-center gap-1">
                    <span>🌐</span> PUBLIC (Visible on Website)
                  </span>
                )}

                <button
                  onClick={() => handleTogglePrivacy(activeFolder)}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition border border-gray-300"
                  title="Toggle Public / Private"
                >
                  {activeFolder.isPrivate ? 'Switch to 🌐 Public' : 'Switch to 🔒 Private'}
                </button>

                <button
                  onClick={() => {
                    setRenamingFolder(activeFolder)
                    setRenameInput(activeFolder.name)
                    setShowRenameModal(true)
                  }}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition border border-gray-300"
                >
                  ✏️ Rename
                </button>

                <button
                  onClick={() => {
                    setDeletingFolder(activeFolder)
                    setDeleteFolderWithPhotos(false)
                    setShowDeleteFolderModal(true)
                  }}
                  className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg transition border border-red-200"
                >
                  🗑️ Delete Folder
                </button>
              </div>
            ) : (
              <span className="text-gray-500">
                {selectedFolderId === 'all'
                  ? 'Showing all designs across all folders'
                  : 'Designs that do not belong to any folder'}
              </span>
            )}
          </div>

          {/* Multi-selection Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {displayedPhotos.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition text-xs"
              >
                {displayedPhotos.every((p) => selectedIds.has(p.id))
                  ? 'Deselect All'
                  : `Select All (${displayedPhotos.length})`}
              </button>
            )}

            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={() => setShowMoveModal(true)}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition text-xs border border-blue-200 flex items-center gap-1"
                >
                  <span>📁</span> Move to Folder ({selectedIds.size})
                </button>

                <button
                  onClick={handleDeleteSelected}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition text-xs shadow-sm flex items-center gap-1"
                >
                  <span>🗑️</span> Delete Selected ({selectedIds.size})
                </button>
              </>
            )}
          </div>
        </div>

        {/* Photos Grid */}
        <div className="p-5">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square bg-gray-200 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : displayedPhotos.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <span className="text-5xl mb-3 block">🖼️</span>
              <p className="text-gray-700 font-bold text-base">
                No photos in this folder
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Upload new photos directly to this folder or move photos from other folders
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="mt-4 px-5 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-secondary transition text-xs shadow-sm"
              >
                + Upload to this Folder
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {displayedPhotos.map((photo) => {
                const isSelected = selectedIds.has(photo.id)
                const photoFolder = folders.find((f) => f.id === photo.folderId)
                return (
                  <div
                    key={photo.id}
                    className={`group relative aspect-square rounded-2xl overflow-hidden bg-gray-100 border-2 transition-all shadow-sm hover:shadow-md ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Square Image */}
                    <img
                      src={photo.image}
                      alt="Artwork"
                      className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-300"
                      onClick={() => setPreviewImage(photo.image)}
                    />

                    {/* Selection Checkbox */}
                    <div className="absolute top-2 left-2 z-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(photo.id)}
                        className="w-5 h-5 rounded cursor-pointer accent-primary bg-white/90 shadow-sm"
                      />
                    </div>

                    {/* Single Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteSingle(photo.id)}
                      className="absolute top-2 right-2 z-10 w-7 h-7 bg-red-600/90 hover:bg-red-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                      title="Permanently delete photo"
                    >
                      <span className="text-sm font-bold">×</span>
                    </button>

                    {/* Folder Badge on photo */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                      {photoFolder ? (
                        <span
                          className={`text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm ${
                            photoFolder.isPrivate
                              ? 'bg-purple-900/90 text-purple-200 border border-purple-700/50'
                              : 'bg-emerald-900/90 text-emerald-200 border border-emerald-700/50'
                          }`}
                        >
                          {photoFolder.isPrivate ? '🔒' : '🌐'} {photoFolder.name}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-black/60 text-gray-300">
                          Uncategorized
                        </span>
                      )}

                      <span className="text-[9px] font-bold text-gray-200 bg-black/60 px-1.5 py-0.5 rounded-full">
                        {photo.createdAt ? photo.createdAt.split('T')[0] : ''}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Multi-Image Upload Modal */}
      {showUploadModal && (
        <MultiImageUploadModal
          defaultFolderId={selectedFolderId !== 'all' && selectedFolderId !== 'uncategorized' ? selectedFolderId : undefined}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            fetchPhotos()
            fetchFolders()
          }}
        />
      )}

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-extrabold text-gray-900">
                📁 Create New Artwork Folder
              </h3>
              <button
                onClick={() => setShowCreateFolderModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Folder Name:
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Truck Show Fitting, Radium Stickers"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  Visibility (Who can view these artworks?):
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewFolderIsPrivate(false)}
                    className={`p-3 rounded-xl border text-left transition ${
                      !newFolderIsPrivate
                        ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs text-emerald-800">
                      <span>🌐</span> Public
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Visible on the website gallery to all customers
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewFolderIsPrivate(true)}
                    className={`p-3 rounded-xl border text-left transition ${
                      newFolderIsPrivate
                        ? 'border-purple-500 bg-purple-50/80 ring-2 ring-purple-500/20'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs text-purple-800">
                      <span>🔒</span> Private
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Hidden from visitors, visible ONLY to admin
                    </p>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateFolderModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFolder}
                  className="px-5 py-2 bg-primary hover:bg-secondary text-white font-bold rounded-xl text-xs shadow-sm disabled:opacity-50"
                >
                  {isSubmittingFolder ? 'Creating...' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Folder Modal */}
      {showRenameModal && renamingFolder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-base font-extrabold text-gray-900 mb-3">
              ✏️ Rename Folder
            </h3>
            <form onSubmit={handleRenameFolder} className="space-y-4">
              <input
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRenameModal(false)}
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-secondary text-white font-bold rounded-xl text-xs"
                >
                  Save Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Folder Modal */}
      {showDeleteFolderModal && deletingFolder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-base font-extrabold text-gray-900">
                Delete Folder: &quot;{deletingFolder.name}&quot;?
              </h3>
            </div>
            <p className="text-xs text-gray-600 mb-4">
              What would you like to do with the photos currently inside this folder?
            </p>

            <div className="space-y-2.5 mb-5 text-xs">
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="deletePhotos"
                  checked={!deleteFolderWithPhotos}
                  onChange={() => setDeleteFolderWithPhotos(false)}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <strong className="block text-gray-900">Keep photos (Move to Uncategorized)</strong>
                  <span className="text-gray-500">The folder will be deleted, but artworks remain in your library.</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-red-200 bg-red-50 cursor-pointer">
                <input
                  type="radio"
                  name="deletePhotos"
                  checked={deleteFolderWithPhotos}
                  onChange={() => setDeleteFolderWithPhotos(true)}
                  className="mt-0.5 accent-red-600"
                />
                <div>
                  <strong className="block text-red-900">Permanently delete all photos inside</strong>
                  <span className="text-red-700">All artworks in this folder will be deleted and recorded in tombstone tracker.</span>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteFolderModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFolder}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm"
              >
                Delete Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Photos Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-base font-extrabold text-gray-900 mb-2">
              📁 Move {selectedIds.size} Photo(s)
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Select destination folder for the selected artworks:
            </p>

            <select
              value={targetMoveFolderId}
              onChange={(e) => setTargetMoveFolderId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-semibold mb-5 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">📁 General / Uncategorized (Public)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.isPrivate ? '🔒' : '🌐'} {f.name} {f.isPrivate ? '(Private)' : '(Public)'}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMoveModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMovePhotos}
                disabled={isMoving}
                className="px-4 py-2 bg-primary hover:bg-secondary text-white font-bold rounded-xl text-xs shadow-sm disabled:opacity-50"
              >
                {isMoving ? 'Moving...' : 'Move Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deleted Photos History Modal */}
      {showDeletedModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <span>🗑️ Live Deletion Tracking Log</span>
                  <span className="text-xs font-bold bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full">
                    {deletedStats?.totalCount || 0} Total Deleted
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Tombstone log ensuring deleted photos never resurrect on URL reloads or cold starts
                </p>
              </div>
              <button
                onClick={() => setShowDeletedModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-2">
              {(!deletedStats || deletedStats.recentDeletions.length === 0) ? (
                <div className="text-center py-12 text-gray-400 text-xs">
                  No deleted photos recorded yet.
                </div>
              ) : (
                deletedStats.recentDeletions.map((item, idx) => (
                  <div
                    key={`${item.id}_${idx}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-mono text-gray-800 font-bold block">
                          ID: {item.id}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Tombstone Locked • Status: Permanently Deleted
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-gray-500 font-medium">
                      {item.deletedAt ? new Date(item.deletedAt).toLocaleString() : 'Recently'}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowDeletedModal(false)}
                className="px-4 py-2 bg-gray-900 text-white font-bold rounded-xl text-xs hover:bg-black transition"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-size Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain border border-white/20"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-4 -right-4 bg-white text-gray-800 rounded-full w-9 h-9 flex items-center justify-center text-xl font-bold shadow-lg hover:bg-gray-100"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* LIVE DELETION PROGRESS MODAL (Real-time percentage & animated progress bar: "show 65% delete like this") */}
      {deleteProgress && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 border border-red-800/60 relative overflow-hidden">
            {/* Ambient Red Glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center text-center">
              {/* Animated Icon */}
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg mb-4 border ${
                  deleteProgress.isComplete
                    ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-400 shadow-emerald-950/60'
                    : 'bg-red-600/30 border-red-500/50 text-red-400 shadow-red-950/60 animate-pulse'
                }`}
              >
                {deleteProgress.isComplete ? '✅' : '🗑️'}
              </div>

              {/* Title */}
              <h3 className="text-xl font-black tracking-tight text-white">
                {deleteProgress.isComplete ? 'Artworks Permanently Deleted!' : 'Deleting Artworks in Progress...'}
              </h3>

              <p className="text-xs text-gray-300 mt-1 max-w-sm">
                {deleteProgress.isComplete
                  ? 'All selected photos have been securely deleted, tombstone locked, and removed from server and cache.'
                  : 'Removing artwork files from database, registering permanent tombstone locks, and syncing live state.'}
              </p>

              {/* Large Percentage Badge (The "show 65% delete like this" feature) */}
              <div className="my-6 flex flex-col items-center">
                <div className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-red-400 via-rose-300 to-amber-300 bg-clip-text text-transparent tracking-tight">
                  {deleteProgress.percentage}%
                </div>
                <div className="text-xs uppercase tracking-widest font-extrabold text-red-300 mt-1">
                  {deleteProgress.isComplete ? '100% Deletion Finished' : `${deleteProgress.percentage}% Deleted`}
                </div>
              </div>

              {/* Glowing Progress Bar */}
              <div className="w-full bg-gray-800/90 rounded-full h-4 p-1 border border-red-700/60 overflow-hidden shadow-inner mb-3 relative">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-400 transition-all duration-300 ease-out shadow-lg shadow-red-500/50 relative"
                  style={{ width: `${Math.min(100, Math.max(0, deleteProgress.percentage))}%` }}
                >
                  <span className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                </div>
              </div>

              {/* Real-time details */}
              <div className="flex justify-between items-center w-full text-xs text-gray-400 font-medium px-1">
                <span>
                  Processed: <strong className="text-white">{deleteProgress.current}</strong> / {deleteProgress.total}
                </span>
                <span className="text-amber-300 font-semibold truncate max-w-[200px]">
                  {deleteProgress.currentBatchText}
                </span>
              </div>

              {/* Tombstone Security Note */}
              <div className="mt-5 p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-[11px] text-red-200 flex items-center gap-2 text-left">
                <span className="text-base">🔒</span>
                <span>
                  <strong>Guaranteed Tombstone Protection:</strong> Deleted IDs are stored permanently in the database so they will never reappear on reload or WhatsApp links.
                </span>
              </div>

              {/* Action Button */}
              {deleteProgress.isComplete ? (
                <button
                  onClick={() => setDeleteProgress(null)}
                  className="mt-6 w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-sm transition shadow-lg shadow-emerald-900/40"
                >
                  Done & Refresh Library
                </button>
              ) : (
                <div className="mt-4 flex items-center gap-2 text-[11px] text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Processing batch deletion... Please keep browser open.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
