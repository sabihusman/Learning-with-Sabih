'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import styles from '../page.module.css'
import { EMPTY, slugify, readOpen, subscribe, toggleSection } from './contentsSections'

// Collapsible contents. Sections start collapsed so a first visit shows the whole
// structure at a glance; the open set persists in localStorage across navigation and
// reload (see contentsSections.js, the store shared with the topic-page drawer so the
// two never drift). The expand/collapse is a pure CSS transition (grid-template-rows
// 0fr -> 1fr plus opacity), so it is state-driven and runs on the compositor: nothing
// to stall if rAF is throttled, and no anime.js is needed here.
export default function ContentsAccordion({ sections }) {
  const openList = useSyncExternalStore(subscribe, readOpen, () => EMPTY)
  const openSet = new Set(openList)
  const toggle = toggleSection

  return (
    <nav className={styles.contents} aria-label="Table of contents">
      <h2 className={styles.contentsLabel}>Contents</h2>
      {sections.map((section) => {
        const isOpen = openSet.has(section.name)
        const headerId = `acc-h-${slugify(section.name)}`
        const panelId = `acc-p-${slugify(section.name)}`
        return (
          <section key={section.name} className={styles.section}>
            <h3 className={styles.sectionHeadingWrap}>
              <button
                type="button"
                id={headerId}
                className={styles.sectionHeader}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(section.name)}
              >
                <span className={styles.chevron} data-open={isOpen} aria-hidden="true">
                  &#9656;
                </span>
                <span className={styles.sectionName}>{section.name}</span>
                <span className={styles.count}>
                  {section.topics.length} {section.topics.length === 1 ? 'topic' : 'topics'}
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
    </nav>
  )
}
