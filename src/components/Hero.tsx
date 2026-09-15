'use client'

import Link from 'next/link'

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary via-[#A0522D] to-secondary text-white py-16 sm:py-24 px-4 sm:px-6">
      {/* Decorative background circle */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-black/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-amber-200 text-xs sm:text-sm font-semibold mb-6 border border-white/20">
          <span>✨</span> Handcrafted Redium &amp; Vehicle Fitting Specialists
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black mb-6 tracking-tight leading-tight">
          JAY MATAJI REDIUM ART &amp; <br />
          <span className="text-amber-300">TRUCK SHOW FITTING</span>
        </h1>

        <p className="text-base sm:text-xl text-gray-100 max-w-3xl mx-auto mb-8 font-normal leading-relaxed">
          Specialized in custom redium artwork, commercial truck show fittings, vehicle styling, signage, and precision handcrafted decals. Bringing quality craftsmanship to every design.
        </p>

        {/* Address badge */}
        <div className="inline-block bg-black/25 backdrop-blur-md px-4 py-2 rounded-xl text-xs sm:text-sm text-gray-200 mb-8 border border-white/10">
          📍 Porbandar Khambhaliya highway bokhira, Near Vachhrajdada Temple, Porbandar 360575
        </div>

        {/* Call-to-action buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="#gallery"
            className="px-6 py-3 bg-white text-primary font-bold rounded-xl shadow-lg hover:bg-amber-50 transition transform hover:-translate-y-0.5 text-sm sm:text-base"
          >
            Browse Artwork Gallery
          </Link>

          <a
            href="https://wa.me/916353016927"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-lg transition transform hover:-translate-y-0.5 text-sm sm:text-base flex items-center gap-2"
          >
            <span>💬</span> WhatsApp: 6353016927
          </a>
        </div>
      </div>
    </section>
  )
}
