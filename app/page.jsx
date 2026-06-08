import Link from 'next/link'
import styles from './page.module.css'

const SECTIONS = [
  {
    name: 'AI and ML',
    topics: [
      {
        num: '01',
        title: 'Gradient Descent',
        subtitle: 'Walking downhill, and why the starting point decides which minimum you reach',
        href: '/topics/gradient-descent/',
      },
      {
        num: '02',
        title: 'Confusion Matrix',
        subtitle: 'Precision, recall, and the threshold that trades one for the other',
        href: '/topics/confusion-matrix/',
      },
      {
        num: '03',
        title: 'Embeddings',
        subtitle: 'Words as points in space, where closeness means similar meaning',
        href: '/topics/embeddings/',
      },
      {
        num: '04',
        title: 'Attention',
        subtitle: 'How a transformer decides which words to focus on, like "it" reaching back to "animal"',
        href: '/topics/attention/',
      },
      {
        num: '05',
        title: 'Neural Networks',
        subtitle: 'Watch a tiny network train live: loss drops, weights shift, the boundary sharpens',
        href: '/topics/neural-networks/',
      },
      {
        num: '06',
        title: 'RLHF',
        subtitle: 'Pick the answers you prefer and watch your feedback reshape the model',
        href: '/topics/rlhf/',
      },
    ],
  },
  {
    name: 'Databases and SQL',
    topics: [
      {
        num: '07',
        title: 'Joins',
        subtitle: 'Match rows across tables, and watch INNER, LEFT, RIGHT, and FULL change the result',
        href: '/topics/joins/',
      },
      {
        num: '08',
        title: 'Window Functions',
        subtitle: 'Rank, number, and total across rows without collapsing them, and see how ties split the ranks',
        href: '/topics/window-functions/',
      },
      {
        num: '09',
        title: 'GROUP BY and Aggregation',
        subtitle: 'Collapse rows into one summary per group, and see how COUNT, DISTINCT, and HAVING behave',
        href: '/topics/group-by/',
      },
      {
        num: '10',
        title: 'Funnel Analysis',
        subtitle: 'Count distinct sessions through each step and watch where users drop off',
        href: '/topics/funnel-analysis/',
      },
    ],
  },
]

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
                    <span className={styles.topicNum}>{topic.num}</span>
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
