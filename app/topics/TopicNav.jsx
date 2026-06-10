'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { neighbors } from '../topicList'
import styles from './TopicNav.module.css'

// Bottom-of-page previous/next navigation, shared across every topic via the topics
// layout. The current topic is derived from the URL (usePathname), and prev/next come
// from the single ordered list in topicList.js, so reordering topics updates these
// buttons automatically. The sequence crosses section boundaries.
export default function TopicNav() {
  const pathname = usePathname() || ''
  // last non-empty path segment, e.g. "/topics/embeddings/" -> "embeddings"
  const parts = pathname.split('/').filter(Boolean)
  const slug = parts[parts.length - 1]
  const { prev, next } = neighbors(slug)

  if (!prev && !next) return null

  return (
    <nav className={styles.topicNav} aria-label="Topic navigation">
      {prev ? (
        <Link href={prev.href} className={`${styles.btn} ${styles.prev}`}>
          <span className={styles.dir}>&larr; Previous</span>
          <span className={styles.name}>{prev.title}</span>
        </Link>
      ) : (
        <span className={styles.spacer} aria-hidden="true" />
      )}

      {next ? (
        <Link href={next.href} className={`${styles.btn} ${styles.next}`}>
          <span className={styles.dir}>Next &rarr;</span>
          <span className={styles.name}>{next.title}</span>
        </Link>
      ) : (
        <span className={styles.spacer} aria-hidden="true" />
      )}
    </nav>
  )
}
