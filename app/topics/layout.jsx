import Link from 'next/link'
import styles from './layout.module.css'
import TopicNav from './TopicNav'
import FontSizeControl from '../components/FontSizeControl'
import ContentsDrawer from '../components/ContentsDrawer'

export default function TopicsLayout({ children }) {
  return (
    <>
      <ContentsDrawer />
      <nav className={styles.nav}>
        <Link href="/" className={styles.back}>
          &larr; Contents
        </Link>
        <div className={styles.navRight}>
          <FontSizeControl />
          <span className={styles.brand}>Learning with Sabih</span>
        </div>
      </nav>
      <div className={styles.container}>
        <article className={styles.prose}>{children}</article>
        <TopicNav />
      </div>
    </>
  )
}
