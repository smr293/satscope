import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AGNT Station - AI Agent Control Panel',
  description: 'Create and manage AI agents with a single prompt',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
