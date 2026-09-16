'use client'

import { useEffect, useState } from 'react'

interface GalleryItem {
  id: string
  image: string
  createdAt: string
}

export default function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null)

  useEffect(() => {
    fetchGallery()
  }, [])

  const fetchGallery = async () => {
    try {
      setLoading(true)
      // 1. Fetch first 15 images for instantaneous (<300ms) initial render
      const response = await fetch('/api/gallery?limit=15&page=1')
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data) && data.length > 0) {
          setItems(data)
          setLoading(false)

          // 2. Fetch remaining images smoothly in the background without UI delay
          fetch('/api/gallery')
            .then((res) => (res.ok ? res.json() : []))
            .then((allData) => {
              if (Array.isArray(allData) && allData.length > data.length) {
                setItems(allData)
              }
            })
            .catch(() => {})
          return
        }
      }

      // Fallback if limit param wasn't returned
      const fallback = await fetch('/api/gallery')
      if (fallback.ok) {
        const full = await fallback.json()
        setItems(full)
      }
    } catch (error) {
      console.error('Error fetching gallery:', error)
    } finally {
      setLoading(false)
    }
  }

  const openLightbox = (index: number) => {
    setActiveLightboxIndex(index)
  }

  const closeLightbox = () => {
    setActiveLightboxIndex(null)
  }

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (activeLightboxIndex !== null && items.length > 0) {
      setActiveLightboxIndex((activeLightboxIndex + 1) % items.length)
    }
  }

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (activeLightboxIndex !== null && items.length > 0) {
      setActiveLightboxIndex(
        (activeLightboxIndex - 1 + items.length) % items.length
      )
    }
  }

  return (
    <section id="gallery" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      {/* Section Title */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <span className="text-secondary font-bold text-xs uppercase tracking-widest bg-orange-100 px-3 py-1 rounded-full">
          Handcrafted Portfolio
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-3 tracking-tight">
          Redium Art &amp; Truck Show Fitting Gallery
        </h2>
        <p className="text-gray-600 mt-2 text-sm sm:text-base">
          Browse our precision crafted redium designs, monograms, truck fittings, and custom artworks.
        </p>
      </div>

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
      ) : items.length > 0 ? (
        /* Structured Square Box Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5">
          {items.map((item, index) => (
            <div
              key={item.id}
              onClick={() => openLightbox(index)}
              className="group relative aspect-square rounded-2xl overflow-hidden bg-gray-100 shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1.5"
            >
              {/* Square Image */}
              <img
                src={item.image}
                alt={`Jay Mataji Redium Artwork ${index + 1}`}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                loading="lazy"
              />

              {/* Elegant Hover Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 sm:p-4 text-white">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  Jay Mataji Art
                </span>
                <p className="text-sm font-bold truncate">Click to View Full Size</p>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-white/90">
                  <span>🔍</span>
                  <span>Zoom / Details</span>
                </div>
              </div>

              {/* Subtle Badge */}
              <div className="absolute top-2.5 right-2.5 bg-black/40 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full opacity-80 group-hover:opacity-0 transition-opacity">
                #{index + 1}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
          <span className="text-5xl mb-3 block">🎨</span>
          <p className="text-gray-600 font-semibold text-lg">Artwork collection coming soon</p>
          <p className="text-gray-400 text-sm mt-1">
            We are curating our newest redium art and truck show fitting designs.
          </p>
        </div>
      )}

      {/* Lightbox Modal */}
      {activeLightboxIndex !== null && items[activeLightboxIndex] && (
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
          {items.length > 1 && (
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
              src={items[activeLightboxIndex].image}
              alt="Full Size Artwork"
              className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 w-full bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl text-white">
              <div>
                <p className="font-bold text-sm sm:text-base">
                  Jay Mataji Redium Art &amp; Truck Show Fitting
                </p>
                <p className="text-xs text-white/70">
                  Artwork #{activeLightboxIndex + 1} of {items.length}
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
          {items.length > 1 && (
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
