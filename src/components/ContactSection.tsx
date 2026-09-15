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

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* Direct Phone / Call */}
          <a
            href="tel:6353016927"
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition text-center flex flex-col items-center justify-center group"
          >
            <div className="w-14 h-14 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              📞
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">Direct Call</h3>
            <p className="text-primary font-extrabold text-base">6353016927</p>
            <p className="text-xs text-gray-500 mt-1">Mon - Sun (Business Hours)</p>
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
          </a>

          {/* Workshop Address */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-2xl mb-4">
              📍
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">Workshop Address</h3>
            <p className="text-xs text-gray-600 leading-relaxed font-medium">
              Porbandar Khambhaliya highway bokhira,
              <br />
              Near Vachhrajdada Temple,
              <br />
              Bokhira, Porbandar 360575
            </p>
          </div>
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
                placeholder="Describe your requirements (e.g., truck show fitting, number plate redium, custom sticker size)..."
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
