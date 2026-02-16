import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import { YahooAuthProvider } from '@/contexts/YahooAuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ToastProvider } from '@/components/Toast'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Fantasy Baseball Copilot — AI-Powered Fantasy Sports Assistant',
    template: '%s | Fantasy Baseball Copilot',
  },
  description:
    'Get AI-powered lineup optimization, trade analysis, waiver wire picks, and draft advice for your Yahoo Fantasy Baseball league.',
  keywords: [
    'fantasy baseball',
    'lineup optimizer',
    'fantasy sports AI',
    'Yahoo fantasy',
    'draft advice',
    'waiver wire',
    'trade analyzer',
    'fantasy baseball assistant',
  ],
  openGraph: {
    title: 'Fantasy Baseball Copilot',
    description:
      'AI-powered fantasy baseball assistant — lineup optimization, trade analysis, waiver picks & more.',
    type: 'website',
    siteName: 'Fantasy Baseball Copilot',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fantasy Baseball Copilot',
    description:
      'AI-powered fantasy baseball assistant — lineup optimization, trade analysis & more.',
  },
  robots: {
    index: true,
    follow: true,
  },
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
  viewportFit: 'cover',
  themeColor: '#0f172a',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="theme-dark bg-slate-900">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-X7CWYR78HV"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-X7CWYR78HV');
          `}
        </Script>
      </head>
      <body className={`${inter.className} bg-slate-900`}>
        <YahooAuthProvider>
          <ThemeProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </ThemeProvider>
        </YahooAuthProvider>
      </body>
    </html>
  )
}
