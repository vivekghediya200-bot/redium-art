import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

/* =========================================================
   GALLERY FOLDERS
   ========================================================= */

export async function getAllGalleryFolders(publicOnly = false) {
  const folders = await prisma.galleryFolder.findMany({
    orderBy: { createdAt: 'desc' }
  })

  if (publicOnly) {
    return folders.filter(f => !f.isPrivate)
  }
  return folders
}

export async function createGalleryFolder(name: string, isPrivate = false) {
  return await prisma.galleryFolder.create({
    data: {
      name: name.trim(),
      isPrivate: Boolean(isPrivate)
    }
  })
}

export async function updateGalleryFolder(
  id: string,
  updates: { name?: string; isPrivate?: boolean }
) {
  const folder = await prisma.galleryFolder.findUnique({
    where: { id }
  })

  if (!folder) return null

  const updated = await prisma.galleryFolder.update({
    where: { id },
    data: {
      name: updates.name !== undefined ? updates.name.trim() : folder.name,
      isPrivate: updates.isPrivate !== undefined ? Boolean(updates.isPrivate) : folder.isPrivate
    }
  })

  // Sync isPrivate flag of all images in that folder
  if (updates.isPrivate !== undefined) {
    await prisma.galleryItem.updateMany({
      where: { folderId: id },
      data: { isPrivate: updated.isPrivate }
    })
  }

  return updated
}

export async function deleteGalleryFolder(id: string, deletePhotos = false) {
  const folder = await prisma.galleryFolder.findUnique({
    where: { id }
  })

  if (!folder) return false

  if (deletePhotos) {
    await prisma.galleryItem.deleteMany({
      where: { folderId: id }
    })
  } else {
    // Move photos to Uncategorized (remove folderId)
    await prisma.galleryItem.updateMany({
      where: { folderId: id },
      data: { folderId: null, isPrivate: false }
    })
  }

  await prisma.galleryFolder.delete({
    where: { id }
  })

  return true
}

export async function moveGalleryImagesToFolder(
  imageIds: string[],
  targetFolderId?: string
) {
  const targetFolder = targetFolderId
    ? await prisma.galleryFolder.findUnique({
        where: { id: targetFolderId }
      })
    : null

  const result = await prisma.galleryItem.updateMany({
    where: {
      id: { in: imageIds }
    },
    data: {
      folderId: targetFolder ? targetFolder.id : null,
      isPrivate: targetFolder ? targetFolder.isPrivate : false
    }
  })

  return result.count
}

/* =========================================================
   GALLERY (Multi-Image Showcase)
   ========================================================= */

export async function getAllGalleryImages(
  publicOnly = false,
  folderId?: string
) {
  const where: any = {}

  if (publicOnly) {
    where.isPrivate = false
  }

  if (folderId && folderId !== 'all') {
    if (folderId === 'uncategorized') {
      where.folderId = null
    } else {
      where.folderId = folderId
    }
  }

  const images = await prisma.galleryItem.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  })

  return images
}

export async function addGalleryImages(
  images: string[],
  folderId?: string
) {
  const targetFolder = folderId && folderId !== 'all' && folderId !== 'uncategorized'
    ? await prisma.galleryFolder.findUnique({
        where: { id: folderId }
      })
    : null

  const newItems = await prisma.galleryItem.createMany({
    data: images.map((img, idx) => ({
      image: img,
      folderId: targetFolder ? targetFolder.id : null,
      isPrivate: targetFolder ? targetFolder.isPrivate : false
    }))
  })

  // Return the created items
  return await prisma.galleryItem.findMany({
    where: {
      image: { in: images }
    },
    orderBy: { createdAt: 'desc' },
    take: newItems.count
  })
}

export async function deleteGalleryImage(id: string) {
  // Record deletion
  await prisma.deletedGalleryItem.create({
    data: { id }
  })

  const result = await prisma.galleryItem.deleteMany({
    where: { id }
  })

  return result.count > 0
}

export async function deleteMultipleGalleryImages(ids: string[]) {
  // Record all deletions
  await prisma.deletedGalleryItem.createMany({
    data: ids.map(id => ({ id }))
  })

  const result = await prisma.galleryItem.deleteMany({
    where: {
      id: { in: ids }
    }
  })

  return result.count
}

export async function getDeletedGalleryItems() {
  return await prisma.deletedGalleryItem.findMany({
    orderBy: { deletedAt: 'desc' }
  })
}

export async function getDeletedGalleryIdSet() {
  const items = await getDeletedGalleryItems()
  const set = new Set<string>()
  for (const item of items) {
    set.add(item.id)
  }
  return set
}

export async function recordPhotoDeletions(ids: string[]) {
  if (!ids || ids.length === 0) return 0

  const existing = await getDeletedGalleryItems()
  const existingSet = new Set(existing.map(x => x.id))

  const newIds = ids.filter(id => !existingSet.has(id))

  if (newIds.length > 0) {
    await prisma.deletedGalleryItem.createMany({
      data: newIds.map(id => ({ id }))
    })
  }

  return newIds.length
}

export async function getDeletedPhotosStats() {
  const items = await getDeletedGalleryItems()
  const activePhotos = await getAllGalleryImages(false)
  const totalHistorical = items.length + activePhotos.length
  const deletionPercentage = totalHistorical > 0
    ? Math.round((items.length / totalHistorical) * 100)
    : 0

  return {
    totalCount: items.length,
    activeCount: activePhotos.length,
    totalHistorical,
    deletionPercentage,
    recentDeletions: items.slice(0, 100)
  }
}

/* =========================================================
   CUSTOMERS
   ========================================================= */

export async function getAllCustomers() {
  return await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' }
  })
}

export async function getCustomerById(id: string) {
  return await prisma.customer.findUnique({
    where: { id }
  })
}

export async function findOrCreateCustomer(name?: string, mobile?: string) {
  const trimmedName = String(name || '').trim()
  const trimmedMobile = String(mobile || '').trim()

  let existing = await prisma.customer.findFirst({
    where: {
      OR: [
        trimmedMobile ? { mobile: trimmedMobile } : {},
        trimmedName ? { name: { equals: trimmedName, mode: 'insensitive' } } : {}
      ].filter(Boolean)
    }
  })

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
      existing = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: trimmedName,
          mobile: trimmedMobile,
          updatedAt: new Date()
        }
      })
    }
    return existing
  }

  const newCustomer = await prisma.customer.create({
    data: {
      name: trimmedName || 'Walk-in Customer',
      mobile: trimmedMobile
    }
  })

  return newCustomer
}

export async function updateCustomer(
  id: string,
  data: { name?: string; mobile?: string }
) {
  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: data.name !== undefined ? data.name.trim() : undefined,
      mobile: data.mobile !== undefined ? data.mobile.trim() : undefined,
      updatedAt: new Date()
    }
  })

  // Update all invoices associated with this customer
  await prisma.invoice.updateMany({
    where: { customerId: id },
    data: {
      customerName: customer.name,
      customerMobile: customer.mobile || '',
      updatedAt: new Date()
    }
  })

  return customer
}

export async function deleteCustomer(id: string) {
  // Delete all invoices for this customer
  await prisma.invoice.deleteMany({
    where: { customerId: id }
  })

  const result = await prisma.customer.delete({
    where: { id }
  })

  return !!result
}

/* =========================================================
   INVOICES / BILLING
   ========================================================= */

export async function getAllInvoices() {
  return await prisma.invoice.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      customer: true
    }
  })
}

export async function getInvoiceById(id: string) {
  return await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true
    }
  })
}

export async function getInvoicesByCustomerId(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId }
  })

  if (!customer) return []

  return await prisma.invoice.findMany({
    where: {
      OR: [
        { customerId },
        { customerName: { equals: customer.name, mode: 'insensitive' } }
      ]
    },
    orderBy: { createdAt: 'desc' }
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
}) {
  const customer = await findOrCreateCustomer(data.customerName, data.customerMobile)
  const invoices = await getAllInvoices()

  // Calculate maximum existing invoice number
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

  const items = (data.items || []).map((it, idx) => {
    const qty = Number(it.qty) || 1
    const rate = Number(it.rate) || 0
    return {
      sr: idx + 1,
      description: it.description || '',
      qty,
      rate,
      total: Number((qty * rate).toFixed(2))
    }
  })

  const subtotal = items.reduce((acc, curr) => acc + curr.total, 0)
  const grandTotal = subtotal

  const newInvoice = await prisma.invoice.create({
    data: {
      id: invoiceId,
      customerId: customer.id,
      customerName: customer.name,
      customerMobile: customer.mobile || '',
      viaCustomer: data.viaCustomer ? data.viaCustomer.trim() : '',
      date: data.date || new Date().toISOString().split('T')[0],
      businessName: 'JAY MATAJI REDIUM ART & TRUCK SHOW FITTING',
      businessMobile: '6353016927',
      businessOwner: 'Vivek Ghediya',
      businessAddress: 'Porbandar Khambhaliya highway bokhira, Near Vachrajdada Temple Bokhira Porbandar 360575',
      paymentStatus: data.paymentStatus || 'PAID',
      paymentMethod: data.paymentStatus === 'PENDING' ? undefined : (data.paymentMethod || 'UPI'),
      items,
      subtotal,
      grandTotal,
      notes: data.notes || ''
    }
  })

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
) {
  const existing = await prisma.invoice.findUnique({
    where: { id }
  })

  if (!existing) return null

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
        total: Number((qty * rate).toFixed(2))
      }
    })
    subtotal = items.reduce((acc, curr) => acc + curr.total, 0)
    grandTotal = subtotal
  }

  const updatedInvoice = await prisma.invoice.update({
    where: { id },
    data: {
      customerName: customer ? customer.name : (data.customerName !== undefined ? data.customerName.trim() : existing.customerName),
      customerMobile: customer ? customer.mobile || '' : (data.customerMobile !== undefined ? data.customerMobile : existing.customerMobile),
      customerId: customer ? customer.id : existing.customerId,
      viaCustomer: data.viaCustomer !== undefined ? data.viaCustomer.trim() : (existing.viaCustomer || ''),
      date: data.date || existing.date,
      items,
      subtotal,
      grandTotal,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      paymentStatus: data.paymentStatus !== undefined ? data.paymentStatus : (existing.paymentStatus || 'PAID'),
      paymentMethod: data.paymentStatus === 'PENDING' ? undefined : (data.paymentMethod !== undefined ? data.paymentMethod : (existing.paymentMethod || 'UPI')),
      updatedAt: new Date()
    }
  })

  return updatedInvoice
}

export async function deleteInvoice(id: string) {
  const result = await prisma.invoice.delete({
    where: { id }
  })
  return !!result
}

/* =========================================================
   LEGACY PRODUCTS (Preserved for compatibility)
   ========================================================= */

export async function getAllProducts() {
  return await prisma.product.findMany({
    orderBy: { createdAt: 'desc' }
  })
}

export async function getProductById(id: string) {
  return await prisma.product.findUnique({
    where: { id }
  })
}

export async function addProduct(product: any) {
  return await prisma.product.create({
    data: {
      ...product,
      id: undefined // Let Prisma generate the ID
    }
  })
}

export async function updateProduct(id: string, updates: any) {
  return await prisma.product.update({
    where: { id },
    data: {
      ...updates,
      updatedAt: new Date()
    }
  })
}

export async function deleteProduct(id: string) {
  const result = await prisma.product.delete({
    where: { id }
  })
  return !!result
}

/* =========================================================
   ADMIN AUTHENTICATION
   ========================================================= */

const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@jaymataji.com').toLowerCase().trim()
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123'

export async function getAllAdmins() {
  return await prisma.admin.findMany({
    orderBy: { createdAt: 'desc' }
  })
}

export async function getAdminByEmail(email: string) {
  return await prisma.admin.findUnique({
    where: { email: email.toLowerCase().trim() }
  })
}

export async function initializeAdmin() {
  const existingAdmins = await getAllAdmins()

  if (existingAdmins.length === 0) {
    try {
      const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10)
      await prisma.admin.create({
        data: {
          email: DEFAULT_ADMIN_EMAIL,
          password: hashedPassword
        }
      })
    } catch (error: any) {
      // Ignore unique constraint error (admin already exists)
      if (error.code !== 'P2002') {
        throw error
      }
    }
  }
}

export async function createAdmin(email: string, password: string) {
  const hashedPassword = await bcrypt.hash(password, 10)
  return await prisma.admin.create({
    data: {
      email: email.toLowerCase().trim(),
      password: hashedPassword
    }
  })
}

export async function updateAdminPassword(id: string, newPassword: string) {
  const hashedPassword = await bcrypt.hash(newPassword, 10)
  return await prisma.admin.update({
    where: { id },
    data: {
      password: hashedPassword,
      updatedAt: new Date()
    }
  })
}

export async function verifyAdminPassword(email: string, password: string) {
  const admin = await getAdminByEmail(email)
  if (!admin) return null

  const isValid = await bcrypt.compare(password, admin.password)
  if (!isValid) return null

  return admin
}

/* =========================================================
   DATABASE INITIALIZATION
   ========================================================= */

export async function initializeDatabase() {
  try {
    // Initialize default admin
    await initializeAdmin()

    // Initialize default folders if none exist
    const folders = await getAllGalleryFolders()
    if (folders.length === 0) {
      await prisma.galleryFolder.createMany({
        data: [
          {
            name: 'Truck Show Fitting',
            isPrivate: false
          },
          {
            name: 'Radium Art & Stickers',
            isPrivate: false
          },
          {
            name: 'Number Plates & Monograms',
            isPrivate: false
          },
          {
            name: 'Private Designs & Samples',
            isPrivate: true
          }
        ]
      })
    }

    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Error initializing database:', error)
    throw error
  }
}
