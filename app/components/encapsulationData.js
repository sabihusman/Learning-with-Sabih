// Hand-authored deterministic scenario for "The object defends itself". A BankAccount
// has one invariant: balance must never go negative. The same three outside-code
// actions run in two modes; only the access modifier on `balance` differs.
//
// Nothing here is hand-typed per step: balance and the invariant flag are REPLAYED
// from these rules, so the readouts can never drift from what the actions describe.

export const START_BALANCE = 100

// The fixed outside-code sequence. Each entry renders differently per mode (public
// code pokes the field directly; private code must go through withdraw()), but it is
// conceptually the same three actions:
//   1. a legitimate withdrawal
//   2. a direct write that forces the balance negative
//   3. an overdraw larger than the balance
//
// kind drives the replay outcome:
//   'direct': public field write, no guard, so it always applies (this is the danger)
//   'assign': direct write to a literal value; applies when public, will not compile
//             when private (the field is not visible to outside code)
//   'method': withdraw(amount), where the guard applies it only when amount <= balance
export const ACTIONS = [
  {
    id: 'withdraw40',
    public: { code: 'account.balance -= 40', kind: 'direct', amount: 40 },
    private: { code: 'account.withdraw(40)', kind: 'method', amount: 40 },
    statusPublic: 'Outside code lowers the field directly. It works, and this one happens to be harmless.',
    statusPrivate: 'withdraw() runs its guard, the amount fits, so the balance drops. A normal withdrawal.',
  },
  {
    id: 'forceNegative',
    public: { code: 'account.balance = -500', kind: 'assign', value: -500 },
    private: { code: 'account.balance = -500', kind: 'assign', value: -500 },
    statusPublic: 'A direct write forces the balance negative. Nothing checks it. The invariant is broken.',
    statusPrivate: 'The field is private, so this line does not even compile. The account is untouched.',
  },
  {
    id: 'overdraw200',
    public: { code: 'account.balance -= 200', kind: 'direct', amount: 200 },
    private: { code: 'account.withdraw(200)', kind: 'method', amount: 200 },
    statusPublic: 'Another direct write lands. The account has no say in its own state.',
    statusPrivate: 'withdraw() sees the amount exceeds the balance and refuses. The balance holds.',
  },
]

export const LAST_STEP = ACTIONS.length // 3

// Replay the first `upto` actions in the given mode from the starting balance. Returns
// the resulting balance plus each action's outcome ('applied' | 'refused' | 'nocompile').
export function replay(mode, upto) {
  let balance = START_BALANCE
  const outcomes = []
  for (let i = 0; i < upto; i += 1) {
    const a = ACTIONS[i][mode]
    let outcome
    if (a.kind === 'direct') {
      balance -= a.amount
      outcome = 'applied'
    } else if (a.kind === 'assign') {
      if (mode === 'public') {
        balance = a.value
        outcome = 'applied'
      } else {
        outcome = 'nocompile' // private field: the compiler rejects the write
      }
    } else {
      // method: withdraw() enforces the invariant with its guard
      if (a.amount <= balance) {
        balance -= a.amount
        outcome = 'applied'
      } else {
        outcome = 'refused'
      }
    }
    outcomes.push(outcome)
  }
  return { balance, outcomes }
}

export const invariantBroken = (balance) => balance < 0

// Display helper: -700 -> "-$700", 60 -> "$60". Kept out of the readout literals so
// the sign/format stays in one place.
export function formatMoney(v) {
  const n = Math.abs(v)
  return v < 0 ? `-$${n}` : `$${n}`
}
