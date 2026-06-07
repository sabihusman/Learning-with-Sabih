import Link from 'next/link'
import styles from './layout.module.css'

export default function TopicsLayout({ children }) {
  return (
    <>
      <nav className={styles.nav}>
        <Link href="/" className={styles.back}>
          &larr; Contents
        </Link>
        <span className={styles.brand}>Learning with Sabih</span>
      </nav>
      <div className={styles.container}>
        <article className={styles.prose}>{children}</article>
      </div>
    </>
  )
}
