import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Fantasy Sports Copilot',
  description: 'Conversational fantasy sports management',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Fantasy Copilot',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f172a',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="bg-slate-900">
      <body className={`${inter.className} bg-slate-900`}>{children}</body>
    </html>
  )
}
