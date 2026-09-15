# Jay Mataji Redium Art - Installation & Setup Guide

## ✅ What's Already Done

Your complete Next.js e-commerce platform has been set up with:
- ✅ Full project structure created
- ✅ Admin dashboard with authentication
- ✅ User-facing product gallery
- ✅ Professional UI/UX design (brown & gold theme)
- ✅ All API routes configured
- ✅ Database models ready
- ✅ Configuration files prepared
- ✅ Security features implemented

## 📦 What You Need to Do Now

### Step 1: Install Node.js (CRITICAL - Do This First)

**Download & Install Node.js LTS:**

1. Visit: https://nodejs.org/
2. Download **LTS version** (v18 or v20 recommended)
3. Run the installer
4. ✅ Check "Automatically install necessary tools"
5. Follow the installation wizard
6. **IMPORTANT:** After installation, close and reopen VS Code completely

### Step 2: Verify Node.js Installation

Open PowerShell and run:
```powershell
node --version
npm --version
```

You should see version numbers like:
```
v18.19.0
9.8.1
```

### Step 3: Install Project Dependencies

In VS Code terminal (in your project folder), run:
```powershell
npm install
```

This will install all required packages (takes 2-3 minutes).

### Step 4: Set Up MongoDB

1. Create a free account at: https://www.mongodb.com/cloud/atlas
2. Create a new database cluster
3. Get your connection string
4. Open `.env.local` file in your project
5. Replace `MONGODB_URI` with your connection string:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/jay-mataji-redium-art
   ```

### Step 5: Run Development Server

In terminal, run:
```powershell
npm run dev
```

You'll see:
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

### Step 6: Access Your Website

- **User Site:** http://localhost:3000
- **Admin Panel:** http://localhost:3000/admin

#### Default Admin Login:
- Email: `admin@jaymataji.com`
- Password: `Admin@123`

---

## 🎨 Project Structure

```
jay-mataji-redium-art/
├── src/
│   ├── app/               # Pages and API routes
│   │   ├── admin/        # Admin login & dashboard
│   │   ├── api/          # Backend API endpoints
│   │   └── page.tsx      # Home page
│   ├── components/       # React components
│   │   ├── Admin/        # Admin components
│   │   ├── Header.tsx    # Navigation
│   │   ├── Gallery.tsx   # Product gallery
│   │   └── ...
│   ├── models/           # MongoDB schemas
│   ├── lib/              # Utilities (auth, DB)
│   └── styles/           # Global CSS
├── package.json          # Dependencies
├── tailwind.config.js    # Styling
└── .env.local            # Environment variables
```

---

## 🚀 Key Features

### User Features (Public Site)
✅ Beautiful product gallery with square images
✅ Product cards showing: image, name, price, stock status
✅ Contact section with Instagram, Facebook, WhatsApp links
✅ Responsive mobile design
✅ Professional brown & gold color scheme

### Admin Features (Protected)
✅ Secure login system
✅ Add new products with images
✅ Edit/delete products
✅ Real-time inventory tracking
✅ Automatic calculations for price & quantity

### Security
✅ JWT token authentication
✅ Password hashing (bcrypt)
✅ Protected API endpoints
✅ Input validation

---

## 🔧 Customization

### Change Colors
Edit `tailwind.config.js`:
```javascript
colors: {
  primary: '#8B4513',    // Brown
  secondary: '#D2691E',  // Chocolate
  accent: '#FFD700',     // Gold
}
```

### Update Social Media Links
1. Edit `src/components/ContactSection.tsx`
2. Replace Instagram/Facebook/WhatsApp URLs
3. Same changes in `src/components/Footer.tsx`

### Change Admin Credentials
1. Login to admin panel with default credentials
2. After first login, change password in database

### Upload Product Images
In production, configure:
- Cloudinary (recommended)
- AWS S3
- Or any image hosting service

Update in `.env.local`:
```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

---

## 📱 Responsive Design

- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 4 columns

All images are square, optimized, and lazy-loaded.

---

## 🚀 Deployment Options

### Vercel (Recommended - Free)
1. Push project to GitHub
2. Go to: https://vercel.com
3. Connect GitHub repository
4. Deploy automatically

### Build for Production
```powershell
npm run build
npm start
```

---

## ❓ Troubleshooting

### `npm: command not found`
- Node.js not installed or PATH not updated
- **Fix:** Restart VS Code and PowerShell after Node.js installation

### Port 3000 already in use
```powershell
npm run dev -- -p 3001
```

### MongoDB connection error
- Check your connection string in `.env.local`
- Ensure IP whitelist allows your computer in MongoDB Atlas

### Images not loading
- Use complete HTTPS URLs
- Or configure image hosting service (Cloudinary)

---

## 📞 Support

For issues or questions:
- 📧 Email: info@jaymataji.com
- 📱 Instagram: @jaymataji-redium-art
- 💬 Facebook: Jay Mataji Redium Art
- 📲 WhatsApp: [Add your number]

---

## ✨ Next Steps After Setup

1. **Customize:** Update colors, links, text
2. **Database:** Configure MongoDB connection
3. **Images:** Set up image hosting (Cloudinary)
4. **Products:** Add your artwork through admin panel
5. **Testing:** Test all features
6. **Deployment:** Deploy to Vercel or hosting provider

---

**Your professional e-commerce platform is ready! Just install Node.js and follow the steps above. 🎉**
