# Prose review — Learning with Sabih study guide

This document exists so an advanced model can review each topic's written prose alongside an accurate description of that topic's interactive figure, and judge how well the two match.

**One real limitation:** the figures are live, interactive React components. This file can only describe them in words. A reviewer reading this cannot actually run a figure, drag a slider, or watch an animation step, so the "What the figure does" notes are descriptions of the current component code, not a substitute for using the figure.

**Scope:** all 36 topics currently in `app/topicList.js`, in listed order, grouped by the four sections. (Topic 32, Atomicity, was merged into `main` while this document was being written; every other topic is long-merged.)

## Shared conventions (read once)

- **The Figure shell.** Every topic's interaction is a `'use client'` React component mounted inside one shared presentational shell, `app/components/Figure.jsx`. The shell renders an `eyebrow` (a short category tag), a `title`, the visualization, an optional control bar, optional `readouts` (labeled live values), and an optional `tryThis` callout. Topic components own all state; the shell only displays what they pass.
- **Real vs illustrative data.** Two broad patterns. Most **AI and ML** figures run real math over **hand-authored/illustrative** inputs (attention weights, next-token probabilities, similarity scores are made up, but the softmax, dot products, or nearest-neighbor math on them is real). The **Algorithms** figures invert this: they compute on small fixed deterministic inputs and the counts are exact, with only a couple of flagged illustrative choices. **Databases** figures compute their results (filters, joins, aggregates, join/scan costs) for real over small fixed datasets. Each topic's "real vs illustrative" line states which is which.
- **Per-topic honesty note.** Most figures carry an in-figure caption or `tryThis` line stating what is simplified (small input size, a teaching hash, an illustrative cost model, an EXPLAIN-style readout that is not literal Postgres, etc.). Where the prose makes the same disclosure, that is noted.
- **Motion.** Where a figure auto-advances ("Play"), the cadence is timer-driven (`setInterval`), chosen deliberately over `requestAnimationFrame` so it keeps progressing in a backgrounded tab. Many figures have no timer and simply recompute when a control changes.

Prose is reproduced verbatim inside fenced blocks (four backticks, so any code fences inside the prose survive). Everything outside those fences is description written for this review.

---

## AI and ML

### 01. Gradient Descent
- **slug:** `gradient-descent`
- **eyebrow/category:** Optimization

**Prose (verbatim):**
````markdown
# Gradient Descent

Machine learning models learn by adjusting their parameters to reduce error.
The mechanism behind most of this adjustment is gradient descent: a way of
finding the minimum of a function by repeatedly stepping downhill, in the
direction of steepest descent.

## The loss curve

Picture a single parameter x and a loss function f(x) that measures how much
error the model makes for that value of x. The goal is to find the value of x
where the loss is lowest.

The function used here is a one-dimensional asymmetric double well:

```
f(x) = 0.08 * (x^2 - 4)^2 + 0.15 * x
```

It has two valleys rather than one. The small tilt from the 0.15 * x term
makes the left valley slightly deeper than the right one, so the two minima
are not equal. This shape is deliberate: a single bowl can only show one
minimum, but a double well can show the difference between a local minimum and
the global minimum.

## The gradient

In one dimension the gradient is just the derivative f'(x), the slope of the
curve. To descend you step in the opposite direction of the slope:

```
f'(x) = 0.32 * x * (x^2 - 4) + 0.15
```

The parameter update at each step:

```
x  <-  x - alpha * f'(x)
```

where alpha (the learning rate) is a small positive number that controls how
large each step is. When the slope is positive the point moves left; when it
is negative the point moves right. Either way it moves toward lower loss.

## Local versus global minima

Setting f'(x) to zero gives three points where the slope is flat:

```
x ≈ -2.056   global minimum   f ≈ -0.304   the deeper, left valley
x ≈ +0.118   local maximum    f ≈ +1.289   the ridge between the valleys
x ≈ +1.939   local minimum    f ≈ +0.296   the shallower, right valley
```

A minimum is global if no other point has a lower loss, and local if it is
the lowest only within its immediate neighborhood. Here the left valley is the
global minimum and the right valley is a local minimum that is higher than the
global one.

## Why the starting point matters

Plain gradient descent only ever moves downhill, so it cannot climb over the
ridge at x ≈ 0.118 that separates the two valleys. Whichever side of that ridge
you start on is the valley you end up in.

Start the demo on the right, at x = 2.4, and run it. The point rolls left and
down until the slope flattens at x ≈ 1.939, then stops. That is the local
minimum. It settles there even though a deeper, better minimum exists in the
left valley, because reaching the left valley would require going uphill first
and gradient descent never does that.

Now switch to Start left, at x = -2.4, and run again. This time the point
settles at x ≈ -2.056, the global minimum.

This is the central limitation the demo is built to show: gradient descent
finds a minimum near where it begins, not necessarily the best minimum overall.
It is why where you initialize the parameters matters, and why techniques such
as random restarts, momentum, and stochastic noise exist. Each is a way to
give the optimizer a chance to escape a local minimum and find a deeper one.

## What the demo shows

The grey curve is the loss f(x). The red dot is the current value of x. The
red arrow shows the descent direction, which is the sign of the negative slope.
The dashed grey trail records every previous position. The filled black dot
marks the global minimum and the hollow black ring marks the local minimum.
Use **Play** to run the optimization, **Step** to advance one iteration at a
time and watch the readouts, and **Start left** or **Start right** to choose
which valley the point begins in.
````

**What the figure does:** Plots the loss curve `f(x) = 0.08(x^2-4)^2 + 0.15x` with a red dot. Controls are Play/Pause, Step (one iteration), Reset, Start right (x=2.4), Start left (x=-2.4), plus a learning-rate slider (0.02–2, default 0.12). While paused the user can drag the dot along the curve to set the start x; Play runs the optimizer on a `setTimeout` timer (STEP_MS = 600ms, timer-driven not rAF so it keeps running in a backgrounded tab), with anime.js gliding the dot between committed steps. Readouts show step count (/79), lr, x, f(x), f'(x); the status reports Running/Paused, which basin it settled in, or "Diverged..." when a large learning rate pushes |x| past 4.2.

**Real vs illustrative:** The optimizer math is fully real (f, f', the update x ← x − α·f'(x), settling, and divergence are computed live). The two minima markers use hard-coded constants (GLOBAL_MIN = −2.0562, LOCAL_MIN = 1.9386), and the extrema values quoted in the prose code block are hand-authored (matching the derivative's roots).

**Cross-links in prose:** none.

### 02. Neural Networks
- **slug:** `neural-networks`
- **eyebrow/category:** Deep learning

**Prose (verbatim):**
````markdown
# Neural Networks

A single artificial neuron does one small calculation. It takes a set of inputs, multiplies each by a weight, adds them into a weighted sum, then passes that sum through an activation function, which decides how strongly the neuron "fires." On its own this is simple: a way to combine several signals into one output.

The power comes from wiring many neurons together in layers. The first layer reads the raw inputs, like pixel values or numeric features. Its outputs feed the next layer, which combines them into more useful signals. With enough layers, later neurons represent higher-level patterns built from earlier ones.

At the start, the network's weights are random, so its first predictions are close to chance. Training is how it improves. You show one example, the signal flows forward through the layers to a prediction, and you compare that prediction to the correct answer. The difference is the loss, a single number saying how wrong the network was.

Backpropagation then works backward from the loss to compute how much each weight contributed to the error. Those contributions are gradients: they say which direction would make the loss larger or smaller. Gradient descent uses them to nudge each weight a little toward less error. This is the same gradient-descent idea from the separate topic, now applied across thousands or millions of weights at once.

Repeat this over many examples and the loss falls, with the weights settling into values that capture the pattern in the data. In the figure below, you can watch a small network train in real time: the loss drops, connection strengths shift, and the boundary between two groups sharpens.
````

**What the figure does:** Two side-by-side SVGs: a live network diagram (2 inputs → 6 hidden neurons with tanh → 1 output) whose edge thickness/opacity/color reflect the live weight snapshot (black = positive, red = negative), and a task panel plotting 2D points (inside vs outside a circle) with the network's shaded decision field behind them. Controls are Play/Pause, Step (STEP_EPOCHS = 25 epochs), and Reset (re-randomizes weights). Play trains on a `setTimeout` loop (FRAME_MS = 16, timer-driven not rAF so training survives a hidden tab), running EPOCHS_PER_FRAME = 3 epochs per tick and throttling the decision-field redraw to ~70ms. Readouts show epoch, loss, accuracy; auto-stops with "Converged..." at loss < 0.012 or epoch ≥ 4000.

**Real vs illustrative:** All real — forward pass, full-batch backprop, BCE loss, weights, accuracy, and the decision field are computed from scratch in plain JS, no ML library. Seeds (SEED_DATA=1, SEED_NET=7) and hyperparameters are fixed for determinism; the 160-point dataset is generated by the seeded PRNG.

**Cross-links in prose:** references Gradient Descent ("the same gradient-descent idea from the separate topic"); names Backpropagation as a concept.

### 03. Why Activations Matter
- **slug:** `activation-functions`
- **eyebrow/category:** Non-linearity

**Prose (verbatim):**
````markdown
# Why activations matter

The previous topic showed a small network learning to separate two groups of points. This topic answers a question that is easy to skip: why does the network need an activation function at all?

An activation function is a small nonlinear step applied to each neuron's output. Without it, each neuron only takes inputs, multiplies them by weights, adds them up, and passes the result forward. That is a straight-line operation. If every layer only does straight-line operations, then stacking layers does not make the network more powerful. A stack of straight-line operations can always be collapsed into one straight-line operation. No matter how many layers or neurons you add, the network can only draw a straight boundary. Depth buys it nothing.

That is a problem because lots of real data cannot be split by a straight line. Imagine one group of points sitting inside a ring, with another group surrounding it. No single straight line can separate the inside from the outside. A network with no activation is stuck trying to solve a curved problem with a straight ruler.

ReLU is one common activation function, and it is very simple. It passes positive values through unchanged and turns negative values into zero. That small bend is enough to change what the network can represent. Once each neuron can bend its output, the network can combine many small bends into a boundary that curves around the data. Each ReLU unit adds another possible bend, so more hidden units let the boundary take on a more complex shape.

Turn the activation off in the figure and watch the boundary fall back to a straight line that cannot separate the groups. Then turn ReLU on and watch the boundary bend to fit the pattern. Add hidden units and watch the boundary gain more bends and fit more tightly.

This small nonlinear step is what makes deep networks powerful. Without it, all the layers in the world collapse into one straight line.

The figure shows real network behavior on a small fixed dataset. The network is trained for real on the fixed dataset, and the boundary you see is that real result. The dataset is kept small so the effect is easy to see.
````

**What the figure does:** A single task panel plots the fixed point set (inner disc inside an outer ring) with the network's decision field shaded behind it. Controls are a two-button toggle (Activation off / ReLU on) and a hidden-units slider (1–8, default 6). No timer or Play: changing either control re-fits the tiny 2→H→1 network via `useMemo` (with a session-wide `FIT_CACHE`, so each activation/unit-count pair trains once) and recomputes the field. Readouts show activation ("ReLU" or "none (linear)"), accuracy, and "separates?" (yes at accuracy ≥ 0.995).

**Real vs illustrative:** All real — trained for real (full-batch gradient descent, EPOCHS=1500, RESTARTS=2 kept by lowest loss); boundary and accuracy come from that trained net. Seeded/deterministic; 140-point dataset PRNG-generated. Prose and caption flag that the dataset is kept small and the boundary computed, not hand-drawn.

**Cross-links in prose:** references Neural Networks ("The previous topic showed a small network learning to separate two groups of points").

### 04. Overfitting and Generalization
- **slug:** `overfitting`
- **eyebrow/category:** Machine learning

**Prose (verbatim):**
````markdown
# Overfitting and generalization

The goal in machine learning is not to match the training data perfectly. It is to learn the underlying pattern and then work well on NEW data the model has not seen. That ability to perform on fresh examples is called generalization. Real data usually contains a true trend plus random noise, and a good model captures the trend while mostly ignoring the noise.

Underfitting happens when a model is too simple for the pattern. If the real relationship is curved but you fit a straight line, the model cannot represent what is going on. It does poorly even on the training data, because it is missing the basic structure.

Overfitting is the opposite. If a model is too complex, it can bend itself to match every training point, including the noise. It can look perfect on the training set, but that "success" is really memorization. Give it new data, where the noise is different, and its overly specific curve fails. The classic picture is a wildly wiggly curve that hits every dot.

The key signal is how error changes as complexity increases. Training error usually keeps dropping, because a more flexible model fits the training data better and better. But error on held-out data, often called test or validation error, drops at first and then starts rising. That rise is the sign of overfitting. The best model is usually in the middle: complex enough to capture the trend, simple enough to ignore the noise.

This is why more complexity or longer training is not always better, and why techniques exist to hold a model back from memorizing.
````

**What the figure does:** Plots training points (blue), held-out test points (green rings), the true trend (faint dashed grey), and the fitted polynomial (red), with a legend. A single "model complexity" slider sets the polynomial degree (1–14, default 4). No timer/Play: each slider tick re-solves the polynomial least-squares fit and recomputes both errors. Readouts show complexity ("degree N"), training error, test error; a regime label (underfitting / good fit / overfitting) and a status line update with degree.

**Real vs illustrative:** Mostly real — the fit is a genuine least-squares solve (normal equations + Gaussian elimination with a tiny ridge), and training/test MSE are recomputed each tick over a fixed seeded dataset (16 train + 6 test points around `sin(2π·0.8x)+0.4x` plus noise). The one hand-authored piece is the regime-label thresholds in `regime()` (degree ≤2 underfitting, ≤6 good fit, else overfitting) — fixed cutoffs, not derived from the measured test-error minimum.

**Cross-links in prose:** none.

### 05. Confusion Matrix
- **slug:** `confusion-matrix`
- **eyebrow/category:** Classification

**Prose (verbatim):**
````markdown
# Confusion Matrix

A confusion matrix is a simple way to count what a classifier got right and wrong. For a spam filter, each email is either actually spam or actually not spam, and the filter predicts spam or not spam. That gives four outcomes:

- True positive (TP): the email is spam, and the filter flags it as spam.
- False positive (FP): the email is not spam, but the filter flags it. A good email sent to the junk folder.
- True negative (TN): the email is not spam, and the filter leaves it in the inbox.
- False negative (FN): the email is spam, but the filter lets it through.

From these counts you get two useful measures.

Precision asks: when the filter says "spam," how often is it right? Precision = TP / (TP + FP). High precision means few false alarms, so you rarely lose real email to the junk folder.

Recall asks: out of all the spam that exists, how much did the filter catch? Recall = TP / (TP + FN). High recall means little spam slips through.

Most filters output a score, say 0 to 1, and you pick a threshold above which an email is marked spam. Raise the threshold and you flag fewer emails: false positives drop, so precision rises, but false negatives climb, so recall falls. Lower it and the reverse happens.

There is no setting that makes both perfect when spam and real mail overlap in score. Choosing the threshold means choosing which mistake you can live with. A spam filter would rather let some spam through than bury your real mail. A cancer screen makes the opposite choice: catch every real case, even at the cost of false alarms.
````

**What the figure does:** A single range slider sets the decision threshold (0–1, step 0.01); no timer, updates instant on drag. An SVG scatter plot lays out 50 fixed items along a model-score axis (top band = actual positives, bottom = actual negatives), shading the predicted-positive region right of the threshold and coloring each dot ink (correct) or red (incorrect). A live 2×2 matrix shows TP/FN/FP/TN; readouts show threshold, precision, recall, and predicted-positive count. Precision reads "n/a" when nothing is predicted positive.

**Real vs illustrative:** The 50-item dataset is seeded deterministic (mulberry32, seed 42) drawing two overlapping Gaussians (positives mean 0.62, negatives mean 0.38); all counts, precision, recall are computed for real from that fixed data and the live threshold. Data synthetic/illustrative, math genuine.

**Cross-links in prose:** none.

### 06. Tokenization
- **slug:** `tokenization`
- **eyebrow/category:** Language models

**Prose (verbatim):**
````markdown
# Tokenization

Before a language model can do anything with text, it has to chop the text into pieces called tokens. A token is often a whole common word, but longer or rarer words get split into smaller subword pieces. For example, "apple" might be a single token, while "unbreakable" might split into "un", "break", "able". This gives the model a manageable vocabulary that can still represent new words by combining pieces.

Each token is mapped to an integer ID. The model never sees letters or words directly. It sees a sequence like `[314, 9271, 18, 502]`, where each number stands for one token. This sets up the next step, embeddings: each token ID becomes a vector of numbers the model can compute with.

This matters because tokenization changes what the model can directly see. Since the model operates on tokens, not characters, it can struggle with tasks that need letter-level detail. Spelling a word backwards, counting the letters in a word, or making rhymes can be harder than you expect. If a whole word is swallowed into a single token, the model has no direct view of the letters inside it.

Tokens are also why text length is measured in tokens, not words. Usage limits and context windows are counted in tokens, because that is the unit the model processes.

The figure below uses a simplified, illustrative tokenizer. Real models use a learned vocabulary of tens of thousands of tokens, often built with byte-pair encoding. The behavior is the real point: common words stay whole, rare words split, and each piece becomes an ID.
````

**What the figure does:** A free-text input lets the user type any sentence; three buttons load a default sentence, a "Spelling example" (`how many r letters are in strawberry`), or clear the field. As text changes it re-tokenizes live (no timer), rendering each word as colored chips — whole words get a single-token fill, split words show varied colors per piece with a "word = N tokens" label, punctuation gets its own chip. Each chip shows token text and integer ID. Readouts show token, word, and character counts.

**Real vs illustrative:** Tokenization and IDs are computed for real, but by a hand-made deterministic splitter (`tokenizerData.js`): a fixed COMMON word set kept whole, longest-first prefix/suffix peeling, a small fixed vocabulary (IDs 100+) plus a stable hash fallback (IDs 9000+). Explicitly not real BPE; prose and an in-figure note flag this.

**Cross-links in prose:** Embeddings ("This sets up the next step, embeddings").

### 07. Why Models Struggle with Math
- **slug:** `why-models-struggle-with-math`
- **eyebrow/category:** Language models

**Prose (verbatim):**
````markdown
# Why models struggle with math

It can feel surprising: language models write fluent essays and code, yet they often fail at arithmetic a calculator handles instantly, or miscount the letters in a word. Why does something that sounds so capable stumble on exact tasks?

The core reason is that a model generates an answer by predicting the next token, one step at a time, based on patterns in its training data. It is not running a calculation. Asked "27 x 14", it does not multiply 27 by 14 the way a calculator does. It predicts a sequence of digits that looks like a plausible answer. That guess may be close, and it may even be right, but it is frequently wrong, because the process is pattern prediction, not arithmetic.

Tokenization adds friction. Because numbers and words are chopped into tokens, the model does not reliably see individual digits or letters the way we do. Exact, position-sensitive work like carrying digits in multiplication or counting letters in a word gets harder when the pieces the model sees do not line up cleanly with the characters we care about.

The deeper point is that prediction is not computation. A calculator follows an exact algorithm and gives the right answer every time. A model produces what is statistically likely to come next. That is a different kind of process, and it has no guarantee of being exact.

Models can still seem good at math sometimes, because many common problems appeared often in training, so the likely next tokens happen to match the correct answer. The weakness shows up with larger numbers, unusual examples, or problems the model has not effectively memorized.

This is why models are paired with real tools, like a calculator or a code interpreter, for exact work, instead of being trusted to compute on their own.
````

**What the figure does:** Two preset buttons choose a problem ("27 × 14" multiplication or count "s" in "mississippi"), plus Step (primary) and Reset. Stepping is user-driven, not timer-based: each press advances one token/step on both sides. The left "calculator" column reveals genuine algorithm steps with a running total/count; the right "language model" column commits one predicted answer token per step and shows an SVG bar chart of the illustrative next-token distribution, with the just-committed chip animated in via anime.js (decorative). Readouts show computed value, predicted string, and a verdict ("match" / "model is wrong").

**Real vs illustrative:** The left/compute side is genuinely correct (real arithmetic and letter-counting in plain JS, `computeSteps`). The right/predict side is hand-authored, fabricated per-token distributions tuned so the argmax path lands on a plausible-but-wrong answer (368 for 27×14; 3 s's in mississippi when the real count is 4). Code comments and the caption flag the probabilities as illustrative.

**Cross-links in prose:** Tokenization ("Tokenization adds friction.").

### 08. Embeddings
- **slug:** `embeddings`
- **eyebrow/category:** Representation

**Prose (verbatim):**
````markdown
# Embeddings

Computers do not understand words, they understand numbers. An embedding is the
bridge: it turns each word into a list of numbers, a vector, chosen so that words
with similar meanings end up with similar vectors. Once meaning is a position in
space, the machine can compare words by measuring how far apart they are.

## Meaning becomes distance

The core trick is that distance carries meaning. Words that appear in similar
contexts are placed close together; words that have nothing to do with each other
are placed far apart. The model is never told that a king and a queen are related.
It learns it from seeing them used in similar sentences, and it records that
relationship by putting their vectors near each other.

In the scene below, each word is a point. Related words form tight clusters and
the clusters sit far apart. Click any word to draw lines to its three nearest
neighbors, and you will see the neighbors are always its own group.

## Why this looks too clean

Real embeddings do not live in three dimensions. A typical model represents each
word with a vector of hundreds or even thousands of numbers. Each of those numbers
is a separate axis, and no one can picture a 300 dimensional space.

So to look at embeddings we cheat: we squash the hundreds of dimensions down to
two or three using a projection technique such as PCA, t-SNE, or UMAP. Something
is always lost in that squashing, which is why real projections look messier than
this one. The coordinates here are placed by hand to show the idea cleanly. The
lesson holds either way: near means similar, far means different.

## Why it matters

This one idea powers a lot of modern software. Search engines embed your query and
your documents into the same space and return the documents whose vectors sit
closest to the query, which is how you find a relevant result that does not share
a single keyword. Recommendation systems embed items and users and look for near
neighbors. Retrieval-augmented generation embeds chunks of text so a language
model can pull in the passages most related to a question. In every case the
machinery underneath is the same: turn things into vectors, then measure distance.

## What the demo shows

Each point is one word, placed by hand so that meaning maps to distance. Drag to
orbit the cloud, scroll to zoom, and click a word to highlight its nearest
neighbors. The four clusters are royalty, animals, vehicles, and fruit. They sit
far apart because their meanings are unrelated, and each word's closest points are
always the other members of its own cluster.
````
(The `<EmbeddingsViz />` embed sits after the "Meaning becomes distance" section, per reading order in `page.mdx`.)

**What the figure does:** An interactive 3D word cloud. `EmbeddingsViz` wraps `EmbeddingsScene` (lazy-loaded client-only via `next/dynamic` `ssr:false`, with a "Loading 3D scene…" placeholder reserving 440px). The scene (three.js / React Three Fiber / drei) draws 16 words as labeled spheres; the user drags to orbit and scrolls to zoom (OrbitControls, pan disabled, distance 6–28), and clicks a word to select it — enlarging it, highlighting its three nearest neighbors in red, drawing lines to them, and dimming the rest. "Clear selection" resets (also clickable on empty space). Readouts show total word count (16), selected word, nearest three. No timer-driven animation.

**Real vs illustrative:** Nearest-neighbor computation is real (`nearestNeighbors` computes true Euclidean distances and sorts). The 3D coordinates are hand-placed (four clusters of four: royalty, animals, vehicles, fruit), explicitly not from any dimensionality reduction. Prose ("Why this looks too clean") and data comments flag this.

**Cross-links in prose:** none (mentions retrieval-augmented generation / language models conceptually, no topic by name).

### 09. Attention
- **slug:** `attention`
- **eyebrow/category:** Transformers (two figures, AttentionViz and QkvViz, both `eyebrow="Transformers"`)

**Prose (verbatim):**
````markdown
# Attention

To understand a sentence, a model has to figure out how the words relate. Read
the sentence "the animal didn't cross the street because it was tired." What does
"it" refer to? Almost certainly the animal, not the street, because streets do
not get tired. You resolved that by letting "it" look back at the other words and
deciding which one matters. Attention is how a transformer does the same thing.

## Every word looks at every other word

For each word, attention asks a simple question: to understand this word, how much
should I focus on each of the other words? The answer is a set of weights, one per
word, that add up to a full unit of focus. A high weight means "this other word is
important for me right now," a low weight means "I can mostly ignore it."

Crucially, every word does this for every other word, in both directions and all
at once. That is what lets a model link "it" to "animal" even though several words
sit between them. Distance in the sentence does not matter; only the learned
relationship does.

## Reading the figure

Click a word to see its attention as links to the rest of the sentence. Thicker,
brighter links mean stronger attention. Click "it" and the strongest link snaps
back to "animal," with only a faint link to "street." That is the model resolving
what "it" stands for. Try "cross" and you will see it lean on "street" and
"animal," the words that say what is being crossed and who is crossing.

The weights here are hand-set to make the lesson clear. A real model is not told
that "it" means "animal." It learns weights like these from data, and it computes
them on the fly from each word using learned query, key, and value vectors,
usually across many attention heads at once, each head watching for a different
kind of relationship.

## Why it matters

Attention is the core mechanism of the transformer, the architecture behind modern
language models. Before attention, models read text strictly in order and tended
to forget what came far earlier. Attention removed that limit: any word can draw
on any other word directly, no matter how far apart, which is what let these
models handle long passages and capture the relationships that make language mean
something.

## What the demo shows

Each point is a word of the example sentence. Drag to orbit, scroll to zoom, and
click a word to draw its attention links to the others, weighted by strength. The
"it" to "animal" link is the headline case, hand-set so the idea of attention
resolving a reference is easy to see.

## Query, key, and value

So far you have seen that words attend to each other with different strengths, but not where those strengths come from. The mechanism is query, key, and value. Each word starts with its embedding and produces three vectors from it: a Query, representing what this word is looking for, a Key, representing what it offers to other words, and a Value, the information it passes along if another word attends to it.

To decide how much one word attends to another, you compare the first word's Query against the second word's Key. A closer match produces a higher attention weight. Once a word has weights for all the words, it pulls in a blend of their Values, with strong matches contributing more and weak ones less. The query, key, and value vectors shown here are hand-authored to illustrate the idea; a real model learns them from data.
````
(The `<AttentionViz />` embed sits after "Every word looks at every other word"; the `<QkvViz />` embed is at the end after "Query, key, and value".)

**What the figure does:** Figure 1 (AttentionViz → AttentionScene) is a 3D R3F scene rendering the 10-word sentence as spheres in reading order with a deterministic 3D wobble. Drag to orbit (OrbitControls, pan off), scroll to zoom (distance 7–30), click a word to select. On selection the selected sphere grows/turns red, and every other word is scaled and color-tinted by how strongly the selected word attends to it; links draw from the selected word with thickness (`1 + wt*5`) and opacity (`0.3 + wt*0.7`) scaling with weight, skipping weights below 0.05. "Clear selection" and clicking empty space deselect. Readouts show word count (10), selected word, top-3 links. No timer — selection-driven. Figure 2 (QkvViz) is a static 2D SVG table, one row per word for a 4-word slice (animal, street, it, tired), showing each word's Query/Key/Value as three 3-cell vectors (cell opacity tracks value). Buttons pick a word (or click its row); that word's Query is dot-producted against every Key, drawing match bars + percentage weights (CSS `sweep` animation, staggered, not setInterval), with an output row showing the picked word's Value blend.

**Real vs illustrative:** Figure 1 fully illustrative — weights come from a hand-authored `WEIGHTS` table (with neighbor-based fallback for function words); link/size math is computed from those hand-set weights, flagged in prose and `tryThis`. Figure 2 has hand-authored Q/K/V vectors, but the mechanism on top is real: `matches()` does a genuine dot product Query·Key, normalizes to weights, and `output()` produces a real weight-blended Value. So bars/percentages/output are real arithmetic over illustrative inputs.

**Cross-links in prose:** none (refers to "the transformer" generically).

### 10. Transformers and Multi-Head Attention
- **slug:** `transformers`
- **eyebrow/category:** Transformers (TransformersViz → MultiHeadAttentionScene)

**Prose (verbatim):**
````markdown
# Transformers and multi-head attention

The attention topic showed a single attention pattern: each word looking at the other words and deciding which ones matter. A transformer does not run just one of these. It runs many attention patterns at the same time, called heads, and each head learns to watch a different kind of relationship.

## Many heads, one sentence

A single head produces one set of links over the sentence. With several heads, the same sentence gets several overlays at once. One head might track coreference, linking a pronoun to the noun it stands for, so "it" reaches back to "animal". Another might track position, with each word mostly looking at the word just before it. Another might track grammar, linking a verb to its subject and object. Each head sees the same words but draws a different map.

This matters because language has many kinds of structure at the same time. No single attention pattern can capture coreference, word order, and grammar together, so the model splits the work across heads and lets each specialize.

## Heads run in parallel, then layers stack

Within one layer, the heads run in parallel and their results are combined, so the model can use several relationships for the same word at once. Then transformers stack many such layers, and later layers attend over the outputs of earlier ones. Early layers tend to capture local and surface patterns, while later layers capture longer-range and more abstract structure built from what came before.

The attention topic is one head in one layer. A transformer is many heads in parallel, repeated across many layers. That combination, simple attention multiplied out and stacked, is what lets these models handle the structure of real language.

## What the demo shows

The figure reuses the attention sentence and shows three illustrative heads. Switch heads to see the link pattern change over the same words, and click a word to draw the current head's links from it, with a readout naming the head and its strongest links. The weights are hand-set to make each head's job legible; a real transformer learns them from data, and uses far more than three heads across many layers.
````

**What the figure does:** A single 3D R3F scene reusing the same 10-word sentence and layout as the attention topic. Controls are one button per head (Coreference, Previous word, Verb to arguments) plus "Clear selection." Switching heads recolors the scene and swaps in that head's weight table, changing the link pattern over the same words; clicking a word draws the current head's outgoing links (thickness `1 + wt*5`, opacity `0.3 + wt*0.7`, weights < 0.05 skipped), the selected node enlarged/tinted in the head color. Drag to orbit, scroll to zoom (7–30, pan off), click empty/Clear to deselect. Readouts name the head and its blurb, selected word, top-3 links. No timer — head-switch and selection driven.

**Real vs illustrative:** Fully illustrative — all three heads' weights are hand-authored (`COREF` and `VERB` explicit per-word tables with neighbor fallback; `ADJACENT` generated by a rule: 0.9 to previous word, 0.3 to next). Link geometry computed from those weights; data comments and `tryThis` flag it. Sentence/layout/palette imported read-only from `attentionData.js` so the two topics match.

**Cross-links in prose:** references "the attention topic" repeatedly (topic 09), as descriptive prose, not a link.

### 11. RLHF
- **slug:** `rlhf`
- **eyebrow/category:** two figures — RlhfViz `eyebrow="Alignment"`; FineTuningViz `eyebrow="Fine-tuning"`

**Prose (verbatim):**
````markdown
# RLHF

A base language model can produce fluent text, but fluency alone does not tell it which answers people actually find helpful, honest, or safe. It imitates patterns from its training data, yet it has no direct signal for human preferences. To align its behavior with what people want, you need feedback that reflects human taste.

RLHF, reinforcement learning from human feedback, adds that signal through a simple loop. Given a prompt, the model generates several candidate responses. Humans compare them and choose which is better. Those comparisons become training data that pushes the model toward responses people prefer.

The preference has to become something a model can optimize. First, the human comparisons train a separate reward model: it takes a prompt and a response and outputs a score predicting how a human would rank it. Then the language model is fine-tuned to produce responses that score well under that reward model. The reward model stands in for the human during training, so a person does not have to judge every new output.

Over many rounds, behavior shifts. The model produces more of the traits that win comparisons, like being clearer, more on topic, and more careful, and less of the traits that lose, like being evasive, unsafe, or misleading.

The figure below is a simplified stand-in. It uses a few hidden trait scores (helpful, honest, concise, and enthusiastic) and a small preference rule, not a real language model, but the loop is the real idea: generate, compare, learn the preference, shift behavior. Pick the better response each round and watch the model's preference move.

## Fine-tuning, more generally

RLHF is one example of a broader technique called fine-tuning. Fine-tuning takes a model that has already been trained on a huge, general corpus and trains it a little further on a smaller, specialized dataset. The goal is to shift the model's behavior toward a particular style, domain, or set of preferences, without starting over from scratch.

The starting point is what makes this work. The base model already knows grammar, facts, and how to follow instructions from its original training. Fine-tuning does not rebuild any of that; it nudges the model on top of what it already knows, which is why it needs far less data and compute than training a model from the beginning. RLHF fits this pattern exactly: the specialized dataset is human preference comparisons, and the further training pushes the model toward responses people prefer.

A common use of fine-tuning is teaching a general assistant a specific domain, like a company's support style. You collect a small set of example questions and good answers, then train on them. Afterward the model answers domain questions in the specialized way, while keeping its general knowledge intact. Done carefully, specializing behavior does not erase what the base model already knew.

The figure below shows this general idea. A base model answers some prompts generically. Run fine-tuning on a small labeled domain dataset and watch the domain answers specialize, while a couple of general-knowledge answers stay the same. As before, the responses are hand-authored to illustrate the behavior, not produced by real training.
````
(The `<RlhfViz />` embed sits after the first block; `<FineTuningViz />` after the "Fine-tuning, more generally" block.)

**What the figure does:** Figure 1 — RlhfViz (eyebrow "Alignment") shows a prompt and up to three candidate responses (each labeled by dominant trait: helpful/honest/concise/enthusiastic). Clicking the preferred one calls `updateWeights`, nudging a 4-trait preference-weight vector, and a diverging SVG meter animates each trait left/right via CSS transitions (no timer for the meter). After a pick a 750ms `setTimeout` acknowledgement beat precedes `makeRound` generating the next prompt/candidates, biased toward high-weight traits. Controls: "Skip prompt", "Reset"; readouts show round, feedback given, "leaning toward" top trait. Figure 2 — FineTuningViz (eyebrow "Fine-tuning") is a three-phase demo (base → tuning → tuned): "Fine-tune on domain data" starts a `setInterval` (TICK_MS = 90ms, STEP = 0.05/tick) filling a progress arrow; as progress crosses each domain prompt's `tuneAt`, its answer flips generic→specialized (staggered, anime.js flourish); two general prompts keep their answer with a "retained" badge, domain prompts get "specialized". Readouts show model state, examples trained on, domain-answer state; "Reset" returns to base.

**Real vs illustrative:** Both explicitly illustrative — no model runs. RlhfViz: trait weights, seeded candidate generation (`mulberry32`), and the update rule (`updateWeights`: LR 0.25, clamp [-1,1]) are real from code, but candidate texts are hand-authored templates (`rlhfData.js`), standing in for a real reward model + RL. FineTuningViz: progress/phase logic real, but all before/after answers and dataset hand-authored (`fineTuningData.js`); caption states no real model is trained.

**Cross-links in prose:** none (page prose names no other topic).

### 12. Temperature and Sampling
- **slug:** `temperature`
- **eyebrow/category:** Language models

**Prose (verbatim):**
````markdown
# Temperature and sampling

At each step, a language model does not output one definite next word. It outputs a probability for every possible next token in its vocabulary, a whole distribution of options. For "The cat sat on the ___", the model might give "mat" a high probability, "chair" a lower one, and "moon" a very low one. The model is telling you what it thinks is likely next, not making the choice yet.

To actually produce text, you pick from that distribution. This is sampling. One extreme is to always take the single most likely token. That stays reliable and on track, but it can become repetitive and flat, because the model keeps choosing the safest continuation. Allowing occasional lower-probability choices makes the output feel more varied and natural.

Temperature is a single knob applied before sampling that reshapes the distribution. Low temperature sharpens it: the top option dominates and the model becomes predictable and focused. Near zero it is almost deterministic, the best token wins nearly every time. High temperature flattens the distribution, so unlikely tokens get a real chance. That can make output more creative and surprising, but also more error-prone and sometimes incoherent.

There is no one correct setting. For factual answers, careful reasoning, or code, you usually want a low temperature for reliability. For brainstorming, story writing, or generating alternatives, a higher temperature helps.

The figure below uses a small fixed set of candidate words with hand-authored probabilities to show the idea, not a real model predicting. The temperature math reshaping the distribution is the real formula models use.
````

**What the figure does:** Shows the fixed context "The cat sat on the ___" and an SVG bar chart of five candidate next-words (mat, floor, chair, roof, moon). A temperature slider (0.1–2.0, step 0.05) recomputes the distribution live via `probsAt` (a real softmax over hand-authored logits divided by temperature); bars re-scale with a CSS width transition; the top word is highlighted. Readouts show temperature, top word with percentage, entropy in bits. "Sample a word" draws from the current distribution using a seeded PRNG (`mulberry32(1)`), prepending to a recent-history list (cap 12); "Reset" reseeds and clears. No timer loop.

**Real vs illustrative:** Candidate words and base logits are hand-authored (`temperatureData.js`), not a real model. But the reshaping math is real: `probsAt` is numerically-stable softmax-with-temperature, `entropy` computes true Shannon entropy in bits, `sampleWith` does real inverse-CDF sampling. Note and `tryThis` flag that only the candidate scores are illustrative.

**Cross-links in prose:** none.

### 13. RAG (Retrieval-Augmented Generation)
- **slug:** `rag`
- **eyebrow/category:** Retrieval

**Prose (verbatim):**
````markdown
# RAG (retrieval-augmented generation)

A language model only knows patterns from its training data. It does not automatically know your private documents, fresh information after its training cutoff, or niche details that were not well covered during training. When asked about something outside what it knows, it may still produce a fluent answer that sounds confident while being wrong. This is called hallucination.

RAG, retrieval-augmented generation, adds a retrieval step before the model answers. Instead of answering from memory alone, the system first retrieves relevant documents and gives them to the model as context. The model can then answer from real, specific, current sources rather than guessing from training patterns.

The pipeline has three steps. First, Retrieve: find the document chunks most relevant to the question. Second, Augment: insert those chunks into the prompt alongside the question. Third, Generate: the model writes an answer grounded in the provided chunks.

Retrieval usually uses embeddings. The question is turned into an embedding, and each document chunk has one too. The system finds the chunks whose embeddings are closest to the question's. Closeness means relevance, the same similarity idea from the embeddings topic: nearby vectors usually mean related meaning.

RAG matters because it lets a model answer about things it was never trained on, like private data or recent information. It also reduces hallucination, because the answer is grounded in retrieved text rather than guessed from memory. And you can update what the system knows by changing the documents, with no retraining.

The figure below uses a small hand-authored knowledge base and illustrative similarity scores, not real embeddings or a real model, but the retrieve, augment, generate pipeline is the real architecture.
````

**What the figure does:** The user picks one of four questions about the fictional company "Nimbus Robotics" (one flagged "not in training"), then advances a stepper through three stages: Retrieve → Augment → Generate (an SVG pipeline indicator lights the current stage; "Reset" returns to 0). Stepping is manual click, not timer-driven. Retrieve sorts the 6-chunk knowledge base by each chunk's per-query similarity, shows score bars/numbers, highlights the top-2 ("retrieved") and dims the rest. Augment reveals the assembled prompt (retrieved context + question) with an anime.js slide-in. Generate shows two answer cards: "Without RAG" (from memory, with a failure badge) vs "With RAG" (grounded). Readouts show KB chunk count, retrieved top-k, grounded yes/no.

**Real vs illustrative:** Knowledge base, per-query similarity scores, and both answers are hand-authored (`ragData.js`), not from real embeddings/model — the KB is a fictional company by design. What is real: `ranked` sorts chunks by score and `retrievedIds` selects the top-K (TOP_K = 2), so retrieval/ordering is computed. Caption and `tryThis` flag that only scores/answers are illustrative.

**Cross-links in prose:** Embeddings ("the same similarity idea from the embeddings topic").

---

## Algorithms and Data Structures

### 14. Big-O and Time Complexity
- **slug:** `big-o`
- **eyebrow/category:** Complexity

**Prose (verbatim):**
````markdown
# Big-O and time complexity

Timing one run of a program can be useful, but it does not answer the bigger question. A result from one computer, one language, one compiler, and one input might not hold somewhere else. To compare algorithms fairly, we need a way to talk about how their work grows as the input grows, without tying the answer to a stopwatch.

Big-O is that tool. It describes the shape of growth as input size n gets larger. It ignores constant factors, small setup costs, and hardware speed. The point is not how many seconds one run takes. The point is what happens to the amount of work when the input gets bigger.

Some algorithms are constant time: they do about the same work no matter how much data exists, like looking up a value directly. Logarithmic time grows slowly by cutting the search space down again and again, the way a binary search halves a sorted list. Linear time grows in step with the input, like scanning each item once.

Linearithmic time, often written n log n, shows up in many good sorting algorithms such as merge sort. It grows faster than a single scan, but much better than comparing everything with everything. Quadratic time is the classic nested-loop shape, where each item is checked against many others. Exponential time grows much faster, often from naive recursion that keeps solving the same subproblems again and again.

These shapes may look close on small inputs, but they separate dramatically as n grows. An algorithm that feels fine on a tiny example can become hopeless on a large real dataset. Slide the input size in the figure and watch the gap open up.

Big-O usually describes the worst case. Best case and average case can be different, so the full story sometimes needs more than one label.

The figure's operation counts and the curve are exact for every class. The exponential lane uses the real number of calls a naive recursive Fibonacci makes, which is why pushing the input far enough sends it past the age of the universe. Only the race speed is set for watchability rather than any real processor, and the wall-clock times assume a fixed rate of two billion operations per second to make the differences tangible. The relative gaps are real.
````

**What the figure does:** A slider sets input size n (1–120), driving three synchronized parts: a "race" of six complexity-class lanes (O(1), O(log n), O(n), O(n log n), O(n^2), O(2^n), each labeled with a sample algorithm), a wall-clock time grid at the current n, and a log-scale curve chart with a dashed marker at n. "Start race" runs a timer-driven animation (`setInterval` at 40ms): each lane fills at a rate pinned so the O(n) reference lane finishes in 2500ms, so slow lanes visibly never catch up. Readouts show `n` and the O(2^n) wall-clock time at that n (formatted up to "> age of universe"). Changing the slider resets the race.

**Real vs illustrative:** Operation counts and the curve are computed exactly per class; the O(2^n) lane uses the true naive-Fibonacci call count `2*Fib(n+1) - 1`. Illustrative choices flagged in code and prose: the race fill speed is set for watchability, and wall-clock times assume a fixed 2 billion ops/sec (`OPS_PER_SECOND = 2e9`).

**Cross-links in prose:** names binary search, merge sort, and naive recursive Fibonacci as class exemplars; no other topic named directly.

### 15. Binary Search
- **slug:** `binary-search`
- **eyebrow/category:** Searching

**Prose (verbatim):**
````markdown
# Binary search

Binary search works when the collection is sorted. That one requirement matters. The values have to be in order, like names alphabetically or numbers from smallest to largest. The ordering is what lets the algorithm rule out large chunks at once instead of checking items one by one.

The core move is simple: check the middle item. If the middle item is the target, the search is done. If the target is smaller than the middle item, then everything above the middle is too large, so the whole upper half can be ignored. If the target is larger, then everything below the middle is too small, so the whole lower half can be ignored. Either way, one comparison eliminates half of what is left.

That is why binary search is so powerful. Halving again and again makes the work grow very slowly as the data grows. Doubling the amount of data adds only one more step to the search. Compare that with scanning from the start, where a bigger collection means more items to check one after another. If the data is unsorted, you are usually stuck with that kind of scan because there is no order you can use to safely skip ahead.

The caveat is that binary search gets its speed from sorted data. Sorting data takes work, and keeping data sorted as it changes can also cost time. Binary search shines when the same sorted data will be searched many times, so the sorting cost pays off across repeated lookups.

This is the same logarithmic growth shown as the O(log n) lane in the Big-O figure, now shown step by step.

Pick a target in the figure and step through the search. Watch the middle item move, the search range shrink, and the number of comparisons update as each half is discarded.

The search in the figure runs for real and the comparison counts are exact. The input is kept small so the steps are easy to follow, while real datasets are far larger.
````

**What the figure does:** A fixed sorted array of 15 values is shown as cells. Clicking any cell picks it as the target (or a button searches a missing value, 50). "Step" performs one real comparison of the middle of the active lo–hi range; "Play" auto-advances via `setInterval` (850ms) until the search finishes. Pointers mark lo, hi, mid; eliminated cells grey out; the found cell turns green. Readouts show the target, the live binary-search comparison count, and the linear-scan count (the target's position) for contrast.

**Real vs illustrative:** Fully real — lo, hi, and comparison counts are computed live by a pure step function on the fixed deterministic array; the linear-scan number is the target's actual position. Only illustrative choice is the small array size, flagged as kept small.

**Cross-links in prose:** Big-O ("the O(log n) lane in the Big-O figure").

### 16. Recursion and the Call Stack
- **slug:** `recursion`
- **eyebrow/category:** Recursion

**Prose (verbatim):**
````markdown
# Recursion and the call stack

Recursion is when a function solves a problem by calling itself on a smaller version of the same problem. It keeps doing that until it reaches a case small enough to solve directly. That stopping point is called the base case. Without a base case, the function would keep calling itself forever.

Each recursive call has to remember its own place. The computer does this with the call stack. When a function calls itself, the computer saves where that call was, what values it was using, and what still needs to happen after the smaller problem finishes. Those saved calls stack up on top of each other. When the smallest call finishes, the computer pops back to the previous call, then the one before that, until it returns to the original problem.

Towers of Hanoi is a classic recursion example. The goal is to move a tower of disks from one peg to another, while never putting a bigger disk on top of a smaller one. The trick is that moving a tall tower has the same shape as moving a slightly shorter tower: move the smaller tower out of the way, move the largest disk, then move the smaller tower back on top. The same plan repeats inside itself, which makes the puzzle a natural fit for recursion.

The stack matters because every unfinished call takes space. Deeper recursion means a taller stack, and that memory is not free. For small problems this is fine, but very deep recursion can use a lot of memory. The work can also grow quickly as the problem gets bigger. Increase the disk count in the figure and watch the stack grow, the calls unfold, and the move count change.

The figure solves the puzzle for real and the move and stack numbers are exact. The disk count is kept small so the stack stays easy to follow.
````

**What the figure does:** Renders a Towers of Hanoi board (three pegs) plus a `CallStackPanel` on the right. A slider sets the disk count (3–6). "Step" advances one move; "Play" auto-advances via `setInterval` (700ms); "Reset" returns to start. The real recursive solver is instrumented to record the stack of active `hanoi` frames at each move, which the shared `CallStackPanel.jsx` renders top-frame-first, growing and shrinking as the recursion descends and returns. Readouts show stack depth, total moves (exactly 2^disks − 1), moves made.

**Real vs illustrative:** Fully real — the solve, move sequence, stack snapshots, and total (2^disks − 1) are computed from the actual recursive algorithm. Only the small disk range is a clarity choice. Uses the shared `CallStackPanel.jsx`, whose header comment flags reuse by the Dynamic Programming topic.

**Cross-links in prose:** none (Towers of Hanoi described, no other topic named).

### 17. Sorting
- **slug:** `sorting`
- **eyebrow/category:** Sorting

**Prose (verbatim):**
````markdown
# Sorting

Sorting means putting data into order: numbers from small to large, names alphabetically, dates from earlier to later. Ordered data is easier to work with. It is the basis for many other tasks, including fast searching. There are many ways to sort, and they do not all scale the same way.

Bubble sort is one of the simplest methods to understand. It repeatedly compares neighboring items and swaps them if they are out of order. After one pass, it starts another pass, then another, until it can pass over the list without making any swaps. The idea is clear, but it is slow because the number of comparisons grows with the square of the list size. As the list grows, the work grows much faster than the input.

Insertion sort builds a sorted section one item at a time. It takes the next item from the unsorted part and slides it backward into the correct place among the items already sorted. Like bubble sort, it is in the slower group for large random lists. But it can do very well when the data is already close to sorted, because most items do not need to move far. That is an important lesson: two algorithms in the same broad speed class can still behave differently on real inputs.

Merge sort uses a different strategy. It splits the list in half, sorts each half, then merges the two sorted halves back together. The halves are sorted the same way, by splitting again and again until the pieces are simple to combine. This is recursion, the same idea from the recursion topic: solve a problem by solving smaller versions of itself. Because merge sort keeps splitting the work, it is much faster on large lists than the simple methods.

On a small list, the methods may look close. As the list gets bigger, the gap opens quickly. Bubble sort is the quadratic case from Big-O, while merge sort is the n log n case shown earlier. Run two sorts on the same array in the figure and compare the counts.

Every sort in the figure is a real implementation and the counts are exact. The array is kept small so the steps are easy to watch, while real datasets are far larger.
````

**What the figure does:** A toggle selects one of three real, instrumented sorts (Bubble, Insertion, Merge), each running on the same fixed 14-element array drawn as bars. "Step" advances one operation-frame; "Play" auto-advances via `setInterval` (120ms); "Reset" snapshots the current run into a "Last run" memory line so two algorithms can be compared side by side. Compared/written bars light red, settled regions turn green, merge shows a highlighted merge band. Readouts show live comparisons, a secondary counter (swaps/moves), step position.

**Real vs illustrative:** Fully real — all three are genuine implementations on one hardcoded deterministic permutation, with comparison and swap/move counters accumulated live. Only the small array size is a clarity choice.

**Cross-links in prose:** Recursion ("the same idea from the recursion topic") and Big-O ("the quadratic case from Big-O", "the n log n case shown earlier").

### 18. Linked List vs Array
- **slug:** `linked-list-vs-array`
- **eyebrow/category:** Data structures

**Prose (verbatim):**
````markdown
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
````

**What the figure does:** Shows an array row above a linked-list row, both holding the same fixed 7-value set. Operation buttons select Insert at front, Insert in middle, Delete, or Access by index (Access reveals index buttons 0–6). "Step" advances one unit of real work; "Play" auto-advances via `setInterval` (650ms). Array snapshots physically shift elements between slots; list snapshots walk a cursor and rewire pointers, with new/deleted nodes drawn above/below the row. Readouts show array shifts, list nodes walked, list pointers rewritten.

**Real vs illustrative:** Real counts — array shifts are elements actually moved; list numbers are nodes actually walked plus pointers actually rewritten, all on the identical fixed value set. Only the small structure size is a clarity choice.

**Cross-links in prose:** none.

### 19. Hash Tables
- **slug:** `hash-tables`
- **eyebrow/category:** Data structures

**Prose (verbatim):**
````markdown
# Hash tables

A hash table solves a common problem: you want to store items and find them again fast, using a key. The key might be a username, an email address, or an ID. Without a hash table, you might have to scan through many items until you find the one you want. A hash table is built to avoid that scan and give near-instant lookup by key.

The trick is a hash function. A hash function takes a key and turns it into a number. That number is used to choose a slot in the table, usually called a bucket. When you store an item, the key decides which bucket it goes in. When you want to find it later, you run the same hash function on the same key, get the same bucket, and look there. The table does not need to search from the beginning.

This is why hash table lookup is the constant-time case. In the usual case, it goes more or less straight to the right bucket no matter how many items are stored. This is the O(1) lane from the Big-O figure, now shown as a real data structure.

There is one catch: different keys can hash to the same bucket. This is called a collision. Collisions are normal, and once there are more possible keys than buckets, they are unavoidable. One common fix is chaining. Each bucket holds a small list, and keys that collide are added to that list. The figure uses chaining, so you can see colliding keys stack up in the same bucket. Another approach, called open addressing, puts a collided key into a different open bucket instead.

As the table fills up, collisions become more likely. The load factor describes how full the table is. When the load factor rises, chains tend to get longer, and lookup slows down because the table has to walk through the chain inside a bucket. Keeping the table from getting too full is how hash tables stay fast. Add a few keys in the figure and watch where they land, then compare the load-factor and chain readouts.

The same basic idea, using a hash to decide where something goes, also scales up to spreading data across many servers.

The hash function in the figure is a simple teaching example: it just adds up the character codes of the key and wraps that around the table size. Real hash functions are far more complex and are designed to scatter keys much more evenly than this one does. The placement, collisions, and load factor shown are all computed for real from that simple hash; the table is kept small so collisions are easy to see.
````

**What the figure does:** A 7-bucket table (`SIZE = 7`). Users add keys via preset buttons (nine three-letter words) or a free-text input. Each added key is hashed by a teaching hash (sum of character codes mod 7); a formula line shows the character-code breakdown, sum, mod, and resulting bucket. Colliding keys chain vertically under their bucket, newest highlighted red. "Reset" clears. Readouts show load factor (`count / 7`), collision count, longest chain, all derived live from state. No timer-driven stepping — state changes only on user add/reset.

**Real vs illustrative:** Placement, collisions, and load factor are computed for real, but the hash function itself is explicitly an illustrative teaching hash (character-code sum mod table size), flagged in prose and caption as far simpler than real hash functions. Table size kept small.

**Cross-links in prose:** Big-O ("the O(1) lane from the Big-O figure"); alludes to distributed data without naming a topic.

### 20. Binary Search Trees
- **slug:** `binary-search-trees`
- **eyebrow/category:** Trees

**Prose (verbatim):**
````markdown
# Binary search trees

A binary search tree is a tree made of nodes. Each node stores a value and can have up to two children: one on the left and one on the right. The values follow a simple rule. For any node, smaller values go to the left, and larger values go to the right. That ordering rule is what makes it a search tree.

To find a value, you start at the top, called the root, and compare. If the value you want is smaller than the current node, you move left. If it is larger, you move right. Each choice lets you ignore the whole other side of the tree. In the good case, this makes search fast because the search space keeps shrinking. This is the same halving idea as binary search, but built into the shape of the data instead of done on a sorted array.

Insertion follows the same path. To add a value, you start at the root and walk downward using the smaller-left, larger-right rule. When you reach an empty spot where the value should go, you place the new node there. The tree grows one node at a time, and each inserted value helps decide the final shape.

The catch is the important part: a binary search tree is only fast when it stays short and bushy. The order you insert values in decides the shape. If values arrive in already sorted order, each new value keeps going to the same side, because it is larger than everything before it. The tree collapses into a single long line. At that point, searching the tree is no better than walking through a linked list one item at a time. In Big-O terms, a balanced tree gives the fast logarithmic case, while a collapsed line gives the slow worst case.

Real systems often use self-balancing trees that rearrange themselves as values are inserted or removed. The goal is to keep the tree short, even when the input order would otherwise make it lopsided.

Insert values in the figure and watch the tree take shape. Try the balanced preset and the sorted-order preset, then compare the tree height each one produces.

The tree, the search and insert paths, and the height and comparison counts in the figure are all real and computed from the actual tree. The tree is kept small so its shape is easy to see.
````

**What the figure does:** Starts empty. Two preset buttons load either a balanced insert order `[4,2,6,1,3,5,7]` (short tree) or a degenerate sorted order `[1..7]` (collapses to a line). A number input plus Insert/Search buttons run real BST operations, animating the walk down the comparison path via `setInterval` (480ms) — current node red, visited tinted, found/inserted green (insert shows a dashed pending node until placed). "Reset" clears. Readouts show tree height, node count, comparisons on the last walk, all computed from the actual tree.

**Real vs illustrative:** Fully real — insert/search paths, tree layout (in-order rank columns by depth), height, node count, and comparison counts are computed from the genuine immutable BST. Only the small tree size is a clarity choice.

**Cross-links in prose:** Binary search ("the same halving idea as binary search"), Linked list vs array ("no better than walking through a linked list one item at a time"), Big-O ("In Big-O terms... the slow worst case").

### 21. Graph Traversal (BFS and DFS)
- **slug:** `graph-traversal`
- **eyebrow/category:** Graphs

**Prose (verbatim):**
````markdown
# Graph traversal

A graph is a set of nodes connected by edges. The nodes are the things, and the edges are the relationships between them. Road maps are graphs, with places connected by roads. Social networks are graphs, with people connected by friendships or follows. Web pages form a graph too, with pages connected by links. Traversal means visiting the nodes in some order, starting from one node and following edges outward.

The two classic traversal methods are breadth-first search and depth-first search. Breadth-first search, or BFS, spreads out in layers. It visits everything one step away from the start first, then everything two steps away, then keeps moving outward. It is like exploring a neighborhood by checking all nearby streets before going farther away.

Depth-first search, or DFS, behaves differently. It follows one path as far as it can go, then backs up and tries another path. Instead of spreading out evenly, it plunges deep first. It is like walking through a maze by choosing a hallway and following it until you hit a dead end, then returning to the last choice point.

The clean punchline is that BFS and DFS are almost the same idea with one key swap: the data structure that holds the nodes waiting to be visited. BFS uses a queue. A queue gives back the oldest waiting node first, so BFS finishes a whole layer before moving on. DFS uses a stack. A stack gives back the newest waiting node first, so DFS keeps diving down the most recent path. Same graph, same starting point, two different orders, and the main thing that changed is queue versus stack. Watch the side panel in the figure to see that waiting structure drive the traversal.

BFS is useful when you want the path with the fewest steps from the start, such as a shortest-hop route through an unweighted network. DFS is useful when you want to explore possibilities deeply, such as searching a maze, walking every branch, or checking whether something is reachable.

When edges carry weights, like distances or costs, finding the cheapest path needs a smarter method, which is the next topic.

The figure runs real breadth-first and depth-first traversals on the same small graph, and the queue and stack shown are the real structures driving each one. The graph is kept small so the order is easy to follow.
````

**What the figure does:** A BFS/DFS toggle plus click-to-choose start node run a real traversal over the shared 8-node graph from `graphData.js`. "Step" advances one visit; "Play" auto-advances via `setInterval` (700ms); "Reset" returns to start. Visited nodes fill with their visit-order number (green/red for current), frontier nodes are amber, and a side panel shows the actual frontier as a Queue (FIFO, front tagged) for BFS or Stack (LIFO, top tagged) for DFS. Readouts show algorithm, step/total, frontier size.

**Real vs illustrative:** Fully real — both traversals share one loop differing only in queue-shift vs stack-pop, over the fixed shared graph with alphabetically-ordered adjacency, so order is deterministic; the panel shows the actual frontier. Only the small graph is a clarity choice.

**Cross-links in prose:** points forward to Dijkstra ("which is the next topic") without naming it. Shares `graphData.js` with Dijkstra.

### 22. Dijkstra's Shortest Path
- **slug:** `dijkstra`
- **eyebrow/category:** Graphs

**Prose (verbatim):**
````markdown
# Dijkstra's shortest path

In the previous topic, a graph edge was just a connection. The shortest path meant the path with the fewest hops. That works for some problems, but real connections often have costs. Roads have distances. Networks have delays. Routes have prices. In those cases, the shortest path means the cheapest total cost, not the fewest steps. A path with fewer hops can still be more expensive than a path with more hops.

Plain breadth-first search is not enough for this job. BFS counts how many edges you cross. It does not add up the cost written on each edge. If every edge costs the same, that is fine. Once edges have different weights, BFS can choose a route that looks short by step count but is not actually cheapest. We need a method that tracks total cost.

Dijkstra's algorithm does that by keeping a running best-known distance from the start to every node. At the beginning, the start node has distance zero, because you are already there. Every other node is unknown. The algorithm then repeats a careful process: pick the closest node whose distance is not final yet, lock in that distance, and check its neighbors.

Checking a neighbor means asking, "Would it be cheaper to reach this neighbor by going through the node I just locked in?" If the answer is yes, update the neighbor's best-known distance. If not, leave it alone. Over time, more nodes get updated, then locked in, until every reachable node has its final cheapest distance from the start.

The key idea is the order. Dijkstra always locks in the closest remaining node first. Because of that, once a node is locked in, there is no cheaper path to it hiding somewhere else. Any other route would have to pass through a node that is at least as far away already, so it cannot improve the locked result. That is what makes the final distances trustworthy.

This trust depends on one rule: edge weights cannot be negative. If an edge could have a negative cost, a path through a node that looks farther away might still come out cheaper later, and the lock-in step would no longer be safe. Graphs with negative weights need a different algorithm.

Pick a start in the figure and step through it. Watch the distances settle from nearest outward as nodes get locked in, then pick any destination to light up the cheapest path to it.

This is the same graph idea from the traversal topic, now with weights. The cheapest path is something the earlier fewest-hops methods could not find.

The figure runs a real Dijkstra on the small weighted graph, and every distance and the final path are computed for real. The graph is kept small so the steps are easy to follow.
````

**What the figure does:** Source-node buttons plus the same shared 8-node graph (now showing edge weights) run a real Dijkstra. "Step" emits one action-frame — finalize the nearest unfinalized node, then relax each of its unfinalized edges one at a time — with a per-frame status note; "Play" auto-advances via `setInterval` (650ms); "Reset" clears. Node fills show state (source/current red, finalized teal, reachable amber), each node displays its tentative distance (∞ until relaxed), and the relaxed edge flashes red. Once all nodes are finalized, clicking any node traces its shortest path back to the source in green. Readouts show source, finalized count, path cost.

**Real vs illustrative:** Fully real — tentative distances, finalized set, predecessor map, and final path are computed by a genuine Dijkstra over the shared weighted graph with deterministic alphabetical tie-breaking. Only the small graph is a clarity choice.

**Cross-links in prose:** Graph Traversal / BFS ("In the previous topic...", "the same graph idea from the traversal topic"). Shares `graphData.js` with Graph Traversal (weighted adjacency rebuilt locally from the same `EDGES`).

### 23. Dynamic Programming
- **slug:** `dynamic-programming`
- **eyebrow/category:** Optimization

**Prose (verbatim):**
````markdown
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
````

**What the figure does:** A Naive/Memoized toggle plus an n slider (4–7) draw the real Fibonacci call tree for fib(n). "Step" reveals calls one at a time in pre-order; "Play" auto-advances via `setInterval` (320ms); "Reset" clears. Each node is one `fib(k)` call, colored by k so repeated subproblems share a pastel; in memoized mode, cache-hit nodes are drawn as dashed leaves that never expand. Readouts show naive call count, memoized call count, and the actual fib(n) value.

**Real vs illustrative:** Fully real — both call trees are built by genuine recursion; each tree's node count is the true number of `fib()` calls that implementation makes, and fib(n) is computed iteratively. The memoized-calls readout counts both real computations (solid nodes) and cache-hit lookups (dashed nodes). Only the small n cap is a clarity choice; the caption notes the blow-up is real. This viz builds its own tree layout and does not import `CallStackPanel.jsx`.

**Cross-links in prose:** Recursion ("the same recursive call structure from the recursion topic") and Big-O ("the same exponential growth shown as the worst case in the Big-O topic").

---

## Databases and SQL

### 24. Tables and the Relational Model
- **slug:** `relational-model`
- **eyebrow/category:** Data model

**Prose (verbatim):**
````markdown
# Tables and the relational model

A database table stores data in rows and columns, like a spreadsheet. Each row is one record, such as one user or one session. Each column is a field on that record, such as `country` or `plan`. A table is useful because you can add many rows of the same shape and reliably refer to the same column across all of them.

The relational model is the idea that you should not cram everything into one giant table. Instead, you split data into focused tables that each describe one kind of thing. A `users` table holds one row per user. A `sessions` table holds one row per session. This avoids repeating a user's details on every session row. If a user's `country` changes, you update it once in `users`, not across all their session records.

Keys are how tables connect. A primary key uniquely identifies each row in a table. For example, `user_id` is the primary key of `users`, and `session_id` is the primary key of `sessions`. A foreign key is a column in one table that points to a primary key in another. Here, `sessions.user_id` is a foreign key pointing to `users.user_id`. That link is what makes the data relational: it encodes "this session belongs to this user."

The payoff is that splitting data keeps it clean and free of repetition, but it also means the information you need is spread across tables. To answer a question like "show each session with the user's country," you have to recombine rows using the keys. That recombination is exactly what a join does, and it is why joins exist.
````

**What the figure does:** Renders a `users` table and a `sessions` table side by side, with PK/FK badges on the header cells (PK green, FK red). The user hovers a row (previews the relationship) or clicks a row (pins it); one account (user 31) is pinned by default. The active user's row and its linked session rows highlight, with red connector lines from the user to each matching session. Readouts show the selected `users.user_id`, the count of linked sessions, and the foreign key `sessions.user_id`. No timer-driven stepping — hover/click driven.

**Real vs illustrative:** The linking and highlighting are computed for real from the shared dataset (matching `sessions.user_id` to the active `users.user_id`); the small fixed table slice is illustrative.

**Cross-links in prose:** Joins (referred to as "a join").

### 25. SELECT, WHERE and CASE
- **slug:** `select-where-case`
- **eyebrow/category:** Filtering

**Prose (verbatim):**
````markdown
# SELECT, WHERE and CASE

`SELECT`, `WHERE`, and `CASE` are the basic tools for asking a database a question and shaping the answer.

`SELECT` chooses which columns you get back. Write `SELECT *` and you get every column; name columns, like `SELECT country, plan`, and you get only those. `SELECT` controls the shape of the result, not which rows are included.

`WHERE` filters which rows you get back. It keeps only rows that meet a condition and drops the rest. For example, `WHERE plan = 'pro'` keeps only paid users, and `WHERE country = 'US'` keeps only users in the US. This is the key split: `SELECT` picks columns, `WHERE` picks rows.

`CASE` creates a new derived column by labeling or bucketing rows with conditions. The pattern is `CASE WHEN ... THEN ... ELSE ... END`. For example, you can compute a label called `tier`: return `'paid'` when `plan = 'pro'`, otherwise `'free'`. Or you can bucket a number into `'low'`, `'medium'`, or `'high'`. `CASE` does not change the stored data; it computes a value on the fly for the result.

These three show up in everyday SQL. Most queries start by choosing columns with `SELECT`, filtering rows with `WHERE`, and sometimes adding a `CASE` label, before any joining or grouping happens.
````

**What the figure does:** Shows a users table whose displayed columns, filtered rows, and optional derived `tier` column update from three controls. The user ticks/unticks column checkboxes for `country`, `plan`, `signup_date` (SELECT; `user_id` always on, disabled), picks a condition from a WHERE dropdown (non-matching rows fade), and toggles a CASE button that adds a `tier` column bucketing rows into paid/free and coloring them. Readouts show visible column count, "rows kept X of N", case on/off; a live SQL block rebuilds to match. No timer-driven animation.

**Real vs illustrative:** Column selection, the WHERE row filtering (`where.test(r)`), the CASE tier computation, and the generated SQL are all computed for real from the fixed dataset; the data itself is illustrative.

**Cross-links in prose:** none (mentions "joining or grouping" generically).

### 26. Joins
- **slug:** `joins`
- **eyebrow/category:** Joining

**Prose (verbatim):**
````markdown
# Joins

Relational data is split across tables on purpose. Facts about people live in a
users table, and facts about what they did live in a sessions table, linked by a
shared key like user_id. A join is how you put them back together: it matches rows
from one table to rows in another using that key, so you can ask questions that
span both, like "show each user alongside their sessions."

## Matching on a key

A join compares a key column in the left table to a key column in the right table
and pairs up the rows where they are equal. In the figure, users and sessions are
joined on user_id. Each red line is a match: a user whose id appears in a session.
The result table below stitches each matched pair into a single wider row.

The interesting part is what happens to rows that do not match, and that is exactly
what the join type controls.

## The four join types

An INNER JOIN keeps only rows that match on both sides. A user with no session
disappears, and so does a session whose user is missing. It is the strictest join
and returns the fewest rows.

The outer joins keep unmatched rows instead of dropping them, filling the missing
side with NULL, which is SQL's marker for "no value here." A LEFT JOIN keeps every
row from the left table, so every user appears even if they have no session. A
RIGHT JOIN keeps every row from the right table, so every session appears even if
its user is missing. A FULL JOIN keeps unmatched rows from both sides at once.

## Reading the row count

Switch the join type and watch the count. With one unmatched user and one
unmatched session, INNER returns the fewest rows, LEFT and RIGHT each add back the
unmatched rows from their side, and FULL adds back both. That is the practical
lesson: the join type decides whether unmatched rows are dropped or kept as NULLs,
and that directly changes how many rows you get. Picking the wrong one is a common
way to silently lose or duplicate data.

## What the demo shows

The two tables at the top are a small slice of the shared dataset: a few users and
a few sessions, joined on user_id. Red lines connect the matching rows. The toggle
chooses the join type, the result table below rebuilds to match, NULLs fill the
columns from the missing side on outer joins, and the SQL for the current join is
shown underneath. The readouts give the row count for all four join types so you
can compare them at a glance.
````
(The `<JoinsViz />` embed sits between the "Matching on a key" and "The four join types" sections.)

**What the figure does:** Displays a `users (u)` table and a `sessions (s)` table with red connector lines between matching `user_id` pairs, plus a result table below. The user toggles among the four join types (INNER/LEFT/RIGHT/FULL); the result table rebuilds, filling the missing side with italic red `NULL` cells on outer joins, and the SQL for the current join appears below. Readouts show the row count for all four join types simultaneously, plus a status line for the current join. Not timer-driven — toggle-driven.

**Real vs illustrative:** The join computation (`computeJoin`), resulting rows/NULLs, and the four per-type row counts are computed for real from a small fixed slice; the SQL strings are hard-coded per join type.

**Cross-links in prose:** none by topic name (references the relational split generically).

### 27. GROUP BY and Aggregation
- **slug:** `group-by`
- **eyebrow/category:** Aggregation

**Prose (verbatim):**
````markdown
# GROUP BY and aggregation

`GROUP BY` is how SQL turns detailed rows into summaries. It collapses many rows into one summary row per group. You choose a grouping column, like `country` or `plan`, and every row with the same value is treated as one group. The result shows one row per group, not the original rows. This is the opposite of window functions, which compute across related rows but keep every original row. `GROUP BY` reduces the number of rows; window functions do not.

The summary numbers per group come from aggregate functions. `COUNT` counts how many rows are in each group. `SUM` adds up a numeric column inside the group. `AVG` computes the average. You typically select the group key plus one or more aggregates.

A common source of mistakes is `COUNT(*)` versus `COUNT(DISTINCT col)`. `COUNT(*)` counts all rows in the group, including several sessions from the same user. `COUNT(DISTINCT user_id)` counts unique users. If you ask "how many users" but write `COUNT(*)`, you may accidentally count sessions instead of people.

Filtering happens in two stages, which SQL splits into `WHERE` and `HAVING`. `WHERE` filters individual rows before grouping, like keeping only events from one week. `HAVING` filters whole groups after aggregation, like keeping only groups with `COUNT(*) > 10`. Putting an aggregate like `COUNT(*) > 10` in `WHERE` is an error, because the count does not exist until after grouping.

In the figure below, choose a `GROUP BY` column to watch rows collapse into groups, switch between `COUNT`, `SUM`, and `AVG`, compare `COUNT(*)` with `COUNT(DISTINCT)`, and adjust a `HAVING` threshold to drop whole groups.
````

**What the figure does:** Shows per-session detail rows on the left that cluster by a chosen grouping column and collapse (via translucent funnel polygons) into one summary card per group on the right. The user picks the grouping column (`country`/`plan`, etc.) via toggle buttons, selects an aggregate (`COUNT(*)`, `COUNT(DISTINCT)`, `SUM`, `AVG`), and drags a HAVING slider to drop whole groups by their `COUNT(*)`. Rows CSS-animate position/color when regrouped, duplicate users fade when `COUNT(DISTINCT)` is active, and each summary card shows the aggregate value with a proportional bar. A live SQL block reflects the current grouping/aggregate/HAVING. Animation is CSS-transition driven, not `setInterval`.

**Real vs illustrative:** The grouping, aggregate values (`computeGroups`, `aggValue`), HAVING filtering, and generated SQL are computed for real from the fixed row set; the row data and colors are illustrative.

**Cross-links in prose:** Window Functions ("window functions").

### 28. Window Functions
- **slug:** `window-functions`
- **eyebrow/category:** Ranking

**Prose (verbatim):**
````markdown
# Window functions

A window function does a calculation over a window of rows while keeping the original rows visible. With `GROUP BY`, you collapse many rows into one summary per group, like one row per session with a total. A window function computes across multiple rows but does not collapse anything. It adds a new column to each row, so you keep every row, now with a calculated value alongside it.

A common use is ranking. `ROW_NUMBER()`, `RANK()`, and `DENSE_RANK()` number rows in an order you choose, such as events ordered by time. They differ on ties. If two rows are tied for second place, `ROW_NUMBER()` still assigns distinct numbers, giving them 2 and 3. `RANK()` gives both 2, and the next row becomes 4, leaving a gap after the tie. `DENSE_RANK()` gives both 2, and the next becomes 3, with no gap. Many mistakes come from using the wrong one when ties exist.

Another use is running totals. `SUM(...) OVER (ORDER BY occurred_at)` adds values as you go down the rows, so each row shows the cumulative total up to that point. You still see every row, plus a "so far" total next to it.

`PARTITION BY` splits the rows into groups and restarts the calculation within each group. `SUM(...) OVER (PARTITION BY session_id ORDER BY occurred_at)` gives each session its own running total instead of one total across the whole table. The same applies to ranking: you can number rows within each session, user, or any grouping key.

In the figure below, toggle between `ROW_NUMBER`, `RANK`, and `DENSE_RANK` to see how they differ on a tied pair, watch a running total accumulate, and turn on `PARTITION BY` to see the calculation restart per group.
````

**What the figure does:** Renders an events table with computed `row_number`, `rank`, `dense_rank`, and a `running` SUM column (number plus a bar). The user toggles the active function among `ROW_NUMBER`/`RANK`/`DENSE_RANK`/`SUM`, which highlights that column with a red band; and toggles `PARTITION BY session_id`, which re-lays the rows with dashed dividers and restarts the numbering and running total per session. A tied pair of rows is shaded to show how the ranking functions diverge. A live SQL block reflects the active function and partition state. The running-bar has a CSS animation delay per row; no `setInterval` timer.

**Real vs illustrative:** The rank/row-number/dense-rank/running values (`computeView`) and the SQL are computed for real; per the `tryThis` copy, the `value` weights (opened 1, used 2, completed 3) are explicitly an "illustrative weight per event type."

**Cross-links in prose:** GROUP BY and Aggregation (`GROUP BY`).

### 29. Funnel Analysis
- **slug:** `funnel-analysis`
- **eyebrow/category:** Analytics

**Prose (verbatim):**
````markdown
# Funnel analysis

A funnel measures progress through a sequence of steps where some users drop off along the way. In a learning app, you might expect a session to open a topic, then use an interactive, then complete the topic. A funnel counts how many sessions reach each step, so you can see where people fall away.

In SQL, a funnel is built from an events table. Each row is an event with fields like `session_id`, `event`, and `occurred_at`. For each step, you count the distinct sessions that fired that event. Distinct matters because one session can fire the same event more than once, and you want to count sessions, not raw events. So you compute the sessions that fired `topic_opened`, then `interactive_used`, then `topic_completed`.

Then you calculate conversion rates. The step-to-step conversion is each step divided by the one before it: `interactive_used / topic_opened`, then `topic_completed / interactive_used`. The overall completion rate is the last step divided by the total sessions. These percentages show whether the funnel leaks early or late.

This is useful because the biggest drop between two steps is usually the best place to investigate. If many sessions open a topic but few use the interactive, the interactive might be hard to find or slow to load. If usage is high but completion is low, the content might be too long or confusing.

In practice this is often written with a CTE per step, combined into one output row. That keeps the logic readable and makes it easy to add filters like date ranges or user cohorts.

In the figure below, you see the three funnel steps sized by their distinct session counts, the conversion percentage between each, and the SQL that produces them.
````

**What the figure does:** Draws a three-step funnel (`topic_opened`, `interactive_used`, `topic_completed`) as centered bars sized by each step's distinct-session count, with step-to-step conversion percentages in the gaps. The one control toggles "Show drop-off," adding ghost wings behind each bar and a `-N` lost-sessions label plus a "% lost" annotation. Readouts show each step's count and the overall completion rate; a live SQL block (one distinct-session set per step, then count each) is shown. Bars have a CSS grow animation with per-step delay; no `setInterval` stepping.

**Real vs illustrative:** The step counts, conversion rates, and overall rate come from precomputed data modules (`STEP_STATS`, `OVERALL_RATE`) derived from the events data; the aria-label cites concrete figures (topic_opened 143, interactive_used 77, topic_completed 45, 146 total sessions). Real counts over the fixed dataset; the SQL is generated.

**Cross-links in prose:** none by topic name (mentions "CTE" generically).

### 30. Indexes
- **slug:** `indexes`
- **eyebrow/category:** Indexing

**Prose (verbatim):**
````markdown
# Indexes

A database table is just rows of data. To find rows that match a query, the simplest thing the database can do is check every row from top to bottom. That is called a full scan. On a small table, a full scan is fine. On a table with millions of rows, it can be slow, because the amount of work grows with the number of rows in the table.

An index is an extra structure the database keeps on the side to speed up searches. It is usually built from one column, such as `email`, `created_at`, or `user_id`. Instead of scanning the whole table, the database can use the index to find the matching rows more directly. The tradeoff is that the index takes extra space and has to stay updated when the table changes. In return, lookups on that column can become much faster.

A common index uses a structure called a B-tree. In plain terms, it keeps the indexed column's values in sorted order, with pointers back to the matching table rows. Because the values are sorted, the database can jump toward the value it wants instead of reading everything from the start. This is the same halving idea as binary search from the algorithms section, applied inside a database.

Sorted order is useful for more than exact matches. If you ask for one value, the index can find it quickly. If you ask for a range, like "everything greater than X" or "everything between X and Y", the database can find the start of the range and then walk along the sorted values. A hash index works more like the hash tables topic: it can be excellent for exact matches, but it does not preserve order, so it cannot handle range queries the same way.

Indexes are not free. They use storage, and they make writes a little slower, because every insert or update may also need to update the index. That is why you add indexes to columns you search, filter, join, or sort on often, not to every column.

Run the same query in the figure with the index off, then on. Watch the database examine every row during the full scan, then use the index to jump to the answer while the rows-examined count stays tiny.

A full scan is the slow linear case where work grows with table size. An indexed lookup is the fast case that stays quick even as the table grows.

The figure runs the scan and the indexed lookup for real on a small fixed table, and the rows-examined counts are the real number of rows each strategy touches. The table is kept small so the steps are easy to see, while real tables have millions of rows where the gap is enormous. The index shown is a simplified version of a real B-tree that works on the same sorted-lookup principle.
````

**What the figure does:** Shows a physical-order table (id/score) on the left and, when the index is on, a sorted B-tree index (score → row) on the right. The user toggles the index off/on, picks a query from a dropdown (equality or between), or clicks any row to search its score value. With the index off it does a full scan, advancing a cursor row by row (matched rows turn green, seen rows dim); with the index on it binary-searches the sorted index (highlighting lo/mid/hi, eliminating halves) then walks the range. Step/Play/Reset drive it; Play auto-advances via `setInterval` (`PLAY_MS = 700`, explicitly chosen over requestAnimationFrame). Readouts show rows examined, total rows, match count.

**Real vs illustrative:** Both strategies computed for real — "rows examined" is the actual number of rows or index entries the chosen strategy touches on the fixed N-row table. The index is a simplified B-tree (a sorted copy of the score column); the tiny table size is illustrative.

**Cross-links in prose:** Binary search ("binary search from the algorithms section") and Hash Tables ("the hash tables topic").

### 31. Query Planning
- **slug:** `query-planning`
- **eyebrow/category:** Planning

**Prose (verbatim):**
````markdown
# Query planning

In SQL, you describe what you want, not exactly how to get it. You might ask for users from one country, sessions in a date range, or rows joined across several tables. The database still has to decide how to run that request. That job belongs to the query planner. The same query can often be executed in more than one way, and the planner tries to choose the cheapest plan.

One major choice is whether to use an index or scan the whole table. From the previous topic, an index lets the database jump toward matching rows instead of checking every row. That sounds like it should always win, but it does not. If a query matches only a few rows, the index is usually a big win because it skips most of the table. If a query matches most of the rows, using the index can be wasteful because the database still has to visit almost everything. In that case, reading the table straight through with a full scan can be cheaper.

This depends on selectivity, which means how narrow the filter is. A highly selective filter matches few rows, so it favors the index. A low-selectivity filter matches many rows, so it favors the scan. The planner estimates this before running the query and chooses the plan it expects to cost less.

Another choice is join order. When a query combines several tables, the database can often join them in different sequences. Joining smaller or more-filtered tables first keeps the temporary, in-between results small. That usually makes the rest of the query cheaper. A poor join order can create a large intermediate result, then force the database to do extra work just to reduce it later.

Most databases let engineers inspect the chosen plan. In PostgreSQL, the command is called `EXPLAIN`. It prints the plan the database expects to use, so you can see whether it chose a scan, an index lookup, a join strategy, and other details. The figure shows a simplified version of this idea.

Slide the filter in the figure and watch the chosen plan flip between using the index and scanning the whole table as the number of matching rows changes. Then try different join orders and watch the cost change.

A full scan is the linear case from Big-O, where work grows with the table. An index lookup is the fast case, which is why the planner prefers it when only a few rows match.

Real query planners are more complex than this. They use detailed table statistics, cost models, and many kinds of plans. The figure uses a simplified, transparent cost model to show the core ideas, and the EXPLAIN-style readout is illustrative rather than exact PostgreSQL output. What is real is the direction of each tradeoff: selectivity drives the choice between an index and a scan, and join order changes how big the in-between results get. The specific numbers are a teaching simplification.
````

**What the figure does:** A two-part figure driven by a top toggle ("1 · index vs scan" / "2 · join order"). Part 1: the user drags a "matches" slider; two cost bars (Index Scan vs Seq Scan) update, the cheaper is tagged "planner picks," a selectivity strip highlights matched cells, and a simplified EXPLAIN readout (labeled "illustrative, not real Postgres output") switches between Index Scan and Seq Scan lines. Part 2: the user toggles "good order" / "bad order" join sequences; a step-by-step list shows intermediate row counts and a running total, and two cost bars (Good vs Bad, in rows) mark the cheaper. No timer-driven animation; slider/toggle driven.

**Real vs illustrative:** Costs and row counts are computed for real from one simplified, transparent cost model on fixed data (`p1Costs`, `p2Cost`); the specific numbers and the EXPLAIN-style readout are a teaching simplification, not exact Postgres output. What is real is the direction of each tradeoff (selectivity flips index vs scan; join order changes intermediate size).

**Cross-links in prose:** Indexes ("From the previous topic" / "the previous topic") and Big-O ("the linear case from Big-O").

### 32. Atomicity
- **slug:** `atomicity`
- **eyebrow/category:** Transactions

**Prose (verbatim):**
````markdown
# Atomicity

Some database operations only make sense if several steps happen together. Moving money between two accounts is the classic example. The database has to subtract money from one account and add it to another. If the first step happens and the second step fails, the money has simply vanished. Nothing about that state is valid. The database has been left half-finished, with one piece of the operation applied and the other missing.

A transaction is how a database groups steps together and treats them as one unit. You mark the start of the transaction, run the statements that belong together, then finish it. If everything worked, you commit the transaction. Commit means the changes are accepted and made permanent. If something goes wrong, you roll back the transaction. Roll back means the database undoes every change made inside the transaction and returns to how it was before the transaction started.

Atomicity is the all-or-nothing rule for transactions. Either every step happens and the transaction commits, or something fails and the whole transaction rolls back as if it never started. There is no half-done version. A transfer cannot subtract from one account and then stop before adding to the other. The transaction is treated as one indivisible action.

That matters because real systems fail in messy ways. A statement can hit an error. A server can crash. A connection can drop. Without atomicity, any of those failures could leave data stuck in a broken in-between state. With atomicity, the money is either fully moved or not moved at all. It is never destroyed in the middle.

Run the transfer in the figure and watch both accounts change while the total stays the same. Then make it fail partway, after the first step. The transaction rolls back, the first step is undone, and the total is still correct.

Atomicity is one of the guarantees a transaction provides. What happens when two transactions run at the same time, and how databases keep them from corrupting each other, are the next two topics.

The figure uses a deliberately tiny two-step transfer so the all-or-nothing rule is easy to see. Real transactions can span many statements and tables, but the atomicity guarantee works the same way. The balances and the rollback in the figure are real arithmetic, kept small for clarity.
````

**What the figure does:** Shows two account cards (A starts at 100, B at 0) with a transfer arrow and a "total" pill, plus a script of SQL lines (BEGIN, debit, credit, COMMIT — or the failure/ROLLBACK path) that highlights the active line. The user toggles "fail after debit" off/on and drives the sequence with Step/Play/Reset; Play auto-advances via `setInterval` (`PLAY_MS = 950`, explicitly chosen over requestAnimationFrame). With fail off, A drops to 60, B rises to 40, total stays 100, then COMMIT. With fail on, after the debit the total briefly reads 60 (broken state, amber), then ROLLBACK literally restores the pre-transaction balances: the rollback frame is built with `a: A_START, b: B_START` (100 and 0), not merely relabeled, so A returns to 100 and the total returns to 100. Readouts show account A, account B, total (A+B), transaction state.

**Real vs illustrative:** The balances, the failure, and the rollback are real integer arithmetic on fixed starting values (A=100, B=0, transfer 40); a rolled-back transaction restores A to exactly 100 (the rollback frame sets balances back to `A_START`/`B_START`). The tiny two-step transfer is a deliberate simplification for clarity, but the numbers are not fabricated.

**Cross-links in prose:** references "the next two topics" (concurrency of simultaneous transactions and how databases prevent corruption) without naming them.

---

## Object-Oriented Programming

All four OOP figures import the shared `RobotAvatar.jsx` (ClassesObjectsViz also imports its `ROBOT_PALETTE` export), and InheritanceViz additionally uses the shared logic module `inheritanceData.js`. A consistent robot color scheme recurs across the section.

### 33. Classes and Objects
- **slug:** `classes-and-objects`
- **eyebrow/category:** Classes

**Prose (verbatim):**
````markdown
# Classes and objects

A class is a blueprint for a kind of thing. It defines what data that thing has, stored in fields, and what it can do, defined by methods. For a robot, a class might include fields like a `name` and a `batteryLevel`, plus methods like `reportStatus()` or `move()`. The class itself is not a robot; it is the plan for making robots.

An object is a real instance created from a class, usually with `new` in Java. Each object gets its own copy of the fields. If you create three robots from one `Robot` class, you get three independent objects. Lowering one robot's battery does not change the others, because their fields live in separate objects.

```java
class Robot {
  String name;
  int batteryLevel;

  Robot(String name, int batteryLevel) {
    this.name = name;
    this.batteryLevel = batteryLevel;
  }

  void reportStatus() {
    System.out.println(name + " battery: " + batteryLevel + "%");
  }
}

Robot r1 = new Robot("Bolt", 80);
Robot r2 = new Robot("Nova", 80);
r1.batteryLevel -= 30;  // only r1 changes
```

Encapsulation is the idea that an object should control its own state. In Java, you can make fields `private` so outside code cannot change them directly. Access goes through methods like a getter or a setter, which can enforce rules ("`batteryLevel` cannot go below 0 or above 100"). This prevents invalid states.

In the figure below, edit the class blueprint, stamp out robot objects, change one robot's battery to see the others unchanged, then mark a field private to see direct access blocked while the method still works.
````

**What the figure does:** A left "class" blueprint panel shows the `Robot` fields (`name`, `batteryLevel`) and methods, with a +/- stepper (10% increments, clamped 0–100) to edit the default `batteryLevel` each new instance receives. Controls are `new Robot(...)` (stamps a new object into "object memory" on the right, up to 4, animating in with anime.js), a public/private toggle for `batteryLevel`, and Reset. Each object card has its own battery bar plus a "direct" write button (`r.batteryLevel-`, subtracts 15) and "method" buttons `charge()` (+15) and `reportStatus()` (prints to a console line). When private, the direct write bounces off with a shake and a "batteryLevel is private" flash, while the class's own methods still work; readouts show instances, blueprint default, access mode. Not timer-driven; only entry/shake animations are anime.js.

**Real vs illustrative:** Real — each object holds its own independent battery value, and the public/private rule genuinely blocks direct writes while allowing method calls. Illustrative — robot names/colors and the fixed 15%/10% step amounts are hand-authored.

**Cross-links in prose:** none.

### 34. Inheritance
- **slug:** `inheritance`
- **eyebrow/category:** Inheritance

**Prose (verbatim):**
````markdown
# Inheritance

A class can extend another class, which means it inherits the parent's fields and methods. The subclass starts with everything the parent has, then adds its own features or changes some behavior. In Java:

```java
class CleaningBot extends Robot { }
```

This is useful because shared behavior lives in one place instead of being copied into every class. A `Robot` parent can hold common fields like `name` and `batteryLevel`, plus a shared method like `reportStatus()`. Specialized robots can then extend it. A `CleaningBot` might add a `dustBinLevel` field and a `clean()` method. A `GuardBot` might add an `alarmEnabled` field and a `patrol()` method. The common parts stay in `Robot`; each subclass defines only what makes it different.

A subclass can also override a parent method by defining a method with the same name and signature, replacing the parent's version for that subclass's objects. If `CleaningBot` overrides `reportStatus()`, then calling it on a `CleaningBot` runs the `CleaningBot` version.

```java
class Robot {
  void reportStatus() { System.out.println("Robot status"); }
}

class CleaningBot extends Robot {
  @Override
  void reportStatus() { System.out.println("CleaningBot status"); }
}
```

Method lookup is the mechanism behind this. When you call a method on an object, Java first looks in the object's actual class. If it is not there, Java searches the parent, then the grandparent, and keeps climbing until it finds a match. That climb is how inherited methods are found and why overrides win.

Deep inheritance chains can get fragile and hard to reason about, which a later topic on composition addresses.

In the figure below, click classes in a small robot family tree to see own vs inherited vs overridden members, and call a method to watch the lookup climb the chain until it finds an implementation.
````

**What the figure does:** A stage draws a four-class robot family tree (`Robot` root; `CleaningBot` and `GuardBot` extend it; `AttackGuardBot` extends `GuardBot`), with SVG connector lines. Clicking a class box selects it and populates a detail panel listing its members color-coded via a legend as own (green), overridden (amber), or inherited (grey). Controls are one button per leaf-callable method (`attack()`, `patrol()`, `reportStatus()`, `move()`) plus Reset; calling a method animates a "lookup probe" climbing from the leaf `AttackGuardBot` upward, marking each class "checking" then "not here" until it reaches the defining class, badged "found". The climb is timer-driven via `setTimeout` (820ms per step) with anime.js moving the probe; readouts show selected class, call site, resolved-in class.

**Real vs illustrative:** Real — the ancestry chain, own/inherited/overridden tagging, and the method-lookup walk are computed from the `CLASSES` data in `inheritanceData.js` (`ancestry`, `resolveMembers`, `lookupPath`). Illustrative — the specific class tree, member names, colors, and box coordinates are hand-authored.

**Cross-links in prose:** references a "later topic on composition" (Composition vs Inheritance, topic 36) by description, not exact title.

### 35. Polymorphism
- **slug:** `polymorphism`
- **eyebrow/category:** Polymorphism

**Prose (verbatim):**
````markdown
# Polymorphism

Different objects can respond to the same method call in their own way. If `CleaningBot`, `GuardBot`, and `ChefBot` all extend `Robot` and each overrides `activate()`, then calling `activate()` does something different depending on which robot it is.

```java
class Robot {
  void activate() { System.out.println("Generic activation"); }
}

class CleaningBot extends Robot {
  @Override void activate() { System.out.println("Starting vacuum and mop"); }
}

class GuardBot extends Robot {
  @Override void activate() { System.out.println("Arming sensors and patrol route"); }
}

class ChefBot extends Robot {
  @Override void activate() { System.out.println("Preheating oven and checking recipes"); }
}
```

The power move is that you can treat them all as their shared parent type. A variable of type `Robot` can hold any subclass instance, and code that uses it does not need to know which specific robot it has.

```java
Robot r = new GuardBot();   // declared Robot, actual GuardBot
r.activate();               // calls GuardBot.activate()

List<Robot> bots = List.of(new CleaningBot(), new GuardBot(), new ChefBot());
for (Robot bot : bots) {
  bot.activate();
}
```

This works because of dynamic dispatch. Which version of `activate()` runs is decided at runtime by the object's actual type, not the variable's declared type. The behavior travels with the object, even when you store it in a `Robot` variable.

Why it matters: you can write one loop that works across many robot types, and later add a `DeliveryBot` that overrides `activate()` without changing the loop. The new behavior appears automatically when the new object is in the list.

In the figure below, send one `activate()` call to a row of different robots all typed as `Robot` and watch each respond in its own way, then shuffle them to see the behavior follow the object, not the variable type.
````

**What the figure does:** A row of cards holds three robots (`CleaningBot`, `GuardBot`, `ChefBot`), each labeled with declared type `Robot [i]` and its actual concrete type. Above them a code bar shows `for (Robot bot : bots) bot.activate();`. Controls are `activate()`, Shuffle, Reset. Pressing `activate()` sends a travelling "activate()" token across each card in sequence (timer-driven via `setTimeout`, ~520ms visit + ~340ms between cards, anime.js moving the token); as it reaches each card, that robot reacts with a hand-authored SVG/CSS action visual (sweep dust, radar rings, heat waves) and prints its own message. Shuffle deterministically rotates the objects through slots so the same concrete object lands in a different slot; readouts fix declared type as `Robot`, count the objects, label dispatch as "runtime (actual type)".

**Real vs illustrative:** Real — the dispatch behavior travels with each object across shuffles (each card renders the response of whatever concrete type occupies it). Illustrative — the messages, per-type action animations, and colors are hand-authored, not produced by real method execution.

**Cross-links in prose:** none (names sibling robot types and a hypothetical `DeliveryBot`, but no other topic).

### 36. Composition vs Inheritance
- **slug:** `composition-vs-inheritance`
- **eyebrow/category:** Composition

**Prose (verbatim):**
````markdown
# Composition vs inheritance

There are two common ways to build capability. **Inheritance** is an is-a relationship: a `GuardBot` IS A `Robot`. **Composition** is a has-a relationship: a robot HAS A flight module. With composition, a class holds other objects as fields and delegates work to them.

Inheritance strains when capabilities need mixing. If you need a robot that flies, one that swims, and one that does both, subclassing pushes you toward awkward trees and duplicated code: `FlyingRobot`, `SwimmingRobot`, `FlyingSwimmingRobot`, and so on. Each new combination needs a new class. Changes in a base class can also ripple down and break subclasses in surprising ways, sometimes called the fragile base class problem.

Composition shines because you can snap capabilities together. A `Robot` can hold a list of modules like `FlightModule` and `SwimModule`. Any robot can have any mix, modules can be added or swapped at runtime, and no new class is needed per combination. Changing one module usually does not force changes in unrelated modules.

```java
interface Module { void activate(Robot r); }

class FlightModule implements Module { public void activate(Robot r) { /* fly */ } }
class SwimModule implements Module { public void activate(Robot r) { /* swim */ } }

class Robot {
  private final List<Module> modules = new ArrayList<>();
  void addModule(Module m) { modules.add(m); }
  void activateAll() { for (Module m : modules) m.activate(this); }
}
```

"Favor composition over inheritance" is common advice and a good default, but inheritance is still right when there is a true is-a relationship and shared core behavior. The skill is choosing, not always avoiding inheritance.

In the figure below, grow an inheritance tree on one side and watch combinations multiply and a base-class change ripple, then build the same robot on the other side by snapping modules in and out cleanly.
````

**What the figure does:** A two-column figure. Left ("Inheritance", is-a): buttons add leaf classes `+ FlyingRobot`, `+ SwimmingRobot`, `+ FlyingSwimmingRobot`, and `+ add Dig capability`; combined classes show duplicated methods with amber "dup" tags, and adding Dig explodes into one class per combination (Dig, Fly+Dig, Swim+Dig, Fly+Swim+Dig). A `Change base class` button animates a staggered ripple down the base and every leaf (timer-driven via `setTimeout` sized to the node count) that then marks the combined subclasses "broken". Right ("Composition", has-a): one `Robot` with toggleable module chips (`FlightModule`, `SwimModule`, `DigModule`) that snap in/off, updating the robot's "can fly()/swim()/dig()" summary with no new class; an `Upgrade FlightModule` button notes only flight-capable robots change (or prompts to snap in FlightModule first). A shared Reset clears both sides; readouts contrast inheritance class count (`1 + leaves`) vs composition class count (always 1) vs modules snapped in.

**Real vs illustrative:** Real — the class-count explosion is computed (each capability combination becomes a distinct leaf; `add Dig` genuinely adds all four combos) and the readout counts reflect actual state. Illustrative — the "broken"/"changed" ripple, the module-upgrade note, and colors/labels are hand-authored effects rather than real code behavior.

**Cross-links in prose:** none (contrasts inheritance vs composition conceptually but names no other topic).

---

## Reviewer notes: points where prose and figure could be checked

These are not confirmed errors; they are the spots most worth a careful reviewer's eye, where the wording and the current code are in mild tension or where the figure deliberately shows something a naive reading of the prose would not expect.

1. **Dynamic Programming (23) — "one computation per distinct subproblem" vs the memoized-calls readout.** The prose says the memoized version "does roughly one real computation per distinct subproblem." The figure's `memoized calls` readout counts *total* `fib()` calls, which includes cache-hit lookups (drawn as dashed leaves), so that number is larger than the count of distinct subproblems. The figure's caption mitigates this by distinguishing solid nodes (real computations) from dashed nodes (cache-hit lookups). Worth confirming the reader is not led to equate the readout with "distinct subproblems."

2. **Overfitting (04) — regime label is a fixed degree band, not the measured minimum.** The prose says "The best model is usually in the middle." The figure's underfitting/good-fit/overfitting label comes from fixed degree cutoffs (`degree ≤2`, `≤6`, else) in `regime()`, not from where the measured test-error curve actually bottoms for the seeded data. The U-shape of test error is real; only the text label is banded. Low severity, but the "good fit" label and the actual test-error minimum may not land on exactly the same degree.

3. **Why Models Struggle with Math (07) — the figure shows intentionally wrong answers.** By design the model side lands on 368 for 27×14 (correct is 378) and 3 s's in "mississippi" (correct is 4). This matches the prose ("frequently wrong... pattern prediction, not arithmetic") and the per-token distributions are flagged illustrative, but a reviewer scanning for arithmetic errors should know the wrong values are deliberate, not bugs.

4. **Query Planning (31) — EXPLAIN readout scope.** The prose describes real `EXPLAIN` as showing "a scan, an index lookup, a join strategy, and other details," then says "The figure shows a simplified version of this idea." The figure's EXPLAIN-style readout (Part 1) shows only the scan-vs-index line; join order (Part 2) is shown as cost bars, not an EXPLAIN join-strategy line. The prose is describing real EXPLAIN generally and labels the figure a simplification, so this is consistent, but the figure's EXPLAIN text itself does not render a join strategy.

5. **Forward references are words-only (correct).** Graph Traversal (21) points to "the next topic" (Dijkstra) and Atomicity (32) points to "the next two topics" (concurrency, isolation) without Markdown links or route references. For Atomicity this is deliberate: those two topics do not exist yet. No action needed; flagged so a reviewer does not expect links.

## How this document was produced

Prose was copied from each `app/topics/<slug>/page.mdx` (the `#` H1 and body only; the `import`, `metadata` export, and `<Component />` embed lines are excluded). Figure descriptions were written from the current component code in `app/components/`. Topic order, numbering, slugs, and sections follow `app/topicList.js` as it stands on the branch that includes the merged Atomicity topic (36 topics across 4 sections).
