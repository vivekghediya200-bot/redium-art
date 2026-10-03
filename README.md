# Jay Mataji Redium Art - Professional E-Commerce Platform

A modern, secure, and fast e-commerce platform for selling Redium artwork.

## Features

### 🎨 User Features
- Beautiful, responsive storefront with square gallery layout
- Advanced product filtering and search
- Secure shopping cart and checkout
- Order tracking
- Social media links (Instagram, Facebook, WhatsApp)
- Responsive design (mobile, tablet, desktop)

### 👨‍💼 Admin Features
- Secure authentication dashboard
- Photo upload and management for artwork
- Inventory management with real-time calculations
- Billing system with item name, price, quantity
- Order management
- Analytics and sales reports

### 🔒 Security Features
- JWT authentication
- Password hashing with bcrypt
- Input validation and sanitization
- SQL injection prevention
- CSRF protection
- Secure API endpoints

### ⚡ Performance Features
- Image optimization and lazy loading
- Server-side rendering
- Caching strategies
- Fast page load times

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: MongoDB with Prisma ORM
- **Authentication**: JWT with bcrypt
- **Image Storage**: Vercel Blob
- **Styling**: Tailwind CSS with custom theme

## Getting Started

### Prerequisites
- Node.js 18+ installed
- MongoDB Atlas account
- npm or yarn

### Installation

1. Open this project in VS Code

2. Install dependencies:
```bash
npm install
```

3. Set up MongoDB Atlas database:
   - Follow the [MongoDB Setup Guide](./MONGODB_SETUP.md) to create your database
   - Copy your connection string

4. Set up environment variables (.env.local):
   - Copy `ENV_TEMPLATE.txt` to `.env.local`
   - Fill in your MongoDB connection string and other secrets
   - See [Vercel Deployment Guide](./VERCEL_DEPLOYMENT.md) for details

5. Generate Prisma client:
```bash
npx prisma generate
```

6. Sync database schema:
```bash
npx prisma db push
```

7. Run development server:
```bash
npm run dev
```

8. Open http://localhost:3000

## Admin Login
- URL: http://localhost:3000/admin
- Default credentials will be set during setup

## Deployment

### Vercel Deployment
This project is configured for Vercel deployment with MongoDB Atlas:

1. Push your code to a Git repository
2. Follow the [Vercel Deployment Guide](./VERCEL_DEPLOYMENT.md)
3. Add environment variables in Vercel dashboard:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: Generate a secure random string
   - `ADMIN_EMAIL`: Your admin email
   - `ADMIN_PASSWORD`: Your admin password
4. Deploy and your app will be live!

**Note**: See [SETUP_COMPLETE.md](./SETUP_COMPLETE.md) for detailed setup and deployment instructions.

## Support

Contact through social media:
- Instagram: Jay Mataji Redium Art
- Facebook: Jay Mataji Redium Art
- WhatsApp: Contact number

---

**Built with ❤️ for Jay Mataji Redium Art**
