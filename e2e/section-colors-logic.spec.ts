import { test, expect } from '@playwright/test'
import { SECTION_ORDER } from '../app/topicList'
import { SECTION_COLORS, colorForSection, sectionSlug, SECTION_BLURBS } from '../app/sectionColors'

// Pure-function correctness for the section color/slug/blurb metadata. No page, no
// browser: this guards against SECTION_ORDER (topicList.js) drifting apart from
// SECTION_COLORS/SECTION_BLURBS (sectionColors.js), e.g. a new section added to one
// but not the other.

const HEX_COLOR = /^#[0-9a-f]{6}$/

test('every SECTION_ORDER entry has a matching SECTION_COLORS entry', () => {
  for (const name of SECTION_ORDER) {
    expect(SECTION_COLORS[name]).toBeDefined()
  }
})

test('every SECTION_COLORS entry is a valid hex color', () => {
  for (const name of Object.keys(SECTION_COLORS)) {
    expect(SECTION_COLORS[name].color).toMatch(HEX_COLOR)
  }
})

test('colorForSection returns the mapped color for every known section', () => {
  for (const name of SECTION_ORDER) {
    expect(colorForSection(name)).toBe(SECTION_COLORS[name].color)
  }
})

test('colorForSection falls back to the accent color for an unknown section', () => {
  expect(colorForSection('Not a Real Section')).toBe('#c0392b')
})

test('every SECTION_ORDER entry has a matching SECTION_BLURBS entry', () => {
  for (const name of SECTION_ORDER) {
    expect(typeof SECTION_BLURBS[name]).toBe('string')
    expect(SECTION_BLURBS[name].length).toBeGreaterThan(0)
  }
})

test('sectionSlug produces the six expected chapter slugs', () => {
  expect(SECTION_ORDER.map(sectionSlug)).toEqual([
    'ai-and-ml',
    'algorithms-and-data-structures',
    'databases-and-sql',
    'systems-and-networking',
    'object-oriented-programming',
    'data-and-compression',
  ])
})

test('sectionSlug produces six distinct slugs, so every /chapters/<slug>/ route is unique', () => {
  const slugs = SECTION_ORDER.map(sectionSlug)
  expect(new Set(slugs).size).toBe(slugs.length)
})
