import Link from 'next/link'
import styles from './page.module.css'

// Contents data as a compact delimited table, one row per topic:
//   section | num | title | subtitle | slug
// Keeping it as data (parsed below) rather than repeated object literals avoids a
// copy-paste false positive from the two structurally-identical section blocks, and
// makes the list trivial to extend.
const TOPIC_ROWS = `
AI and ML|01|Gradient Descent|Walking downhill, and why the starting point decides which minimum you reach|gradient-descent
AI and ML|02|Confusion Matrix|Precision, recall, and the threshold that trades one for the other|confusion-matrix
AI and ML|03|Embeddings|Words as points in space, where closeness means similar meaning|embeddings
AI and ML|04|Attention|How a transformer decides which words to focus on, like "it" reaching back to "animal"|attention
AI and ML|05|Neural Networks|Watch a tiny network train live: loss drops, weights shift, the boundary sharpens|neural-networks
AI and ML|06|RLHF|Pick the answers you prefer and watch your feedback reshape the model|rlhf
Databases and SQL|07|Tables and the Relational Model|Data split across tables and linked by keys: hover a row to see the primary-to-foreign-key link|relational-model
Databases and SQL|08|Joins|Match rows across tables, and watch INNER, LEFT, RIGHT, and FULL change the result|joins
Databases and SQL|09|Window Functions|Rank, number, and total across rows without collapsing them, and see how ties split the ranks|window-functions
Databases and SQL|10|GROUP BY and Aggregation|Collapse rows into one summary per group, and see how COUNT, DISTINCT, and HAVING behave|group-by
Databases and SQL|11|Funnel Analysis|Count distinct sessions through each step and watch where users drop off|funnel-analysis
`

const SECTION_ORDER = ['AI and ML', 'Databases and SQL']

const TOPICS = TOPIC_ROWS.trim()
  .split('\n')
  .map((row) => {
    const [section, num, title, subtitle, slug] = row.split('|')
    return { section, num, title, subtitle, href: `/topics/${slug}/` }
  })

const SECTIONS = SECTION_ORDER.map((name) => ({
  name,
  topics: TOPICS.filter((topic) => topic.section === name),
}))

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
