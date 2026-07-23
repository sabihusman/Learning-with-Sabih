# Learning with Sabih — Full Site Audit (Report Only)

**Date:** 2026-07-09
**Repo:** github.com/sabihusman/Learning-with-Sabih (identity confirmed via `git remote -v`)
**Working tree:** branch `add-entropy-and-compression-topic`, commit `fe1e74a` (open PR #98)
**Auditors:** one orchestrating session + seven parallel read-only audit agents (one per section chunk). No files were modified; this report is the only file written.

---

## 0. Scope verification

The audit brief expected **53 topics across 5 sections** (AI and ML 17, Algorithms 10, Databases 13, Systems and Networking 6, OOP 7). The working tree is on the open PR #98 branch, which adds one topic and one section, so the actual counts are:

| Section | Expected | Found |
|---|---|---|
| AI and ML | 17 | 17 |
| Algorithms and Data Structures | 10 | 10 |
| Databases and SQL | 13 | 13 |
| Systems and Networking | 6 | 6 |
| Object-Oriented Programming | 7 | 7 |
| Data and Compression | — | 1 (Entropy and Compression, PR #98, unmerged) |
| **Total** | **53** | **54** |

**Mismatch explanation:** `main` matches the expected 53/5 exactly; the extra topic/section is the unmerged PR #98 branch state. Not a defect. Numbering is sequential 1–54; every slug has a `page.mdx` (verified by executing `topicList.js`).

## 1. Methodology and evidence classes

- **Verified by execution:** numeric claims checked by running the actual data modules in Node harnesses (entropy values, log-probabilities, convergence numbers, funnel counts, LRU traces, Dijkstra distances, etc.). Marked "verified by execution" per topic.
- **Verified by reading:** claims checked against source code without running it (mechanisms, state derivations, timer patterns).
- **Not directly checked here, but covered by tests:** visual rendering and console cleanliness. The full Playwright suite (150 tests, including a per-topic "loads its figure with no console errors" smoke test for all 54 topics) **passed on this branch today**; runtime console-cleanliness is treated as verified on that basis. Pixel-level visual appearance was not audited (no browser inspection was performed in this audit).

## 2. Global checks (whole-repo, verified directly by the orchestrator)

- **Figure.jsx unmodified:** `git diff origin/main -- app/components/Figure.jsx` is empty; its last change was commit `a71d9f8` (#40, a site-wide audit-fix commit), not a topic build. ✅
- **Em/en dashes in prose:** zero matches across all 54 `page.mdx` files. ✅
- **Curly quotes in prose:** zero matches. ✅
- **rAF chaining:** every `requestAnimationFrame` mention in components is in comments explaining why it is NOT used. No rAF-driven state anywhere. ✅
- **anime.js onComplete chaining:** the single `onComplete:` in the codebase (`GradientDescentViz.jsx:296`) only snaps a display proxy; it never schedules the next optimizer step. Compliant (flourish only). ✅
- **Console errors:** covered by the passing Playwright suite (see §1). ✅

## 3. Per-topic findings

Ratings: **strong / adequate / weak**. "Clean" means no findings under that heading. Findings worth action are **bolded**.

### AI and ML (topics 1–17)

**01 gradient-descent** — Code: clean (timer-driven `setTimeout` chain for playback — see §4.2; anime.js glide is display-only; snap deferred via 0ms timeout to avoid sync setState). Prose: all extrema/run claims verified by execution (x=-2.056/+0.118/+1.939; both basin outcomes). **Honesty note missing** (everything is genuinely computed, so no overclaim — but the site convention is absent); "What the demo shows" omits the lr slider and drag-to-place interactions. Fit: **strong**.

**02 neural-networks** — Code: real from-scratch backprop; `setTimeout(loop, 16)` chain (§4.2); one dead export (`ACCENT`). Prose: convergence verified by execution (initial acc 47%, converges ~epoch 1143 at 160/160). **Contradiction: the figure's tryThis says "Reset re-randomizes the weights" — false; `makeNet()` is seeded (SEED_NET=7), Reset restores identical initial weights every time.** **Honesty note missing** (training is real but the dataset is synthetic/seeded and the reader is never told). Fit: **strong**.

**03 activation-functions** — Code: clean (no effects, no timers; fits run in useMemo with cache; dead color exports). Prose: verified by execution — linear accuracy flat at 56.4% for 1–8 units with identical loss; ReLU 65.7% → 100% at 4+ units. Honesty note present and accurate. Fit: **strong**.

**04 overfitting** — Code: real least-squares fits; the "regime" badge (underfit/good/overfit) is **hand-authored degree thresholds**, not derived from the error curves — presented as a label and consistent with the computed test-error minimum (degree 4), so acceptable, but it is the closest thing to a scripted computed-looking value in this section. Prose: U-shape verified by execution (test error min 0.0067 at degree 4); training error effectively monotone (one 4th-decimal uptick at degree 13, invisible at display precision). **Minor overclaims: tryThis "zig-zags through every training point" and slider label "passes every point" — at degree 14 train MSE is 0.0076, the ridge-regularized fit does not interpolate the points.** Honesty note present. Fit: **adequate-to-strong** (the topic's key signal, the U-curve, is never drawn — reader must scrub and memorize two numbers).

**05 decision-boundary** — Code: exemplary (true `setInterval` playback; dead color exports only). Prose: verified by execution (200 steps, lr 3 → w=(7.443, 6.149, -0.200), loss 0.0299, 0 misclassified). Honesty notes present, detailed, accurate — best of the section. Fit: **strong**.

**06 confusion-matrix** — Code: clean (no effects/timers; all quantities computed live; logic inline in component, acceptable at this size). Prose: threshold sweep verified by execution (precision rises / recall falls at every sampled threshold; max score 0.980 so threshold 1.0 → precision "n/a" as tryThis promises). **Honesty note missing** (the 50 "emails" are a synthetic seeded dataset with hand-picked Gaussians; never disclosed). Fit: **strong**.

**07 tokenization** — Code: clean. Prose: verified by execution ("unbreakable" → un/break/able; 11 tokens from 6 words; "strawberry" single token). Honesty note present in three places, accurate. Fit: **strong**.

**08 why-models-struggle-with-math** — Code: clean; compute side genuinely computed, predict side hand-authored probabilities with the picked token genuinely the argmax over them — exactly as disclosed. Prose: accurate; honesty note thorough. Fit: **adequate** (interaction is thin: two fixed presets + a Step button; nothing for the reader to vary or probe).

**09 embeddings** — Code: clean; R3F correctly isolated behind `dynamic({ssr:false})`; **dead export: `CLUSTERS` color map imported nowhere, so the four clusters are not color-coded despite a palette existing for it**. Prose: verified by execution (all 16 words' 3 nearest neighbors are same-cluster). Honesty note exemplary ("Why this looks too clean" section). Fit: **strong**.

**10 attention** — Code: clean (no effects, no timers). Prose: weight-table claims verified by reading (it→animal 1.0, it→street 0.2; cross leans on street/animal); honesty note present in three places. Fit: **adequate** — the click-to-see-links interaction is on-concept, but the 3D orbit adds nothing (attention has no spatial structure here) and the figure shows one word's outgoing links at a time while the prose's "every word does this for every other word, all at once" is only assertable, not visible.

**11 tensors** — Code: clean (no effects/timers; rank/shape/element counts and index paths all computed). Prose: accurate ("RGB-style" wording skirts the 2-channel/RGB mismatch — borderline but defensible). Honesty note present and accurate. Fit: **strong**.

**12 broadcasting** — Code: clean; `alignShapes()` is a faithful NumPy-rule implementation (verified by reading, including failIndex arithmetic). Prose: rules and tryThis examples all match. Honesty note present. Fit: **strong**.

**13 transformers** — Code: clean. Prose: all three heads' behaviors match the data; honesty note present. One nit: prose says head outputs "are combined," which the figure never shows (not claimed of the figure — but the combine step is untaught visually). Fit: **adequate** — switching heads sequentially over the same sentence shows specialization but not the parallel/combined nature that makes multi-head multi.

**14 rlhf** — Code: clean; post-pick beat is a 750ms `setTimeout` (timer-driven, compliant); FineTuningViz progress uses `setInterval`; anime.js flourish only; dead export `PAPER`. Prose: preference-update and generation-bias mechanisms verified by reading; honesty disclosures excellent (in-figure disclaimer: "no real language model is running"). Nit: traits are described as "hidden" but each candidate is labeled "mostly {trait}". Fit: **strong** (RlhfViz); the secondary FineTuningViz is adequate (press-button-watch-text-swap).

**15 temperature** — Code: clean; **dead import `CONTEXT` in `TemperatureViz.jsx:5` — the sentence is duplicated as a JSX literal, inviting drift**. Prose: verified by execution (T=0.1 → mat 100.0%; T=1.0 → 77.5/15.7/5.8/1.0/0.1; T=2.0 flattens; entropy 0.00/1.01/1.73 bits); real softmax-with-temperature. Honesty note present. Fit: **strong**.

**16 beam-search** — Code: clean; **dead export `NODES_BY_ID`; misleading comment: `beamSearchData.js:104-106` claims `siblingSumsValid` is a "load-time invariant [that] fails loudly," but nothing invokes it at module load — it only runs in the e2e spec**. Prose: every number verified by execution (greedy -3.074; best-under-cloudy -2.941; beam winner -1.261; margin 1.813 ≈ 6.1×; k=1 identical to greedy; k=3 survivor chips). Honesty note present and precise. Fit: **strong**.

**17 rag** — Code: clean; similarity scores are hand-authored constants but ranking/top-k over them is computed and the labeling says so; prompt panel assembles context from actually-retrieved chunk ids. Prose: accurate; honesty notes in three places; canned answers labeled with failure-mode badges. Fit: **strong**.

### Algorithms and Data Structures (topics 18–27)

**18 big-o** — Code: clean (exponential lane uses real naive-Fibonacci call counts, not 2^n; setInterval playback). Prose: verified by execution (age-of-universe crossover at exactly n=129, matching the code comment; 2e9 ops/sec). Honesty note present, well-calibrated. Fit: **strong**.

**19 binary-search** — Code: clean (real stepwise search; vestigial always-true `clickable` const, trivial). Prose: verified by execution (target 48 in 3 comparisons; absent 50 in 4; worst case 4 = ceil(log2 16)). Honesty note present. Fit: **strong**.

**20 recursion** — Code: clean (genuine recursive Hanoi solver instrumented with live stack snapshots). Prose: verified by execution (moves = 2^n − 1 for n=3–6; max stack depth = disk count). Honesty note present. Fit: **strong**.

**21 sorting** — Code: real instrumented bubble/insertion/merge; **soft spot: the "Last run" snapshot records whatever frame the user abandoned mid-run, labeling partial counts as if a completed run** (numbers real, label misleading; low severity). Prose: verified by execution (85/55/41 comparisons on the fixed seed). Honesty note present. Fit: **strong**.

**22 linked-list-vs-array** — Code: clean (traces perform actual shifts/walks/pointer writes). Prose: verified by reading (7 shifts for front-insert at N=7; walked 0 / pointers 2 for list front-insert). Honesty note present. Fit: **strong**.

**23 hash-tables** — Code: clean (no effects, no timers; all derived from `hashOf` and live entries). Prose: verified by hand-execution (owl=338, cod=310, jay=324, all mod 7 = 2). Honesty note present and unusually good. Fit: **strong**.

**24 binary-search-trees** — Code: clean (real immutable BST; `'pending'` state safely guarded; empty-input guarded). Prose: verified by reading (balanced height 3 vs degenerate height 7 on the same values; 7 vs 3 comparisons). Honesty note present. Fit: **strong**.

**25 graph-traversal** — Code: **dead import `NODE_IDS` in `GraphTraversalViz.jsx:6`**. One shared loop where only the frontier pop differs — exactly the pedagogical claim. Pedagogical nuance (not a bug): DFS is visited-on-push, not the classic recursive variant; prose never claims otherwise. Prose: visit orders verified by execution. Honesty note present. Fit: **strong**.

**26 dijkstra** — Code: clean (real deterministic Dijkstra; same shared graph module as traversal). Prose: verified by execution (final distances from A: B 4, C 9, D 3, E 4, F 7, G 10, H 9; the hop-count-vs-cost contrast is real on this graph). Honesty note present. Fit: **strong**.

**27 dynamic-programming** — Code: clean (both call trees built by real recursions; readouts are true node counts). Prose: verified by execution (naive/memo calls 9/7, 15/9, 25/11, 41/13 for n=4–7; fib values match; "n=8 needs 34 leaves" comment correct). Honesty note present, arguably exemplary (explains that memo counts cache-hit lookups as calls). Fit: **strong**.

### Databases and SQL (topics 28–40)

**28 relational-model** — Code: clean (no effects/timers; linked sessions computed by real filtering of the shared seed data). Prose: user-31-has-two-sessions verified by reading. **Honesty note missing** (nothing distinguishes the 4-user/5-session slice from the full 50/146 dataset; low severity since nothing is contrived). Fit: **strong**.

**29 select-where-case** — Code: clean; **drift risk: the CASE expression string is duplicated (hardcoded in JSX at `SelectWhereCaseViz.jsx:164` and as `CASE_SQL` in `selectWhereData.js:24`) — they currently agree**. Prose: accurate. **Honesty note missing** (low severity). Fit: **strong**.

**30 joins** — Code: clean (real nested-loop join computed live; CSS entrance animation only). Prose: verified by execution (unmatched pair user 47 / session for user 31; row counts INNER 3 / LEFT 4 / RIGHT 4 / FULL 5). Honesty note present ("small slice of the shared dataset"). Nit: prose says wrong joins "silently lose **or duplicate** data" — duplication is asserted but never demonstrated (no 1-to-many fan-out in the slice). Fit: **strong**.

**31 group-by** — Code: clean; real Map-based grouping over a genuinely derived session_stats slice; **two warts: `MAX_COUNT` is the max across both grouping columns, so when grouping by country the HAVING slider's range 7–11 is dead (nothing changes); the comment at `groupByData.js:35-36` mis-describes the implementation (says "just below the biggest group's COUNT(*)" but uses the max — behavior still correct)**. Prose: COUNT(*) vs COUNT(DISTINCT) divergence verified by execution (US 6 rows / 4 users; JP 4/2). **Honesty note missing** (low severity). Fit: **strong**.

**32 window-functions** — Code: clean (real sort-and-scan ROW_NUMBER/RANK/DENSE_RANK/running SUM; real tied pair in the slice; displayed SQL correctly emits the explicit ROWS frame matching the computation). Prose: tie arithmetic verified (2,2,4 vs 2,2,3). Nits: the slice contains no `topic_completed` events so the weight-3 case is described but never exercised; the prose's simplified `OVER (ORDER BY ...)` omits the frame the figure's own SQL includes (defensible). Honesty disclosure adequate (illustrative weights disclosed). Fit: **strong**.

**33 funnel-analysis** — Code: clean (COUNT(DISTINCT session_id) computed over the full 383-event table; aria-label's hardcoded "143, 77, 45" matches computed values). Prose: verified by execution (143/77/45; 30.8% overall; 53.8%/58.4% conversions; 146 sessions). Definition nuance: steps don't enforce order — a session counts if it ever fired the event; the tryThis states this, though the MDX's "progress through a sequence" slightly implies ordered progression. Honesty adequate. Fit: **adequate** — the only interaction is one show/drop-off toggle; the investigative skill the prose emphasizes is told, not experienced. See recommendation R2.

**34 indexes** — Code: clean (frames genuinely execute full scan vs binary search + range walk; effect body clean; **dead export `matchedIds`**). Semantic nit: indexed mode counts index-entry probes, not the table fetch — but the figure's note says "rows or index entries," so labeled honestly. Prose: accurate; honesty note **present and exemplary** — the standard the other pages should match. Fit: **strong**.

**35 query-planning** — Code: clean (real cost model; planner choice derived from comparison, flips at m=5 — verified by execution; join orders 300 vs 5250 verified; minor dead exports). Prose: accurate; EXPLAIN correctly labeled "illustrative rather than exact PostgreSQL output." Honesty note present in prose and footer. Fit: **strong**.

**36 normalization** — Code: clean (readouts genuinely counted from live data shapes: places-price-lives 3 → 4 → 1 verified by execution; minor dead exports). Prose: anomaly prices [20,25,20,20] verified; 2NF-skip disclosed. Honesty note present in both prose and footer. Fit: **strong**.

**37 sql-vs-nosql-modeling** — Code: places-touched counts derived from highlight frames by real Set counting (3-vs-1, 1-vs-2, 1-vs-3 verified by execution); highlight frames themselves hand-authored but internally consistent with the data (verified: orders >25 are exactly 101/103/105; the two pro docs are the ones marked). Minor dead code (`ORDER_THRESHOLD` unused; stray `order_id: null`). Prose: accurate; secondary-index caveat domain-correct. Honesty note present ("counted from what lights up, not typed in" — accurate). Fit: **strong**.

**38 atomicity** — Code: clean (frames built by real arithmetic; running total computed live in render; rollback genuinely restores). **Prose contradiction: "watch both accounts change while the total stays the same" and tryThis "the total stays 100 the whole way" — in the figure the total visibly reads 60 between debit and credit even on the successful run, and the total pill renders amber/broken at that step.** The more truthful (and more instructive) framing is that atomicity guarantees what persists at commit boundaries, not what is momentarily in flight. One-sentence prose fix. Honesty note present and accurate. Fit: **strong**.

**39 concurrency** — Code: clean (outcomes are the arithmetic consequences of the scripted interleaving: 150 lost-update vs 200 locked, all derived). Prose: verified by reading (all numbers match constants); prose explicitly says the ordering is chosen, not inevitable. Honesty note present and unusually precise. Fit: **strong**.

**40 isolation-levels** — Code: clean (explicitly a scripted walkthrough; OCCURS/PREVENTED verdicts derived from an `OUTCOME` table transcribed from PostgreSQL docs Table 13.1, not duplicated per timeline). Prose: **domain-verified correct against real PostgreSQL semantics** — RU behaves as RC, RR prevents phantoms (stricter than ANSI), only Serializable stops serialization anomalies, serialization-error abort shown. This was the specific landmine checked for, and the figure gets it right. (Transcription fidelity verified against auditor knowledge of PG semantics; the live docs page was not fetched.) Pedantic nit: real PG can abort either transaction, sometimes pre-commit; the script always aborts T2 at COMMIT — fair simplification, not claimed exact. Honesty note present in prose and footer. Fit: **strong** (with the noted reservation that outcomes are looked up, not emergent — for this topic, a faithful lookup is more honest than a fake simulation).

### Systems and Networking (topics 41–46)

**41 caching** — Code: clean (real LRU on a Map; frames snapshotted from one actual run; anime pulse flourish-only; dead export `FINAL_HIT_RATE` whose comment overstates its use). Prose: verified by execution (final hit rate exactly 50%; E evicts C at step 10; C re-requested two steps later; origin-fetches = misses counter as the prose admits). Honesty note present in prose and caption. Fit: **strong**.

**42 percentiles-and-tail-latency** — Code: clean (nearest-rank percentile math over the fixed 60-value sample; deterministic jitter; dead exports MEDIAN/MIN/MAX/SORTED). Prose: verified by execution (mean 80.65 ≈ "about 81"; p50 39; p95 220; p99 1080; ratio ≈ 27.7 "roughly 28×"; p93=160 with exactly 5 of 60 slower). Wording nit: "drag the handle" implies the SVG handle is draggable; the real control is the range slider below (status text does mention it). Honesty note present. Fit: **strong**.

**43 load-balancing** — Code: clean (pure deterministic tick simulation; genuine RR-with-skip and least-connections policies; unused `SERVER_COUNT` import). Prose: verified by execution (RR: 25 ticks, peak 4; least-conn: 17 ticks, peak 2; difference 8; kill drops the queue into `dropped`). Honesty note present, appropriately scoped. Fit: **strong**.

**44 cap-theorem** — Code: clean (real two-node state machine; refusals/divergences computed; conflict detection real). Prose: verified by execution (healthy: 0/0; partitioned+C: 6 refusals; partitioned+A: a=2/b=3, 6 divergences; heal → conflict). Honesty note substance all present (caption + disclosure), though the MDX lacks the explicit honesty header other pages use — not a real gap. Fit: **strong**.

**45 tcp-and-udp** — Code: clean (seeded mulberry32, SEED 555, one draw per packet independent of protocol so both face identical drops — exactly as prose claims; real in-order buffer cascade; minor duplication: `PACKET_COUNT = 8` defined locally in the Viz rather than imported). Prose: verified by execution at 25% loss (drops exactly 2, 4, 7; UDP delivers 1,3,5,6,8 in 8 ticks; TCP 11 sends / 3 retransmits / 11 ticks, all released in order; 0% loss behaviors identical). Honesty note present (no handshake/congestion/windowing; guaranteed retransmit; seeded randomness). Fit: **strong**.

**46 dns** — Code: the referral chain is a hand-authored fixed event queue, but the state machine around it is real (cache decides 8-step walk vs 2-step hit; expire genuinely clears; counters derived by scanning processed events). Prose: verified by execution (miss: 8 steps, 4 servers asked, only auth answers; hit: 2 steps, 1 server; expire → full walk again); 192.0.2.42 is RFC 5737 TEST-NET-1 and app.example.com RFC 2606 — correct. **Mild honesty overclaim: the caption's "every readout above is read from the simulation, not typed in" is true of the counters, but the "simulation" is a scripted queue — unlike the other five topics in this section, whose engines genuinely compute outcomes; neither MDX nor caption says the chain is scripted.** Fit: **adequate-to-strong** — teaches delegation and TTL well, but every run is one of two fixed scripts; interaction is replay, not manipulation. See recommendation R3.

### Object-Oriented Programming (topics 47–53)

**47 classes-and-objects** — Code: state genuinely per-object; encapsulation guard real. **Two nits: `reportStatus` calls `setReport` inside a `setObjects` updater (side effect in a state updater; StrictMode double-invokes it — idempotent here but an anti-pattern); the blueprint lists `charge()` as a method only in private mode while the per-card button exists in both modes.** Prose: per-object state and access-modifier claims verified by reading; constructor-argument story vs blueprint-default mechanism slightly different (not a factual error). **Honesty note missing** (low risk — everything is computed state). Fit: **strong**.

**48 constructors-and-the-heap** — Code: scripted 6-state trace, but readouts derived by counting the state object (2 refs / 1 heap object verified by execution); scripted nature disclosed in caption and data file. setInterval playback, compliant. Prose: all claims verified. Honesty note present and accurate. Fit: **strong**.

**49 encapsulation** — Code: genuinely computed — `replay()` re-executes the action list with a real withdraw guard (public: −$700, all applied; private: $60, nocompile/refused — verified by execution). setInterval playback. Trivial dead value (`fieldLine.hot`). Prose: verified by execution; the simulated "does not compile" step is explicitly disclosed. Honesty notes present twice, accurate. Fit: **strong**.

**50 inheritance** — Code: method lookup is REAL logic (`lookupPath` walks parent pointers; member resolution with first-definition-wins shadowing — all four walk shapes verified by execution). **Playback: the walk advances by chained `setTimeout` + setState, not `setInterval` — see §4.2.** Prose: all tryThis walk claims verified by execution. **Honesty note missing** (low risk — the lookup is real). Fit: **strong** — best figure of the section.

**51 polymorphism** — Code: dispatch modeled by real type-keyed lookup with the declared label fixed at Robot; shuffle is a real rotation so behavior demonstrably follows the object. Chained `setTimeout` playback (§4.2). Dead ref (`stageRef` attached, never read). The `dispatch: runtime (actual type)` readout is a static label, not computed — acceptable as a caption. Prose: override messages match character-for-character. **Honesty note missing** (action visuals/messages hand-authored per type; the code comment admits it, no user-facing note does). Fit: **strong** (no base-class fallback case, but Inheritance covers that boundary).

**52 abstract-classes-and-interfaces** — Code: checklist verdicts are hand-authored language facts (necessarily); the two non-step readouts are genuinely derived (verified by execution). setInterval playback. Prose: every checklist row checked against Java semantics — correct, including the interface-fields-are-static-final and extends-one/implements-many rows; "provides behavior: only as a default method" is slightly oversimplified (interfaces also allow static/private methods with bodies since Java 8/9) but not error-level; the interface-mode status omits the "concrete implementer" qualifier that the abstract-mode status has. Honesty note present in MDX and caption, accurate. Fit: **adequate** — a stepped-reveal comparison table; the user watches facts appear rather than manipulating a system. See recommendation R6.

**53 composition-vs-inheritance** — Code: class-count/module readouts computed from real list logic (Dig button genuinely inserts the 4 missing combinations with dedup; dup tags derive from real capability counts). Single `setTimeout` for the ripple transition (arguably not "playback" at all). The `composition classes` readout is a hard-coded `1` — correct by construction. **The fragile-base "broken" verdict is a scripted consequence (dup ⇒ broken), a dramatization: the code does not model why combined subclasses break while single-capability ones survive.** Prose: explosion/dup/ripple claims verified by reading; balanced closing is good. **Honesty note missing — and this is the page where it matters most, because the ripple outcome looks computed but is authored.** Fit: **strong** (the ripple is the one soft spot: asserted, not demonstrated).

### Data and Compression (topic 54 — PR #98, unmerged)

**54 entropy-and-compression** — Code: no `useEffect` at all (pure useState + useMemo, no timers — trivially compliant); every readout (entropy, Huffman average, gap, nonzero count) derived from real functions in `entropyCompressionData.js`. Verified by execution and by the committed page-less Playwright logic spec: default {0.4,0.3,0.2,0.1} → entropy 1.846 / avg 1.900 / gap 0.054; powers-of-½ → gap 0; uniform → both 2.000; skew {0.7,0.15,0.10,0.05} → gap 0.131; codes prefix-free; renormalization sums to 1. Prose: **placeholder by design** (final prose is a planned follow-up to PR #98); the TODO block encodes the honesty constraints including the per-symbol-prefix-code caveat. Fit: **strong** — dragging probabilities directly manipulates the quantity entropy is defined over; the gap readout is the lesson. (Audited by the orchestrating session, which built it earlier today; numbers independently re-verified in a harness.)

## 4. Cross-cutting findings

### 4.1 The only outright prose–code contradictions found (2)

1. **neural-networks** — tryThis claims "Reset re-randomizes the weights and starts over"; the net is seeded and Reset restores identical weights every time.
2. **atomicity** — prose and tryThis claim "the total stays 100 the whole way"; the figure's own successful-run frames show the total at 60 mid-transfer, with the total pill rendering broken.

Plus one minor literal overclaim: **overfitting**'s "passes every point" / "zig-zags through every training point" (ridge-regularized degree-14 fit does not interpolate).

### 4.2 setTimeout chains vs the "setInterval + setState" rule — needs an owner decision

Five figures drive discrete state with **chained `setTimeout` + setState** rather than `setInterval`: gradient-descent, neural-networks, inheritance, polymorphism, and (one-shot, arguably not playback) composition-vs-inheritance. None use rAF chaining or anime `onComplete` chaining for state; all are timer-driven and background-tab-safe, which is the rule's evident intent. This is flagged as a letter-vs-spirit question for the maintainer, not reported as a violation. Everything else uses `setInterval` (or has no timer).

### 4.3 Honesty-note coverage is inconsistent

Present and often exemplary on most pages (indexes, embeddings, decision-boundary, dynamic-programming are the models). **Missing on nine pages:** gradient-descent, neural-networks, confusion-matrix, relational-model, select-where-case, group-by, classes-and-objects, inheritance, polymorphism — all low severity because nothing on those pages is faked. **Missing where it actually matters: composition-vs-inheritance** (the "broken" ripple looks computed but is authored). **One mild overclaim: dns** (caption's "read from the simulation" where the chain is a scripted queue). Suggested fix: a one-to-three-sentence note per page, matching the indexes standard.

### 4.4 Code hygiene (all harmless; none affect rendered output)

- Dead imports: `NODE_IDS` (GraphTraversalViz.jsx:6), `CONTEXT` (TemperatureViz.jsx:5, with the sentence duplicated as a JSX literal), `SERVER_COUNT` (LoadBalancingViz.jsx:9).
- Dead exports: `NODES_BY_ID` (beamSearchData), `PAPER` (rlhfData), `ACCENT` (neuralNetData), `INK/FADE/ACCENT` (activationData), `PAPER/INK/FADE` (decisionBoundaryData), `CLUSTERS` (embeddingsData — a missed feature: cluster color-coding exists but is unused), `matchedIds` (indexData), `MEDIAN/MIN/MAX/SORTED` (percentilesData), `FINAL_HIT_RATE` (cachingData), `ORDER_THRESHOLD` (sqlNoSqlData), several internal-only exports in normalizationData/queryPlanData/windowFnData/funnelData.
- Duplicated constants inviting drift: the CASE SQL string (SelectWhereCaseViz.jsx:164 vs selectWhereData.js:24), `PACKET_COUNT` (TcpUdpViz.jsx:25 vs tcpUdpData.js).
- Misleading comments: `beamSearchData.js:104-106` ("load-time invariant... fails loudly" — never invoked at load), `groupByData.js:35-36` (mis-describes `MAX_COUNT`).
- Behavior warts: group-by's HAVING slider has a dead range (7–11) when grouping by country; sorting's "Last run" can record an abandoned run's partial counts without saying so; ClassesObjectsViz calls `setReport` inside a `setObjects` updater.

### 4.5 What was NOT checked

- Pixel-level visual appearance (colors, overlap, clipping) — not inspected in a browser during this audit; the Playwright suite checks figure presence and console cleanliness, not layout aesthetics.
- The live production site — this audit covers the working tree only.
- PostgreSQL docs Table 13.1 transcription fidelity — verified against auditor domain knowledge of PG semantics, not the live docs page.

## 5. Recommendations (report only — nothing implemented)

Ordered by expected learning impact. Each is specific enough to become a build prompt.

### High

None. No figure is broken or teaching its topic incorrectly; the site's floor is unusually high. The items below are upgrades, not fixes. (The two prose contradictions in §4.1 and the composition honesty note in §4.3 are the closest things to must-do items, and they are one-to-three-sentence prose/caption edits, not visualizations.)

### Medium

**R1. overfitting — draw the U-curve.** Add a companion panel plotting train and test error vs degree (two line curves, computed by running the existing `fitPolynomial`/`mse` over all degrees — already sub-millisecond), with a dot marking the current slider degree and the test-error minimum flagged. The topic's central diagram currently exists only as two numbers the reader must scrub through and hold in memory; drawing it converts the figure's biggest weakness into its payoff, and incidentally justifies the hand-authored "regime" badge against the actual computed minimum.

**R2. funnel-analysis — add a cohort dimension.** A control to slice the funnel by `plan` (pro vs free) or signup month, recomputing the three COUNT(DISTINCT) step counts live from the joined tables (the seed data already links sessions to users). The user toggles a cohort and watches bars and conversion rates recompute, discovering that different cohorts leak at different steps — turning "the biggest drop is the best place to investigate" from told to experienced, and exercising the CTE-with-filters point in the prose. Currently the section's weakest interaction (one toggle).

**R3. dns — make TTL a real countdown.** Add a TTL slider (e.g. 5–600s) and a clock that ticks with playback; the cached entry ages and repeated "Look up again" presses naturally flip from hit to miss at expiry, replacing the teleporting "Expire cache" button. Gives the learner the experimental variable the figure currently lacks and makes "TTL is the dial each domain owner sets" a felt tradeoff computed from real entry age. Also fixes the §4.3 honesty nuance if the caption discloses the scripted chain at the same time.

**R4. attention — full attention-matrix heatmap.** A 2D words×words heatmap (click a row to highlight that word's outgoing weights on the sentence) showing "every word attends to every word, all at once" — the claim the prose makes but the current one-word-at-a-time 3D view cannot show. The 3D orbit adds no conceptual content (attention has no spatial structure here). Reuses the existing weight table unchanged.

**R5. transformers — all-heads-at-once view.** When a word is clicked, show all three heads' links simultaneously (three colors overlaid, or three small-multiple panels of the same sentence) instead of only switching between heads. Directly visualizes "parallel heads over one sentence," which is the topic's core claim and is currently only shown sequentially. Small change; reuses existing data.

**R6. abstract-classes-and-interfaces — "build a bot against a contract."** Replace watching a checklist reveal with assembling `GuardBot`: the user picks contract kind (abstract class vs interface) and toggles which members the class provides; the figure computes whether it compiles (missing `doJob()` → error naming the method; second `extends` blocked vs second `implements` allowed; per-instance field rejected in interface mode). Converts five static facts into consequences the user triggers, computed from the same rule table. Current figure is accurate but is the least "figure" of its section.

**R7. why-models-struggle-with-math — user-supplied problems.** Let the reader enter the two small operands; generate the "model" side procedurally (correct leading digit with high probability, per-digit distributions blurred around the true digits — a realistic failure shape) so larger operands visibly degrade the argmax answer while the compute side stays exact. Lets the reader test the prose's "shows up with larger numbers" claim instead of taking two canned presets on faith. Still honestly labeled synthetic.

### Low

**R8. atomicity — one-sentence prose fix** (see §4.1): reframe as "the total is guaranteed at commit boundaries," which is both true of the figure and the deeper lesson.
**R9. neural-networks — one-word tryThis fix** (see §4.1): "Reset restores the same seeded starting weights."
**R10. embeddings — use the existing `CLUSTERS` palette** to color points by cluster, making the grouping legible before any click. The palette already exists, unused.
**R11. Honesty-note sweep** — add the missing one-to-three-sentence notes on the nine pages listed in §4.3, prioritizing composition-vs-inheritance, and soften the dns caption.
**R12. Hygiene sweep** — the dead imports/exports, duplicated constants, and misleading comments in §4.4, plus sorting's partial-run "Last run" label and ClassesObjectsViz's setState-in-updater.
**R13. gradient-descent — prose fix for the learning-rate slider.** The prose states the point "never goes uphill" and always settles in the nearest valley, but never mentions the demo's learning-rate slider or its Diverged state; the "never goes uphill" framing is only true at low learning rates, since a large step can overshoot the ridge or diverge outright. Add a sentence or two acknowledging the slider and what happens at high learning rates.

---

## 6. Summary

- **53 expected topics: all present and audited; plus the unmerged PR #98 topic (54 total).** No topic is missing prose, a figure, or tests-passing status (the one placeholder-prose page, entropy-and-compression, is placeholder by design pending its follow-up PR).
- **Hard rules: zero violations.** No rAF chaining, no anime onComplete state-chaining, no synchronous setState in effect bodies anywhere, Figure.jsx untouched. Five figures use setTimeout chains instead of setInterval — compliant in spirit, flagged for an owner ruling (§4.2).
- **No faked readouts anywhere.** Every "computed-looking" number on the site traces to real state; the handful of authored elements (attention weights, RAG scores, DNS chain, isolation outcomes, composition's ripple) are disclosed — with the exceptions listed in §4.3.
- **Prose accuracy is excellent:** across ~54 pages and hundreds of specific numeric claims (the majority re-verified by execution), exactly two outright contradictions and one minor overclaim were found (§4.1).
- **Figure quality:** 46 strong, 8 adequate (attention, transformers, why-models-struggle-with-math, funnel-analysis, abstract-classes-and-interfaces, plus adequate-to-strong overfitting, dns, and the secondary fine-tuning figure), **zero weak**.

## Candidate new topics (scoped, not built)

These are scoped topic candidates from a scoping pass, ranked by figure strength and evergreen value. None are built. Order of build is TBD and sits behind existing queued work.

**N1. Encryption and public keys** (new topic, AI-adjacent or a new security grouping, TBD).
- **Teaches:** why symmetric encryption cannot share its own secret over an open wire, and how a public/private key pair solves it. Second beat: signing (encrypt with private, verify with public).
- **Figure:** two parties each with a shareable public lock and a private key. Encrypt with a chosen public key, watch it scramble, unlock only with the matching private key. Wrong key stays scrambled. Toggle for signing mode.
- **Constraint:** strictly conceptual. Illustrative scrambling only, clearly marked in an honesty note. No real algorithm internals or implementation guidance.

**N2. How streaming works: buffering** (new topic, Systems and Networking).
- **Teaches:** the buffer as a cushion between a variable network and steady playback; stalls happen when the buffer drains to zero.
- **Figure:** a buffer bar filling from the network and draining at playback rate. Drag network speed down mid-play, watch it deplete, hit zero, stall, then recover. Optional adaptive-bitrate beat.
- **Note:** pairs with the existing caching topic (same fast-cushion-over-slow-source intuition).

**N3. The network stack: protocols, layers, routers vs switches** (new topic, Systems and Networking).
- **Teaches:** what a protocol is, the layered model where each layer wraps the one below with its own header, and switch (forwards by MAC within a network) vs router (forwards by IP between networks).
- **Figure:** a message descending application to transport to network to link, each layer wrapping a header like nested envelopes, then a switch forwarding locally and a router hopping between networks, then unwrapping back up.
- **Constraint:** densest candidate. Build as one focused topic with the envelope-wrapping as the spine; split routing into its own later topic only if the figure gets crowded.

**N4. VMs, containers, and serverless: the compute-abstraction spectrum** (new topic, Systems and Networking).
- **Teaches:** the same app three ways along a spectrum of how much you manage vs how much is shared. VM (full guest OS), container (shared host kernel), serverless (you supply only the function, scales to zero).
- **Figure:** three stacks side by side with a movable "you manage vs platform provides" boundary. Slide from VM toward serverless, watch your responsibility shrink, startup time drop, density rise. Optional cold-start beat.
- **Constraint:** teach the concept only. Do not state specific Azure Functions or Lambda limits, timeouts, or pricing. Naming specific products as category examples requires a web-search pass first.

**N5. Denormalization** (extension to existing topic 38 Normalization, not a new topic, no new slug or number).
- **Teaches:** the deliberate reverse of normalization. Un-split tables to make reads fast (fewer joins), accepting that duplicated facts can drift on update (the anomaly returns).
- **Figure:** reuse topic 38's tables. Add a toggle that merges them into a wide read-friendly shape, shows a query speeding up, then demonstrates the tradeoff by updating one row and showing a duplicated fact go stale.

**Parking lot (verify before scoping, do not build):**
- A2A vs MCP: viable figure (vertical model-to-tools vs horizontal agent-to-agent), but AI-tooling register not CS fundamentals, and carries a staleness cost. Scheduled last. Note: MCP is Anthropic's protocol; prose must stay neutral on the merits.
- Image and lossy compression: real gap next to the existing Huffman topic (60), distinct build, not yet scoped.

Ranking noted in the doc: encryption and buffering are the cleanest builds; network stack is richest but densest; VM/container/serverless carries the product-facts constraint.

### Proposed new chapter: Building AI Agents

Six topics forming a new chapter on agentic AI engineering. Register is current industry practice, younger and faster-moving than the rest of the guide; prose must anchor on mechanisms and use current term names lightly so topics age well. Chapter arc: loop, context, memory, tools, guardrails, measurement.

**N6. The agent loop**
- **Teaches:** what separates an agent from a chatbot. A chatbot answers in one pass; an agent runs a cycle, perceive, reason, act, observe, repeat, until a termination condition says done. The harness is the scaffolding around that loop: tools, constraints, verification.
- **Figure:** step a toy agent through the loop on a small task (e.g. "find the largest file"). Each step shows the four phases and the state changing. Then break it: remove the termination condition and watch it loop forever with an iteration counter climbing; add a max-iterations guard and watch it stop.
- **Constraint:** mechanism-first prose. Use "the agent loop" as the primary name; mention "harness" and "loop engineering" once as current industry terms, not as load-bearing vocabulary.

**N7. Context engineering**
- **Teaches:** the context window as a finite resource. Everything the model knows at inference time must fit in the window: instructions, history, tool results, retrieved documents. The craft is choosing what goes in, what gets summarized, what gets evicted, and what gets fetched on demand instead of front-loaded.
- **Figure:** a visible window with a token budget. Feed a multi-turn task; watch the window fill. When it overflows, choose a strategy, truncate oldest, summarize, or retrieve-on-demand, and watch what the model can and cannot see change, with a task that fails when the needed fact was evicted.
- **Constraint:** no model-specific window sizes in prose (they change). The budget in the figure is illustrative, honesty note required.

**N8. Agent memory**
- **Teaches:** the context window is short-term memory; anything that must survive the session needs an external store. The three-tier taxonomy: episodic (what happened), semantic (what is true), procedural (how to do things). The read-before-reasoning, write-after-acting pattern, and the core tradeoff: in-window is instant but costly and finite; external is durable but adds retrieval latency and relevance error.
- **Figure:** an agent across two sessions. Session one, it learns a fact. Toggle memory off: session two, it is forgotten. Toggle on: watch the write at session end and the read at session start, with the fact landing in the right tier.
- **Constraint:** taxonomy is stable (borrowed from decades-old cognitive science); implementation specifics (vector stores, specific products) stay out of prose.

**N9. Tools and orchestration**
- **Teaches:** tools are the agent's hands, each a named action with defined inputs, and what the agent can do is exactly its tool list. Then patterns for structuring the work: one agent with tools, a router dispatching to specialists, parallel workers, a pipeline.
- **Figure:** same task run under two or three patterns; the call graph lights up differently (single agent doing everything sequentially vs router fanning out to parallel workers), with step count and a toy cost comparison.
- **Constraint:** pattern names vary by vendor; describe the shapes, name them generically.

**N10. Guardrails and the human in the loop**
- **Teaches:** full autonomy is rarely right. Permissions define what an agent may do (allow/deny lists, scoped access); approval gates define when a human must confirm. The autonomy dial: more autonomy is faster and riskier.
- **Figure:** a toy agent with a task touching safe and dangerous actions (read file vs delete file vs send email). Drag an autonomy threshold: watch actions auto-execute, queue for approval, or get blocked. At full autonomy, a destructive action slips through, the payoff moment.
- **Constraint:** keep it conceptual; this is about the design pattern, not a security how-to.

**N11. Evals and observability**
- **Teaches:** agents fail in ways single responses do not, so you measure at two levels: did the task succeed (evals), and what actually happened inside (tracing). A trace is a tree of spans: LLM calls, tool calls, sub-steps, each with latency and token cost.
- **Figure:** two panels. Left: run a toy agent against a 10-task eval set, watch pass/fail; change one tool description, re-run, watch the score move. Right: click into one run's trace tree, expand spans, find where the time and tokens went.
- **Constraint:** scores and costs in the figure are illustrative, honesty note required.

### Laws and principles candidates

Three named laws with genuine mechanisms and figure fits. Chapter placement varies per item.

**N12. Brooks's Law**
- **Teaches:** adding people to a late software project makes it later. The mechanism: communication channels grow as n(n-1)/2 while each person's output stays roughly flat, so coordination overhead eventually swamps added capacity. Plus ramp-up cost: new people subtract time from existing ones before contributing.
- **Figure:** a team-size slider. Watch the channel graph draw itself (every pair a line, count climbing quadratically), next to a bar of total output that rises, flattens, then falls as overhead grows. A second toggle adds the ramp-up penalty mid-project.
- **Constraint:** the output curve is illustrative (there is no one true formula for productivity), honesty note required; the channel count n(n-1)/2 is exact math.

**N13. Goodhart's Law**
- **Teaches:** when a measure becomes a target, it stops being a good measure. The mechanism: optimizing a proxy diverges from the true goal wherever the two are not identical. This is the intuition behind reward hacking and metric gaming.
- **Figure:** a toy optimizer chasing a proxy metric while the true goal is plotted alongside. Early on both rise together; keep optimizing and watch them split, proxy climbing, true goal falling. A slider controls how correlated proxy and goal are; at perfect correlation they never split.
- **Constraint:** cross-link to RLHF (topic 16) and the future Evals topic in prose; the optimizer and metrics are illustrative, honesty note required.

**N14. Hick's Law**
- **Teaches:** decision time grows logarithmically with the number of choices: T = a + b log2(n+1). Why menus with fewer options feel faster, and why log, not linear: doubling choices adds a constant, not double the time.
- **Figure:** a live reaction-time experiment. The user clicks a highlighted target among n options; their own measured times get plotted against n, with the log curve overlaid. The user is the dataset.
- **Constraint:** the user's measured data is real (say so); the fitted curve is illustrative unless enough trials exist. Scope note: this is HCI, adjacent to the guide's current register, placement decision deferred.

### Transformer block internals

Fills the verified gap between the existing attention topics and the full architecture: residual connections, layer norm, and the FFN appear nowhere in the codebase (confirmed by grep). Placement decided: new topic slotted between Transformers and Multi-Head Attention (topic 14) and Encoders and Decoders (topic 15) in AI and ML.

**N15. Inside a transformer block**
- **Teaches:** attention is only part of the repeating unit. One block is attention, then add and norm, then a position-wise feed-forward network, then add and norm again, stacked N times. Residual connections let the signal skip past each sublayer so deep stacks stay trainable; layer norm keeps activations at a stable scale; the FFN transforms each position independently between attention steps. The common intuition, attention mixes information across positions while the FFN processes each position, is presented as intuition, not mechanism.
- **Figure:** one block drawn as a pipeline with a token vector flowing through. Toggle the residual connection off and watch the signal degrade through a stacked run; toggle layer norm off and watch activation scale drift. The current sublayer highlights as the vector passes.
- **Constraint:** the degradation behavior must be either real computation or clearly labeled illustration, decided at build time and reflected accurately in the honesty note. Slot between topics 14 and 15; this shifts the numbering of every topic from Encoders and Decoders onward, so the build must update topicList.js as single source of truth and let numbers flow from it, never retyped.
