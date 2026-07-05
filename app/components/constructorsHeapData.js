// Hand-authored deterministic trace for "One object, two names". The figure steps
// through this exact three-line snippet, splitting the first line into three
// sub-steps (declare, allocate, construct) so the stack/heap split is visible:
//
//   Dog a = new Dog("Rex");
//   Dog b = a;
//   b.name = "Max";
//
// Each STATES entry is the full visual state AFTER that step. Index 0 is the start
// (nothing run yet); indices 1..5 are the five described steps. Rendering reads one
// state by index, so there is no per-frame computation and no randomness.

// The snippet, one line per array entry. `line` is the 1-based source line each
// state highlights (0 = none), so steps 1-3 all point at line 1.
export const CODE_LINES = ['Dog a = new Dog("Rex");', 'Dog b = a;', 'b.name = "Max";']

// A stack slot: `name` is the variable, `ref` is whether it currently holds a
// reference (draws an arrow to the heap object) or is still empty (drawn as a dash).
export const STATES = [
  {
    slots: [],
    heap: null,
    line: 0,
    highlight: false,
    status: 'Press Step to run the code one line at a time.',
  },
  {
    slots: [{ name: 'a', ref: false }],
    heap: null,
    line: 1,
    highlight: false,
    status: 'Declare a reference. No object exists yet.',
  },
  {
    slots: [{ name: 'a', ref: false }],
    heap: { name: null },
    line: 1,
    highlight: false,
    status: 'new allocates space on the heap.',
  },
  {
    slots: [{ name: 'a', ref: true }],
    heap: { name: 'Rex' },
    line: 1,
    highlight: false,
    status: 'The constructor initializes the fields. a holds a reference, not the object.',
  },
  {
    slots: [
      { name: 'a', ref: true },
      { name: 'b', ref: true },
    ],
    heap: { name: 'Rex' },
    line: 2,
    highlight: false,
    status: 'b = a copies the reference. Still one object.',
  },
  {
    slots: [
      { name: 'a', ref: true },
      { name: 'b', ref: true },
    ],
    heap: { name: 'Max' },
    line: 3,
    highlight: true,
    status: 'Changing it through b changes it for a too. Same object, two names.',
  },
]

export const LAST_STEP = STATES.length - 1 // 5

// Readouts are derived from a state, never hand-typed, so they can never drift from
// what the panels draw. The punchline at the final step is 2 references, 1 object.
export const referenceCount = (state) => state.slots.filter((s) => s.ref).length
export const heapObjectCount = (state) => (state.heap ? 1 : 0)
