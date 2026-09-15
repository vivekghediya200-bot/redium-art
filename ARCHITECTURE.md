# Project Structure & Architecture

## Directory Layout

```
C:\Users\DELL\web/
│
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout wrapper
│   │   ├── page.tsx                  # Home page
│   │   ├── globals.css               # Global styles
│   │   │
│   │   ├── admin/                    # Admin section
│   │   │   ├── page.tsx              # Admin login page
│   │   │   └── dashboard/
│   │   │       └── page.tsx          # Admin dashboard
│   │   │
│   │   └── api/                      # Backend API Routes
│   │       ├── products/
│   │       │   └── route.ts          # GET all products
│   │       ├── auth/
│   │       │   └── login/
│   │       │       └── route.ts      # Admin login endpoint
│   │       └── admin/
│   │           └── products/
│   │               ├── route.ts      # POST/GET admin products
│   │               └── [id]/
│   │                   └── route.ts  # DELETE/PUT product
│   │
│   ├── components/                   # React Components
│   │   ├── Header.tsx                # Navigation header
│   │   ├── Hero.tsx                  # Hero section
│   │   ├── Gallery.tsx               # Product gallery
│   │   ├── ProductCard.tsx           # Product display card
│   │   ├── ContactSection.tsx        # Contact/social links
│   │   ├── Footer.tsx                # Footer
│   │   └── Admin/                    # Admin components
│   │       ├── AdminHeader.tsx       # Admin nav
│   │       ├── ProductList.tsx       # Admin product table
│   │       └── AddProductModal.tsx   # Add product form
│   │
│   ├── models/                       # MongoDB Schemas
│   │   ├── Product.ts                # Product schema
│   │   └── Admin.ts                  # Admin user schema
│   │
│   └── lib/                          # Utility Functions
│       ├── db.ts                     # MongoDB connection
│       └── auth.ts                   # JWT authentication
│
├── public/                           # Static files (images, etc)
│
├── Configuration Files
│   ├── package.json                  # Dependencies & scripts
│   ├── tsconfig.json                 # TypeScript config
│   ├── next.config.js                # Next.js config
│   ├── tailwind.config.js            # Tailwind CSS config
│   ├── postcss.config.js             # PostCSS config
│   ├── .env.local                    # Environment variables (local)
│   ├── .env.example                  # Environment template
│   └── .gitignore                    # Git ignore rules
│
├── Documentation
│   ├── README.md                     # Project overview
│   ├── INSTALLATION_GUIDE.md         # Setup instructions
│   └── ARCHITECTURE.md               # This file
│
├── Docker
│   ├── Dockerfile                    # Docker container config
│   └── docker-compose.yml            # Docker compose setup
│
├── Setup Scripts
│   ├── setup.bat                     # Windows setup
│   └── setup.sh                      # Linux/Mac setup
│
└── .github/
    └── copilot-instructions.md       # VS Code Copilot config
```

## Technology Stack

### Frontend
- **Next.js 14** - React framework with SSR
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS
- **React 18** - UI library

### Backend
- **Next.js API Routes** - Serverless functions
- **Node.js** - JavaScript runtime
- **Express-like** routing

### Database
- **MongoDB** - NoSQL database
- **Mongoose** - ODM (Object Document Mapper)
- **MongoDB Atlas** - Cloud database (recommended)

### Security
- **bcryptjs** - Password hashing
- **jsonwebtoken (JWT)** - Token authentication
- **Next.js middleware** - Protected routes

### Deployment
- **Vercel** - Recommended (free tier available)
- **Docker** - Container support
- **AWS, Google Cloud** - Alternative options

---

## Database Schema

### Products Collection
```javascript
{
  _id: ObjectId,
  name: String,           // Product name (3-100 chars)
  image: String,          // Image URL
  price: Number,          // Price in INR (min: 0)
  quantity: Number,       // Stock quantity (min: 0)
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Admin Collection
```javascript
{
  _id: ObjectId,
  email: String,          // Unique email
  password: String,       // Hashed with bcrypt
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## API Endpoints

### Public Endpoints

#### Get All Products
```
GET /api/products
Response: Array of products
```

#### Get Single Product
```
GET /api/products/:id
Response: Single product object
```

### Protected Admin Endpoints

#### Admin Login
```
POST /api/auth/login
Body: { email, password }
Response: { token, admin }
```

#### Get Admin Products
```
GET /api/admin/products
Headers: Authorization: Bearer <token>
Response: Array of products
```

#### Create Product
```
POST /api/admin/products
Headers: Authorization: Bearer <token>
Body: FormData { name, price, quantity, image }
Response: { message, product }
```

#### Update Product
```
PUT /api/admin/products/:id
Headers: Authorization: Bearer <token>
Body: { name, price, quantity }
Response: { message, product }
```

#### Delete Product
```
DELETE /api/admin/products/:id
Headers: Authorization: Bearer <token>
Response: { message }
```

---

## Authentication Flow

1. **Admin enters credentials** → Login page
2. **POST /api/auth/login** → Server validates credentials
3. **Server generates JWT token** → Token includes admin ID & email
4. **Token stored in localStorage** → Browser stores for future requests
5. **Protected routes check token** → Authorization header verified
6. **Token expires after 7 days** → User must login again

---

## Environment Variables

```
MONGODB_URI          # MongoDB connection string
NEXTAUTH_SECRET      # JWT signing secret (min 32 chars)
NEXTAUTH_URL         # Application URL
NEXT_PUBLIC_API_URL  # Public API endpoint
CLOUDINARY_*         # Image hosting (optional)
```

---

## Performance Optimizations

1. **Image Optimization**
   - Lazy loading with `loading="lazy"`
   - WebP format support
   - Automatic resizing

2. **Code Splitting**
   - Next.js automatic code splitting
   - Component-level lazy loading

3. **Caching**
   - MongoDB query caching
   - Static generation where possible

4. **Security**
   - Input validation on all endpoints
   - CORS protection
   - JWT token verification

---

## Development Workflow

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

---

## Color Scheme (Customizable)

- **Primary**: #8B4513 (Brown - Used for main elements)
- **Secondary**: #D2691E (Chocolate - Used for hover states)
- **Accent**: #FFD700 (Gold - Used for highlights)
- **Background**: #FFFFFF (White)
- **Text**: #1F2937 (Dark Gray)

---

## Deployment Checklist

- [ ] Install Node.js
- [ ] Run `npm install`
- [ ] Configure MongoDB Atlas
- [ ] Set environment variables
- [ ] Test locally with `npm run dev`
- [ ] Build with `npm run build`
- [ ] Deploy to Vercel/hosting
- [ ] Configure domain
- [ ] Set production environment variables
- [ ] Test all features
- [ ] Set up monitoring

---

## Next Steps

1. **Local Development**: Install Node.js and dependencies
2. **Database Setup**: Create MongoDB Atlas account
3. **Configuration**: Update .env.local with credentials
4. **Customization**: Update colors, links, and content
5. **Image Hosting**: Set up Cloudinary (optional)
6. **Testing**: Test all features locally
7. **Deployment**: Deploy to Vercel or hosting provider

---

**Built with ❤️ for Jay Mataji Redium Art**
