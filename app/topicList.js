// Single source of truth for the ordered topic list. Both the contents page and the
// per-topic prev/next navigation import from here, so reordering a topic in TOPIC_ROWS
// updates the contents page AND every page's prev/next buttons automatically.
//
// Compact delimited table, one row per topic:  section | num | title | subtitle | slug
// Kept as data (parsed below) rather than repeated object literals.
const TOPIC_ROWS = `
AI and ML|01|Gradient Descent|Walking downhill, and why the starting point decides which minimum you reach|gradient-descent
AI and ML|02|Neural Networks|Watch a tiny network train live: loss drops, weights shift, the boundary sharpens|neural-networks
AI and ML|03|Why Activations Matter|Turn the activation off and the boundary is a straight line that fails; turn ReLU on and it bends to fit, gaining more bends with more units|activation-functions
AI and ML|04|Overfitting and Generalization|Slide model complexity from underfit to good fit to overfit, and watch test error trace a U|overfitting
AI and ML|05|Decision Boundary|Drag a point and watch a real logistic regression, fit live by gradient descent, chase it: the boundary is the learned object, defined by three numbers|decision-boundary
AI and ML|06|Confusion Matrix|Precision, recall, and the threshold that trades one for the other|confusion-matrix
AI and ML|07|Tokenization|How text is split into tokens, each with an integer ID, before a model ever sees it|tokenization
AI and ML|08|Why Models Struggle with Math|See one side compute the right answer step by step while a model predicts answer tokens and lands on a plausible but wrong one|why-models-struggle-with-math
AI and ML|09|Embeddings|Words as points in space, where closeness means similar meaning|embeddings
AI and ML|10|Attention|How a transformer decides which words to focus on, like "it" reaching back to "animal"|attention
AI and ML|11|Tensors|Climb the dimensionality ladder from a scalar to a batch of images, watching the shape and index math build up rank by rank|tensors
AI and ML|12|Broadcasting|Pick two array shapes and watch them align from the right, stretching size-1 dimensions to see whether they combine and what result shape they make|broadcasting
AI and ML|13|Positional Encoding|Attention ignores word order, so each token gets a sine and cosine fingerprint of its position; pick a position and watch its pattern shift|positional-encoding
AI and ML|14|Transformers and Multi-Head Attention|Many attention heads in parallel, each head watching a different relationship over the same sentence|transformers
AI and ML|15|Encoders and Decoders|An encoder sees the whole sentence at once; a decoder can only look back. Toggle the attention mask and watch which words each word is allowed to see|encoders-and-decoders
AI and ML|16|RLHF|Pick the answers you prefer and watch your feedback reshape the model|rlhf
AI and ML|17|Temperature and Sampling|Move a temperature slider and watch the next-word distribution sharpen or flatten|temperature
AI and ML|18|Beam Search vs Greedy Decoding|Watch greedy decoding lock onto the locally best token while beam search keeps a wider set of candidates alive and finds a more probable sequence overall|beam-search
AI and ML|19|RAG (Retrieval-Augmented Generation)|Retrieve relevant document chunks by similarity, drop them into the prompt, and watch the model answer from real sources instead of memory|rag
Algorithms and Data Structures|20|Big-O and Time Complexity|Race six real algorithms and watch operation counts split apart as the input grows, from constant time to exponential|big-o
Algorithms and Data Structures|21|Binary Search|Halve a sorted array each comparison to find a value, and watch how few steps it takes next to a linear scan|binary-search
Algorithms and Data Structures|22|Recursion and the Call Stack|Solve Towers of Hanoi one move at a time and watch the call stack push and pop as the recursion descends and returns|recursion
Algorithms and Data Structures|23|Sorting|Step three real sorts through the same fixed array and compare how many comparisons and moves the slow and fast ones take|sorting
Algorithms and Data Structures|24|Linked List vs Array|Run the same operation on both structures and count the real shifts, walks, and pointer rewrites each one costs|linked-list-vs-array
Algorithms and Data Structures|25|Hash Tables|Hash keys into buckets by a visible character-code rule, watch collisions chain up, and track load factor live|hash-tables
Algorithms and Data Structures|26|Binary Search Trees|Insert and search values down a tree, then watch a sorted insert order collapse it into a slow straight line|binary-search-trees
Algorithms and Data Structures|27|Graph Traversal (BFS and DFS)|Walk one graph two ways and watch the only real difference, a queue versus a stack, reorder the visits|graph-traversal
Algorithms and Data Structures|28|Dijkstra's Shortest Path|Lock in the nearest node and relax its edges until every shortest distance from a source is found, then trace any path|dijkstra
Algorithms and Data Structures|29|Dynamic Programming|Compute Fibonacci naively and watch the call tree explode with repeated work, then memoize and see it collapse|dynamic-programming
Databases and SQL|30|Tables and the Relational Model|Data split across tables and linked by keys: hover a row to see the primary-to-foreign-key link|relational-model
Databases and SQL|31|SELECT, WHERE and CASE|Choose columns, filter rows live, and bucket them with a CASE expression|select-where-case
Databases and SQL|32|Joins|Match rows across tables, and watch INNER, LEFT, RIGHT, and FULL change the result|joins
Databases and SQL|33|GROUP BY and Aggregation|Collapse rows into one summary per group, and see how COUNT, DISTINCT, and HAVING behave|group-by
Databases and SQL|34|Window Functions|Rank, number, and total across rows without collapsing them, and see how ties split the ranks|window-functions
Databases and SQL|35|Funnel Analysis|Count distinct sessions through each step and watch where users drop off|funnel-analysis
Databases and SQL|36|Indexes|Run the same query with the index off then on, and watch rows examined collapse from the whole table to a handful|indexes
Databases and SQL|37|Query Planning|Slide selectivity to watch the planner flip between an index and a full scan, then compare a good and a bad join order|query-planning
Databases and SQL|38|Normalization|Watch one wide table that stores each fact many times step into first normal form, hit an update anomaly, then split into three linked tables so every fact lives in exactly one place|normalization
Databases and SQL|39|SQL vs NoSQL Modeling|Model the same users, plans, and orders as normalized tables and as one document per user, then run three queries and watch which shape touches fewer places as the access pattern changes|sql-vs-nosql-modeling
Databases and SQL|40|Atomicity|Transfer money between two accounts as one transaction, trigger a failure between the debit and the credit, and watch the rollback restore the balances so the total never changes|atomicity
Databases and SQL|41|Concurrency|Run two transactions that both add to one balance, watch a stale read make an update vanish, then switch on locking so the second waits and the total comes out right|concurrency
Databases and SQL|42|Isolation Levels|Turn the isolation dial and pick a concurrency phenomenon, then watch a two-transaction timeline show whether PostgreSQL lets it happen or prevents it|isolation-levels
Systems and Networking|43|Caching|Feed a fixed request stream through a real least-recently-used cache of three slots and watch hits skip the slow origin while each miss fetches a key and evicts the one used longest ago|caching
Systems and Networking|44|Percentiles and Tail Latency|Drag a percentile handle across a fixed sample of 60 request latencies and watch the mean sit far below p99, because a handful of slow tail requests drag the average up while most requests never see them|percentiles-and-tail-latency
Systems and Networking|45|Load Balancing|Send one fixed request stream through a balancer to three servers and watch round robin pile long requests onto one server while least connections keeps them level, then kill a server mid-run and see which policy copes|load-balancing
Systems and Networking|46|CAP Theorem|Replicate one key across two nodes, cut the network between them, and choose: refuse writes to stay consistent or serve both sides and let the copies diverge, the tradeoff a partition forces|cap-theorem
Systems and Networking|47|Sharding|Pick a partition key and watch rows hash into shards, then see a low-cardinality key pile most rows onto one hot shard|sharding
Systems and Networking|48|Consistent Hashing|Place keys on a hash ring, then add a node and watch only a small slice of keys move, while plain hash-mod-N would reshuffle almost everything|consistent-hashing
Systems and Networking|49|Race Conditions and Locks|Step two threads through a shared balance by hand or on auto-play, watch a bad interleaving lose an update, then turn on a lock and try to break it again|race-conditions
Systems and Networking|50|Deadlock|Two threads, two locks, grabbed in opposite orders, and watch the wait-for graph close into a circular deadlock, then switch to one lock order and see it become impossible|deadlock
Systems and Networking|51|TCP and UDP|Send the same 8 packets across an identical lossy channel and watch UDP finish fast with permanent gaps while TCP detects each drop, resends it, and holds arrivals out of order until the gap behind them fills in|tcp-and-udp
Systems and Networking|52|DNS|Resolve a name through root, TLD, and authoritative servers, watching each one hand back a referral instead of an answer, then look it up again and watch the cached answer skip the whole chain|dns
Systems and Networking|53|Encryption and Public Keys|Lock a message with someone's public key and see that only their private key opens it, then flip the keys to sign|encryption-and-public-keys
Systems and Networking|54|Streaming and Buffering|Watch a playback buffer fill from a variable network and drain at a steady rate, then drop the network speed and see the stall coming before it happens|streaming-and-buffering
Systems and Networking|55|Network Stack and Routing|Walk a packet through two switched networks joined by a router and watch the layer 2 header get rewritten at the crossing while the layer 3 addresses ride through unchanged|network-stack-and-routing
Object-Oriented Programming|56|Classes and Objects|Stamp objects off a class blueprint, give each its own state, then lock a field down with encapsulation|classes-and-objects
Object-Oriented Programming|57|Constructors and the Heap|Trace new step by step as it allocates a Dog on the heap, then copy the reference and watch two names change one object|constructors-and-the-heap
Object-Oriented Programming|58|Encapsulation|Give a bank account one rule, break it through a public field, then make the field private so the object can refuse the writes that would violate it|encapsulation
Object-Oriented Programming|59|Inheritance|Build a robot family tree and watch method lookup climb the chain until an override wins|inheritance
Object-Oriented Programming|60|Polymorphism|Send one activate() call to robots all typed as Robot and watch each run its own behavior|polymorphism
Object-Oriented Programming|61|Abstract Classes and Interfaces|Toggle a Robot type between an abstract class and an interface, and watch a checklist compare what each kind of contract can force, carry, and be extended by|abstract-classes-and-interfaces
Object-Oriented Programming|62|Composition vs Inheritance|Grow an inheritance tree until it tangles, then build the same robot by snapping modules in|composition-vs-inheritance
Data and Compression|63|Entropy and Compression|Drag four symbol probabilities and watch a real Huffman code chase Shannon's entropy floor, closing the gap only at powers of one-half|entropy-and-compression
`

export const SECTION_ORDER = ['AI and ML', 'Algorithms and Data Structures', 'Databases and SQL', 'Systems and Networking', 'Object-Oriented Programming', 'Data and Compression']

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

// Shared "N topic(s)" pluralization, used by both the contents-page chapter cards
// and the chapter view header so the wording never drifts between the two.
export function pluralTopics(count) {
  return `${count} ${count === 1 ? 'topic' : 'topics'}`
}

// The previous/next topic for a given slug, treating the 38-topic list as one
// sequence that crosses section boundaries. Either side is null at the ends.
export function neighbors(slug) {
  const i = TOPICS.findIndex((t) => t.slug === slug)
  if (i === -1) return { prev: null, next: null }
  return {
    prev: i > 0 ? TOPICS[i - 1] : null,
    next: i < TOPICS.length - 1 ? TOPICS[i + 1] : null,
  }
}
