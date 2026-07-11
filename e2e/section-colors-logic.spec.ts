import { test, expect } from '@playwright/test'
import { SECTION_ORDER } from '../app/topicList'
import { SECTION_COLORS, colorForSection } from '../app/sectionColors'

// Pure-function correctness for the section color map. No page, no browser: this
// guards against SECTION_ORDER (topicList.js) and SECTION_COLORS (sectionColors.js)
// drifting apart, e.g. a new section added to one file but not the other.

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
