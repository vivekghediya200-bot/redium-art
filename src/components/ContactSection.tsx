'use client'

import { useState } from 'react'

export default function ContactSection() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')

  const handleWhatsAppMessage = (e: React.FormEvent) => {
    e.preventDefault()
    const text = `Hello Jay Mataji Redium Art & Truck Show Fitting,\nName: ${name}\nPhone: ${phone}\nMessage: ${message}`
    window.open(
      `https://wa.me/916353016927?text=${encodeURIComponent(text)}`,
      '_blank'
    )
  }

  return (
    <section id="contact" className="bg-gray-50 py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-secondary font-bold text-xs uppercase tracking-widest bg-orange-100 px-3 py-1 rounded-full">
            Visit or Message
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-3">
            Contact &amp; Workshop Location
          </h2>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">
            Get in touch for custom quotes, bulk truck fitting, and artwork orders.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12">
          {/* Direct Phone / Call */}
          <a
            href="tel:6353016927"
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition text-center flex flex-col items-center justify-center group hover:border-amber-300"
          >
            <div className="w-14 h-14 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              📞
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">Direct Call</h3>
            <p className="text-primary font-extrabold text-base">6353016927</p>
            <p className="text-xs font-bold text-gray-700 mt-1">Owner: Vivek Ghediya</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full group-hover:bg-amber-600 group-hover:text-white transition">
              Call Now ↗
            </span>
          </a>

          {/* WhatsApp Direct */}
          <a
            href="https://wa.me/916353016927"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition text-center flex flex-col items-center justify-center group hover:border-green-300"
          >
            <div className="w-14 h-14 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              💬
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">WhatsApp Chat</h3>
            <p className="text-green-600 font-extrabold text-base">Chat on WhatsApp</p>
            <p className="text-xs text-gray-500 mt-1">Instant photo sharing &amp; quotes</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full group-hover:bg-green-600 group-hover:text-white transition">
              Open WhatsApp ↗
            </span>
          </a>

          {/* Workshop Address with Google Maps Redirection */}
          <a
            href="https://maps.google.com/?q=21°39'33.9%22N+69°36'22.1%22E"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition text-center flex flex-col items-center justify-center group hover:border-blue-300 cursor-pointer"
            title="Open Workshop Location in Google Maps"
          >
            <div className="w-14 h-14 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              📍
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">Workshop Address</h3>
            <p className="text-xs text-gray-600 leading-relaxed font-medium">
              Porbandar Khambhaliya highway,
              <br />
              Near Vachhrajdada Temple,
              <br />
              Bokhira, Porbandar 360575
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full group-hover:bg-blue-600 group-hover:text-white transition">
              📍 View on Google Maps ↗
            </span>
          </a>

          {/* Instagram Showcase */}
          <a
            href="https://www.instagram.com/jay_mataji_truck_body_builder/?hl=en"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition text-center flex flex-col items-center justify-center group hover:border-pink-300 cursor-pointer"
            title="Follow on Instagram"
          >
            <div className="w-14 h-14 bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 text-white rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform shadow-sm">
              📸
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">Instagram</h3>
            <p className="text-pink-600 font-extrabold text-xs truncate max-w-full">
              @jay_mataji_truck_body_builder
            </p>
            <p className="text-xs text-gray-500 mt-1">Truck artwork &amp; fittings</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-pink-600 bg-pink-50 px-3 py-1 rounded-full group-hover:bg-pink-600 group-hover:text-white transition">
              Follow Profile ↗
            </span>
          </a>
        </div>

        {/* Instant Quote / Message via WhatsApp Form */}
        <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-xl sm:text-2xl font-bold mb-2 text-gray-900">
            Send Inquiry to WhatsApp
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 mb-6">
            Fill in your details below to open a pre-filled direct WhatsApp inquiry with us.
          </p>

          <form onSubmit={handleWhatsAppMessage} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Your Mobile Number
                </label>
                <input
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Message / Artwork Requirements *
              </label>
              <textarea
                required
                placeholder="Describe your requirements (truck show fitting, number plate redium, custom sticker size)..."
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:border-primary"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-green-600 text-white py-3.5 rounded-xl hover:bg-green-700 transition font-bold text-sm shadow-md flex items-center justify-center gap-2"
            >
              <span>💬</span> Send Directly via WhatsApp (6353016927)
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
