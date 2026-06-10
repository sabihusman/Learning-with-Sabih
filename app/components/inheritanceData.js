// Robot inheritance tree for the Inheritance topic, plus the small helpers the
// figure animates: ancestry (climb to the root), member resolution (own /
// inherited / overridden), and method lookup (climb until a level defines it).
//
//            Robot
//           /     \
//   CleaningBot   GuardBot
//                    |
//              AttackGuardBot   <- leaf the lookup walk starts from

export const ROOT = 'Robot'
export const LEAF = 'AttackGuardBot'

// parent + own members per class. `overrides` are methods re-defined from an ancestor.
export const CLASSES = {
  Robot: { parent: null, color: '#2c6e7f', fields: ['name', 'batteryLevel'], methods: ['reportStatus', 'move'], overrides: [] },
  CleaningBot: { parent: 'Robot', color: '#4f6d9c', fields: [], methods: ['clean'], overrides: ['reportStatus'] },
  GuardBot: { parent: 'Robot', color: '#b07a2e', fields: [], methods: ['patrol'], overrides: ['reportStatus'] },
  AttackGuardBot: { parent: 'GuardBot', color: '#8a5a83', fields: [], methods: ['attack'], overrides: [] },
}

// Methods that can be called on the leaf, ordered to show a range of walks:
// attack() resolves at the leaf, patrol()/reportStatus() one level up (the latter
// at an override that short-circuits the climb), move() climbs all the way to Robot.
export const LEAF_METHODS = ['attack', 'patrol', 'reportStatus', 'move']

// box positions and sizes in the stage coordinate space (px)
export const BOX_W = 164
export const BOX_H = 86
export const STAGE_W = 500
export const STAGE_H = 356
export const LAYOUT = {
  Robot: { x: 168, y: 6 },
  CleaningBot: { x: 8, y: 134 },
  GuardBot: { x: 328, y: 134 },
  AttackGuardBot: { x: 328, y: 262 },
}

// from a class up to the root, e.g. AttackGuardBot -> GuardBot -> Robot
export function ancestry(name) {
  const chain = []
  let c = name
  while (c) {
    chain.push(c)
    c = CLASSES[c].parent
  }
  return chain
}

const defines = (cls, method) => CLASSES[cls].methods.includes(method) || CLASSES[cls].overrides.includes(method)

// All members visible on `name`, tagged relative to `name`:
//   own (defined here), overridden (re-defined here from an ancestor), inherited.
export function resolveMembers(name) {
  const chain = ancestry(name)
  const self = CLASSES[name]
  const fields = []
  const methods = []
  const seenF = new Set()
  const seenM = new Set()
  chain.forEach((cls, depth) => {
    const c = CLASSES[cls]
    c.fields.forEach((f) => {
      if (seenF.has(f)) return
      seenF.add(f)
      fields.push({ name: f, tag: depth === 0 ? 'own' : 'inherited', from: cls })
    })
    ;[...c.methods, ...c.overrides].forEach((m) => {
      if (seenM.has(m)) return
      seenM.add(m)
      let tag = 'inherited'
      if (depth === 0) tag = self.overrides.includes(m) ? 'overridden' : 'own'
      methods.push({ name: m, tag, from: cls })
    })
  })
  return { fields, methods }
}

// The own/overridden methods to print compactly inside a class box.
export function boxMethods(name) {
  const c = CLASSES[name]
  return [
    ...c.methods.map((m) => ({ name: m, tag: 'own' })),
    ...c.overrides.map((m) => ({ name: m, tag: 'overridden' })),
  ]
}

// The lookup walk for calling `method` on `name`: each level checked, climbing
// until a level that defines the method (own or override).
export function lookupPath(name, method) {
  const chain = ancestry(name)
  const path = []
  for (const cls of chain) {
    const found = defines(cls, method)
    path.push({ cls, found })
    if (found) break
  }
  return path
}
