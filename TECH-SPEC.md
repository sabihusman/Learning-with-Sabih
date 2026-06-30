# Learning with Sabih — Technical Specification

An interactive, browser-based computer-science study guide. Each topic is a short prose
explanation paired with one hand-built, interactive figure that lets the reader
manipulate the concept directly. The site is a fully static export with no backend.

_Last updated: reflects `main` with the complete Algorithms and Data Structures section
(10 topics, Big-O through Dynamic programming) and the required-status-checks ruleset on
`main` (32 topics, 4 sections)._

---

## 1. Product overview

- **Format:** a contents page that lists every topic, grouped into collapsible
  sections, plus one page per topic. Each topic page is prose + a single interactive
  figure, with previous/next navigation across the whole sequence.
- **Content scope:** 32 topics in 4 sections (in contents order):
  - **AI and ML** (12): Gradient Descent, Neural Networks, Overfitting and
    Generalization, Confusion Matrix, Tokenization, Why Models Struggle with Math,
    Embeddings, Attention, Transformers and Multi-Head Attention, RLHF, Temperature and
    Sampling, RAG (Retrieval-Augmented Generation).
  - **Algorithms and Data Structures** (10): Big-O and Time Complexity, Binary Search,
    Recursion and the Call Stack, Sorting, Linked List vs Array, Hash Tables, Binary
    Search Trees, Graph Traversal (BFS and DFS), Dijkstra's Shortest Path, Dynamic
    Programming. The section is internally ordered to build on itself and is bookended by
    recursion (topic 3, Towers of Hanoi) returning at topic 10 (Fibonacci memoization).
  - **Databases and SQL** (6): Tables and the Relational Model, SELECT/WHERE/CASE,
    Joins, GROUP BY and Aggregation, Window Functions, Funnel Analysis.
  - **Object-Oriented Programming** (4): Classes and Objects, Inheritance,
    Polymorphism, Composition vs Inheritance.
- **Design intent:** calm, editorial "study guide" aesthetic — serif body, mono labels,
  dotted-leader contents rows, a restrained paper/ink/accent palette.

---

## 2. Tech stack

| Area | Choice | Version |
|------|--------|---------|
| Framework | Next.js (App Router) | `^15.3.3` |
| UI runtime | React / React DOM | `^19.0.0` |
| Output mode | Static export (`output: 'export'`) | — |
| Content | MDX via `@next/mdx` + `@mdx-js/*` | `^3.1.0` |
| 2D animation | anime.js | `^4.0.0` (installed 4.4.x) |
| 3D (3 topics only) | three.js + React Three Fiber + drei | `0.184` / `9.6.1` / `10.7.7` |
| E2E tests | Playwright | `^1.60.0` |
| Lint | ESLint + `eslint-config-next` | `9.x` / `16.x` |
| Types (tests only) | TypeScript | `^5.9.3` |
| Runtime | Node | `>= 20` |

There is **no application server, database, or API**. Figure data comes in two flavours,
each stated honestly in the prose: the **AI and ML** figures (and some SQL ones) use
hand-authored illustrative data in plain JS modules (similarity scores, model answers,
training curves, etc.), while the **Algorithms and Data Structures** figures compute
everything for real on small, fixed, deterministic inputs (sort orders, traversal orders,
shortest paths, call counts). The deliberately-simplified elements in that section are
Hash tables' teaching hash function and, in Big-O, the race speed and the assumed
wall-clock rate (the operation counts and curve are exact); the prose flags each.

---

## 3. Architecture

### 3.1 Rendering model

- **Static export.** `next.config.mjs` sets `output: 'export'`, `trailingSlash: true`,
  `images.unoptimized: true`, and `pageExtensions: ['js','jsx','ts','tsx','md','mdx']`.
  `next build` emits a fully static `./out` directory; there is no runtime Next server in
  production.
- **Server Components by default.** Pages that only render content (the contents page,
  topic MDX pages) are server components. Anything interactive is a separate
  `'use client'` component mounted inside them.

### 3.2 Single source of truth: `app/topicList.js`

The ordered topic list is a compact delimited table (`section | num | title | subtitle |
slug`) parsed into:

- `TOPICS` — the flat ordered sequence (drives prev/next).
- `SECTIONS` — `TOPICS` grouped by `SECTION_ORDER` (drives the contents page).
- `neighbors(slug)` — `{ prev, next }`, crossing section boundaries, `null` at the ends.

**Every consumer reads from here.** Adding/reordering a topic in `TOPIC_ROWS` updates the
contents page and all prev/next navigation automatically. Numbering is sequential,
zero-padded, and spans sections (01–32); inserting a topic mid-list means renumbering
every later row (e.g. each Algorithms topic shifted the Databases and OOP rows down).
`SECTION_ORDER` places **Algorithms and Data Structures** second, between AI and ML and
Databases and SQL.

### 3.3 The `Figure` shell — `app/components/Figure.jsx`

A single presentational shell every interaction plugs into. Props:

- `eyebrow` — a short thematic category label (mono).
- `title` — the figure title (renders as `<h3>`).
- `children` — the visualization (SVG / canvas / R3F).
- `controls[]` — `{ label, onClick, disabled?, active?, variant? }`; rendered as a
  button bar. `active` marks a toggle; `variant: 'primary'` is the filled main action.
- `status` — a one-line status string (renders in the control bar; also rendered on its
  own when a figure passes status but no controls).
- `readouts[]` — `{ label, value }` live values (definition list).
- `tryThis` — a callout aside.

The interaction component owns **all** state and animation; the shell only renders the
display config. The shell is intentionally stable — **topic components must not modify
it.**

### 3.4 Layouts and navigation

- `app/layout.jsx` (root) — sets `<html>`/`<body>`, imports `globals.css`, and inlines a
  tiny pre-paint script that applies the saved reading-size from `localStorage` before
  first paint (anti-FOUC). `<html>` carries `suppressHydrationWarning` for that
  intentional pre-hydration mutation.
- `app/topics/layout.jsx` — the shared chrome for every topic page: a sticky top nav
  ("← Contents" + brand + the font-size control), the prose `<article>`, and the
  bottom `TopicNav`.
- `app/topics/TopicNav.jsx` (`'use client'`) — bottom-of-page previous/next buttons.
  Derives the current slug from `usePathname()` and looks up neighbors via
  `topicList.neighbors()`, so it stays correct under static prerender.
- **Contents page** = `app/page.jsx` (server, owns `metadata`) renders the header +
  `<ContentsAccordion sections={SECTIONS} />`.

### 3.5 Contents accordion — `app/components/ContentsAccordion.jsx`

- Each section is a collapsible group: a real `<button>` header with `aria-expanded` +
  `aria-controls`, a rotating chevron, and a topic count ("AI and ML … 12 topics").
- **Default: all sections collapsed.** Open set persists in `localStorage` (key
  `contentsOpenSections`) via `useSyncExternalStore` with a cached snapshot — single
  source of truth, no `setState`-in-effect, hydration-safe (server renders collapsed;
  the saved set is reconciled after mount with no mismatch).
- Expand/collapse is a **pure CSS transition** (`grid-template-rows: 0fr → 1fr` +
  opacity), state-driven; `prefers-reduced-motion` is respected.
  Collapsed panels are `inert` but remain in the DOM (so collapsed topic links are still
  discoverable by DOM queries).

### 3.6 Font-size control — `app/components/FontSizeControl.jsx`

Site-wide Small/Medium/Large reading-text control. Drives one CSS variable
`--read-scale`; prose and contents text size in `em` off that variable, so reading text
scales but figures do not. Persists in `localStorage` (key `readScale`); applied
pre-paint by the root-layout script. Reads state via `useSyncExternalStore`.

---

## 4. Anatomy of a topic

A topic is three things:

1. **`app/topics/<slug>/page.mdx`** — server-rendered MDX: an import of the topic's
   component, a `metadata` export (`"<Title> - Learning with Sabih"`), exactly one `#`
   H1, prose, and the component embed. The file ends after the embed.
2. **`app/components/<Name>Viz.jsx`** (+ optional `<name>Data.js`, `.module.css`) — the
   `'use client'` interaction on the `Figure` shell.
3. **A row in `app/topicList.js`** and **an entry in `e2e/smoke.spec.ts`**.

`app/components/` holds **42 `.jsx` files** (per-topic `*Viz` interactions, the Figure
shell, RobotAvatar, FontSizeControl, ContentsAccordion, the R3F scenes, and the shared
`CallStackPanel.jsx`) plus **21 `.js` modules** (per-topic `*Data.js` data modules, the
shared `graphData.js`, and `vizPalette.js`). Several topics ship a small `*Data.js` module
so the component body stays simple and hand-authored data is isolated; the two cross-topic
shared modules are described in §4.3.

### 4.1 Interaction conventions (important)

- **Hand-authored, illustrative data, stated honestly.** Many AI/ML figures use
  fabricated numbers (attention weights, next-token probabilities, RAG similarity scores,
  fine-tune before/after answers). Where a figure is illustrative, **the prose and/or the
  figure caption say so explicitly**, while any genuinely-correct computation (e.g. the
  arithmetic/letter-count in "Why Models Struggle with Math") is done for real in JS.
- **Algorithms section: compute for real, then state what is illustrative.** The whole
  Algorithms and Data Structures section inverts the default — every readout (operation
  counts, tree height, load factor, shortest-path cost, naive/memoized call counts, etc.)
  is computed from the real algorithm on a small fixed deterministic input, and the prose
  flags the few illustrative choices: Big-O's race *speed* and its assumed
  2-billion-ops-per-second wall-clock rate (both for watchability and tangibility; the
  operation counts and curve themselves are exact) and Hash tables' simple teaching hash.
  Each topic also carries a one-line honesty note that the input is kept small for
  readability.
- **State-driven motion; not animation-dependent.** Teaching-critical progression
  (training loops, method-lookup walks, RAG steps, the algorithm steppers in the
  Algorithms section) is driven by **timers/`setState`**, never solely by
  `requestAnimationFrame` or anime `onComplete`. The reason: `requestAnimationFrame` is
  paused entirely in a hidden/backgrounded tab, so anything chained off it freezes there.
  Timers keep firing in a hidden tab (browsers may throttle them to run slower, but they
  do not stop), so the teaching state keeps advancing rather than freezing. anime.js (or
  a CSS transition) is layered on **only for the visual flourish**. This is a hard-won
  rule: the gradient-descent and neural-network figures were explicitly reworked to
  follow it.
- **anime.js v4.** Use the v4 API (`import { animate, stagger } from 'animejs'`; `ease`,
  not `easing`). Verify against the installed version before use.
- **No 3D unless the topic needs it.** New topics are 2D (SVG + React).

### 4.2 3D topics and bundle isolation

Only **Embeddings, Attention, and Transformers** use three.js / R3F. Their R3F scenes
(`EmbeddingsScene`, `AttentionScene`, `MultiHeadAttentionScene`) are dynamically imported
with `next/dynamic({ ssr: false })` so the ~hundreds-of-KB three.js bundle loads **only**
on those three routes and never inflates the shared baseline.

### 4.3 Shared modules across topics

Two helpers in the Algorithms section are deliberately reused so related topics stay
consistent. They are extracted, example-agnostic, and **must not be specialized to one
topic**:

- **`graphData.js`** — the single source of truth for one fixed graph (8 nodes A–H with
  hand-placed x/y positions, 11 undirected edges, each carrying an optional `weight`).
  **Graph traversal** uses it ignoring weights (BFS/DFS); **Dijkstra** reuses the *same*
  nodes/positions/edges and reads the weights, so the reader recognizes the same graph
  made weighted. Editing it affects both topics.
- **`CallStackPanel.jsx`** — a reusable vertical call-stack view (takes `frames` data,
  grows on push / shrinks on pop). **Recursion** drives it with Hanoi frames. **Dynamic
  programming** echoes its frame *look* in its own call-tree component but does not import
  it. The panel is not modified by other topics.

---

## 5. Styling and conventions

- **Design tokens** in `app/globals.css` `:root`: `--ink #1a1a1a`, `--paper #f7f6f2`,
  `--fade #9b9892`, `--accent #c0392b`, `--rule #e2e0d8`, plus `--read-scale`.
- **Type:** serif (Georgia) body/titles; `ui-monospace` for eyebrows, section labels,
  readouts, and code-like UI. Shared viz tokens in `app/components/vizPalette.js`
  (`INK/FADE/ACCENT/MONO`).
- **CSS Modules** per component; the contents page CSS (`app/page.module.css`) is shared
  between `page.jsx` and `ContentsAccordion.jsx`.
- **Eyebrow labels** are concise thematic tags, consistent within a section (e.g. SQL:
  Data model / Filtering / Joining / Aggregation / Ranking / Analytics). The Algorithms
  section uses Complexity, Searching, Recursion, Sorting, Data structures, Trees, Graphs,
  and Optimization.
- **Prose rules:** straight quotes only, **no em-dashes** in MDX prose. (A placeholder
  glyph such as a hyphen, `∞`, or an em-dash is used intentionally for "no value yet"
  inside component readouts — that is UI, not prose.) Apostrophes are fine in MDX text but
  must be avoided/escaped in JSX text (`react/no-unescaped-entities`). Topic titles with an
  apostrophe (e.g. "Dijkstra's shortest path") put the `metadata.title` string in double
  quotes.
- **Lint rule to respect:** `react-hooks/set-state-in-effect` — do not call `setState`
  synchronously in an effect body (use `useSyncExternalStore` or a timer/callback). This
  bit the font-size control and the accordion; both use `useSyncExternalStore`.

### 5.1 Client persistence (localStorage keys)

| Key | Written by | Purpose |
|-----|-----------|---------|
| `readScale` | FontSizeControl | `small` / `medium` / `large` reading size |
| `contentsOpenSections` | ContentsAccordion | JSON array of expanded section names |

Both are applied hydration-safely (pre-paint script for read scale; `useSyncExternalStore`
for both).

---

## 6. Testing

E2E only, via **Playwright** (`e2e/`), Chromium project. Tests run against the **built
static export** served locally on port 4173 (`e2e/serve-out.mjs`); they never touch the
deployed server. `playwright.config.ts`: global timeout 30s, expect timeout 7s,
`fullyParallel`, `retries: 1` in CI.

Spec files:

- `smoke.spec.ts` — every topic in a `TOPICS` array: home page loads; each topic page
  mounts its figure with **zero console errors**; the contents page links to every topic;
  and one **per-topic** test clicks each contents link and verifies navigation (split
  per-topic to stay within the per-test timeout; expands accordion sections first).
- `accordion.spec.ts` — default-collapsed + topic count, keyboard (Enter/Space) toggle +
  reveal, persistence across reload, and link navigation.
- `nav.spec.ts` — prev/next neighbors for a middle/first/last topic.
- `fontsize.spec.ts` — the reading-size control scales prose, persists, leaves figures
  fixed.
- `interactions.spec.ts` — per-topic behavioral assertions for several figures.
- `util.ts` — `trackConsoleErrors`, readout helpers.

**Adding a topic requires adding it to the `TOPICS` array in `smoke.spec.ts`.**

---

## 7. CI/CD and deployment

Three GitHub Actions workflows:

- **`ci.yml`** (workflow name `CI`, on `pull_request`) — jobs **`build`**, **`lint`**,
  **`link-check`**.
- **`e2e.yml`** (workflow name `e2e`, on `pull_request`) — job **`test`**.
- **`deploy.yml`** (`Deploy to Hetzner`, on `push` to main + manual dispatch) — builds and
  **rsyncs `./out` over SSH** to a Hetzner server (secrets `SSH_PRIVATE_KEY`, `SSH_HOST`).
  Concurrency group cancels in-flight deploys. **Not Vercel.**

A SonarCloud analysis also runs on PRs as a **non-required** quality gate (flags
duplication, security hotspots, reliability) — informational; it can fail (e.g. the
new-code duplication threshold) without blocking a merge.

### 7.1 Branch protection — the required-status-checks ruleset

`main` is governed by a repository **ruleset** named **`Main Protect`** (enforcement:
`active`) with rules `deletion`, `non_fast_forward`, `pull_request`,
`required_linear_history`, and **`required_status_checks`**.

- **The four required checks are matched by check-run NAME, not display label.** The
  required contexts are **`build`**, **`lint`**, **`link-check`**, **`test`** — the job
  ids. GitHub's UI shows these as `CI / build`, `CI / lint`, `CI / link-check`, and
  `e2e / test` (`<workflow> / <job>`), but a ruleset listing those `… / …` display
  strings would match nothing and **block every PR**. Always use the bare job names.
  Strict mode is off (it would fight `required_linear_history`). SonarCloud is not in the
  required list.
- **Merge-state semantics:** while a required check is pending or failing, the PR shows
  `mergeStateStatus = BLOCKED`. Once all four pass, a failing non-required check (e.g.
  SonarCloud) leaves it `UNSTABLE` — mergeable, not blocked.

**Workflow conventions:** branch per change; PRs are squash-merged (commits land as
`Title (#NN)`, which also satisfies `required_linear_history`); merge only when the four
required checks are green; the ruleset and branch protection are not modified by routine
automation.

---

## 8. Accessibility

- Figures use real `<button>`/`<input>` controls; toggle groups and the accordion expose
  state. The accordion is fully keyboard-operable (`aria-expanded` / `aria-controls` /
  `role="region"`, native button activation, `inert` on collapsed panels).
- Known gaps are tracked (see §9): some Figure toggle buttons use `data-active` instead of
  `aria-pressed`; some figure SVGs use a bare `aria-label` without `role="img"`; a couple
  of figures have heading-level or keyboard-reachability gaps. These are triage items, not
  regressions.

---

## 9. Known issues / triage

`AUDIT-NOTES.md` (repo root) is the living triage list from the site audit: minor
prose/figure numeric mismatches, accessibility attribute gaps, and cosmetic
inconsistencies, ordered by severity (accuracy → a11y → cosmetic). It is a backlog, not a
record of regressions; confirmed bugs found in the audit have already been fixed and
merged.

---

## 10. Repository layout

```
app/
  layout.jsx            root layout + pre-paint read-scale script
  globals.css           design tokens, base type
  page.jsx              contents page (server) -> ContentsAccordion
  page.module.css       contents styling (shared with the accordion)
  topicList.js          SINGLE SOURCE OF TRUTH for topics/order/nav
  components/
    Figure.jsx          the shared figure shell (do not modify per-topic)
    vizPalette.js       shared viz color/font tokens
    FontSizeControl.jsx, ContentsAccordion.jsx, RobotAvatar.jsx
    <Topic>Viz.jsx      one interaction per topic (+ <topic>Data.js, .module.css)
    graphData.js        shared graph (Graph traversal + Dijkstra)
    CallStackPanel.jsx  reusable call-stack view (Recursion; style echoed by DP)
    *Scene.jsx          R3F scenes for the 3 3D topics (dynamic, ssr:false)
  topics/
    layout.jsx          shared topic chrome (top nav + prose + TopicNav)
    TopicNav.jsx        prev/next, driven by topicList.neighbors()
    <slug>/page.mdx     one MDX page per topic
e2e/                    Playwright specs + serve-out.mjs + util.ts
.github/workflows/      ci.yml, e2e.yml, deploy.yml
next.config.mjs         static export + MDX config
mdx-components.jsx      MDX component mapping (currently pass-through)
AUDIT-NOTES.md          triage backlog
ALGORITHMS-SECTION-REVIEW.md   per-topic prose + figure-behavior review packet
```

---

## 11. How to add a topic (checklist)

1. Add a row to `TOPIC_ROWS` in `app/topicList.js` at the desired position; renumber the
   `num` column so it stays sequential.
2. Build `app/components/<Name>Viz.jsx` (2D SVG + React) on the `Figure` shell — plus an
   optional `<name>Data.js` for hand-authored data and a `.module.css`. Keep teaching
   progression timer/state-driven; use anime.js v4 only for flourish.
3. Create `app/topics/<slug>/page.mdx`: component import, `metadata`, one H1, prose
   (straight quotes, no em-dashes; state honestly if data is illustrative), then the
   component embed.
4. Add the slug to the `TOPICS` array in `e2e/smoke.spec.ts`. If the insertion changes a
   neighbor that `nav.spec.ts` asserts, update that expectation.
5. Verify: `npm run build`, `npm run lint`, `npx playwright test` all green; check the
   figure in a browser (behaves as the prose claims; zero console errors).
6. Open a PR; do not modify the `Figure` shell or other topics. The four required checks
   (`build`, `lint`, `link-check`, `test`) must be green before a squash merge; SonarCloud
   may fail without blocking.
