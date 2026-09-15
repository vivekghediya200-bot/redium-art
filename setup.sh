#!/bin/bash
# Jay Mataji Redium Art - Quick Setup Script for macOS/Linux

echo ""
echo "===================================="
echo "Jay Mataji Redium Art Setup"
echo "===================================="
echo ""

# Check if Node.js is installed
echo "Checking for Node.js installation..."
if ! command -v node &> /dev/null; then
    echo ""
    echo "❌ Node.js is not installed"
    echo "Please install Node.js from: https://nodejs.org/"
    echo ""
    exit 1
fi

echo "✓ Node.js found:"
node --version

echo ""
echo "Installing dependencies (this may take 2-3 minutes)..."
npm install

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Failed to install dependencies"
    echo "Check your internet connection and try again"
    echo ""
    exit 1
fi

echo ""
echo "✓ Dependencies installed successfully!"
echo ""
echo "===================================="
echo "Setup Complete! 🎉"
echo "===================================="
echo ""
echo "Next steps:"
echo "1. Update .env.local with your MongoDB connection string"
echo "2. Run: npm run dev"
echo "3. Open: http://localhost:3000"
echo ""
echo "Admin Panel: http://localhost:3000/admin"
echo "Default Email: admin@jaymataji.com"
echo "Default Password: Admin@123"
echo ""
