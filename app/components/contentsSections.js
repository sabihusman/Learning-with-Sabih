// Shared open-section store for the contents accordion (contents page) and the
// contents drawer (topic pages). Both read and write the SAME localStorage key and
// dispatch the SAME change event, so expanding a section in one place is reflected in
// the other and the two can never drift out of sync.
//
// The value is the list of open section names. It is exposed as an external store for
// useSyncExternalStore: getSnapshot returns a STABLE reference until the stored string
// changes (a fresh array each call would loop forever), and the server snapshot is the
// empty list so the static HTML renders every section collapsed with no hydration
// mismatch; if localStorage holds a saved set, React reconciles it after mount.

const STORAGE_KEY = 'contentsOpenSections'
const CHANGE_EVENT = 'contentsaccordionchange'
export const EMPTY = []

export const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

let cachedRaw = null
let cachedVal = EMPTY

export function readOpen() {
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

export function subscribe(callback) {
  window.addEventListener('storage', callback)
  window.addEventListener(CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(CHANGE_EVENT, callback)
  }
}

// Toggle one section open/closed. Derive from the latest stored value (the source of
// truth), not a stale render closure, so quick successive toggles compose correctly.
export function toggleSection(name) {
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
