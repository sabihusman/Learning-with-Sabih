import { test, expect } from '@playwright/test'
import sitemap from '../app/sitemap'
import robots from '../app/robots'
import { SITE_URL } from '../app/site'
import { SECTION_ORDER, TOPICS } from '../app/topicList'
import { sectionSlug } from '../app/sectionColors'

// Page-less: the sitemap and robots.txt are built from topicList, so a topic
// added there must appear in the sitemap without anyone remembering to.

test('sitemap lists the home page, every chapter, and every topic exactly once', () => {
  const urls = sitemap().map((e) => e.url)
  const expected = [
    `${SITE_URL}/`,
    ...SECTION_ORDER.map((name) => `${SITE_URL}/chapters/${sectionSlug(name)}/`),
    ...TOPICS.map((t) => `${SITE_URL}/topics/${t.slug}/`),
  ]
  expect(urls).toEqual(expected)
  expect(new Set(urls).size).toBe(urls.length)
})

test('every sitemap URL is on the canonical https origin with a trailing slash', () => {
  for (const { url } of sitemap()) {
    expect(url.startsWith(`${SITE_URL}/`), url).toBe(true)
    expect(url.endsWith('/'), url).toBe(true)
  }
  expect(SITE_URL).toBe('https://learnwithsabih.com')
})

test('robots.txt allows everything and points at the sitemap', () => {
  const r = robots()
  expect(r.rules).toEqual({ userAgent: '*', allow: '/' })
  expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`)
})
