'use client'

import { useState, useEffect } from 'react'
import MultiImageUploadModal from './MultiImageUploadModal'

export interface GalleryPhoto {
  id: string
  image: string
  createdAt: string
}

export default function AdminGalleryManager() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  useEffect(() => {
    fetchPhotos()
  }, [])

  const fetchPhotos = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/gallery?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (res.ok) {
        const data = await res.json()
        setPhotos(data)
      }
    } catch (err) {
      console.error('Error fetching gallery:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSingle = async (id: string) => {
    if (!confirm('Are you sure you want to delete this photo from the gallery?'))
      return

    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/gallery/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== id))
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    } catch (err) {
      console.error('Error deleting photo:', err)
    }
  }

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
    if (selectedIds.size === photos.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(photos.map((p) => p.id)))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    if (
      !confirm(
        `Are you sure you want to delete ${selectedIds.size} selected image(s)?`
      )
    )
      return

    const token = localStorage.getItem('adminToken')
    for (const id of Array.from(selectedIds)) {
      try {
        await fetch(`/api/gallery/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch (e) {
        console.error('Delete error for id', id, e)
      }
    }

    setSelectedIds(new Set())
    fetchPhotos()
  }

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            Artwork Gallery ({photos.length} Photos)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Photos shown in the square box gallery on the public storefront
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {photos.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="px-3.5 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
            >
              {selectedIds.size === photos.length
                ? 'Deselect All'
                : 'Select All'}
            </button>
          )}

          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="px-3.5 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition shadow-sm"
            >
              🗑️ Delete Selected ({selectedIds.size})
            </button>
          )}

          <button
            onClick={() => setShowUploadModal(true)}
            className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-secondary transition shadow-sm flex items-center gap-2"
          >
            <span>+</span> Upload Images (Multiple)
          </button>
        </div>
      </div>

      {/* Photos Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-gray-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <span className="text-5xl mb-3 block">🖼️</span>
          <p className="text-gray-600 font-semibold text-lg">No photos in gallery yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Click &quot;Upload Images&quot; above to select multiple artwork photos
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="mt-4 px-5 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition text-sm"
          >
            Upload Images
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {photos.map((photo) => {
            const isSelected = selectedIds.has(photo.id)
            return (
              <div
                key={photo.id}
                className={`group relative aspect-square rounded-xl overflow-hidden bg-gray-100 border-2 transition-all shadow-sm hover:shadow-md ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-transparent hover:border-gray-300'
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
                    className="w-5 h-5 rounded cursor-pointer accent-primary bg-white/80 backdrop-blur-sm"
                  />
                </div>

                {/* Single Delete Button */}
                <button
                  type="button"
                  onClick={() => handleDeleteSingle(photo.id)}
                  className="absolute top-2 right-2 z-10 w-7 h-7 bg-red-600/90 hover:bg-red-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                  title="Delete image"
                >
                  <span className="text-sm">×</span>
                </button>

                {/* Date Tag */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white text-[11px] opacity-0 group-hover:opacity-100 transition">
                  {photo.createdAt ? photo.createdAt.split('T')[0] : 'Artwork'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Multi-Image Upload Modal */}
      {showUploadModal && (
        <MultiImageUploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => fetchPhotos()}
        />
      )}

      {/* Image Preview Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
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
    </div>
  )
}

