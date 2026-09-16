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
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json')
const INVOICES_FILE = path.join(DATA_DIR, 'invoices.json')
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json')

function ensureDirAndSeed() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    if (DATA_DIR !== ROOT_DATA_DIR && fs.existsSync(ROOT_DATA_DIR)) {
      const files = ['products.json', 'gallery.json', 'customers.json', 'invoices.json', 'admins.json']
      for (const f of files) {
        const src = path.join(ROOT_DATA_DIR, f)
        const dst = path.join(DATA_DIR, f)
        if (fs.existsSync(src) && !fs.existsSync(dst)) {
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
    if (!fs.existsSync(filePath)) {
      const baseName = path.basename(filePath)
      const rootFallback = path.join(ROOT_DATA_DIR, baseName)
      if (fs.existsSync(rootFallback)) {
        return fs.readFileSync(rootFallback, 'utf-8')
      }
      return '[]'
    }
    return fs.readFileSync(filePath, 'utf-8')
  } catch (e) {
    console.error('safeReadFile error for', filePath, e)
    return '[]'
  }
}

function safeWriteFile(filePath: string, content: string): boolean {
  try {
    ensureDirAndSeed()
    fs.writeFileSync(filePath, content, 'utf-8')
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

export interface GalleryItem {
  id: string
  image: string
  createdAt: string
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
  date: string
  businessName: string
  businessMobile: string
  businessAddress: string
  items: InvoiceItem[]
  subtotal: number
  grandTotal: number
  notes?: string
  createdAt: string
  updatedAt: string
}

const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@jaymataji.com').toLowerCase().trim()
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123'

// Initialize default admin if not exists
async function initializeAdmin(): Promise<void> {
  let admins: any[] = []
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
  }
}

// Initialize default files
function initializeFiles(): void {
  ensureDirAndSeed()
  if (!fs.existsSync(PRODUCTS_FILE)) {
    const defaultProducts: any[] = []
    safeWriteFile(PRODUCTS_FILE, JSON.stringify(defaultProducts, null, 2))
  }

  if (!fs.existsSync(GALLERY_FILE)) {
    const initialGallery: GalleryItem[] = []
    // Seed from existing products if present
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
   GALLERY (Multi-Image Showcase)
   ========================================================= */

export function getAllGalleryImages(): GalleryItem[] {
  try {
    initializeFiles()
    if (!fs.existsSync(GALLERY_FILE)) return []
    const data = safeReadFile(GALLERY_FILE)
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading gallery:', error)
    return []
  }
}

export function addGalleryImages(images: string[]): GalleryItem[] {
  const current = getAllGalleryImages()
  const newItems: GalleryItem[] = images.map((img, idx) => ({
    id: `${Date.now()}_${idx}`,
    image: img,
    createdAt: new Date().toISOString(),
  }))
  const updated = [...newItems, ...current]
  safeWriteFile(GALLERY_FILE, JSON.stringify(updated, null, 2))
  return newItems
}

export function deleteGalleryImage(id: string): boolean {
  const current = getAllGalleryImages()
  const filtered = current.filter((item) => item.id !== id)
  if (filtered.length === current.length) return false
  return safeWriteFile(GALLERY_FILE, JSON.stringify(filtered, null, 2))
}

export function deleteMultipleGalleryImages(ids: string[]): number {
  const current = getAllGalleryImages()
  const idSet = new Set(ids)
  const filtered = current.filter((item) => !idSet.has(item.id))
  const removedCount = current.length - filtered.length
  safeWriteFile(GALLERY_FILE, JSON.stringify(filtered, null, 2))
  return removedCount
}

/* =========================================================
   CUSTOMERS
   ========================================================= */

export function getAllCustomers(): Customer[] {
  try {
    initializeFiles()
    const data = safeReadFile(CUSTOMERS_FILE)
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Error reading customers:', error)
    return []
  }
}

export function getCustomerById(id: string): Customer | undefined {
  const customers = getAllCustomers()
  return customers.find((c) => c.id === id)
}

export function findOrCreateCustomer(name?: string, mobile?: string): Customer {
  const customers = getAllCustomers()
  const trimmedName = String(name || '').trim()
  const trimmedMobile = String(mobile || '').trim()

  // Match by mobile or exact name safely
  let existing = customers.find(
    (c) =>
      (trimmedMobile && c.mobile && c.mobile === trimmedMobile) ||
      (trimmedName && c.name && c.name.toLowerCase() === trimmedName.toLowerCase())
  )

  if (existing) {
    // Update name or phone if provided
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
      safeWriteFile(CUSTOMERS_FILE, JSON.stringify(customers, null, 2))
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
  safeWriteFile(CUSTOMERS_FILE, JSON.stringify(customers, null, 2))
  return newCustomer
}

export function updateCustomer(
  id: string,
  data: { name?: string; mobile?: string }
): Customer | null {
  const customers = getAllCustomers()
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

  safeWriteFile(CUSTOMERS_FILE, JSON.stringify(customers, null, 2))

  // Also update all invoices associated with this customer
  const invoices = getAllInvoices()
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
    safeWriteFile(INVOICES_FILE, JSON.stringify(invoices, null, 2))
  }

  return customers[index]
}

export function deleteCustomer(id: string): boolean {
  try {
    const customers = getAllCustomers()
    const filtered = customers.filter((c) => c.id !== id)
    if (filtered.length === customers.length) return false
    safeWriteFile(CUSTOMERS_FILE, JSON.stringify(filtered, null, 2))

    // Also delete all invoices for this customer
    const invoices = getAllInvoices()
    const filteredInvoices = invoices.filter((inv) => inv.customerId !== id)
    safeWriteFile(INVOICES_FILE, JSON.stringify(filteredInvoices, null, 2))

    return true
  } catch (err) {
    console.error('Error deleting customer:', err)
    return false
  }
}

/* =========================================================
   INVOICES / BILLING
   ========================================================= */

export function getAllInvoices(): Invoice[] {
  try {
    initializeFiles()
    const data = safeReadFile(INVOICES_FILE)
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Error reading invoices:', error)
    return []
  }
}

export function getInvoiceById(id: string): Invoice | undefined {
  const invoices = getAllInvoices()
  return invoices.find((inv) => inv.id.trim().toLowerCase() === id.trim().toLowerCase())
}

export function getInvoicesByCustomerId(customerId: string): Invoice[] {
  const invoices = getAllInvoices()
  return invoices.filter((inv) => inv.customerId === customerId)
}

export function createInvoice(data: {
  customerName: string
  customerMobile?: string
  date?: string
  items: Array<{ description: string; qty: number; rate: number }>
  notes?: string
}): Invoice {
  const customer = findOrCreateCustomer(data.customerName, data.customerMobile)
  const invoices = getAllInvoices()

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
    date: data.date || new Date().toISOString().split('T')[0],
    businessName: 'JAY MATAJI REDIUM ART & TRUCK SHOW FITTING',
    businessMobile: '6353016927',
    businessAddress:
      'Porbandar Khambhaliya highway bokhira, Near Vachhrajdada Temple Bokhira Porbandar 360575',
    items,
    subtotal,
    grandTotal,
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  invoices.unshift(newInvoice)
  safeWriteFile(INVOICES_FILE, JSON.stringify(invoices, null, 2))
  return newInvoice
}

export function updateInvoice(
  id: string,
  data: {
    customerName?: string
    customerMobile?: string
    date?: string
    items?: Array<{ description: string; qty: number; rate: number }>
    notes?: string
  }
): Invoice | null {
  const invoices = getAllInvoices()
  const cleanId = id.trim().toLowerCase()
  const index = invoices.findIndex((inv) => inv.id.trim().toLowerCase() === cleanId)
  if (index === -1) return null

  const existing = invoices[index]
  const customer = data.customerName
    ? findOrCreateCustomer(data.customerName, data.customerMobile || existing.customerMobile)
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
    customerName: customer ? customer.name : existing.customerName,
    customerMobile: customer ? customer.mobile : (data.customerMobile !== undefined ? data.customerMobile : existing.customerMobile),
    customerId: customer ? customer.id : existing.customerId,
    date: data.date || existing.date,
    items,
    subtotal,
    grandTotal,
    notes: data.notes !== undefined ? data.notes : existing.notes,
    updatedAt: new Date().toISOString(),
  }

  invoices[index] = updatedInvoice
  safeWriteFile(INVOICES_FILE, JSON.stringify(invoices, null, 2))
  return updatedInvoice
}

export function deleteInvoice(id: string): boolean {
  try {
    const invoices = getAllInvoices()
    const cleanId = id.trim().toLowerCase()
    const filtered = invoices.filter((inv) => inv.id.trim().toLowerCase() !== cleanId)
    if (filtered.length === invoices.length) return false
    return safeWriteFile(INVOICES_FILE, JSON.stringify(filtered, null, 2))
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
   ADMIN AUTHENTICATION
   ========================================================= */

export async function getAllAdmins() {
  try {
    await initializeAdmin()
    if (!fs.existsSync(ADMINS_FILE)) return []
    const data = fs.readFileSync(ADMINS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading admins:', error)
    return []
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
  }

  admins.push(newAdmin)
  safeWriteFile(ADMINS_FILE, JSON.stringify(admins, null, 2))
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
  return safeWriteFile(ADMINS_FILE, JSON.stringify(admins, null, 2))
}

export async function updateAdminCredentials(
  adminId: string,
  updates: { newEmail?: string; newPassword?: string }
): Promise<{ success: boolean; message?: string; admin?: any }> {
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

  admins[idx].updatedAt = new Date().toISOString()
  safeWriteFile(ADMINS_FILE, JSON.stringify(admins, null, 2))
  return { success: true, admin: admins[idx] }
}

export async function initializeDatabase() {
  await initializeAdmin()
  initializeFiles()
}
