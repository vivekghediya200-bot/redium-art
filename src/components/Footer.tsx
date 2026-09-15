'use client'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-950 text-gray-400 py-12 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl overflow-hidden bg-white flex items-center justify-center p-0.5 shadow-md flex-shrink-0">
                <img
                  src="/images/logo.png"
                  alt="Jay Mataji Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="text-white font-extrabold text-lg leading-tight">
                JAY MATAJI REDIUM ART &amp; TRUCK SHOW FITTING
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-gray-400 max-w-md leading-relaxed mb-4">
              Specialized in artistic redium works, commercial vehicle &amp; truck show styling, custom decals, reflective tape fitting, and bespoke signage.
            </p>
            <p className="text-xs text-gray-500">
              📍 Porbandar Khambhaliya highway bokhira, Near Vachhrajdada Temple, Porbandar 360575
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-bold text-sm mb-3">Quick Navigation</h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <a href="#gallery" className="hover:text-amber-400 transition">
                  Artwork Gallery
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-amber-400 transition">
                  Workshop Location
                </a>
              </li>
              <li>
                <a href="/admin" className="hover:text-amber-400 transition">
                  Admin Login
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Details */}
          <div>
            <h4 className="text-white font-bold text-sm mb-3">Direct Contact</h4>
            <p className="text-xs sm:text-sm mb-2 text-gray-300">
              📞 Phone:{' '}
              <a href="tel:6353016927" className="text-amber-400 font-bold hover:underline">
                6353016927
              </a>
            </p>
            <p className="text-xs sm:text-sm mb-2">
              💬 WhatsApp:{' '}
              <a
                href="https://wa.me/916353016927"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 font-semibold hover:underline"
              >
                Chat on WhatsApp
              </a>
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Bokhira, Porbandar, Gujarat, India
            </p>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-800 pt-6 text-center text-xs text-gray-500 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p>
            © {currentYear} Jay Mataji Redium Art &amp; Truck Show Fitting. All rights reserved.
          </p>
          <p className="text-gray-600">
            Built for professional artwork &amp; vehicle styling operations.
          </p>
        </div>
      </div>
    </footer>
  )
}
