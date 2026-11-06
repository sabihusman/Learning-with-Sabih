import './globals.css'
import { SITE_NAME, SITE_URL } from './site'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: 'Interactive study guide for computer science concepts',
  alternates: { canonical: './' },
  openGraph: { siteName: SITE_NAME, type: 'website', url: './' },
}

// Applies the saved reading-size before first paint so there is no flash of the
// default size on load. Runs synchronously during HTML parse, ahead of any content.
const READ_SCALE_SCRIPT = `(function(){try{var m={small:'0.9',medium:'1',large:'1.15'};var s=localStorage.getItem('readScale');if(s&&m[s])document.documentElement.style.setProperty('--read-scale',m[s]);}catch(e){}})();`

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: READ_SCALE_SCRIPT }} />
        {children}
      </body>
    </html>
  )
}
