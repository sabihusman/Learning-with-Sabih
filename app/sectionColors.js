// Single source of truth for each section's color. Nothing consumes this yet;
// future PRs (intro cards, topic-page accents) will import from here.

export const SECTION_COLORS = {
  'AI and ML': { color: '#c0392b' },
  'Algorithms and Data Structures': { color: '#2f6f7e' },
  'Databases and SQL': { color: '#9c6b1e' },
  'Systems and Networking': { color: '#1f6f5c' },
  'Object-Oriented Programming': { color: '#7b4b78' },
  'Data and Compression': { color: '#46628f' },
}

const FALLBACK_COLOR = '#c0392b'

// Returns the color for a section name, falling back to the accent color so a
// typo or a new section added to SECTION_ORDER without a color entry never
// crashes a consumer.
export function colorForSection(name) {
  return SECTION_COLORS[name]?.color ?? FALLBACK_COLOR
}

export default SECTION_COLORS

// Guard: every SECTION_ORDER entry must have a color. Enforced by
// e2e/section-colors-logic.spec.ts (which imports SECTION_ORDER from
// topicList.js and asserts a SECTION_COLORS entry exists for each name)
// rather than a runtime throw here, since a throw at module scope would
// break every page that ever imports this file over one missing section -
// the test still fails CI if a section is ever added to SECTION_ORDER
// without a matching color.
