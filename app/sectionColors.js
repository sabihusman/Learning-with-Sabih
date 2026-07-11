// Single source of truth for each section's chapter metadata: color, slug, and
// blurb. Shared by the contents-page chapter cards and the /chapters/<slug>/ view
// routes so neither copy ever drifts from the other.

export const SECTION_COLORS = {
  'AI and ML': { color: '#c0392b' },
  'Algorithms and Data Structures': { color: '#3a6f8f' },
  'Databases and SQL': { color: '#8a6d3b' },
  'Systems and Networking': { color: '#1f6f5c' },
  'Object-Oriented Programming': { color: '#7a4e7e' },
  'Data and Compression': { color: '#a85632' },
}

const FALLBACK_COLOR = '#c0392b'

// Returns the color for a section name, falling back to the accent color so a
// typo or a new section added to SECTION_ORDER without a color entry never
// crashes a consumer.
export function colorForSection(name) {
  return SECTION_COLORS[name]?.color ?? FALLBACK_COLOR
}

// The single slug function for section/chapter names: lowercase, non-alphanumeric
// runs collapsed to one hyphen, no leading/trailing hyphen. Used by both the
// contents-page chapter cards (href) and generateStaticParams for /chapters/<slug>/,
// so a card's link and the route it points to can never fall out of sync.
export function sectionSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// One-line blurb per section, shown on both the contents-page chapter card and the
// chapter view page's header - kept here as the single copy of this text.
export const SECTION_BLURBS = {
  'AI and ML': 'From gradient descent to attention, RLHF and RAG, watch models train, sample and retrieve live.',
  'Algorithms and Data Structures': 'Race real algorithms, hash keys into buckets, and watch the call stack push and pop.',
  'Databases and SQL': 'Joins, indexes, query plans and transactions, watch queries run against live tables.',
  'Systems and Networking': 'Caches, load balancers, shards and packets, the machinery behind every request.',
  'Object-Oriented Programming': 'Classes, inheritance and polymorphism as moving diagrams, not definitions.',
  'Data and Compression': 'Drag probabilities and watch a Huffman code chase the entropy floor.',
}

export default SECTION_COLORS

// Guard: every SECTION_ORDER entry must have a color. Enforced by
// e2e/section-colors-logic.spec.ts (which imports SECTION_ORDER from
// topicList.js and asserts a SECTION_COLORS entry exists for each name)
// rather than a runtime throw here, since a throw at module scope would
// break every page that ever imports this file over one missing section -
// the test still fails CI if a section is ever added to SECTION_ORDER
// without a matching color.
