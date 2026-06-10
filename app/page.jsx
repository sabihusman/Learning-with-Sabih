import Link from 'next/link'
import styles from './page.module.css'
import { SECTIONS } from './topicList'

export const metadata = {
  title: 'Learning with Sabih',
}

export default function ContentsPage() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Learning with Sabih</p>
        <h1 className={styles.siteName}>Computer Science</h1>
        <p className={styles.tagline}>An interactive study guide</p>
      </header>

      <nav className={styles.contents} aria-label="Table of contents">
        <h2 className={styles.contentsLabel}>Contents</h2>
        {SECTIONS.map((section) => (
          <section key={section.name} className={styles.section}>
            <h3 className={styles.sectionHeader}>{section.name}</h3>
            <ol className={styles.list}>
              {section.topics.map((topic) => (
                <li key={topic.num} className={styles.item}>
                  <Link href={topic.href} className={styles.link}>
                    <span className={styles.num}>{topic.num}</span>
                    <span className={styles.topicTitle}>{topic.title}</span>
                    <span className={styles.leader} aria-hidden="true" />
                  </Link>
                  <p className={styles.subtitle}>{topic.subtitle}</p>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </nav>
    </main>
  )
}
