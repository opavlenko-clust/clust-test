import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'App',
  description: 'MVP Template',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
