// Single source of truth for the ordered topic list. Both the contents page and the
// per-topic prev/next navigation import from here, so reordering a topic in TOPIC_ROWS
// updates the contents page AND every page's prev/next buttons automatically.
//
// Compact delimited table, one row per topic:  section | num | title | subtitle | slug
// Kept as data (parsed below) rather than repeated object literals.
const TOPIC_ROWS = `
AI and ML|01|Gradient Descent|Walking downhill, and why the starting point decides which minimum you reach|gradient-descent
AI and ML|02|Neural Networks|Watch a tiny network train live: loss drops, weights shift, the boundary sharpens|neural-networks
AI and ML|03|Overfitting and Generalization|Slide model complexity from underfit to good fit to overfit, and watch test error trace a U|overfitting
AI and ML|04|Confusion Matrix|Precision, recall, and the threshold that trades one for the other|confusion-matrix
AI and ML|05|Tokenization|How text is split into tokens, each with an integer ID, before a model ever sees it|tokenization
AI and ML|06|Why Models Struggle with Math|See one side compute the right answer step by step while a model predicts answer tokens and lands on a plausible but wrong one|why-models-struggle-with-math
AI and ML|07|Embeddings|Words as points in space, where closeness means similar meaning|embeddings
AI and ML|08|Attention|How a transformer decides which words to focus on, like "it" reaching back to "animal"|attention
AI and ML|09|Transformers and Multi-Head Attention|Many attention heads in parallel, each head watching a different relationship over the same sentence|transformers
AI and ML|10|RLHF|Pick the answers you prefer and watch your feedback reshape the model|rlhf
AI and ML|11|Temperature and Sampling|Move a temperature slider and watch the next-word distribution sharpen or flatten|temperature
AI and ML|12|RAG (Retrieval-Augmented Generation)|Retrieve relevant document chunks by similarity, drop them into the prompt, and watch the model answer from real sources instead of memory|rag
Algorithms and Data Structures|13|Big-O and Time Complexity|Race six real algorithms and watch operation counts split apart as the input grows, from constant time to exponential|big-o
Algorithms and Data Structures|14|Binary Search|Halve a sorted array each comparison to find a value, and watch how few steps it takes next to a linear scan|binary-search
Algorithms and Data Structures|15|Recursion and the Call Stack|Solve Towers of Hanoi one move at a time and watch the call stack push and pop as the recursion descends and returns|recursion
Algorithms and Data Structures|16|Sorting|Step three real sorts through the same fixed array and compare how many comparisons and moves the slow and fast ones take|sorting
Algorithms and Data Structures|17|Linked List vs Array|Run the same operation on both structures and count the real shifts, walks, and pointer rewrites each one costs|linked-list-vs-array
Algorithms and Data Structures|18|Hash Tables|Hash keys into buckets by a visible character-code rule, watch collisions chain up, and track load factor live|hash-tables
Algorithms and Data Structures|19|Binary Search Trees|Insert and search values down a tree, then watch a sorted insert order collapse it into a slow straight line|binary-search-trees
Algorithms and Data Structures|20|Graph Traversal (BFS and DFS)|Walk one graph two ways and watch the only real difference, a queue versus a stack, reorder the visits|graph-traversal
Databases and SQL|21|Tables and the Relational Model|Data split across tables and linked by keys: hover a row to see the primary-to-foreign-key link|relational-model
Databases and SQL|22|SELECT, WHERE and CASE|Choose columns, filter rows live, and bucket them with a CASE expression|select-where-case
Databases and SQL|23|Joins|Match rows across tables, and watch INNER, LEFT, RIGHT, and FULL change the result|joins
Databases and SQL|24|GROUP BY and Aggregation|Collapse rows into one summary per group, and see how COUNT, DISTINCT, and HAVING behave|group-by
Databases and SQL|25|Window Functions|Rank, number, and total across rows without collapsing them, and see how ties split the ranks|window-functions
Databases and SQL|26|Funnel Analysis|Count distinct sessions through each step and watch where users drop off|funnel-analysis
Object-Oriented Programming|27|Classes and Objects|Stamp objects off a class blueprint, give each its own state, then lock a field down with encapsulation|classes-and-objects
Object-Oriented Programming|28|Inheritance|Build a robot family tree and watch method lookup climb the chain until an override wins|inheritance
Object-Oriented Programming|29|Polymorphism|Send one activate() call to robots all typed as Robot and watch each run its own behavior|polymorphism
Object-Oriented Programming|30|Composition vs Inheritance|Grow an inheritance tree until it tangles, then build the same robot by snapping modules in|composition-vs-inheritance
`

export const SECTION_ORDER = ['AI and ML', 'Algorithms and Data Structures', 'Databases and SQL', 'Object-Oriented Programming']

// Flat ordered list (the canonical sequence used for prev/next, spanning sections).
export const TOPICS = TOPIC_ROWS.trim()
  .split('\n')
  .map((row) => {
    const [section, num, title, subtitle, slug] = row.split('|')
    return { section, num, title, subtitle, slug, href: `/topics/${slug}/` }
  })

// Grouped by section, in section order (for the contents page).
export const SECTIONS = SECTION_ORDER.map((name) => ({
  name,
  topics: TOPICS.filter((topic) => topic.section === name),
}))

// The previous/next topic for a given slug, treating the 16-topic list as one
// sequence that crosses section boundaries. Either side is null at the ends.
export function neighbors(slug) {
  const i = TOPICS.findIndex((t) => t.slug === slug)
  if (i === -1) return { prev: null, next: null }
  return {
    prev: i > 0 ? TOPICS[i - 1] : null,
    next: i < TOPICS.length - 1 ? TOPICS[i + 1] : null,
  }
}
