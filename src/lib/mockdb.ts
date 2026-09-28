import fs from 'fs'
import path from 'path'
import os from 'os'
import bcrypt from 'bcryptjs'

const ROOT_DATA_DIR = path.join(process.cwd(), 'data')
const IS_SERVERLESS = Boolean(
  process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NODE_ENV === 'production'
)
const DATA_DIR = IS_SERVERLESS ? path.join(os.tmpdir(), 'jaymataji_data') : ROOT_DATA_DIR

const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json')
const GALLERY_FILE = path.join(DATA_DIR, 'gallery.json')
const GALLERY_FOLDERS_FILE = path.join(DATA_DIR, 'gallery_folders.json')
const DELETED_GALLERY_FILE = path.join(DATA_DIR, 'deleted_gallery.json')
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json')
const INVOICES_FILE = path.join(DATA_DIR, 'invoices.json')
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json')

// Cloud Blob Pathnames
export const CLOUD_INVOICES_PATH = 'invoices.json'
export const CLOUD_CUSTOMERS_PATH = 'customers.json'
export const CLOUD_GALLERY_PATH = 'gallery.json'
export const CLOUD_FOLDERS_PATH = 'gallery_folders.json'
export const CLOUD_DELETED_GALLERY_PATH = 'deleted_gallery.json'
export const CLOUD_ADMINS_PATH = 'admin_credentials.json'

function ensureDirAndSeed() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    if (DATA_DIR !== ROOT_DATA_DIR && fs.existsSync(ROOT_DATA_DIR)) {
      const files = [
        'products.json',
        'gallery.json',
        'gallery_folders.json',
        'deleted_gallery.json',
        'customers.json',
        'invoices.json',
        'admins.json',
      ]
      for (const f of files) {
        const src = path.join(ROOT_DATA_DIR, f)
        const dst = path.join(DATA_DIR, f)
        const needsCopy = !fs.existsSync(dst) || (fs.existsSync(dst) && fs.statSync(dst).size === 0)
        if (fs.existsSync(src) && needsCopy) {
          try {
            fs.copyFileSync(src, dst)
          } catch (e) {
            console.error('Error seeding file to tmp:', f, e)
          }
        }
      }
    }
  } catch (err) {
    console.error('Error ensuring DATA_DIR:', err)
  }
}

ensureDirAndSeed()

function safeReadFile(filePath: string): string {
  try {
    ensureDirAndSeed()
    let content = ''
    if (!fs.existsSync(filePath) || (fs.existsSync(filePath) && fs.statSync(filePath).size === 0)) {
      const baseName = path.basename(filePath)
      const rootFallback = path.join(ROOT_DATA_DIR, baseName)
      if (fs.existsSync(rootFallback)) {
        content = fs.readFileSync(rootFallback, 'utf-8')
      } else {
        return '[]'
      }
    } else {
      content = fs.readFileSync(filePath, 'utf-8')
    }
    if (!content || !content.trim()) {
      const baseName = path.basename(filePath)
      const rootFallback = path.join(ROOT_DATA_DIR, baseName)
      if (fs.existsSync(rootFallback)) {
        content = fs.readFileSync(rootFallback, 'utf-8')
      }
    }
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1)
    }
    return content
  } catch (e) {
    console.error('safeReadFile error for', filePath, e)
    return '[]'
  }
}

function safeWriteFile(filePath: string, content: string): boolean {
  try {
    ensureDirAndSeed()
    fs.writeFileSync(filePath, content, 'utf-8')
    if (DATA_DIR !== ROOT_DATA_DIR && fs.existsSync(ROOT_DATA_DIR)) {
      try {
        const rootCopy = path.join(ROOT_DATA_DIR, path.basename(filePath))
        fs.writeFileSync(rootCopy, content, 'utf-8')
      } catch {}
    }
    return true
  } catch (err: any) {
    console.error('safeWriteFile primary error:', err)
    if (err.code === 'EROFS' || err.code === 'EACCES') {
      try {
        const tmpFallback = path.join(os.tmpdir(), 'jaymataji_data', path.basename(filePath))
        fs.mkdirSync(path.dirname(tmpFallback), { recursive: true })
        fs.writeFileSync(tmpFallback, content, 'utf-8')
        return true
      } catch (e2) {
        console.error('safeWriteFile fallback error:', e2)
      }
    }
    return false
  }
}

/* =========================================================
   VERCEL CLOUD BLOB RESILIENT READ / WRITE HELPERS
   ========================================================= */

export async function readFromCloudBlob<T>(pathname: string, fallback: T): Promise<T> {
  try {
    const { get } = await import('@vercel/blob')
    const response = await get(pathname, { access: 'private' })
    if (response && response.stream) {
      const text = await new Response(response.stream).text()
      if (text && text.trim()) {
        return JSON.parse(text) as T
      }
    }
  } catch (err: any) {
    // Expected fallback if offline, store not configured, or blob does not exist yet
  }
  return fallback
}

export async function writeToCloudBlob<T>(
  pathname: string,
  data: T,
  localFilePath?: string
): Promise<boolean> {
  if (localFilePath) {
    safeWriteFile(localFilePath, JSON.stringify(data, null, 2))
  }
  try {
    const { put } = await import('@vercel/blob')
    await put(pathname, JSON.stringify(data, null, 2), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    return true
  } catch (err) {
    console.error(`writeToCloudBlob error for ${pathname}:`, err)
    return false
  }
}

/* =========================================================
   INTERFACES
   ========================================================= */

export interface GalleryFolder {
  id: string
  name: string
  isPrivate: boolean // true = Admin Only (Hidden from public website), false = Public (Shown on website)
  createdAt: string
  updatedAt: string
}

export interface GalleryItem {
  id: string
  image: string
  folderId?: string
  isPrivate?: boolean
  createdAt: string
}

export interface DeletedGalleryItem {
  id: string
  deletedAt: string
}

export interface Customer {
  id: string
  name: string
  mobile: string
  createdAt: string
  updatedAt: string
}

export interface InvoiceItem {
  sr: number
  description: string
  qty: number
  rate: number
  total: number
}

export interface Invoice {
  id: string
  customerId: string
  customerName: string
  customerMobile: string
  viaCustomer?: string
  date: string
  businessName: string
  businessMobile: string
  businessAddress: string
  businessOwner?: string
  paymentStatus?: 'PAID' | 'PENDING'
  paymentMethod?: 'CASH' | 'UPI' | 'CARD'
  items: InvoiceItem[]
  subtotal: number
  grandTotal: number
  notes?: string
  createdAt: string
  updatedAt: string
}

const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@jaymataji.com').toLowerCase().trim()
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123'

// In-memory cache variables for instant responses
let inMemoryInvoicesCache: Invoice[] | null = null
let inMemoryCustomersCache: Customer[] | null = null
let inMemoryFoldersCache: GalleryFolder[] | null = null
let inMemoryDeletedGalleryCache: DeletedGalleryItem[] | null = null
let inMemoryGalleryCache: GalleryItem[] | null = null
let inMemoryGalleryMtime = 0

// Initialize default admin if not exists
async function initializeAdmin(): Promise<void> {
  let admins: any[] = []
  const cloudAdmins = await getCloudAdminCredentials()
  if (cloudAdmins && cloudAdmins.length > 0) {
    admins = cloudAdmins
    safeWriteFile(ADMINS_FILE, JSON.stringify(admins, null, 2))
    return
  }

  if (fs.existsSync(ADMINS_FILE)) {
    try {
      const content = safeReadFile(ADMINS_FILE)
      admins = JSON.parse(content)
      if (!Array.isArray(admins)) admins = []
    } catch {
      admins = []
    }
  }

  if (admins.length === 0) {
    const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10)
    admins = [
      {
        id: '1',
        email: DEFAULT_ADMIN_EMAIL,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
      },
    ]
    safeWriteFile(ADMINS_FILE, JSON.stringify(admins, null, 2))
    await saveCloudAdminCredentials(admins)
  }
}

// Initialize default files locally
function initializeFiles(): void {
  ensureDirAndSeed()
  if (!fs.existsSync(PRODUCTS_FILE)) {
    const defaultProducts: any[] = []
    safeWriteFile(PRODUCTS_FILE, JSON.stringify(defaultProducts, null, 2))
  }

  if (!fs.existsSync(GALLERY_FILE)) {
    const initialGallery: GalleryItem[] = []
    if (fs.existsSync(PRODUCTS_FILE)) {
      try {
        const prodData = JSON.parse(safeReadFile(PRODUCTS_FILE))
        if (Array.isArray(prodData)) {
          prodData.forEach((p: any) => {
            if (p.image) {
              initialGallery.push({
                id: p.id || String(Date.now()),
                image: p.image,
                createdAt: p.createdAt || new Date().toISOString(),
              })
            }
          })
        }
      } catch (err) {
        console.error('Error migrating products to gallery:', err)
      }
    }
    safeWriteFile(GALLERY_FILE, JSON.stringify(initialGallery, null, 2))
  }

  if (!fs.existsSync(GALLERY_FOLDERS_FILE)) {
    const initialFolders: GalleryFolder[] = [
      {
        id: 'folder_truck_fitting',
        name: 'Truck Show Fitting',
        isPrivate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'folder_radium_art',
        name: 'Radium Art & Stickers',
        isPrivate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'folder_number_plates',
        name: 'Number Plates & Monograms',
        isPrivate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'folder_private_drafts',
        name: 'Private Designs & Samples',
        isPrivate: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    safeWriteFile(GALLERY_FOLDERS_FILE, JSON.stringify(initialFolders, null, 2))
  }

  if (!fs.existsSync(DELETED_GALLERY_FILE)) {
    const defaultDeleted: DeletedGalleryItem[] = []
    safeWriteFile(DELETED_GALLERY_FILE, JSON.stringify(defaultDeleted, null, 2))
  }

  if (!fs.existsSync(CUSTOMERS_FILE)) {
    const defaultCustomers: Customer[] = []
    safeWriteFile(CUSTOMERS_FILE, JSON.stringify(defaultCustomers, null, 2))
  }

  if (!fs.existsSync(INVOICES_FILE)) {
    const defaultInvoices: Invoice[] = []
    safeWriteFile(INVOICES_FILE, JSON.stringify(defaultInvoices, null, 2))
  }
}

/* =========================================================
   DELETED GALLERY TOMBSTONE & LIVE TRACKING
   ========================================================= */

export async function getDeletedGalleryItems(): Promise<DeletedGalleryItem[]> {
  try {
    const cloud = await readFromCloudBlob<DeletedGalleryItem[] | null>(
      CLOUD_DELETED_GALLERY_PATH,
      null
    )
    if (Array.isArray(cloud)) {
      inMemoryDeletedGalleryCache = cloud
      safeWriteFile(DELETED_GALLERY_FILE, JSON.stringify(cloud, null, 2))
      return cloud
    }
  } catch {}

  if (inMemoryDeletedGalleryCache) return inMemoryDeletedGalleryCache
  initializeFiles()
  try {
    const content = safeReadFile(DELETED_GALLERY_FILE)
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) {
      inMemoryDeletedGalleryCache = parsed
      return parsed
    }
  } catch {}
  return []
}

export async function getDeletedGalleryIdSet(): Promise<Set<string>> {
  const items = await getDeletedGalleryItems()
  const set = new Set<string>()
  for (const item of items) {
    if (item && item.id) {
      set.add(String(item.id).trim().toLowerCase())
    }
  }
  return set
}

export async function recordPhotoDeletions(ids: string[]): Promise<number> {
  if (!ids || ids.length === 0) return 0
  const existing = await getDeletedGalleryItems()
  const existingSet = new Set(existing.map((x) => String(x.id).trim().toLowerCase()))
  const now = new Date().toISOString()
  let newlyRecorded = 0

  for (const id of ids) {
    const cleanId = decodeURIComponent(String(id || '')).trim().toLowerCase()
    if (cleanId && !existingSet.has(cleanId)) {
      existing.unshift({
        id: String(id).trim(),
        deletedAt: now,
      })
      existingSet.add(cleanId)
      newlyRecorded++
    }
  }

  if (newlyRecorded > 0) {
    inMemoryDeletedGalleryCache = existing
    await writeToCloudBlob(CLOUD_DELETED_GALLERY_PATH, existing, DELETED_GALLERY_FILE)
  }
  return newlyRecorded
}

export async function getDeletedPhotosStats(): Promise<{
  totalCount: number
  activeCount: number
  totalHistorical: number
  deletionPercentage: number
  recentDeletions: DeletedGalleryItem[]
}> {
  const items = await getDeletedGalleryItems()
  const activePhotos = await getAllGalleryImages(false)
  const totalHistorical = items.length + activePhotos.length
  const deletionPercentage =
    totalHistorical > 0 ? Math.round((items.length / totalHistorical) * 100) : 0

  return {
    totalCount: items.length,
    activeCount: activePhotos.length,
    totalHistorical,
    deletionPercentage,
    recentDeletions: items.slice(0, 100),
  }
}

/* =========================================================
   GALLERY FOLDERS
   ========================================================= */

export async function getAllGalleryFolders(publicOnly = false): Promise<GalleryFolder[]> {
  try {
    const cloud = await readFromCloudBlob<GalleryFolder[] | null>(CLOUD_FOLDERS_PATH, null)
    if (Array.isArray(cloud) && cloud.length > 0) {
      inMemoryFoldersCache = cloud
      safeWriteFile(GALLERY_FOLDERS_FILE, JSON.stringify(cloud, null, 2))
      return publicOnly ? cloud.filter((f) => !f.isPrivate) : cloud
    }
  } catch {}

  if (inMemoryFoldersCache && inMemoryFoldersCache.length > 0) {
    return publicOnly ? inMemoryFoldersCache.filter((f) => !f.isPrivate) : inMemoryFoldersCache
  }

  initializeFiles()
  const content = safeReadFile(GALLERY_FOLDERS_FILE)
  let folders: GalleryFolder[] = []
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) folders = parsed
  } catch {}

  if (folders.length === 0) {
    folders = [
      {
        id: 'folder_truck_fitting',
        name: 'Truck Show Fitting',
        isPrivate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'folder_radium_art',
        name: 'Radium Art & Stickers',
        isPrivate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'folder_number_plates',
        name: 'Number Plates & Monograms',
        isPrivate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'folder_private_drafts',
        name: 'Private Designs & Samples',
        isPrivate: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    await writeToCloudBlob(CLOUD_FOLDERS_PATH, folders, GALLERY_FOLDERS_FILE)
  }

  inMemoryFoldersCache = folders
  if (publicOnly) {
    return folders.filter((f) => !f.isPrivate)
  }
  return folders
}

export async function createGalleryFolder(name: string, isPrivate = false): Promise<GalleryFolder> {
  const folders = await getAllGalleryFolders()
  const trimmedName = name.trim()
  const newFolder: GalleryFolder = {
    id: `folder_${Date.now()}`,
    name: trimmedName,
    isPrivate: Boolean(isPrivate),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  folders.push(newFolder)
  inMemoryFoldersCache = folders
  await writeToCloudBlob(CLOUD_FOLDERS_PATH, folders, GALLERY_FOLDERS_FILE)
  return newFolder
}

export async function updateGalleryFolder(
  id: string,
  updates: { name?: string; isPrivate?: boolean }
): Promise<GalleryFolder | null> {
  const folders = await getAllGalleryFolders()
  const cleanId = id.trim().toLowerCase()
  const index = folders.findIndex((f) => f.id.trim().toLowerCase() === cleanId)
  if (index === -1) return null

  const target = folders[index]
  const updatedFolder: GalleryFolder = {
    ...target,
    name: updates.name !== undefined ? updates.name.trim() : target.name,
    isPrivate: updates.isPrivate !== undefined ? Boolean(updates.isPrivate) : target.isPrivate,
    updatedAt: new Date().toISOString(),
  }
  folders[index] = updatedFolder
  inMemoryFoldersCache = folders
  await writeToCloudBlob(CLOUD_FOLDERS_PATH, folders, GALLERY_FOLDERS_FILE)

  // If folder privacy changed, sync isPrivate flag of all images in that folder
  if (updates.isPrivate !== undefined) {
    const images = await getAllGalleryImages(false)
    let imagesModified = false
    for (const img of images) {
      if (img.folderId && img.folderId.trim().toLowerCase() === cleanId) {
        img.isPrivate = updatedFolder.isPrivate
        imagesModified = true
      }
    }
    if (imagesModified) {
      inMemoryGalleryCache = images
      inMemoryGalleryMtime = Date.now()
      await writeToCloudBlob(CLOUD_GALLERY_PATH, images, GALLERY_FILE)
    }
  }

  return updatedFolder
}

export async function deleteGalleryFolder(id: string, deletePhotos = false): Promise<boolean> {
  const folders = await getAllGalleryFolders()
  const cleanId = id.trim().toLowerCase()
  const filtered = folders.filter((f) => f.id.trim().toLowerCase() !== cleanId)
  if (filtered.length === folders.length) return false

  inMemoryFoldersCache = filtered
  await writeToCloudBlob(CLOUD_FOLDERS_PATH, filtered, GALLERY_FOLDERS_FILE)

  // Handle images inside the deleted folder
  const images = await getAllGalleryImages(false)
  if (deletePhotos) {
    const imagesToDelete = images.filter(
      (img) => img.folderId && img.folderId.trim().toLowerCase() === cleanId
    )
    if (imagesToDelete.length > 0) {
      await deleteMultipleGalleryImages(imagesToDelete.map((img) => img.id))
    }
  } else {
    // Move photos to Uncategorized
    let modified = false
    for (const img of images) {
      if (img.folderId && img.folderId.trim().toLowerCase() === cleanId) {
        delete img.folderId
        img.isPrivate = false
        modified = true
      }
    }
    if (modified) {
      inMemoryGalleryCache = images
      inMemoryGalleryMtime = Date.now()
      await writeToCloudBlob(CLOUD_GALLERY_PATH, images, GALLERY_FILE)
    }
  }

  return true
}

export async function moveGalleryImagesToFolder(
  imageIds: string[],
  targetFolderId?: string
): Promise<number> {
  const images = await getAllGalleryImages(false)
  const idSet = new Set(imageIds.map((id) => decodeURIComponent(id).trim().toLowerCase()))
  const folders = await getAllGalleryFolders()
  const targetFolder = targetFolderId
    ? folders.find((f) => f.id.trim().toLowerCase() === targetFolderId.trim().toLowerCase())
    : null

  let updatedCount = 0
  for (const img of images) {
    const imgId = String(img.id || '').trim().toLowerCase()
    if (idSet.has(imgId)) {
      if (targetFolder) {
        img.folderId = targetFolder.id
        img.isPrivate = targetFolder.isPrivate
      } else {
        delete img.folderId
        img.isPrivate = false
      }
      updatedCount++
    }
  }

  if (updatedCount > 0) {
    inMemoryGalleryCache = images
    inMemoryGalleryMtime = Date.now()
    await writeToCloudBlob(CLOUD_GALLERY_PATH, images, GALLERY_FILE)
  }
  return updatedCount
}

/* =========================================================
   GALLERY (Multi-Image Showcase)
   ========================================================= */

export async function getAllGalleryImages(
  publicOnly = false,
  folderId?: string
): Promise<GalleryItem[]> {
  try {
    // 1. Try reading from Cloud Blob first
    const cloud = await readFromCloudBlob<GalleryItem[] | null>(CLOUD_GALLERY_PATH, null)
    let items: GalleryItem[] = []
    if (Array.isArray(cloud)) {
      items = cloud
      inMemoryGalleryCache = cloud
    } else if (inMemoryGalleryCache) {
      items = inMemoryGalleryCache
    } else {
      initializeFiles()
      const data = safeReadFile(GALLERY_FILE)
      const parsed = JSON.parse(data)
      if (Array.isArray(parsed)) {
        items = parsed
        inMemoryGalleryCache = parsed
      }
    }

    // Always filter out any tombstoned/deleted photo IDs
    const deletedIdSet = await getDeletedGalleryIdSet()
    if (deletedIdSet.size > 0) {
      const originalCount = items.length
      items = items.filter((item) => {
        const id = String(item.id || '').trim().toLowerCase()
        return !deletedIdSet.has(id)
      })
      if (items.length !== originalCount) {
        inMemoryGalleryCache = items
        inMemoryGalleryMtime = Date.now()
        await writeToCloudBlob(CLOUD_GALLERY_PATH, items, GALLERY_FILE)
      }
    }

    // Determine private folders
    const folders = await getAllGalleryFolders()
    const privateFolderIdSet = new Set(
      folders.filter((f) => f.isPrivate).map((f) => f.id.trim().toLowerCase())
    )

    // Filter by publicOnly if requested
    if (publicOnly) {
      items = items.filter((item) => {
        if (item.isPrivate === true) return false
        if (item.folderId && privateFolderIdSet.has(item.folderId.trim().toLowerCase())) {
          return false
        }
        return true
      })
    }

    // Filter by folderId if specified
    if (folderId && folderId !== 'all') {
      const cleanFolderId = folderId.trim().toLowerCase()
      if (cleanFolderId === 'uncategorized') {
        items = items.filter((item) => !item.folderId)
      } else {
        items = items.filter(
          (item) => item.folderId && item.folderId.trim().toLowerCase() === cleanFolderId
        )
      }
    }

    return items
  } catch (error) {
    console.error('Error reading gallery:', error)
    return inMemoryGalleryCache || []
  }
}

export async function addGalleryImages(
  images: string[],
  folderId?: string
): Promise<GalleryItem[]> {
  const current = await getAllGalleryImages(false)
  let targetFolder: GalleryFolder | undefined
  if (folderId && folderId !== 'all' && folderId !== 'uncategorized') {
    const folders = await getAllGalleryFolders()
    targetFolder = folders.find((f) => f.id.trim().toLowerCase() === folderId.trim().toLowerCase())
  }

  const newItems: GalleryItem[] = images.map((img, idx) => ({
    id: `${Date.now()}_${idx}`,
    image: img,
    folderId: targetFolder ? targetFolder.id : undefined,
    isPrivate: targetFolder ? targetFolder.isPrivate : false,
    createdAt: new Date().toISOString(),
  }))
  const updated = [...newItems, ...current]
  inMemoryGalleryCache = updated
  inMemoryGalleryMtime = Date.now()
  await writeToCloudBlob(CLOUD_GALLERY_PATH, updated, GALLERY_FILE)
  return newItems
}

export async function deleteGalleryImage(id: string): Promise<boolean> {
  const cleanId = decodeURIComponent(String(id || '')).trim()
  await recordPhotoDeletions([cleanId])
  const current = await getAllGalleryImages(false)
  const filtered = current.filter((item) => {
    const itemId = String(item.id || '').trim()
    return itemId !== cleanId && itemId !== String(id).trim()
  })
  if (filtered.length === current.length) return false
  inMemoryGalleryCache = filtered
  inMemoryGalleryMtime = Date.now()
  await writeToCloudBlob(CLOUD_GALLERY_PATH, filtered, GALLERY_FILE)
  return true
}

export async function deleteMultipleGalleryImages(ids: string[]): Promise<number> {
  if (!ids || ids.length === 0) return 0
  await recordPhotoDeletions(ids)
  const current = await getAllGalleryImages(false)
  const cleanIdSet = new Set(
    ids.map((id) => decodeURIComponent(String(id || '')).trim().toLowerCase())
  )
  const filtered = current.filter((item) => {
    const itemId = String(item.id || '').trim().toLowerCase()
    return !cleanIdSet.has(itemId) && !ids.includes(item.id)
  })
  const removedCount = current.length - filtered.length
  if (removedCount > 0) {
    inMemoryGalleryCache = filtered
    inMemoryGalleryMtime = Date.now()
    await writeToCloudBlob(CLOUD_GALLERY_PATH, filtered, GALLERY_FILE)
  }
  return removedCount
}

/* =========================================================
   CUSTOMERS
   ========================================================= */

export async function getAllCustomers(): Promise<Customer[]> {
  try {
    const cloud = await readFromCloudBlob<Customer[] | null>(CLOUD_CUSTOMERS_PATH, null)
    if (Array.isArray(cloud)) {
      inMemoryCustomersCache = cloud
      safeWriteFile(CUSTOMERS_FILE, JSON.stringify(cloud, null, 2))
      return cloud
    }
  } catch (error) {
    console.error('Error reading customers from cloud:', error)
  }

  if (inMemoryCustomersCache) return inMemoryCustomersCache
  initializeFiles()
  try {
    const data = safeReadFile(CUSTOMERS_FILE)
    const parsed = JSON.parse(data)
    if (Array.isArray(parsed)) {
      inMemoryCustomersCache = parsed
      return parsed
    }
  } catch {}
  return []
}

export async function getCustomerById(id: string): Promise<Customer | undefined> {
  const customers = await getAllCustomers()
  return customers.find((c) => c.id === id)
}

export async function findOrCreateCustomer(name?: string, mobile?: string): Promise<Customer> {
  const customers = await getAllCustomers()
  const trimmedName = String(name || '').trim()
  const trimmedMobile = String(mobile || '').trim()

  let existing = customers.find(
    (c) =>
      (trimmedMobile && c.mobile && c.mobile === trimmedMobile) ||
      (trimmedName && c.name && c.name.toLowerCase() === trimmedName.toLowerCase())
  )

  if (existing) {
    let updated = false
    if (trimmedName && existing.name !== trimmedName) {
      existing.name = trimmedName
      updated = true
    }
    if (trimmedMobile && existing.mobile !== trimmedMobile) {
      existing.mobile = trimmedMobile
      updated = true
    }
    if (updated) {
      existing.updatedAt = new Date().toISOString()
      inMemoryCustomersCache = customers
      await writeToCloudBlob(CLOUD_CUSTOMERS_PATH, customers, CUSTOMERS_FILE)
    }
    return existing
  }

  const newCustomer: Customer = {
    id: `cust_${Date.now()}`,
    name: trimmedName || 'Walk-in Customer',
    mobile: trimmedMobile,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  customers.push(newCustomer)
  inMemoryCustomersCache = customers
  await writeToCloudBlob(CLOUD_CUSTOMERS_PATH, customers, CUSTOMERS_FILE)
  return newCustomer
}

export async function updateCustomer(
  id: string,
  data: { name?: string; mobile?: string }
): Promise<Customer | null> {
  const customers = await getAllCustomers()
  const index = customers.findIndex((c) => c.id === id)
  if (index === -1) return null

  const newName = data.name !== undefined ? data.name.trim() : customers[index].name
  const newMobile = data.mobile !== undefined ? data.mobile.trim() : customers[index].mobile

  customers[index] = {
    ...customers[index],
    name: newName,
    mobile: newMobile,
    updatedAt: new Date().toISOString(),
  }

  inMemoryCustomersCache = customers
  await writeToCloudBlob(CLOUD_CUSTOMERS_PATH, customers, CUSTOMERS_FILE)

  // Also update all invoices associated with this customer
  const invoices = await getAllInvoices()
  let invoicesUpdated = false
  for (let i = 0; i < invoices.length; i++) {
    if (invoices[i].customerId === id) {
      invoices[i].customerName = newName
      invoices[i].customerMobile = newMobile
      invoices[i].updatedAt = new Date().toISOString()
      invoicesUpdated = true
    }
  }
  if (invoicesUpdated) {
    inMemoryInvoicesCache = invoices
    await writeToCloudBlob(CLOUD_INVOICES_PATH, invoices, INVOICES_FILE)
  }

  return customers[index]
}

export async function deleteCustomer(id: string): Promise<boolean> {
  try {
    const customers = await getAllCustomers()
    const cleanId = decodeURIComponent(String(id || '')).trim().toLowerCase()
    const target = customers.find((c) => (c.id || '').trim().toLowerCase() === cleanId)
    const filtered = customers.filter((c) => (c.id || '').trim().toLowerCase() !== cleanId)
    if (filtered.length === customers.length) return false
    inMemoryCustomersCache = filtered
    await writeToCloudBlob(CLOUD_CUSTOMERS_PATH, filtered, CUSTOMERS_FILE)

    // Also delete all invoices for this customer by customerId or customerName
    const invoices = await getAllInvoices()
    const targetName = target?.name?.trim().toLowerCase()
    const filteredInvoices = invoices.filter((inv) => {
      const invCustId = (inv.customerId || '').trim().toLowerCase()
      const invCustName = (inv.customerName || '').trim().toLowerCase()
      if (invCustId === cleanId) return false
      if (targetName && invCustName === targetName) return false
      return true
    })
    inMemoryInvoicesCache = filteredInvoices
    await writeToCloudBlob(CLOUD_INVOICES_PATH, filteredInvoices, INVOICES_FILE)

    return true
  } catch (err) {
    console.error('Error deleting customer:', err)
    return false
  }
}

/* =========================================================
   INVOICES / BILLING
   ========================================================= */

export async function getAllInvoices(): Promise<Invoice[]> {
  try {
    // 1. Try reading from Cloud Blob first for 100% live consistency across all containers & devices
    const cloudInvoices = await readFromCloudBlob<Invoice[] | null>(CLOUD_INVOICES_PATH, null)
    if (Array.isArray(cloudInvoices)) {
      inMemoryInvoicesCache = cloudInvoices
      safeWriteFile(INVOICES_FILE, JSON.stringify(cloudInvoices, null, 2))
      return cloudInvoices
    }
  } catch (error) {
    console.error('Error reading invoices from cloud:', error)
  }

  // 2. Fallback to in-memory cache or local file
  if (inMemoryInvoicesCache) return inMemoryInvoicesCache
  initializeFiles()
  try {
    const data = safeReadFile(INVOICES_FILE)
    const parsed = JSON.parse(data)
    if (Array.isArray(parsed)) {
      inMemoryInvoicesCache = parsed
      return parsed
    }
  } catch {}
  return []
}

export async function getInvoiceById(id: string): Promise<Invoice | undefined> {
  const cleanId = id.trim().toLowerCase()
  const invoices = await getAllInvoices()
  let found = invoices.find((inv) => inv.id.trim().toLowerCase() === cleanId)
  if (found) return found

  // Direct forced query to Cloud Blob to ensure zero latency misses across containers
  try {
    const cloudInvoices = await readFromCloudBlob<Invoice[] | null>(CLOUD_INVOICES_PATH, null)
    if (Array.isArray(cloudInvoices)) {
      inMemoryInvoicesCache = cloudInvoices
      safeWriteFile(INVOICES_FILE, JSON.stringify(cloudInvoices, null, 2))
      found = cloudInvoices.find((inv) => inv.id.trim().toLowerCase() === cleanId)
      if (found) return found
    }
  } catch {}

  return undefined
}

export async function getInvoicesByCustomerId(customerId: string): Promise<Invoice[]> {
  const invoices = await getAllInvoices()
  const cleanId = (customerId || '').trim().toLowerCase()
  const customers = await getAllCustomers()
  const cust = customers.find((c) => (c.id || '').trim().toLowerCase() === cleanId)
  const custName = cust?.name?.trim().toLowerCase()

  return invoices.filter((inv) => {
    const invCustId = (inv.customerId || '').trim().toLowerCase()
    if (invCustId === cleanId) return true
    if (custName && (inv.customerName || '').trim().toLowerCase() === custName) return true
    return false
  })
}

export async function createInvoice(data: {
  customerName: string
  customerMobile?: string
  viaCustomer?: string
  date?: string
  items: Array<{ description: string; qty: number; rate: number }>
  notes?: string
  paymentStatus?: 'PAID' | 'PENDING'
  paymentMethod?: 'CASH' | 'UPI' | 'CARD'
}): Promise<Invoice> {
  const customer = await findOrCreateCustomer(data.customerName, data.customerMobile)
  const invoices = await getAllInvoices()

  // Calculate maximum existing invoice number to guarantee strictly unique ID
  const maxNumber = invoices.reduce((max, inv) => {
    if (!inv || !inv.id) return max
    const match = inv.id.match(/\d+/)
    if (match) {
      const num = parseInt(match[0], 10)
      return num > max ? num : max
    }
    return max
  }, 0)
  const nextNumber = maxNumber + 1
  const invoiceId = `INV-${String(nextNumber).padStart(4, '0')}`

  const items: InvoiceItem[] = (data.items || []).map((it, idx) => {
    const qty = Number(it.qty) || 1
    const rate = Number(it.rate) || 0
    return {
      sr: idx + 1,
      description: it.description || '',
      qty,
      rate,
      total: Number((qty * rate).toFixed(2)),
    }
  })

  const subtotal = items.reduce((acc, curr) => acc + curr.total, 0)
  const grandTotal = subtotal

  const newInvoice: Invoice = {
    id: invoiceId,
    customerId: customer.id,
    customerName: customer.name,
    customerMobile: customer.mobile,
    viaCustomer: data.viaCustomer ? data.viaCustomer.trim() : '',
    date: data.date || new Date().toISOString().split('T')[0],
    businessName: 'JAY MATAJI REDIUM ART & TRUCK SHOW FITTING',
    businessMobile: '6353016927',
    businessOwner: 'Vivek Ghediya',
    businessAddress:
      'Porbandar Khambhaliya highway bokhira, Near Vachhrajdada Temple Bokhira Porbandar 360575',
    paymentStatus: data.paymentStatus || 'PAID',
    paymentMethod: data.paymentStatus === 'PENDING' ? undefined : (data.paymentMethod || 'UPI'),
    items,
    subtotal,
    grandTotal,
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  invoices.unshift(newInvoice)
  inMemoryInvoicesCache = invoices
  await writeToCloudBlob(CLOUD_INVOICES_PATH, invoices, INVOICES_FILE)
  return newInvoice
}

export async function updateInvoice(
  id: string,
  data: {
    customerName?: string
    customerMobile?: string
    viaCustomer?: string
    date?: string
    items?: Array<{ description: string; qty: number; rate: number }>
    notes?: string
    paymentStatus?: 'PAID' | 'PENDING'
    paymentMethod?: 'CASH' | 'UPI' | 'CARD'
  }
): Promise<Invoice | null> {
  const invoices = await getAllInvoices()
  const cleanId = id.trim().toLowerCase()
  const index = invoices.findIndex((inv) => inv.id.trim().toLowerCase() === cleanId)
  if (index === -1) return null

  const existing = invoices[index]
  const customer = data.customerName
    ? await findOrCreateCustomer(data.customerName, data.customerMobile || existing.customerMobile)
    : null

  let items = existing.items
  let subtotal = existing.subtotal
  let grandTotal = existing.grandTotal

  if (data.items && Array.isArray(data.items)) {
    items = data.items.map((it, idx) => {
      const qty = Number(it.qty) || 1
      const rate = Number(it.rate) || 0
      return {
        sr: idx + 1,
        description: it.description || '',
        qty,
        rate,
        total: Number((qty * rate).toFixed(2)),
      }
    })
    subtotal = items.reduce((acc, curr) => acc + curr.total, 0)
    grandTotal = subtotal
  }

  const updatedInvoice: Invoice = {
    ...existing,
    customerName: customer ? customer.name : (data.customerName !== undefined ? data.customerName.trim() : existing.customerName),
    customerMobile: customer ? customer.mobile : (data.customerMobile !== undefined ? data.customerMobile : existing.customerMobile),
    customerId: customer ? customer.id : existing.customerId,
    viaCustomer: data.viaCustomer !== undefined ? data.viaCustomer.trim() : (existing.viaCustomer || ''),
    date: data.date || existing.date,
    items,
    subtotal,
    grandTotal,
    notes: data.notes !== undefined ? data.notes : existing.notes,
    businessOwner: existing.businessOwner || 'Vivek Ghediya',
    paymentStatus: data.paymentStatus !== undefined ? data.paymentStatus : (existing.paymentStatus || 'PAID'),
    paymentMethod: data.paymentStatus === 'PENDING' ? undefined : (data.paymentMethod !== undefined ? data.paymentMethod : (existing.paymentMethod || 'UPI')),
    updatedAt: new Date().toISOString(),
  }

  invoices[index] = updatedInvoice
  inMemoryInvoicesCache = invoices
  await writeToCloudBlob(CLOUD_INVOICES_PATH, invoices, INVOICES_FILE)
  return updatedInvoice
}

export async function deleteInvoice(id: string): Promise<boolean> {
  try {
    const invoices = await getAllInvoices()
    const cleanId = decodeURIComponent(String(id || '')).trim().toLowerCase()
    const filtered = invoices.filter((inv) => (inv.id || '').trim().toLowerCase() !== cleanId)
    if (filtered.length === invoices.length) return false
    inMemoryInvoicesCache = filtered
    await writeToCloudBlob(CLOUD_INVOICES_PATH, filtered, INVOICES_FILE)
    return true
  } catch (e) {
    console.error('Error deleting invoice:', e)
    return false
  }
}

/* =========================================================
   LEGACY PRODUCTS (Preserved for compatibility)
   ========================================================= */

export function getAllProducts() {
  try {
    initializeFiles()
    if (!fs.existsSync(PRODUCTS_FILE)) return []
    const data = fs.readFileSync(PRODUCTS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading products:', error)
    return []
  }
}

export function getProductById(id: string) {
  const products = getAllProducts()
  return products.find((p: any) => p.id === id)
}

export function addProduct(product: any) {
  const products = getAllProducts()
  const newProduct = {
    id: Date.now().toString(),
    ...product,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  products.push(newProduct)
  safeWriteFile(PRODUCTS_FILE, JSON.stringify(products, null, 2))
  return newProduct
}

export function updateProduct(id: string, updates: any) {
  const products = getAllProducts()
  const index = products.findIndex((p: any) => p.id === id)
  if (index === -1) return null

  products[index] = {
    ...products[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  safeWriteFile(PRODUCTS_FILE, JSON.stringify(products, null, 2))
  return products[index]
}

export function deleteProduct(id: string) {
  const products = getAllProducts()
  const filtered = products.filter((p: any) => p.id !== id)
  return safeWriteFile(PRODUCTS_FILE, JSON.stringify(filtered, null, 2))
}

/* =========================================================
   ADMIN AUTHENTICATION & MULTI-DEVICE CLOUD SYNC
   ========================================================= */

async function getCloudAdminCredentials(): Promise<any[] | null> {
  try {
    const { get } = await import('@vercel/blob')
    const response = await get(CLOUD_ADMINS_PATH, { access: 'private' })
    if (response && response.stream) {
      const text = await new Response(response.stream).text()
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (err) {
    // Graceful fallback to disk if offline or token not configured
  }
  return null
}

async function saveCloudAdminCredentials(admins: any[]): Promise<boolean> {
  try {
    const { put } = await import('@vercel/blob')
    await put(CLOUD_ADMINS_PATH, JSON.stringify(admins, null, 2), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    return true
  } catch (err) {
    console.error('saveCloudAdminCredentials error:', err)
    return false
  }
}

export async function getAllAdmins(): Promise<any[]> {
  try {
    // 1. Check cloud blob first for live multi-device sync (Laptop <-> Mobile)
    const cloudAdmins = await getCloudAdminCredentials()
    if (cloudAdmins && cloudAdmins.length > 0) {
      safeWriteFile(ADMINS_FILE, JSON.stringify(cloudAdmins, null, 2))
      return cloudAdmins
    }

    // 2. Fallback to local files
    await initializeAdmin()
    const content = safeReadFile(ADMINS_FILE)
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
    }
    return []
  } catch (error) {
    console.error('Error reading admins:', error)
    return []
  }
}

export async function getAdminSyncStatus(): Promise<{
  email: string
  updatedAt: string
  isCloudSynced: boolean
  activeDevicesSupported: string[]
}> {
  const admins = await getAllAdmins()
  const activeAdmin = admins[0]
  return {
    email: activeAdmin ? activeAdmin.email : DEFAULT_ADMIN_EMAIL,
    updatedAt:
      activeAdmin && (activeAdmin.updatedAt || activeAdmin.createdAt)
        ? activeAdmin.updatedAt || activeAdmin.createdAt
        : new Date().toISOString(),
    isCloudSynced: true,
    activeDevicesSupported: ['Laptop', 'Mobile Phone', 'Tablet', 'Desktop'],
  }
}

export async function getAdminByEmail(email: string) {
  if (!email) return null
  const normalized = email.toLowerCase().trim()
  const admins = await getAllAdmins()
  return admins.find((a: any) => a.email && a.email.toLowerCase().trim() === normalized) || null
}

export async function verifyAdminPassword(
  email: string,
  password: string
): Promise<any> {
  if (!email || !password) return null
  const normalizedEmail = email.toLowerCase().trim()
  const admins = await getAllAdmins()

  // Only if no admins exist at all, allow bootstrapping with env/default credentials
  if (admins.length === 0) {
    const envEmail = DEFAULT_ADMIN_EMAIL
    const envPass = DEFAULT_ADMIN_PASSWORD
    if (normalizedEmail === envEmail && password === envPass) {
      return await createAdmin(envEmail, envPass)
    }
    return null
  }

  // Find admin strictly by normalized email
  const admin = admins.find(
    (a: any) => a.email && a.email.toLowerCase().trim() === normalizedEmail
  )
  if (!admin) return null

  // Strictly verify bcrypt hash against the admin's active password
  const isBcryptValid = await bcrypt
    .compare(password, admin.password)
    .catch(() => false)

  if (!isBcryptValid) return null

  return admin
}

export async function createAdmin(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim()
  const admins = await getAllAdmins()
  const exists = admins.find(
    (a: any) => a.email && a.email.toLowerCase().trim() === normalizedEmail
  )
  if (exists) return null

  const hashedPassword = await bcrypt.hash(password, 10)
  const newAdmin = {
    id: Date.now().toString(),
    email: normalizedEmail,
    password: hashedPassword,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  admins.push(newAdmin)
  safeWriteFile(ADMINS_FILE, JSON.stringify(admins, null, 2))
  await saveCloudAdminCredentials(admins)
  return newAdmin
}

export async function updateAdminPassword(
  adminId: string,
  newPassword: string
): Promise<boolean> {
  const admins = await getAllAdmins()
  const idx = admins.findIndex((a: any) => a.id === adminId)
  if (idx === -1) return false

  const hashedPassword = await bcrypt.hash(newPassword, 10)
  admins[idx].password = hashedPassword
  admins[idx].updatedAt = new Date().toISOString()
  safeWriteFile(ADMINS_FILE, JSON.stringify(admins, null, 2))
  await saveCloudAdminCredentials(admins)
  return true
}

export async function updateAdminCredentials(
  adminId: string,
  updates: { newEmail?: string; newPassword?: string }
): Promise<{ success: boolean; message?: string; admin?: any; syncedToCloud?: boolean }> {
  const admins = await getAllAdmins()
  const idx = admins.findIndex((a: any) => a.id === adminId)
  if (idx === -1) return { success: false, message: 'Admin not found' }

  if (updates.newEmail) {
    const normalizedEmail = updates.newEmail.toLowerCase().trim()
    const duplicate = admins.find(
      (a: any) =>
        a.id !== adminId &&
        a.email &&
        a.email.toLowerCase().trim() === normalizedEmail
    )
    if (duplicate) {
      return {
        success: false,
        message: 'This email is already in use by another account',
      }
    }
    admins[idx].email = normalizedEmail
  }

  if (updates.newPassword) {
    const hashedPassword = await bcrypt.hash(updates.newPassword, 10)
    admins[idx].password = hashedPassword
  }

  const now = new Date().toISOString()
  admins[idx].updatedAt = now

  // Save to local file cache
  safeWriteFile(ADMINS_FILE, JSON.stringify(admins, null, 2))

  // Persist to Vercel Cloud Blob for live multi-device sync
  const syncedToCloud = await saveCloudAdminCredentials(admins)

  return { success: true, admin: admins[idx], syncedToCloud }
}

export async function initializeDatabase() {
  await initializeAdmin()
  initializeFiles()
  // Hydrate memory caches from Cloud Blob if accessible
  try {
    const [cloudInvoices, cloudCustomers, cloudFolders, cloudDeleted, cloudGallery] =
      await Promise.all([
        readFromCloudBlob<Invoice[] | null>(CLOUD_INVOICES_PATH, null),
        readFromCloudBlob<Customer[] | null>(CLOUD_CUSTOMERS_PATH, null),
        readFromCloudBlob<GalleryFolder[] | null>(CLOUD_FOLDERS_PATH, null),
        readFromCloudBlob<DeletedGalleryItem[] | null>(CLOUD_DELETED_GALLERY_PATH, null),
        readFromCloudBlob<GalleryItem[] | null>(CLOUD_GALLERY_PATH, null),
      ])
    if (Array.isArray(cloudInvoices)) {
      inMemoryInvoicesCache = cloudInvoices
      safeWriteFile(INVOICES_FILE, JSON.stringify(cloudInvoices, null, 2))
    }
    if (Array.isArray(cloudCustomers)) {
      inMemoryCustomersCache = cloudCustomers
      safeWriteFile(CUSTOMERS_FILE, JSON.stringify(cloudCustomers, null, 2))
    }
    if (Array.isArray(cloudFolders)) {
      inMemoryFoldersCache = cloudFolders
      safeWriteFile(GALLERY_FOLDERS_FILE, JSON.stringify(cloudFolders, null, 2))
    }
    if (Array.isArray(cloudDeleted)) {
      inMemoryDeletedGalleryCache = cloudDeleted
      safeWriteFile(DELETED_GALLERY_FILE, JSON.stringify(cloudDeleted, null, 2))
    }
    if (Array.isArray(cloudGallery)) {
      inMemoryGalleryCache = cloudGallery
      safeWriteFile(GALLERY_FILE, JSON.stringify(cloudGallery, null, 2))
    }
  } catch (e) {
    console.error('Error hydrating cache from Cloud Blob in initializeDatabase:', e)
  }
}
