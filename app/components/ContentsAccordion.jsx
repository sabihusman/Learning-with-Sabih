'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import styles from '../page.module.css'

const STORAGE_KEY = 'contentsOpenSections'
const CHANGE_EVENT = 'contentsaccordionchange'
const EMPTY = []

const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Read the open-section list from localStorage as an external store, with a cached
// snapshot so getSnapshot returns a STABLE reference until the stored value changes
// (otherwise useSyncExternalStore would re-render forever). The server snapshot is the
// empty list, so the static HTML renders all sections collapsed and there is no
// hydration mismatch; if localStorage has a saved set, React reconciles after mount.
let cachedRaw = null
let cachedVal = EMPTY
function readOpen() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || '[]'
    if (raw === cachedRaw) return cachedVal
    cachedRaw = raw
    const parsed = JSON.parse(raw)
    cachedVal = Array.isArray(parsed) ? parsed : EMPTY
    return cachedVal
  } catch {
    return cachedVal
  }
}

function subscribe(callback) {
  window.addEventListener('storage', callback)
  window.addEventListener(CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(CHANGE_EVENT, callback)
  }
}

// Collapsible contents. Sections start collapsed so a first visit shows the whole
// structure at a glance; the open set persists in localStorage across navigation and
// reload. The expand/collapse is a pure CSS transition (grid-template-rows 0fr -> 1fr
// plus opacity), so it is state-driven and runs on the compositor: nothing to stall if
// rAF is throttled, and no anime.js is needed here.
export default function ContentsAccordion({ sections }) {
  const openList = useSyncExternalStore(subscribe, readOpen, () => EMPTY)
  const openSet = new Set(openList)

  const toggle = (name) => {
    // Derive from the latest stored value (the source of truth), not the render
    // closure, so quick successive toggles compose correctly.
    const next = new Set(readOpen())
    if (next.has(name)) next.delete(name)
    else next.add(name)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
    } catch {
      /* ignore persistence failures */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }

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
