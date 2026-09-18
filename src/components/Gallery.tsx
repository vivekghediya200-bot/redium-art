'use client'

import { useEffect, useState, useMemo, useRef } from 'react'

interface GalleryItem {
  id: string
  image: string
  folderId?: string
  createdAt: string
}

interface GalleryFolder {
  id: string
  name: string
  isPrivate: boolean
}

export default function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [folders, setFolders] = useState<GalleryFolder[]>([])
  const [activeFolderId, setActiveFolderId] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null)
  const isFetchingRef = useRef(false)

  useEffect(() => {
    // Initial fetch
    fetchGallery(true)
    fetchFolders()

    // Auto-update: periodically check for newly uploaded/updated images every 25 seconds
    const interval = setInterval(() => {
      fetchGallery(false)
      fetchFolders()
    }, 25000)

    // Auto-update on window focus / tab switch
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchGallery(false)
        fetchFolders()
      }
    }
    window.addEventListener('focus', handleVisibility)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleVisibility)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const fetchFolders = async () => {
    try {
      const res = await fetch(`/api/gallery/folders?publicOnly=true&t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setFolders(data)
        }
      }
    } catch (err) {
      console.error('Error fetching public folders:', err)
    }
  }

  const fetchGallery = async (showLoader = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    try {
      if (showLoader) setLoading(true)
      const now = Date.now()

      // 1. Instant fetch of initial public photos
      const response = await fetch(`/api/gallery?publicOnly=true&limit=25&page=1&t=${now}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })

      if (response.ok) {
        const initialData = await response.json()
        if (Array.isArray(initialData) && initialData.length > 0) {
          setItems(initialData)
          if (showLoader) setLoading(false)

          // 2. Fetch full public set in background
          fetch(`/api/gallery?publicOnly=true&t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' },
          })
            .then((res) => (res.ok ? res.json() : []))
            .then((allData) => {
              if (Array.isArray(allData)) {
                setItems(allData)
              }
            })
            .catch(() => {})
          return
        }
      }

      // Fallback
      const fallback = await fetch(`/api/gallery?publicOnly=true&t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (fallback.ok) {
        const full = await fallback.json()
        if (Array.isArray(full)) {
          setItems(full)
        }
      }
    } catch (error) {
      console.error('Error fetching public gallery:', error)
    } finally {
      if (showLoader) setLoading(false)
      isFetchingRef.current = false
    }
  }

  // Count photos per public folder
  const folderCounts = useMemo(() => {
    const map: Record<string, number> = { all: items.length, uncategorized: 0 }
    for (const item of items) {
      if (item.folderId) {
        map[item.folderId] = (map[item.folderId] || 0) + 1
      } else {
        map.uncategorized = (map.uncategorized || 0) + 1
      }
    }
    return map
  }, [items])

  // Filter items by active folder pill
  const displayedItems = useMemo(() => {
    if (activeFolderId === 'all') return items
    if (activeFolderId === 'uncategorized') {
      return items.filter((item) => !item.folderId)
    }
    return items.filter((item) => item.folderId === activeFolderId)
  }, [items, activeFolderId])

  const openLightbox = (index: number) => {
    setActiveLightboxIndex(index)
  }

  const closeLightbox = () => {
    setActiveLightboxIndex(null)
  }

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (activeLightboxIndex !== null && displayedItems.length > 0) {
      setActiveLightboxIndex((activeLightboxIndex + 1) % displayedItems.length)
    }
  }

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (activeLightboxIndex !== null && displayedItems.length > 0) {
      setActiveLightboxIndex(
        (activeLightboxIndex - 1 + displayedItems.length) % displayedItems.length
      )
    }
  }

  return (
    <section id="gallery" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      {/* Section Title */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="text-secondary font-bold text-xs uppercase tracking-widest bg-orange-100 px-3 py-1 rounded-full">
          Handcrafted Portfolio
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-3 tracking-tight">
          Redium Art &amp; Truck Show Fitting Gallery
        </h2>
        <p className="text-gray-600 mt-2 text-sm sm:text-base">
          Explore our custom truck fittings, laser-cut redium designs, monograms, and custom show fittings organized by design categories.
        </p>
      </div>

      {/* User-Side Folder & Category Filter Pills */}
      {folders.length > 0 && (
        <div className="flex items-center justify-center gap-2 flex-wrap mb-10">
          <button
            onClick={() => setActiveFolderId('all')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition shadow-sm flex items-center gap-1.5 ${
              activeFolderId === 'all'
                ? 'bg-primary text-white shadow-md scale-105'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <span>🌟</span> All Designs
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                activeFolderId === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {items.length}
            </span>
          </button>

          {folders.map((folder) => {
            const count = folderCounts[folder.id] || 0
            const isSelected = activeFolderId === folder.id
            return (
              <button
                key={folder.id}
                onClick={() => setActiveFolderId(folder.id)}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition shadow-sm flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-primary text-white shadow-md scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span>📂</span> {folder.name}
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-orange-100 text-orange-800'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}

          {(folderCounts.uncategorized || 0) > 0 && (
            <button
              onClick={() => setActiveFolderId('uncategorized')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition shadow-sm flex items-center gap-1.5 ${
                activeFolderId === 'uncategorized'
                  ? 'bg-primary text-white shadow-md scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <span>✨</span> Other Work
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  activeFolderId === 'uncategorized'
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {folderCounts.uncategorized}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl animate-pulse shadow-sm"
            />
          ))}
        </div>
      ) : displayedItems.length > 0 ? (
        /* Structured Square Box Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5">
          {displayedItems.map((item, index) => {
            const folderName = folders.find((f) => f.id === item.folderId)?.name
            return (
              <div
                key={item.id}
                onClick={() => openLightbox(index)}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-gray-100 shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1.5 border border-gray-100"
              >
                {/* Square Image */}
                <img
                  src={item.image}
                  alt={`Jay Mataji Redium Artwork ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                  loading="lazy"
                />

                {/* Elegant Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 sm:p-4 text-white">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    {folderName || 'Jay Mataji Art'}
                  </span>
                  <p className="text-sm font-bold truncate">Click to View Full Size</p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-white/90">
                    <span>🔍</span>
                    <span>Zoom Artwork</span>
                  </div>
                </div>

                {/* Subtle Folder Category Pill on Corner */}
                {folderName && (
                  <div className="absolute top-2.5 left-2.5 bg-black/50 backdrop-blur-md text-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full opacity-90 group-hover:opacity-0 transition-opacity">
                    {folderName}
                  </div>
                )}

                {/* Index Badge */}
                <div className="absolute top-2.5 right-2.5 bg-black/40 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full opacity-80 group-hover:opacity-0 transition-opacity">
                  #{index + 1}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
          <span className="text-5xl mb-3 block">🎨</span>
          <p className="text-gray-700 font-bold text-lg">No photos in this category yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Check out other design categories above or explore our entire collection.
          </p>
          <button
            onClick={() => setActiveFolderId('all')}
            className="mt-4 px-5 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-sm hover:bg-secondary transition"
          >
            Show All Designs
          </button>
        </div>
      )}

      {/* Lightbox Modal */}
      {activeLightboxIndex !== null && displayedItems[activeLightboxIndex] && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-opacity"
          onClick={closeLightbox}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl font-bold bg-white/10 hover:bg-white/20 rounded-full w-12 h-12 flex items-center justify-center transition z-50"
            title="Close (Esc)"
          >
            ×
          </button>

          {/* Navigation Prev Button */}
          {displayedItems.length > 1 && (
            <button
              onClick={prevImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-2xl font-bold bg-white/10 hover:bg-white/20 rounded-full w-12 h-12 flex items-center justify-center transition z-50"
              title="Previous"
            >
              ‹
            </button>
          )}

          {/* Active Image Box */}
          <div
            className="relative max-w-4xl max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={displayedItems[activeLightboxIndex].image}
              alt="Full Size Artwork"
              className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 w-full bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl text-white">
              <div>
                <p className="font-bold text-sm sm:text-base">
                  Jay Mataji Redium Art &amp; Truck Show Fitting
                </p>
                <p className="text-xs text-white/70">
                  Artwork #{activeLightboxIndex + 1} of {displayedItems.length}
                  {displayedItems[activeLightboxIndex].folderId && (
                    <span className="ml-2 px-2 py-0.5 bg-amber-400/20 text-amber-300 font-semibold rounded-full text-[10px]">
                      {folders.find((f) => f.id === displayedItems[activeLightboxIndex].folderId)?.name || ''}
                    </span>
                  )}
                </p>
              </div>

              <a
                href={`https://wa.me/916353016927?text=${encodeURIComponent(
                  `Hello Jay Mataji Redium Art, I am interested in custom work for artwork #${
                    activeLightboxIndex + 1
                  }`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white font-semibold text-xs rounded-lg transition flex items-center gap-1.5"
              >
                <span>💬</span> Inquire on WhatsApp
              </a>
            </div>
          </div>

          {/* Navigation Next Button */}
          {displayedItems.length > 1 && (
            <button
              onClick={nextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-2xl font-bold bg-white/10 hover:bg-white/20 rounded-full w-12 h-12 flex items-center justify-center transition z-50"
              title="Next"
            >
              ›
            </button>
          )}
        </div>
      )}
    </section>
  )
}
