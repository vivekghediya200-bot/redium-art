'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
            <img
              src="/images/logo.png"
              alt="Jay Mataji Redium Art Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 leading-tight group-hover:text-primary transition">
              Jay Mataji
            </h1>
            <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">
              Redium Art &amp; Truck Show Fitting
            </p>
          </div>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-5">
          <a
            href="tel:6353016927"
            className="text-xs font-bold text-gray-700 hover:text-primary flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 transition"
          >
            <span>📞</span> 6353016927
          </a>
          <a
            href="https://www.instagram.com/jay_mataji_truck_body_builder/?hl=en"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-pink-600 hover:text-pink-700 flex items-center gap-1.5 bg-pink-50 px-3 py-1.5 rounded-lg border border-pink-200 transition"
            title="Follow on Instagram"
          >
            <span>📸</span> Instagram
          </a>
          <Link
            href="#gallery"
            className="text-sm font-semibold text-gray-700 hover:text-primary transition"
          >
            Gallery
          </Link>
          <Link
            href="#contact"
            className="text-sm font-semibold text-gray-700 hover:text-primary transition"
          >
            Contact
          </Link>
          <Link
            href="/admin"
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition font-semibold text-xs sm:text-sm shadow-sm flex items-center gap-1.5"
          >
            <span>👨‍💼</span> Admin Portal
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-2xl p-1 text-gray-700"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          ☰
        </button>

        {/* Mobile Menu Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 bg-white shadow-xl border-b border-gray-200 p-4 md:hidden flex flex-col gap-3">
            <a
              href="tel:6353016927"
              className="text-sm font-bold text-gray-800 flex items-center gap-2 py-2"
            >
              <span>📞</span> Call: 6353016927
            </a>
            <a
              href="https://www.instagram.com/jay_mataji_truck_body_builder/?hl=en"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="text-sm font-bold text-pink-600 flex items-center gap-2 py-2"
            >
              <span>📸</span> Instagram: @jay_mataji_truck_body_builder
            </a>
            <Link
              href="#gallery"
              onClick={() => setIsOpen(false)}
              className="block py-2 text-sm font-semibold text-gray-700 hover:text-primary"
            >
              Gallery
            </Link>
            <Link
              href="#contact"
              onClick={() => setIsOpen(false)}
              className="block py-2 text-sm font-semibold text-gray-700 hover:text-primary"
            >
              Contact &amp; Location
            </Link>
            <Link
              href="/admin"
              onClick={() => setIsOpen(false)}
              className="block py-2.5 px-4 bg-primary text-white rounded-lg text-center font-bold text-sm"
            >
              Admin Portal
            </Link>
          </div>
        )}
      </nav>
    </header>
  )
}
