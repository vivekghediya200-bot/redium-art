import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Jay Mataji Redium Art & Truck Show Fitting',
  description:
    'Professional Redium Artwork, Truck Show Fitting, Commercial Vehicle Styling, and Decal Specialists in Porbandar',
  keywords:
    'redium art, truck show fitting, porbandar, decals, number plate, vehicle styling, artwork',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  )
}
