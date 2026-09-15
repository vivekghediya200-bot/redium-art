import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'

const DATA_DIR = path.join(process.cwd(), 'data')
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json')
const GALLERY_FILE = path.join(DATA_DIR, 'gallery.json')
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json')
const INVOICES_FILE = path.join(DATA_DIR, 'invoices.json')
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json')

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
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
      const content = fs.readFileSync(ADMINS_FILE, 'utf-8')
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
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2))
  }
}

// Initialize default files
function initializeFiles(): void {
  if (!fs.existsSync(PRODUCTS_FILE)) {
    const defaultProducts: any[] = []
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(defaultProducts, null, 2))
  }

  if (!fs.existsSync(GALLERY_FILE)) {
    const initialGallery: GalleryItem[] = []
    // Seed from existing products if present
    if (fs.existsSync(PRODUCTS_FILE)) {
      try {
        const prodData = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf-8'))
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
    fs.writeFileSync(GALLERY_FILE, JSON.stringify(initialGallery, null, 2))
  }

  if (!fs.existsSync(CUSTOMERS_FILE)) {
    const defaultCustomers: Customer[] = []
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(defaultCustomers, null, 2))
  }

  if (!fs.existsSync(INVOICES_FILE)) {
    const defaultInvoices: Invoice[] = []
    fs.writeFileSync(INVOICES_FILE, JSON.stringify(defaultInvoices, null, 2))
  }
}

/* =========================================================
   GALLERY (Multi-Image Showcase)
   ========================================================= */

export function getAllGalleryImages(): GalleryItem[] {
  try {
    initializeFiles()
    if (!fs.existsSync(GALLERY_FILE)) return []
    const data = fs.readFileSync(GALLERY_FILE, 'utf-8')
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
  fs.writeFileSync(GALLERY_FILE, JSON.stringify(updated, null, 2))
  return newItems
}

export function deleteGalleryImage(id: string): boolean {
  const current = getAllGalleryImages()
  const filtered = current.filter((item) => item.id !== id)
  if (filtered.length === current.length) return false
  fs.writeFileSync(GALLERY_FILE, JSON.stringify(filtered, null, 2))
  return true
}

export function deleteMultipleGalleryImages(ids: string[]): number {
  const current = getAllGalleryImages()
  const idSet = new Set(ids)
  const filtered = current.filter((item) => !idSet.has(item.id))
  const removedCount = current.length - filtered.length
  fs.writeFileSync(GALLERY_FILE, JSON.stringify(filtered, null, 2))
  return removedCount
}

/* =========================================================
   CUSTOMERS
   ========================================================= */

export function getAllCustomers(): Customer[] {
  try {
    initializeFiles()
    if (!fs.existsSync(CUSTOMERS_FILE)) return []
    const data = fs.readFileSync(CUSTOMERS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading customers:', error)
    return []
  }
}

export function getCustomerById(id: string): Customer | undefined {
  const customers = getAllCustomers()
  return customers.find((c) => c.id === id)
}

export function findOrCreateCustomer(name: string, mobile: string): Customer {
  const customers = getAllCustomers()
  const trimmedName = name.trim()
  const trimmedMobile = mobile.trim()

  // Match by mobile or exact name
  let existing = customers.find(
    (c) =>
      (trimmedMobile && c.mobile === trimmedMobile) ||
      c.name.toLowerCase() === trimmedName.toLowerCase()
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
      fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2))
    }
    return existing
  }

  const newCustomer: Customer = {
    id: `cust_${Date.now()}`,
    name: trimmedName,
    mobile: trimmedMobile,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  customers.push(newCustomer)
  fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2))
  return newCustomer
}

/* =========================================================
   INVOICES / BILLING
   ========================================================= */

export function getAllInvoices(): Invoice[] {
  try {
    initializeFiles()
    if (!fs.existsSync(INVOICES_FILE)) return []
    const data = fs.readFileSync(INVOICES_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading invoices:', error)
    return []
  }
}

export function getInvoiceById(id: string): Invoice | undefined {
  const invoices = getAllInvoices()
  return invoices.find((inv) => inv.id === id)
}

export function getInvoicesByCustomerId(customerId: string): Invoice[] {
  const invoices = getAllInvoices()
  return invoices.filter((inv) => inv.customerId === customerId)
}

export function createInvoice(data: {
  customerName: string
  customerMobile: string
  date?: string
  items: Array<{ description: string; qty: number; rate: number }>
  notes?: string
}): Invoice {
  const customer = findOrCreateCustomer(data.customerName, data.customerMobile)
  const invoices = getAllInvoices()

  // Generate sequential/formatted invoice number e.g. INV-1001
  const nextNumber = invoices.length + 1
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
  fs.writeFileSync(INVOICES_FILE, JSON.stringify(invoices, null, 2))
  return newInvoice
}

export function deleteInvoice(id: string): boolean {
  const invoices = getAllInvoices()
  const filtered = invoices.filter((inv) => inv.id !== id)
  if (filtered.length === invoices.length) return false
  fs.writeFileSync(INVOICES_FILE, JSON.stringify(filtered, null, 2))
  return true
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
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2))
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
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2))
  return products[index]
}

export function deleteProduct(id: string) {
  const products = getAllProducts()
  const filtered = products.filter((p: any) => p.id !== id)
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(filtered, null, 2))
  return true
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
  let admin = admins.find(
    (a: any) => a.email && a.email.toLowerCase().trim() === normalizedEmail
  )

  const envEmail = DEFAULT_ADMIN_EMAIL
  const envPass = DEFAULT_ADMIN_PASSWORD

  // If credentials match default/env credentials
  if (normalizedEmail === envEmail && password === envPass) {
    if (!admin) {
      admin = await createAdmin(envEmail, envPass)
    } else {
      // Ensure bcrypt hash in admins.json matches
      const isBcryptValid = await bcrypt
        .compare(password, admin.password)
        .catch(() => false)
      if (!isBcryptValid) {
        const newHash = await bcrypt.hash(envPass, 10)
        admin.password = newHash
        const idx = admins.findIndex((a: any) => a.id === admin.id)
        if (idx !== -1) {
          admins[idx].password = newHash
          fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2))
        }
      }
    }
    return admin
  }

  if (!admin) return null

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
  fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2))
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
  fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2))
  return true
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
  fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2))
  return { success: true, admin: admins[idx] }
}

export async function initializeDatabase() {
  await initializeAdmin()
  initializeFiles()
}
