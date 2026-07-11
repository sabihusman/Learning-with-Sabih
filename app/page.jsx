import Link from 'next/link'
import styles from './page.module.css'
import { SECTIONS, TOPICS } from './topicList'
import { colorForSection, sectionSlug, SECTION_BLURBS } from './sectionColors'
import FontSizeControl from './components/FontSizeControl'

export const metadata = {
  title: 'Learning with Sabih',
}

export default function ContentsPage() {
  const topicCount = TOPICS.length
  const chapterCount = SECTIONS.length

  return (
    <main className={styles.main}>
      <div className={styles.topBar}>
        <FontSizeControl />
      </div>

      <header className={styles.hero}>
        <span className={styles.circleLarge} aria-hidden="true" />
        <span className={styles.circleSmall} aria-hidden="true" />
        <p className={styles.eyebrow}>Learning with Sabih</p>
        <h1 className={styles.headline}>Computer Science, an interactive study guide</h1>
        <p className={styles.subline}>
          {topicCount} hands-on topics across {chapterCount} chapters. Every one is a live demo, drag, slide and break things until they make sense.
        </p>
      </header>

      <div className={styles.grid}>
        {SECTIONS.map((section) => {
          const count = section.topics.length
          return (
            <Link
              key={section.name}
              href={`/chapters/${sectionSlug(section.name)}/`}
              className={styles.card}
            >
              <div className={styles.cardTop}>
                <span className={styles.countPill} style={{ backgroundColor: colorForSection(section.name) }}>
                  {count} {count === 1 ? 'topic' : 'topics'}
                </span>
                <span className={styles.arrow} aria-hidden="true">
                  &rarr;
                </span>
              </div>
              <h2 className={styles.cardTitle}>{section.name}</h2>
              <p className={styles.cardBlurb}>{SECTION_BLURBS[section.name]}</p>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
