'use client'

import { useState, useRef } from 'react'

interface MultiImageUploadModalProps {
  onClose: () => void
  onSuccess: () => void
}

async function safelyOptimizeImage(file: File): Promise<File | Blob> {
  // If file is already smaller than 1.2 MB, return it as-is
  if (file.size <= 1.2 * 1024 * 1024) {
    return file
  }

  // 3-second safety timeout so image processing NEVER hangs
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(file), 3000)

    try {
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        clearTimeout(timer)
        URL.revokeObjectURL(url)

        try {
          const maxDimension = 1600
          let w = img.naturalWidth || img.width
          let h = img.naturalHeight || img.height

          if (w > maxDimension || h > maxDimension) {
            if (w > h) {
              h = Math.round((h * maxDimension) / w)
              w = maxDimension
            } else {
              w = Math.round((w * maxDimension) / h)
              h = maxDimension
            }
          }

          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(file)
            return
          }

          ctx.drawImage(img, 0, 0, w, h)
          canvas.toBlob(
            (blob) => {
              if (blob && blob.size < file.size) {
                resolve(blob)
              } else {
                resolve(file)
              }
            },
            'image/jpeg',
            0.82
          )
        } catch {
          resolve(file)
        }
      }

      img.onerror = () => {
        clearTimeout(timer)
        URL.revokeObjectURL(url)
        resolve(file)
      }

      img.src = url
    } catch {
      clearTimeout(timer)
      resolve(file)
    }
  })
}

export default function MultiImageUploadModal({
  onClose,
  onSuccess,
}: MultiImageUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{
    current: number
    total: number
    currentFileName?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)

    const newFiles = Array.from(files).filter((file) =>
      file.type.startsWith('image/')
    )

    if (newFiles.length === 0) {
      setError('Please select valid image files')
      return
    }

    const updatedFiles = [...selectedFiles, ...newFiles]
    setSelectedFiles(updatedFiles)

    // Generate previews
    const newPreviews = newFiles.map((file) => URL.createObjectURL(file))
    setPreviews((prev) => [...prev, ...newPreviews])
  }

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index])
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one image to upload')
      return
    }

    const token = localStorage.getItem('adminToken')
    if (!token) {
      setError('Admin session not found. Please log in again.')
      setTimeout(() => {
        window.location.href = '/admin'
      }, 1500)
      return
    }

    setLoading(true)
    setError(null)
    setUploadProgress({ current: 0, total: selectedFiles.length })

    let successCount = 0
    const errors: string[] = []

    // Upload each image one-by-one so you can upload as many as you want without hitting the 4.5MB cloud limit!
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      setUploadProgress({
        current: i + 1,
        total: selectedFiles.length,
        currentFileName: file.name,
      })

      try {
        const optimized = await safelyOptimizeImage(file)
        const formData = new FormData()
        formData.append('images', optimized, file.name)

        const response = await fetch('/api/gallery', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })

        if (response.ok) {
          successCount++
        } else {
          if (response.status === 401) {
            localStorage.removeItem('adminToken')
            setError('Admin session expired. Redirecting to login...')
            setTimeout(() => {
              window.location.href = '/admin'
            }, 1500)
            setLoading(false)
            setUploadProgress(null)
            return
          }
          const errData = await response.json().catch(() => ({}))
          errors.push(`${file.name}: ${errData.message || 'Upload failed'}`)
        }
      } catch (err: any) {
        errors.push(`${file.name}: ${err?.message || 'Network error'}`)
      }
    }

    setLoading(false)
    setUploadProgress(null)

    if (successCount > 0) {
      previews.forEach((url) => URL.revokeObjectURL(url))
      onSuccess()
      if (errors.length === 0) {
        onClose()
      } else {
        setError(
          `Uploaded ${successCount} of ${selectedFiles.length} images. Failed for: ${errors.join(', ')}`
        )
      }
    } else {
      setError(`Upload failed: ${errors.join('; ')}`)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 md:p-8 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Upload Artwork Images
            </h2>
            <p className="text-sm text-gray-500">
              Select or drop multiple images to add them to the public gallery
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
            disabled={loading}
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Live Upload Progress Indicator */}
        {uploadProgress && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl shadow-inner">
            <div className="flex justify-between text-xs font-bold text-orange-950 mb-1.5">
              <span>
                Uploading image {uploadProgress.current} of {uploadProgress.total}...
              </span>
              <span>
                {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-orange-200 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                }}
              />
            </div>
            {uploadProgress.currentFileName && (
              <p className="text-[11px] text-gray-500 mt-1.5 truncate">
                File: {uploadProgress.currentFileName}
              </p>
            )}
          </div>
        )}

        {/* Drag and Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
            dragOver
              ? 'border-primary bg-orange-50/50'
              : 'border-gray-300 hover:border-primary hover:bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center">
            <span className="text-4xl mb-3">🖼️</span>
            <p className="font-semibold text-gray-700">
              Click to choose multiple images or drag & drop here
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Supports PNG, JPG, JPEG, WebP (multiple selection supported)
            </p>
          </div>
        </div>

        {/* Selected Images Preview Grid */}
        {selectedFiles.length > 0 && (
          <div className="mt-4 flex-1 overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-700">
                {selectedFiles.length} image{selectedFiles.length !== 1 ? 's' : ''} ready to upload:
              </span>
              <button
                type="button"
                onClick={() => {
                  previews.forEach((url) => URL.revokeObjectURL(url))
                  setSelectedFiles([])
                  setPreviews([])
                }}
                className="text-xs text-red-600 hover:underline"
              >
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 p-1">
              {previews.map((previewUrl, index) => (
                <div
                  key={index}
                  className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100"
                >
                  <img
                    src={previewUrl}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(index)
                    }}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-80 hover:opacity-100 shadow transition"
                    title="Remove image"
                  >
                    ×
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] p-1 truncate text-center">
                    {selectedFiles[index]?.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 pt-4 border-t flex gap-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={loading || selectedFiles.length === 0}
            className="flex-1 px-4 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-secondary transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && uploadProgress ? (
              <>
                <span className="animate-spin text-lg">⏳</span>
                <span>
                  Uploading {uploadProgress.current}/{uploadProgress.total}...
                </span>
              </>
            ) : loading ? (
              <>
                <span className="animate-spin text-lg">⏳</span> Uploading...
              </>
            ) : (
              `Upload ${selectedFiles.length > 0 ? selectedFiles.length : ''} Image${
                selectedFiles.length !== 1 ? 's' : ''
              }`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

