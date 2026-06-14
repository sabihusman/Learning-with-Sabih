# Audit notes — minor warnings triage

A triage list of minor issues found in the site audit, re-checked against the current
`main`. **Nothing here is fixed yet** — this is a backlog for a later pass. Confirmed
bugs from the audit (missing H1s, dropped Figure status, RLHF pick feedback, the
NeuralNet/GradientDescent rAF freezes, the e2e smoke-loop timeout) are already merged
(PRs #38–#40); the overfitting hydration mismatch is in flight on PR #41. Those are
**not** repeated below.

Severity tags: `accuracy` (prose/figure or behavioral mismatch) · `a11y`
(accessibility gap) · `cosmetic` (inconsistency, no functional/teaching impact).
Ordered accuracy → a11y → cosmetic.

Each item was re-verified by reading the current source unless marked
*(needs runtime re-check)*.

## accuracy

| # | Issue | File(s) |
|---|-------|---------|
| A1 | Attention prose says the per-word weights "add up to a full unit of focus," but the hand-set weights for `it` are `{animal 1.0, tired 0.5, was 0.35, street 0.2, ...}` and sum to **2.59** (unnormalized). | `app/topics/attention/page.mdx` (line ~20), `app/components/attentionData.js` (line 25) |
| A2 | Window-functions running total shows ROWS-frame accumulation (`2` then `4` across the tied pair), but the displayed SQL `SUM(value) OVER (ORDER BY occurred_at)` has no explicit frame, so the SQL-standard default RANGE would return `4, 4` for both tied peers. | `app/components/WindowFunctionsViz.jsx` (tryThis), `app/components/windowFnData.js` (`buildSql`, line 86) |
| A3 | Neural-networks tryThis says "Reset re-randomizes the weights and starts over," but the net is seeded (`SEED_NET = 7`), so Reset restores the **identical** weights every time. | `app/components/NeuralNetViz.jsx` (line ~217), `app/components/neuralNetData.js` (lines 24–25) |
| A4 | Inheritance prose promises subclass fields `dustBinLevel` (CleaningBot) and `alarmEnabled` (GuardBot), but the figure's data never defines or shows them (only the methods `clean()`/`patrol()` exist). | `app/topics/inheritance/page.mdx` (line 15), `app/components/inheritanceData.js` |
| A5 | Classes-and-objects: object cards expose a `charge()` button in **public** mode, but the class blueprint lists `charge()` only when `batteryLevel` is private (gated on `isPrivate`), so the object's surface and the blueprint disagree in public mode. | `app/components/ClassesObjectsViz.jsx` (blueprint line 174, card button line ~241) |
| A6 | Embeddings prose says "click any word," but only the small sphere has an `onClick`; the prominent text label has none, so clicking the label registers as a canvas miss (`onPointerMissed`) and **deselects**. | `app/components/EmbeddingsScene.jsx` (sphere onClick line 41, Text line 60, onPointerMissed line 92) |
| A7 | Font-size cross-tab sync is half-applied: a second open tab's active button updates via the `storage` event, but `--read-scale` is only set inside the local click handler, so the other tab's button highlights the new size while its text does not rescale. | `app/components/FontSizeControl.jsx` (storage listener line 30, setProperty line 43) |
| A8 | Overfitting "wiggly (passes every point)" / "zig-zags through every training point" is never literally true — even at max degree the least-squares fit does not interpolate all 16 training points. | `app/components/OverfittingViz.jsx` (line 142, tryThis line 85) |
| A9 | Confusion-matrix prose states precision strictly rises as the threshold rises ("false positives drop, so precision rises"), but precision is locally non-monotonic at some threshold steps. *(prose confirmed in source; the non-monotonic steps were measured in the prior audit's full slider sweep — needs runtime re-check to re-list exact steps.)* | `app/topics/confusion-matrix/page.mdx` (line 22), `app/components/ConfusionMatrixViz.jsx` |
| A10 | Tokenization: punctuation-only input appears to render token chips while the status reads "Type a sentence to tokenize it" (the word count is 0). *(needs runtime re-check of the punctuation path.)* | `app/components/TokenizerViz.jsx` (status line 41) |
| A11 | Code-quality: `reportStatus()` calls `setReport(...)` inside a `setObjects` updater function (an impure state updater; risks a double side-effect under React StrictMode). Not user-visible today. | `app/components/ClassesObjectsViz.jsx` (lines 87–90) |

## a11y

| # | Issue | File(s) |
|---|-------|---------|
| B1 | Figure toggle buttons mark the active option with `data-active` but never `aria-pressed`, so toggle state is not exposed to assistive tech (affects e.g. joins INNER/LEFT/RIGHT/FULL, gradient-descent Start-left/right presets, the classes private toggle). | `app/components/Figure.jsx` (line 59) |
| B2 | Heading-level skip: the shared Figure title renders as `<h3>`, so on the ~15 topic pages whose first heading after the page `<h1>` is the figure, the structure jumps h1 → h3 with no h2. | `app/components/Figure.jsx` (title element), `app/topics/*/page.mdx` |
| B3 | The top navigation bar on every topic page is an unlabeled `<nav>` landmark (the bottom prev/next nav is labeled "Topic navigation"; this one has no `aria-label`). | `app/topics/layout.jsx` (line 9) |
| B4 | The gradient-descent drag handle is pointer-only — an SVG circle with `onPointerDown` but no `tabindex`/`role`/keyboard handling — so keyboard users cannot set the start position the prose invites them to drag. | `app/components/GradientDescentViz.jsx` (handle line ~433) |
| B5 | Figure SVG roots use a bare `aria-label` without `role="img"`, which some screen readers ignore on `<svg>`. | `app/components/*Viz.jsx` (multiple figure SVGs) |

## cosmetic

| # | Issue | File(s) |
|---|-------|---------|
| C1 | Title-case inconsistency: the contents list uses Title Case ("Overfitting and Generalization") while 9 page H1s use sentence case ("Overfitting and generalization"). Affects topics 03, 08, 10, 11, 14, 15, 16, 17, 20. | `app/topicList.js`, `app/topics/*/page.mdx` |
| C2 | Polymorphism reacted cards get a literal `undefined` class token: the className uses `styles.reacted`, but `.reacted` is never defined in the CSS module. No visual break (the reacted look is applied via inline `borderColor`). | `app/components/PolymorphismViz.jsx` (line 180), `app/components/PolymorphismViz.module.css` |

---

**Counts:** 11 accuracy · 5 a11y · 2 cosmetic = 18 open items.
Two items (A9, A10) need a runtime re-check to fully confirm/quantify.
