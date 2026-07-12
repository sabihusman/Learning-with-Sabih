import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SECTIONS, SECTION_ORDER, pluralTopics } from '../../topicList'
import { colorForSection, sectionSlug, SECTION_BLURBS } from '../../sectionColors'
import styles from './page.module.css'

// One static page per section, at /chapters/<slug>/. Only the six real sections ever
// exist - dynamicParams: false makes any other slug 404 at build/request time instead
// of attempting a render this static export cannot serve.
export const dynamicParams = false

export function generateStaticParams() {
  return SECTION_ORDER.map((name) => ({ slug: sectionSlug(name) }))
}

function findSection(slug) {
  return SECTIONS.find((section) => sectionSlug(section.name) === slug)
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const section = findSection(slug)
  if (!section) return {}
  return { title: `${section.name} - Learning with Sabih` }
}

export default async function ChapterPage({ params }) {
  const { slug } = await params
  const section = findSection(slug)
  if (!section) notFound()

  const color = colorForSection(section.name)

  return (
    <main className={styles.main} style={{ '--chapter-color': color }}>
      <Link href="/" className={styles.backLink}>
        &larr; All Chapters
      </Link>

      <header className={styles.header}>
        <span className={styles.countPill}>
          {pluralTopics(section.topics.length)}
        </span>
        <h1 className={styles.title}>{section.name}</h1>
        <p className={styles.blurb}>{SECTION_BLURBS[section.name]}</p>
      </header>

      <ol className={styles.grid}>
        {section.topics.map((topic) => (
          <li key={topic.num}>
            <Link href={topic.href} className={styles.row}>
              <span className={styles.num}>{topic.num}</span>
              <span className={styles.rowBody}>
                <span className={styles.rowTitle}>{topic.title}</span>
                <span className={styles.rowSubtitle}>{topic.subtitle}</span>
              </span>
              <span className={styles.arrow} aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  )
}
