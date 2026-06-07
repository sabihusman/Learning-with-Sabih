import './globals.css'

export const metadata = {
  title: 'Learning with Sabih',
  description: 'Interactive study guide for computer science concepts',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
