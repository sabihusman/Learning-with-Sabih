# Algorithms and Data Structures — Section Review

This document is a review packet for the **Algorithms and Data Structures** section of the "Learning with Sabih" study guide. It is generated for an external AI reviewer who **cannot see the live site**. For every topic it pairs the **verbatim prose** (copied exactly from the topic's `page.mdx`) with a **factual description of what the interactive figure actually does**, read from the component source code as it exists now (not from the original build plans — several figures changed during the build, and the descriptions reflect the current code).

**The one real limitation:** the figures are interactive (sliders, toggles, stepping, clicking nodes, timed playback). This file can only *describe* them in words. A reviewer cannot watch them run, so claims like "the bars glide" or "the tree lights up in order" are descriptions of code behavior, not screenshots.

Source of truth used: `app/topicList.js` (order, numbering, titles, slugs), each `app/topics/<slug>/page.mdx` (prose), and each `app/components/<Name>Viz.jsx` plus shared modules `app/components/graphData.js` and `app/components/CallStackPanel.jsx` (figure behavior).

## Section design conventions (context for the reviewer)

Every topic renders one interaction inside a shared **`Figure` shell** (eyebrow, title, a controls bar, a status line, and a small readouts row). Any auto-advancing playback is **timer-driven** (`setInterval` + React state), never chained off `requestAnimationFrame`, so an interaction keeps progressing even in a backgrounded browser tab; the only thing kept in a React effect is interval cleanup, and component state is reset from the user's own handlers (toggle / slider / step / reset), not synchronously inside effects. Where any data is hand-authored or simplified rather than computed, the topic's prose says so plainly (a per-topic "honesty note", usually the last paragraph). Across this section that honest-simplification is rare: only **Hash tables** uses a deliberately simplified element (its teaching hash function), and **Big-O** sets its race *speed* for watchability while keeping the underlying counts exact. Everything else computes on small, fixed, deterministic inputs.

The section is ordered to build on itself and is bookended by recursion: topic 3 (Recursion) opens the recursive-call-structure theme with Towers of Hanoi, and topic 10 (Dynamic programming) closes it by returning to a recursive call structure with Fibonacci.

There are **10 topics**, numbered 13–22 in the global list (the section is the second of four). They are covered below in listed order. All ten are merged to `main` and their files exist on the current branch.

---

## 13. Big-O and time complexity

- **Slug:** `big-o` · **Component:** `BigOViz.jsx` · **Eyebrow / category:** Complexity

**Verbatim prose (`app/topics/big-o/page.mdx`):**

```md
# Big-O and time complexity

Timing one run of a program can be useful, but it does not answer the bigger question. A result from one computer, one language, one compiler, and one input might not hold somewhere else. To compare algorithms fairly, we need a way to talk about how their work grows as the input grows, without tying the answer to a stopwatch.

Big-O is that tool. It describes the shape of growth as input size n gets larger. It ignores constant factors, small setup costs, and hardware speed. The point is not how many seconds one run takes. The point is what happens to the amount of work when the input gets bigger.

Some algorithms are constant time: they do about the same work no matter how much data exists, like looking up a value directly. Logarithmic time grows slowly by cutting the search space down again and again, the way a binary search halves a sorted list. Linear time grows in step with the input, like scanning each item once.

Linearithmic time, often written n log n, shows up in many good sorting algorithms such as merge sort. It grows faster than a single scan, but much better than comparing everything with everything. Quadratic time is the classic nested-loop shape, where each item is checked against many others. Exponential time grows much faster, often from naive recursion that keeps solving the same subproblems again and again.

These shapes may look close on small inputs, but they separate dramatically as n grows. An algorithm that feels fine on a tiny example can become hopeless on a large real dataset. Slide the input size in the figure and watch the gap open up.

Big-O usually describes the worst case. Best case and average case can be different, so the full story sometimes needs more than one label.

The figure's operation counts and the curve are exact for every class. The exponential lane uses the real number of calls a naive recursive Fibonacci makes, which is why pushing the input far enough sends it past the age of the universe. Only the race speed is set for watchability rather than any real processor, and the wall-clock times assume a fixed rate of two billion operations per second to make the differences tangible. The relative gaps are real.
```

**What the figure does (from `BigOViz.jsx`):** Three stacked parts share one input-size slider (`n`, range 1–120). (1) A **race**: six horizontal bars, one per complexity class, labeled with a real algorithm — `O(1)` Hash table lookup, `O(log n)` Binary search, `O(n)` Linear scan, `O(n log n)` Merge sort, `O(n²)` Bubble sort, `O(2ⁿ)` Naive Fibonacci. A single "Start race" / "Reset" button runs it; bars fill on a `setInterval` (40 ms) at a rate set so the `O(n)` lane finishes in 2500 ms, and the slower lanes simply never catch up. (2) A **wall-clock block** listing, for the current `n`, the estimated time per class at a fixed 2 billion operations/second (formatted up to "> age of universe"). (3) An **exact log-scale curve** plotting operation count vs `n` for all six classes, with a dashed vertical marker and dots at the current `n` and an "off-chart" label when a curve exits the top. Readouts: `input size n` and `O(2ⁿ) at n` (as a wall-clock time). The exponential lane's count is the real naive-Fibonacci call count `fibCalls(n) = 2·Fib(n+1) − 1` (iterative, not `2^n`).

**Real vs illustrative:** Operation counts and the curve are **exact** for every class (including the `O(2ⁿ)` lane's real call count). **Illustrative:** the race *speed* is tuned for watchability rather than any real processor, and the wall-clock estimates assume a fixed 2 billion ops/sec. The relative gaps between classes are real. The prose states all of this.

**Cross-links:** None outward — this is the reference hub the rest of the section points back to. Its six lanes are named after algorithms taught in other topics (binary search, merge/bubble sort, hash-table lookup, naive Fibonacci).

---

## 14. Binary search

- **Slug:** `binary-search` · **Component:** `BinarySearchViz.jsx` · **Eyebrow / category:** Searching

**Verbatim prose (`app/topics/binary-search/page.mdx`):**

```md
# Binary search

Binary search works when the collection is sorted. That one requirement matters. The values have to be in order, like names alphabetically or numbers from smallest to largest. The ordering is what lets the algorithm rule out large chunks at once instead of checking items one by one.

The core move is simple: check the middle item. If the middle item is the target, the search is done. If the target is smaller than the middle item, then everything above the middle is too large, so the whole upper half can be ignored. If the target is larger, then everything below the middle is too small, so the whole lower half can be ignored. Either way, one comparison eliminates half of what is left.

That is why binary search is so powerful. Halving again and again makes the work grow very slowly as the data grows. Doubling the amount of data adds only one more step to the search. Compare that with scanning from the start, where a bigger collection means more items to check one after another. If the data is unsorted, you are usually stuck with that kind of scan because there is no order you can use to safely skip ahead.

The caveat is that binary search gets its speed from sorted data. Sorting data takes work, and keeping data sorted as it changes can also cost time. Binary search shines when the same sorted data will be searched many times, so the sorting cost pays off across repeated lookups.

This is the same logarithmic growth shown as the O(log n) lane in the Big-O figure, now shown step by step.

Pick a target in the figure and step through the search. Watch the middle item move, the search range shrink, and the number of comparisons update as each half is discarded.

The search in the figure runs for real and the comparison counts are exact. The input is kept small so the steps are easy to follow, while real datasets are far larger.
```

**What the figure does (from `BinarySearchViz.jsx`):** A fixed sorted array of 15 cells (`[2,5,9,13,18,24,31,37,42,48,55,61,68,74,81]`). The user picks a target by clicking any cell, or presses a "search a missing value (50)" button to force a not-found run; the default target is 48. Controls: **Step**, **Play/Pause**, **Reset**. Each Step performs one real comparison (a pure reducer over `{lo, hi, comparisons, status}`); Play auto-advances on a `setInterval` (850 ms) that tears itself down when the search reaches found or not-found. `lo`, `hi`, and `mid` pointers are drawn above the array, the eliminated half is greyed, the compared mid cell is highlighted, and the run ends green (found) or in a clear not-found state. Readouts: `target`, `binary search` comparison count, and `linear scan` comparison count (the latter being the target's real position, index + 1, or the array length if absent).

**Real vs illustrative:** Fully real on small deterministic data. Both the binary-search comparison count and the linear-scan baseline are computed live; nothing is hand-authored. Array kept small for readability.

**Cross-links:** Prose explicitly ties this to **Big-O**: "the same logarithmic growth shown as the O(log n) lane in the Big-O figure."

---

## 15. Recursion and the call stack

- **Slug:** `recursion` · **Component:** `RecursionViz.jsx` (uses shared `CallStackPanel.jsx`) · **Eyebrow / category:** Recursion

**Verbatim prose (`app/topics/recursion/page.mdx`):**

```md
# Recursion and the call stack

Recursion is when a function solves a problem by calling itself on a smaller version of the same problem. It keeps doing that until it reaches a case small enough to solve directly. That stopping point is called the base case. Without a base case, the function would keep calling itself forever.

Each recursive call has to remember its own place. The computer does this with the call stack. When a function calls itself, the computer saves where that call was, what values it was using, and what still needs to happen after the smaller problem finishes. Those saved calls stack up on top of each other. When the smallest call finishes, the computer pops back to the previous call, then the one before that, until it returns to the original problem.

Towers of Hanoi is a classic recursion example. The goal is to move a tower of disks from one peg to another, while never putting a bigger disk on top of a smaller one. The trick is that moving a tall tower has the same shape as moving a slightly shorter tower: move the smaller tower out of the way, move the largest disk, then move the smaller tower back on top. The same plan repeats inside itself, which makes the puzzle a natural fit for recursion.

The stack matters because every unfinished call takes space. Deeper recursion means a taller stack, and that memory is not free. For small problems this is fine, but very deep recursion can use a lot of memory. The work can also grow quickly as the problem gets bigger. Add a disk in the figure and watch the stack grow, the calls unfold, and the move count change.

The figure solves the puzzle for real and the move and stack numbers are exact. The disk count is kept small so the stack stays easy to follow.
```

**What the figure does (from `RecursionViz.jsx` + `CallStackPanel.jsx`):** A Towers of Hanoi board (three pegs, disks) beside a **call-stack panel**. A disk-count slider sets the problem size (3–6 disks, default 3). Controls: **Step**, **Play/Pause**, **Reset**. The real recursive Hanoi solver is run once (a pure `useMemo`) and instrumented to record, at each move, the stack of active `hanoi(k, from→to)` calls. Step advances one move; the moved disk is highlighted; the reusable `CallStackPanel` (a vertical stack of frame boxes that grows on push and shrinks on pop, the top frame emphasized) shows the live call stack in sync with the moves. Play auto-advances on a `setInterval` (700 ms). Readouts: `stack depth`, `total moves` (exactly 2^disks − 1), and `moves made` (step / total). The maximum stack depth reached equals the disk count.

`CallStackPanel.jsx` is a **shared, example-agnostic** component: it takes a `frames` array of `{id, name, args}` plus a label and a reserved-slot count, and renders the growing/shrinking stack. (Topic 22, Dynamic programming, echoes this frame *look* with its own tree component but does not import the panel.)

**Real vs illustrative:** Fully real — the move sequence, stack snapshots, and all readouts are computed from the actual recursion; `total moves = 2^n − 1`. Disk count kept small for readability.

**Cross-links:** None stated in the prose (this topic opens the recursion theme; topic 22 refers back to it).

---

## 16. Sorting

- **Slug:** `sorting` · **Component:** `SortingViz.jsx` · **Eyebrow / category:** Sorting

**Verbatim prose (`app/topics/sorting/page.mdx`):**

```md
# Sorting

Sorting means putting data into order: numbers from small to large, names alphabetically, dates from earlier to later. Ordered data is easier to work with. It is the basis for many other tasks, including fast searching. There are many ways to sort, and they do not all scale the same way.

Bubble sort is one of the simplest methods to understand. It repeatedly compares neighboring items and swaps them if they are out of order. After one pass, it starts another pass, then another, until it can pass over the list without making any swaps. The idea is clear, but it is slow because the number of comparisons grows with the square of the list size. As the list grows, the work grows much faster than the input.

Insertion sort builds a sorted section one item at a time. It takes the next item from the unsorted part and slides it backward into the correct place among the items already sorted. Like bubble sort, it is in the slower group for large random lists. But it can do very well when the data is already close to sorted, because most items do not need to move far. That is an important lesson: two algorithms in the same broad speed class can still behave differently on real inputs.

Merge sort uses a different strategy. It splits the list in half, sorts each half, then merges the two sorted halves back together. The halves are sorted the same way, by splitting again and again until the pieces are simple to combine. This is recursion, the same idea from the recursion topic: solve a problem by solving smaller versions of itself. Because merge sort keeps splitting the work, it is much faster on large lists than the simple methods.

On a small list, the methods may look close. As the list gets bigger, the gap opens quickly. Bubble sort is the quadratic case from Big-O, while merge sort is the n log n case shown earlier. Run two sorts on the same array in the figure and compare the counts.

Every sort in the figure is a real implementation and the counts are exact. The array is kept small so the steps are easy to watch, while real datasets are far larger.
```

**What the figure does (from `SortingViz.jsx`):** A row of 14 value bars at a fixed shuffled start (`[8,3,11,6,14,1,9,4,13,7,2,12,5,10]`). A toggle picks one of three **real** implementations — Bubble, Insertion, Merge — and switching resets to the same seed so all three run on identical input. Controls: **Step**, **Play/Pause**, **Reset**. Each algorithm is precomputed into one frame per operation; Step advances one operation, Play auto-advances on a `setInterval` (120 ms). Bars are keyed by slot and glide via a CSS `transform: scaleY` transition; compared bars are highlighted, the merge sub-range is shaded with the written bar marked, and a settled region is greened. A **"last run" memory** line keeps the previous run's counts on screen so two algorithms can be compared after switching. Readouts: `comparisons` and a per-algorithm second metric labeled honestly — `swaps` for bubble, `moves` for insertion and merge — plus a step counter. Bubble sort uses the **standard early-exit** (it stops after a full pass with zero swaps), so on the seed it makes 85 comparisons / 44 swaps; insertion makes 55 comparisons / 44 moves; merge makes 41 comparisons / 54 moves.

**Real vs illustrative:** Fully real — three genuine implementations, every counter accumulated live. Array kept small for readability.

**Cross-links:** Prose ties bubble sort to **Big-O** ("the quadratic case from Big-O") and merge sort to **Big-O** ("the n log n case shown earlier") and to **Recursion** ("This is recursion, the same idea from the recursion topic").

---

## 17. Linked list vs array

- **Slug:** `linked-list-vs-array` · **Component:** `LinkedListArrayViz.jsx` · **Eyebrow / category:** Data structures

**Verbatim prose (`app/topics/linked-list-vs-array/page.mdx`):**

```md
# Linked list vs array

An array and a linked list are two ways to store a sequence of items. An array keeps its items in one contiguous block of memory, side by side. Each item has a position number, called an index, so the program can reach an item by asking for its position.

A linked list stores the same kind of sequence in a different shape. Its items live in separate nodes that may be scattered around memory. Each node holds a value and a pointer to the next node. The list is connected by those pointers, like a chain.

That layout difference is the whole story. Arrays are strong where position matters. Since the items sit in a known order in one block, the program can jump straight to the item at any position. It does not need to inspect the earlier items first.

A linked list cannot jump that way. To reach an item at a given position, it has to start at the front and follow pointers one node at a time until it arrives. Access by position is slower because the list only knows how to move from one node to the next.

Linked lists are strong when you insert or remove near the front. In an array, adding a new first item means every later item has to shift over to make room. Removing the first item means later items shift back to close the gap. That is a lot of moving.

In a linked list, inserting or removing near the front mostly means changing pointers. The nodes do not have to slide around in memory. The list just rewires which node points to which.

Neither structure is simply better. They trade off. Arrays are fast to read by position and slower to insert near the front. Linked lists are the reverse. The right choice depends on what your program does most.

Run insert at the front in the figure and watch the array shift while the list just repoints. Then run access by position and watch the array jump straight there while the list walks node by node.

The figure shows the real work each structure does for each operation, and the costs shown are real counts of that work. The structures are kept small so the steps are easy to see, while real ones hold far more.
```

**What the figure does (from `LinkedListArrayViz.jsx`):** Two rows hold the same seven values (`[17,4,42,8,23,15,16]`): an **array** of contiguous indexed cells above a **linked list** of fixed-position nodes wired by pointer arrows ending in `null`. An operation selector offers four operations — **Insert at front**, **Insert in middle** (index 3), **Delete** (index 3), **Access by index** (with a pickable index 0–6). Controls: **Step**, **Play/Pause**, **Reset**. Running an operation plays a real trace of each structure's actual work on a **single parallel timeline**, so the structure that has more work to do is still moving after the other has finished: the array shifts cells between slots (gliding) to open or close a gap, or jumps directly for access; the linked list keeps its nodes fixed and only rewires pointers (a new node appears above the row, a deleted node drops below it), walking a cursor to the operation site first. Play auto-advances on a `setInterval` (650 ms). Readouts (all real counts of what happened on screen): `array shifts`, `list walked` (nodes traversed), `list pointers` (pointer writes). The winner flips across operations — Insert at front: array 7 shifts vs list walked 0 (pointers 2); Access index 6: array 0 shifts vs list walked 6 (pointers 0); Insert middle: 4 / 2 / 2; Delete: 3 / 2 / 1.

**Real vs illustrative:** Fully real — every shift, walk, and pointer write is the real cost of the real operation performed on the on-screen structure. Structures kept small for readability.

**Cross-links:** None as explicit topic references in the prose (it is a self-contained trade-off discussion; "linked list" is the structure itself, also referenced conceptually by later topics).

---

## 18. Hash tables

- **Slug:** `hash-tables` · **Component:** `HashTableViz.jsx` · **Eyebrow / category:** Data structures

**Verbatim prose (`app/topics/hash-tables/page.mdx`):**

```md
# Hash tables

A hash table solves a common problem: you want to store items and find them again fast, using a key. The key might be a username, an email address, or an ID. Without a hash table, you might have to scan through many items until you find the one you want. A hash table is built to avoid that scan and give near-instant lookup by key.

The trick is a hash function. A hash function takes a key and turns it into a number. That number is used to choose a slot in the table, usually called a bucket. When you store an item, the key decides which bucket it goes in. When you want to find it later, you run the same hash function on the same key, get the same bucket, and look there. The table does not need to search from the beginning.

This is why hash table lookup is the constant-time case. In the usual case, it goes more or less straight to the right bucket no matter how many items are stored. This is the O(1) lane from the Big-O figure, now shown as a real data structure.

There is one catch: different keys can hash to the same bucket. This is called a collision. Collisions are normal, and once there are more possible keys than buckets, they are unavoidable. One common fix is chaining. Each bucket holds a small list, and keys that collide are added to that list. The figure uses chaining, so you can see colliding keys stack up in the same bucket. Another approach, called open addressing, puts a collided key into a different open bucket instead.

As the table fills up, collisions become more likely. The load factor describes how full the table is. When the load factor rises, chains tend to get longer, and lookup slows down because the table has to walk through the chain inside a bucket. Keeping the table from getting too full is how hash tables stay fast. Add a few keys in the figure and watch where they land, then compare the load-factor and chain readouts.

The same basic idea, using a hash to decide where something goes, also scales up to spreading data across many servers.

The hash function in the figure is a simple teaching example: it just adds up the character codes of the key and wraps that around the table size. Real hash functions are far more complex and are designed to scatter keys much more evenly than this one does. The placement, collisions, and load factor shown are all computed for real from that simple hash; the table is kept small so collisions are easy to see.
```

**What the figure does (from `HashTableViz.jsx`):** A row of **7 buckets** (indices 0–6). The user adds keys either from nine preset words (`cat, dog, owl, ant, hen, ram, fox, cod, jay`; each preset button disables once used) or by typing into a free-form input. Each key is placed by a visible teaching hash — the **sum of its character codes mod 7** — and on each add the full computation is shown (e.g. `"jay"  j(106) + a(97) + y(121) = 324  →  324 mod 7 = 2  →  bucket 2`). Collisions are handled by **chaining only**: keys that hash to the same bucket stack in that bucket connected by a spine; the newest chip animates in via CSS. The only Figure control is **Reset**; adding a key is a single triggered action, so there is no playback timer and no React effects at all. Readouts (all derived live from the real table): `load factor` (key count / 7, with a decimal), `collisions` (sum over buckets of chain length − 1), and `longest chain`. Adding all nine presets yields load factor 9/7, 3 collisions, longest chain 3 (bucket 2 holds owl→cod→jay).

**Real vs illustrative:** Placement, collisions, and load factor are **real** (computed from the actual table). The **hash function is the one deliberately illustrative element in the section** — a simple teaching hash, which the prose states plainly is far simpler than real hash functions and scatters keys less evenly. No fabricated data otherwise.

**Cross-links:** Prose ties this to **Big-O**: "the O(1) lane from the Big-O figure, now shown as a real data structure." It also makes a **words-only forward mention** of scaling "to spreading data across many servers" — there is no link and no named topic (the distributed/consistent-hashing topic does not exist yet).

---

## 19. Binary search trees

- **Slug:** `binary-search-trees` · **Component:** `BinarySearchTreeViz.jsx` · **Eyebrow / category:** Trees

**Verbatim prose (`app/topics/binary-search-trees/page.mdx`):**

```md
# Binary search trees

A binary search tree is a tree made of nodes. Each node stores a value and can have up to two children: one on the left and one on the right. The values follow a simple rule. For any node, smaller values go to the left, and larger values go to the right. That ordering rule is what makes it a search tree.

To find a value, you start at the top, called the root, and compare. If the value you want is smaller than the current node, you move left. If it is larger, you move right. Each choice lets you ignore the whole other side of the tree. In the good case, this makes search fast because the search space keeps shrinking. This is the same halving idea as binary search, but built into the shape of the data instead of done on a sorted array.

Insertion follows the same path. To add a value, you start at the root and walk downward using the smaller-left, larger-right rule. When you reach an empty spot where the value should go, you place the new node there. The tree grows one node at a time, and each inserted value helps decide the final shape.

The catch is the important part: a binary search tree is only fast when it stays short and bushy. The order you insert values in decides the shape. If values arrive in already sorted order, each new value keeps going to the same side, because it is larger than everything before it. The tree collapses into a single long line. At that point, searching the tree is no better than walking through a linked list one item at a time. In Big-O terms, a balanced tree gives the fast logarithmic case, while a collapsed line gives the slow worst case.

Real systems often use self-balancing trees that rearrange themselves as values are inserted or removed. The goal is to keep the tree short, even when the input order would otherwise make it lopsided.

Insert values in the figure and watch the tree take shape. Try the balanced preset and the sorted-order preset, then compare the tree height each one produces.

The tree, the search and insert paths, and the height and comparison counts in the figure are all real and computed from the actual tree. The tree is kept small so its shape is easy to see.
```

**What the figure does (from `BinarySearchTreeViz.jsx`):** A binary search tree drawn top-down (an in-order x-index layout, so a parent sits horizontally between its subtrees and a sorted insert order draws a diagonal line). Two preset buttons populate it: **Balanced** (insert order `4,2,6,1,3,5,7`) and **Degenerate** (sorted order `1,2,3,4,5,6,7`). A number input with **Insert** and **Search** buttons drives single operations; the only Figure control is **Reset**. Insert and Search walk from the root by the BST rule (smaller left, larger right), highlighting each node visited; the walk auto-advances node by node on a `setInterval` (480 ms). Insert places the new node at the empty spot it reaches; Search ends in a found (green) or not-found state. Readouts (all from the real tree): `tree height` (longest root-to-leaf path in nodes), `node count`, and `comparisons` for the most recent search/insert (`-` when none yet). The Balanced preset gives height 3 over 7 nodes; the Degenerate preset gives **height 7 over 7 nodes** — a straight diagonal line whose height equals its node count.

**Real vs illustrative:** Fully real — the tree structure, the insert/search walks, and all readouts are computed from the actual BST. Tree kept small for readability.

**Cross-links:** Prose ties this to **Binary search** ("the same halving idea as binary search, but built into the shape of the data") and to **Big-O** ("a balanced tree gives the fast logarithmic case, while a collapsed line gives the slow worst case"); it also makes a conceptual reference to the **Linked list** topic ("no better than walking through a linked list one item at a time").

---

## 20. Graph traversal (BFS and DFS)

- **Slug:** `graph-traversal` · **Component:** `GraphTraversalViz.jsx` (uses shared `graphData.js`) · **Eyebrow / category:** Graphs

**Verbatim prose (`app/topics/graph-traversal/page.mdx`):**

```md
# Graph traversal

A graph is a set of nodes connected by edges. The nodes are the things, and the edges are the relationships between them. Road maps are graphs, with places connected by roads. Social networks are graphs, with people connected by friendships or follows. Web pages form a graph too, with pages connected by links. Traversal means visiting the nodes in some order, starting from one node and following edges outward.

The two classic traversal methods are breadth-first search and depth-first search. Breadth-first search, or BFS, spreads out in layers. It visits everything one step away from the start first, then everything two steps away, then keeps moving outward. It is like exploring a neighborhood by checking all nearby streets before going farther away.

Depth-first search, or DFS, behaves differently. It follows one path as far as it can go, then backs up and tries another path. Instead of spreading out evenly, it plunges deep first. It is like walking through a maze by choosing a hallway and following it until you hit a dead end, then returning to the last choice point.

The clean punchline is that BFS and DFS are almost the same idea with one key swap: the data structure that holds the nodes waiting to be visited. BFS uses a queue. A queue gives back the oldest waiting node first, so BFS finishes a whole layer before moving on. DFS uses a stack. A stack gives back the newest waiting node first, so DFS keeps diving down the most recent path. Same graph, same starting point, two different orders, and the main thing that changed is queue versus stack. Watch the side panel in the figure to see that waiting structure drive the traversal.

BFS is useful when you want the path with the fewest steps from the start, such as a shortest-hop route through an unweighted network. DFS is useful when you want to explore possibilities deeply, such as searching a maze, walking every branch, or checking whether something is reachable.

When edges carry weights, like distances or costs, finding the cheapest path needs a smarter method, which is the next topic.

The figure runs real breadth-first and depth-first traversals on the same small graph, and the queue and stack shown are the real structures driving each one. The graph is kept small so the order is easy to follow.
```

**What the figure does (from `GraphTraversalViz.jsx` + `graphData.js`):** Draws the **shared graph** from `graphData.js` — 8 nodes (A–H) at fixed positions, 11 undirected edges (weights present but ignored here), connected and containing cycles. A toggle picks **BFS** or **DFS**; clicking a node sets the start. Controls: **Step**, **Play/Pause**, **Reset**. BFS and DFS share one traversal loop and differ **only** in the frontier structure: BFS dequeues the front of a **queue** (`frontier.shift()`, FIFO), DFS pops the top of a **stack** (`frontier.pop()`, LIFO); nodes are discovered once in a fixed alphabetical neighbour order, so the order is reproducible. A **side panel** shows the live queue or stack contents (labeled "Queue (FIFO)" / "Stack (LIFO)"). Nodes fill with their visit-order number as they are visited; the current node and the frontier are highlighted. Play auto-advances on a `setInterval` (700 ms). Readouts: `algorithm` (queue/stack), `step / total`, `frontier` size; the status line shows the live visit sequence. From start A: BFS visits `A B D C E G F H`; DFS visits `A B C F H G E D`.

`graphData.js` is the **shared graph module** (exports `NODES`, `EDGES` with weights, `NODE_IDS`, `nodePos`, `buildAdjacency`, `GRAPH_VIEWBOX`); it is reused unchanged by topic 21 (Dijkstra).

**Real vs illustrative:** Fully real — both traversals are deterministic, and the side panel reflects the actual queue/stack that drives the visit order. Graph kept small for readability.

**Cross-links:** Prose makes a **words-only forward reference** to the next topic ("finding the cheapest path needs a smarter method, which is the next topic") — no link.

---

## 21. Dijkstra's shortest path

- **Slug:** `dijkstra` · **Component:** `DijkstraViz.jsx` (uses shared `graphData.js`) · **Eyebrow / category:** Graphs

**Verbatim prose (`app/topics/dijkstra/page.mdx`):**

```md
# Dijkstra's shortest path

In the previous topic, a graph edge was just a connection. The shortest path meant the path with the fewest hops. That works for some problems, but real connections often have costs. Roads have distances. Networks have delays. Routes have prices. In those cases, the shortest path means the cheapest total cost, not the fewest steps. A path with fewer hops can still be more expensive than a path with more hops.

Plain breadth-first search is not enough for this job. BFS counts how many edges you cross. It does not add up the cost written on each edge. If every edge costs the same, that is fine. Once edges have different weights, BFS can choose a route that looks short by step count but is not actually cheapest. We need a method that tracks total cost.

Dijkstra's algorithm does that by keeping a running best-known distance from the start to every node. At the beginning, the start node has distance zero, because you are already there. Every other node is unknown. The algorithm then repeats a careful process: pick the closest node whose distance is not final yet, lock in that distance, and check its neighbors.

Checking a neighbor means asking, "Would it be cheaper to reach this neighbor by going through the node I just locked in?" If the answer is yes, update the neighbor's best-known distance. If not, leave it alone. Over time, more nodes get updated, then locked in, until every reachable node has its final cheapest distance from the start.

The key idea is the order. Dijkstra always locks in the closest remaining node first. Because of that, once a node is locked in, there is no cheaper path to it hiding somewhere else. Any other route would have to pass through a node that is at least as far away already, so it cannot improve the locked result. That is what makes the final distances trustworthy.

Pick a start in the figure and step through it. Watch the distances settle from nearest outward as nodes get locked in, then pick any destination to light up the cheapest path to it.

This is the same graph idea from the traversal topic, now with weights. The cheapest path is something the earlier fewest-hops methods could not find.

The figure runs a real Dijkstra on the small weighted graph, and every distance and the final path are computed for real. The graph is kept small so the steps are easy to follow.
```

**What the figure does (from `DijkstraViz.jsx` + `graphData.js`):** Draws the **same shared graph** as topic 20, now showing each edge's weight (the weighted adjacency is built locally from the shared `EDGES`; `graphData.js` is unchanged). A source selector (A–H) or a node click sets the source. Controls: **Step**, **Play/Pause**, **Reset**. This is **run-to-completion** Dijkstra: each Step finalizes the nearest unfinalized node, then relaxes each of its unfinalized edges one at a time, updating a neighbour's tentative distance only when going through the current node is cheaper. The on-screen state is deliberately minimal — each node shows its tentative distance (`∞` until reached), finalized nodes get a distinct fill, the current node and the single edge being relaxed are highlighted, and there is no distance table, priority-queue panel, or predecessor data shown. After every node is finalized, clicking any node traces its shortest path back to the source (green) and shows the total cost. Play auto-advances on a `setInterval` (650 ms); the run is a pure `useMemo` with an alphabetical tie-break, so it is reproducible. Readouts: `source`, `finalized` count / total, and `path cost` (once a target is picked). From source A the final distances are `A0 B4 C9 D3 E4 F7 G10 H9`; the shortest path A→H is `A → D → E → F → H` at cost 9 (a four-hop path that beats the direct E–H edge of weight 8).

**Real vs illustrative:** Fully real — every tentative distance, the finalized set, and the final path are computed by a real, deterministic Dijkstra on the real weighted graph. Graph kept small for readability.

**Cross-links:** Prose ties this to **Graph traversal** ("This is the same graph idea from the traversal topic, now with weights") and explicitly contrasts with **BFS** from that topic ("Plain breadth-first search is not enough for this job").

---

## 22. Dynamic programming

- **Slug:** `dynamic-programming` · **Component:** `DynamicProgrammingViz.jsx` · **Eyebrow / category:** Optimization

**Verbatim prose (`app/topics/dynamic-programming/page.mdx`):**

```md
# Dynamic programming

Some problems break into smaller subproblems. Dynamic programming applies when those subproblems overlap, meaning the same smaller question comes up again and again. The idea is simple but powerful: solve each subproblem once, remember the answer, and reuse it instead of solving it over and over.

Fibonacci is the classic example. Each Fibonacci number is the sum of the two before it. A direct recursive version says `fib(n)` depends on `fib(n - 1)` and `fib(n - 2)`. Each of those depends on the two before it, and the calls keep branching until they reach the smallest cases.

The catch is that many branches ask for the same values. One branch may compute a smaller Fibonacci value, then another branch computes that same value again, then another does it again. The naive recursive version does a huge amount of repeated work because it forgets answers as soon as each call returns.

This is the same recursive call structure from the recursion topic. The naive version's explosion of repeated calls is also the same exponential growth shown as the worst case in the Big-O topic. In the figure, you can see that explosion as a branching tree.

Memoization is the fix. Keep a small store of answers that have already been computed. The first time the program needs `fib` of some value, it computes it normally and saves the result. Every time after that, it just looks the value up. A branch that reaches a known value does not need to expand again, so the repeated branches collapse.

That changes the shape of the work. Instead of recomputing the same subproblems across many branches, the memoized version does roughly one real computation per distinct subproblem. It spends a little memory to avoid a lot of repeated work.

Pick a value in the figure and switch between naive and memoized. Watch the tree go from bushy to lean, then compare the two call counts.

That trade, using memory to remember answers so the program does not repeat itself, is the heart of dynamic programming. Fibonacci is only the small teaching example. The same shape appears in many harder problems where repeated subproblems hide inside a larger task.

The figure computes both versions for real and the call counts shown are exact. The value of n is kept small so the naive tree stays readable, but the blow-up is real and grows far worse for larger n.
```

**What the figure does (from `DynamicProgrammingViz.jsx`):** Builds the recursive Fibonacci **call tree** for a chosen `n` (slider, range 4–7, default 6) and toggles between **Naive** and **Memoized**. Both trees are built for real (pure `useMemo`). In **Naive** mode every `fib(k≥2)` expands into `fib(k−1)` and `fib(k−2)`; each node is a small rounded frame (echoing the recursion topic's `CallStackPanel` look) labeled with its index `k` and **coloured by that value**, so the same subproblem repeats as repeated colours across the tree (for `fib(6)`, `fib(1)` appears 8 times, `fib(2)` 5 times, `fib(0)` 5 times). In **Memoized** mode each value is computed once; later appearances are drawn as **dashed "cache hit" leaves that do not expand**, so the tree collapses to a lean spine. Controls: **Step**, **Play/Pause**, **Reset** — Step/Play trace the calls in pre-order (so the step total equals the call count), Play on a `setInterval` (320 ms). **The node count of each tree is the real number of `fib()` calls that implementation makes.** Readouts show both at once: `naive calls`, `memoized calls`, and `fib(n)`. For `n = 6`: naive 25 calls, memoized 11 (`fib(6) = 8`). For `n = 7`: naive 41, memoized 13. (The memoized count follows `2n − 1`.)

**Real vs illustrative:** Fully real — both call trees and both call counts are computed from the actual recursion; nothing is hand-authored. `n` kept small so the naive tree stays readable; the prose notes the blow-up is real and far worse for larger `n`.

**Cross-links:** Prose ties this to **Recursion** ("the same recursive call structure from the recursion topic") and to **Big-O** ("the same exponential growth shown as the worst case in the Big-O topic" — i.e. the `O(2ⁿ)` lane). This is the section's closing bookend back to topic 15.

---

## Reviewer notes: places where prose and figure should be double-checked

These are not confirmed errors — they are points where the wording and the code describe slightly different (though compatible) quantities, worth a reviewer's eye:

1. **Dynamic programming — "one real computation per distinct subproblem" vs the `memoized calls` readout.** The prose says the memoized version "does roughly one real computation per distinct subproblem." The figure's `memoized calls` readout (11 for `n = 6`) is the total number of `fib()` *invocations*, which includes the cache-hit lookups, not just the distinct *computations* (which for `n = 6` are 7). The figure does distinguish them visually — solid coloured nodes are real computations, dashed nodes are cache hits — and the prose carefully says "roughly one … computation" and separately "compare the two call counts," so the two statements are about two different real numbers and are not contradictory. A reviewer may still want to confirm the prose's "roughly one per distinct subproblem" reads correctly next to a readout that counts total calls.

2. **Recursion — "Add a disk in the figure."** The control is a disk-count **slider** (3–6), not an explicit "add" button; increasing the slider adds disks. The wording is functionally accurate but a reviewer might note the interaction is a slider rather than an add action.

No outright contradictions were found between any topic's prose and its figure: in every case the figure computes what the prose claims, the honesty notes match the code (only Hash tables' hash function and Big-O's race speed are flagged as simplified/illustrative, and both prose blocks say so), and the cross-links point at topics that exist in the section.
