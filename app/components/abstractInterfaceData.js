// Hand-authored deterministic scenario for "Two kinds of contract". A Robot type with
// two implementers (CleanerBot, GuardBot) is shown as either an abstract class or an
// interface, and a five-row checklist compares what each kind of contract can carry.
//
// Every fact here is verified against the official Oracle Java Tutorial, not memory:
//   - Abstract classes can declare non-static, non-final fields and concrete methods.
//     https://docs.oracle.com/javase/tutorial/java/IandI/abstract.html
//   - Interface fields are implicitly public static final (so no instance state), and
//     interface bodies can contain abstract, default, and static methods.
//     https://docs.oracle.com/javase/tutorial/java/IandI/interfaceDef.html
//   - A class extends one class but implements any number of interfaces; neither an
//     abstract class nor an interface can be instantiated. (abstract.html)
//
// Readouts are DERIVED from the members below, never hand-typed per step.

// The Robot type definition in each mode. `code` is the line; `comment` is a trailing
// faded note; `hot` marks a line worth highlighting. Stored as strings so nothing here
// is parsed as JSX.
export const TYPE = {
  abstract: {
    keyword: 'abstract class',
    lines: [
      { code: 'abstract class Robot {' },
      { code: '    int battery = 100;', comment: '// state: allowed', hot: true },
      { code: '    void charge() { battery = 100; }', comment: '// implemented: allowed', hot: true },
      { code: '    abstract void doJob();', comment: '// subclass MUST implement', hot: true },
      { code: '}' },
      { code: '' },
      { code: 'class CleanerBot extends Robot { void doJob() {...} }' },
      { code: 'class GuardBot   extends Robot { void doJob() {...} }' },
    ],
    // members drive the "must implement" readout: methods with impl:false are forced.
    members: [
      { name: 'battery', kind: 'field', impl: true },
      { name: 'charge', kind: 'method', impl: true },
      { name: 'doJob', kind: 'method', impl: false },
    ],
    take: { value: '1', word: 'one class' }, // a class extends only one class
  },
  interface: {
    keyword: 'interface',
    lines: [
      { code: 'interface Robot {' },
      { code: '    void doJob();', comment: '// implementer MUST implement', hot: true },
      { code: '    // fields are public static final:', dim: true },
      { code: '    // no instance state', dim: true, hot: true },
      { code: '}' },
      { code: '' },
      { code: 'class CleanerBot implements Robot { ... }' },
      { code: 'class GuardBot   implements Robot, Alarmed { ... }' },
    ],
    members: [{ name: 'doJob', kind: 'method', impl: false }],
    take: { value: 'many', word: 'interfaces' }, // implement any number of interfaces
  },
}

// The comparison checklist, revealed one row per step. Each row carries a per-mode
// verdict and a teaching status line. `verdict` drives the marker; `note` is the short
// label shown beside it.
//   verdicts: 'yes' | 'no' | 'partial' | 'one' | 'many'
export const CHECKLIST = [
  {
    id: 'force',
    label: 'Force implementers to provide doJob()',
    abstract: { verdict: 'yes', note: 'YES' },
    interface: { verdict: 'yes', note: 'YES' },
    statusAbstract: 'An abstract method has no body, so every concrete subclass must implement doJob().',
    statusInterface: 'An interface method is abstract by default, so every implementer must provide doJob().',
  },
  {
    id: 'state',
    label: 'Carry state (a battery field)',
    abstract: { verdict: 'yes', note: 'YES' },
    interface: { verdict: 'no', note: 'NO' },
    statusAbstract: 'An abstract class is a class, so it can hold instance fields like battery.',
    statusInterface: 'Interface fields are implicitly public static final, so an interface carries no instance state.',
  },
  {
    id: 'behavior',
    label: 'Provide implemented behavior (charge())',
    abstract: { verdict: 'yes', note: 'YES' },
    interface: { verdict: 'partial', note: 'only as a default method' },
    statusAbstract: 'An abstract class can define ordinary methods with bodies, like charge().',
    statusInterface: 'An interface can provide a body too, but only as a default method, marked with the default keyword.',
  },
  {
    id: 'count',
    label: 'How many can one class take on',
    abstract: { verdict: 'one', note: 'ONE' },
    interface: { verdict: 'many', note: 'MANY' },
    subAbstract: 'class GuardBot extends Robot',
    subInterface: 'class GuardBot implements Robot, Alarmed',
    statusAbstract: 'A class extends only one class, so it can inherit from just one abstract class.',
    statusInterface: 'A class can implement any number of interfaces, so GuardBot implements Robot and Alarmed.',
  },
  {
    id: 'instantiate',
    label: 'Instantiate directly with new Robot()',
    abstract: { verdict: 'no', note: 'NO' },
    interface: { verdict: 'no', note: 'NO' },
    strikeCode: 'new Robot()',
    statusAbstract: 'An abstract class cannot be instantiated. new Robot() does not compile.',
    statusInterface: 'An interface cannot be instantiated either. new Robot() does not compile.',
  },
]

export const LAST_STEP = CHECKLIST.length // 5

// Derived readouts, computed from the members / take rules above so they cannot drift.
export const mustImplement = (mode) =>
  TYPE[mode].members.filter((m) => m.kind === 'method' && !m.impl).length
export const canTake = (mode) => TYPE[mode].take
