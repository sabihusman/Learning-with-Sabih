import styles from './page.module.css'
import { SECTIONS } from './topicList'
import FontSizeControl from './components/FontSizeControl'
import ContentsAccordion from './components/ContentsAccordion'

export const metadata = {
  title: 'Learning with Sabih',
}

export default function ContentsPage() {
  return (
    <main className={styles.main}>
      <div className={styles.topBar}>
        <FontSizeControl />
      </div>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Learning with Sabih</p>
        <h1 className={styles.siteName}>Computer Science</h1>
        <p className={styles.tagline}>An interactive study guide</p>
      </header>

      <ContentsAccordion sections={SECTIONS} />
    </main>
  )
}
