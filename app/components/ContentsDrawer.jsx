'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SECTIONS } from '../topicList'
import { EMPTY, slugify, readOpen, subscribe, toggleSection } from './contentsSections'
import styles from './ContentsDrawer.module.css'

// ── pin store (desktop) ──────────────────────────────────────────────────────────────
// Whether the desktop panel is pinned open. Persisted like readScale/contentsOpenSections:
// useSyncExternalStore over localStorage + a custom event, with the server snapshot false
// so the static HTML renders collapsed and there is no hydration mismatch.
const PIN_KEY = 'contentsDrawerPinned'
const PIN_EVENT = 'contentsdrawerpinchange'

function readPinned() {
  try {
    return localStorage.getItem(PIN_KEY) === '1'
  } catch {
    return false
  }
}
function subscribePin(callback) {
  window.addEventListener('storage', callback)
  window.addEventListener(PIN_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(PIN_EVENT, callback)
  }
}
function setPinned(value) {
  try {
    localStorage.setItem(PIN_KEY, value ? '1' : '0')
  } catch {
    /* ignore persistence failures */
  }
  window.dispatchEvent(new Event(PIN_EVENT))
}

// ── viewport store ───────────────────────────────────────────────────────────────────
// Desktop (hover + pin) vs mobile (tap + backdrop) is chosen by width. matchMedia is read
// as an external store so there is no setState-in-effect; the server snapshot is desktop,
// which is harmless because both variants render collapsed (an overlay, no reflow).
const DESKTOP_QUERY = '(min-width: 768px)'
function subscribeDesktop(callback) {
  const mql = window.matchMedia(DESKTOP_QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}
function readDesktop() {
  return window.matchMedia(DESKTOP_QUERY).matches
}

const FOCUSABLE = 'a[href], button:not([disabled])'

export default function ContentsDrawer() {
  const pathname = usePathname() || ''
  const parts = pathname.split('/').filter(Boolean)
  const currentSlug = parts[parts.length - 1]

  const openList = useSyncExternalStore(subscribe, readOpen, () => EMPTY)
  const openSet = new Set(openList)
  const pinned = useSyncExternalStore(subscribePin, readPinned, () => false)
  const isDesktop = useSyncExternalStore(subscribeDesktop, readDesktop, () => true)

  // Transient reveal drivers. On desktop the panel shows on hover or keyboard focus (or
  // when pinned); on mobile it shows only when explicitly opened by tap.
  const [hovering, setHovering] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const rootRef = useRef(null)
  const tabRef = useRef(null)
  const panelRef = useRef(null)

  const revealed = isDesktop ? hovering || focusWithin || pinned : mobileOpen

  // Close everything. On desktop, dropping focus out of the drawer collapses the
  // focus/hover reveal (returning focus to the tab would keep it open, since the tab is
  // inside the reveal region). On mobile, restore focus to the opener tab.
  const close = useCallback(() => {
    setMobileOpen(false)
    setHovering(false)
    setFocusWithin(false)
    if (isDesktop) {
      if (readPinned()) setPinned(false)
      const active = document.activeElement
      if (active && active !== document.body && rootRef.current?.contains(active)) active.blur()
    } else if (tabRef.current) {
      tabRef.current.focus()
    }
  }, [isDesktop])

  // Escape closes from anywhere inside the drawer. Bound only while revealed so it does
  // not swallow Escape for the rest of the page.
  useEffect(() => {
    if (!revealed) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [revealed, close])

  const onTabClick = () => {
    if (isDesktop) setPinned(!readPinned())
    else setMobileOpen(true)
  }

  // Keep focus inside the mobile overlay while it is open (simple wrap at the edges).
  const onPanelKeyDown = (e) => {
    if (isDesktop || !mobileOpen || e.key !== 'Tab') return
    const focusables = panelRef.current?.querySelectorAll(FOCUSABLE)
    if (!focusables || focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  // Desktop focus tracking: reveal when focus enters the drawer, collapse when it leaves.
  const onFocusCapture = () => {
    if (isDesktop) setFocusWithin(true)
  }
  const onBlurCapture = (e) => {
    if (!isDesktop) return
    if (!rootRef.current?.contains(e.relatedTarget)) setFocusWithin(false)
  }
  const onMouseEnter = () => {
    if (isDesktop) setHovering(true)
  }
  const onMouseLeave = () => {
    if (isDesktop) setHovering(false)
  }

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-revealed={revealed || undefined}
      data-mobile-open={!isDesktop && mobileOpen ? 'true' : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
    >
      {/* Dimmed backdrop, mobile only, only while open. */}
      <button
        type="button"
        className={styles.backdrop}
        aria-hidden="true"
        tabIndex={-1}
        onClick={close}
      />

      {/* The always-present edge tab: desktop hover/focus target and pin toggle; mobile
          open button. A comfortable tap target on mobile. */}
      <button
        ref={tabRef}
        type="button"
        className={styles.tab}
        aria-expanded={revealed}
        aria-controls="contents-drawer-panel"
        onClick={onTabClick}
      >
        <span className={styles.tabLabel}>Contents</span>
      </button>

      <aside
        ref={panelRef}
        id="contents-drawer-panel"
        className={styles.panel}
        aria-label="Contents"
        onKeyDown={onPanelKeyDown}
      >
        <div className={styles.panelHead}>
          <span className={styles.panelTitle}>Contents</span>
          {isDesktop ? (
            <button
              type="button"
              className={styles.pin}
              aria-pressed={pinned}
              onClick={() => setPinned(!readPinned())}
            >
              {pinned ? 'Unpin' : 'Pin open'}
            </button>
          ) : (
            <button type="button" className={styles.closeBtn} aria-label="Close contents" onClick={close}>
              &times;
            </button>
          )}
        </div>

        <nav className={styles.nav} aria-label="All topics">
          {SECTIONS.map((section) => {
            const isOpen = openSet.has(section.name)
            const headerId = `drawer-h-${slugify(section.name)}`
            const panelId = `drawer-p-${slugify(section.name)}`
            return (
              <section key={section.name} className={styles.section}>
                <h3 className={styles.sectionHeadingWrap}>
                  <button
                    type="button"
                    id={headerId}
                    className={styles.sectionHeader}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggleSection(section.name)}
                  >
                    <span className={styles.chevron} data-open={isOpen} aria-hidden="true">
                      &#9656;
                    </span>
                    <span className={styles.sectionName}>{section.name}</span>
                    <span className={styles.count}>{section.topics.length}</span>
                  </button>
                </h3>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={headerId}
                  className={`${styles.sectionPanel} ${isOpen ? styles.sectionPanelOpen : ''}`}
                  inert={!isOpen || undefined}
                >
                  <div className={styles.sectionPanelInner}>
                    <ol className={styles.list}>
                      {section.topics.map((topic) => {
                        const active = topic.slug === currentSlug
                        return (
                          <li key={topic.num} className={styles.item}>
                            <Link
                              href={topic.href}
                              className={`${styles.link} ${active ? styles.linkActive : ''}`}
                              aria-current={active ? 'page' : undefined}
                              onClick={() => setMobileOpen(false)}
                            >
                              <span className={styles.num}>{topic.num}</span>
                              <span className={styles.topicTitle}>{topic.title}</span>
                              <span className={styles.leader} aria-hidden="true" />
                            </Link>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                </div>
              </section>
            )
          })}
        </nav>
      </aside>
    </div>
  )
}
