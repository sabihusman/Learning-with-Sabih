'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { colorForSection } from '../sectionColors'
import styles from './ContentsAccordion.module.css'
import { EMPTY, slugify, readOpen, subscribe, openOnlySection } from './contentsSections'

// One-line blurb per section, shown on its chapter card. Keyed by the exact
// SECTION_ORDER strings from topicList.js.
const SECTION_BLURBS = {
  'AI and ML': 'From gradient descent to attention, transformers, and how models are trained.',
  'Algorithms and Data Structures': 'Sorting, searching, hashing, and the data structures underneath, watched step by step.',
  'Databases and SQL': 'Joins, indexes, transactions, and query plans on real tables.',
  'Systems and Networking': 'Caches, load balancers, sharding, concurrency, and how data moves.',
  'Object-Oriented Programming': 'Classes, inheritance, polymorphism, and composition, built up in order.',
  'Data and Compression': 'How information is measured and squeezed, from entropy to encoding.',
}

// Colored chapter cards that ARE the accordion: all six stay visible in a grid, and
// clicking a card's header opens its topic list directly beneath it, closing whichever
// other card was open (see openOnlySection in contentsSections.js). The open card spans
// the full grid width so its topic list reads as "right below" the card that owns it,
// rather than as a separate block elsewhere on the page.
//
// Only ONE open section name is ever rendered, even though the underlying store
// technically allows more (it is shared with the topic-page drawer's own multi-select
// behavior, left unchanged) - openList[0] is treated as the single source of truth here
// so the cards never show two sections open at once.
export default function ContentsAccordion({ sections }) {
  const openList = useSyncExternalStore(subscribe, readOpen, () => EMPTY)
  const openName = openList.length > 0 ? openList[0] : null

  return (
    <nav className={styles.contents} aria-label="Table of contents">
      <h2 className={styles.contentsLabel}>Contents</h2>
      <div className={styles.grid}>
        {sections.map((section) => {
          const isOpen = section.name === openName
          const slug = slugify(section.name)
          const headerId = `card-h-${slug}`
          const panelId = `card-p-${slug}`
          const color = colorForSection(section.name)
          const count = section.topics.length

          return (
            <section
              key={section.name}
              id={slug}
              className={styles.card}
              data-open={isOpen || undefined}
              style={{ '--card-color': color }}
            >
              <h3 className={styles.cardHeadingWrap}>
                <button
                  type="button"
                  id={headerId}
                  className={styles.cardHeader}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => openOnlySection(section.name)}
                >
                  <span className={styles.cardTitleRow}>
                    <span className={styles.cardName}>{section.name}</span>
                    <span className={styles.chevron} data-open={isOpen} aria-hidden="true">
                      &#9656;
                    </span>
                  </span>
                  <span className={styles.cardBlurb}>{SECTION_BLURBS[section.name]}</span>
                  <span className={styles.countPill}>
                    {count} {count === 1 ? 'topic' : 'topics'}
                  </span>
                </button>
              </h3>

              <div
                id={panelId}
                role="region"
                aria-labelledby={headerId}
                className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
                inert={!isOpen || undefined}
              >
                <div className={styles.panelInner}>
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
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </nav>
  )
}
