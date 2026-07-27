import { test, expect } from '@playwright/test'
import { DEFAULTS, evaluate, buildDefinition } from '../app/components/abstractInterfaceData'

// Pure-function correctness for the GuardBot contract builder (R6). No page,
// no browser: asserts directly on the same evaluate()/buildDefinition() the
// component renders, so a change to the rule table or the priority order
// fails here before it ever reaches a browser.
//
// The verdict depends on exactly 5 inputs (kind, implementsDoJob, hasBattery,
// takesAlarmed, triedNew) = 2^5 = 32 states, enumerated exhaustively below.
// hasChargeBody is deliberately excluded from that space: it is purely
// descriptive and must never affect the verdict (see its own test below).

const KIND = ['abstract', 'interface'] as const
const BOOL = [true, false]

// Independently-reasoned reference classification, not a call into
// evaluate(): if this ever silently converges to a copy of evaluate()'s own
// branching, that's fine (the two were authored separately from the same
// spec); the value is in asserting every one of the 32 cells, not a sample.
function expectedCategory(kind: string, doJob: boolean, battery: boolean, alarmed: boolean, triedNew: boolean) {
  if (triedNew) return 'new'
  if (kind === 'abstract' && alarmed) return 'second-parent'
  if (!doJob) return 'missing-dojob'
  if (kind === 'interface' && battery) return 'note'
  return 'plain-compiles'
}

function allStates() {
  const states: { kind: string; implementsDoJob: boolean; hasBattery: boolean; takesAlarmed: boolean; triedNew: boolean }[] = []
  for (const kind of KIND) {
    for (const implementsDoJob of BOOL) {
      for (const hasBattery of BOOL) {
        for (const takesAlarmed of BOOL) {
          for (const triedNew of BOOL) {
            states.push({ kind, implementsDoJob, hasBattery, takesAlarmed, triedNew })
          }
        }
      }
    }
  }
  return states
}

test('there are exactly 32 states in the verdict-relevant combination space', () => {
  expect(allStates().length).toBe(32)
})

test('every one of the 32 states produces the correct compiles/does-not-compile verdict and priority', () => {
  for (const s of allStates()) {
    const category = expectedCategory(s.kind, s.implementsDoJob, s.hasBattery, s.takesAlarmed, s.triedNew)
    const result = evaluate({ ...s, hasChargeBody: true })
    const label = JSON.stringify(s)

    if (category === 'new') {
      expect(result.compiles, label).toBe(false)
      expect(result.message, label).toContain('new Robot() does not compile')
      expect(result.message, label).toContain(s.kind === 'abstract' ? 'Robot is abstract' : 'Robot is an interface')
    } else if (category === 'second-parent') {
      expect(result.compiles, label).toBe(false)
      expect(result.message, label).toContain('extends Robot, Alarmed')
      expect(result.message, label).toContain('extend only one class')
      // priority: must not also mention new Robot() or doJob when this wins
      expect(result.message, label).not.toContain('new Robot()')
    } else if (category === 'missing-dojob') {
      expect(result.compiles, label).toBe(false)
      expect(result.message, label).toContain('does not implement doJob()')
      expect(result.message, label).toContain(s.kind === 'abstract' ? 'abstract class Robot' : 'interface Robot')
      expect(result.message, label).not.toContain('new Robot()')
      expect(result.message, label).not.toContain('extends Robot, Alarmed')
    } else if (category === 'note') {
      expect(result.compiles, label).toBe(true)
      expect(result.message, label).toContain('compiles')
      expect(result.message, label).toContain('public static final')
      expect(result.message, label).toContain('not per-object state')
    } else {
      // plain-compiles
      expect(result.compiles, label).toBe(true)
      expect(result.message, label).toBe('GuardBot compiles.')
    }
  }
})

test('hasChargeBody never changes the verdict for any of the 32 states (purely descriptive)', () => {
  for (const s of allStates()) {
    const withBody = evaluate({ ...s, hasChargeBody: true })
    const withoutBody = evaluate({ ...s, hasChargeBody: false })
    const label = JSON.stringify(s)
    expect(withoutBody.compiles, label).toBe(withBody.compiles)
    expect(withoutBody.message, label).toBe(withBody.message)
  }
})

test('DEFAULTS produce a plain compiles verdict with no note and no error', () => {
  const result = evaluate(DEFAULTS)
  expect(result.compiles).toBe(true)
  expect(result.message).toBe('GuardBot compiles.')
})

test('buildDefinition: the illegal second-parent line is flagged as an error, and only in abstract mode', () => {
  const abstractWithAlarmed = buildDefinition({ ...DEFAULTS, kind: 'abstract', takesAlarmed: true })
  const classLine = abstractWithAlarmed.guardBotLines[0]
  expect(classLine.code).toContain('extends Robot, Alarmed')
  expect(classLine.error).toBe(true)

  const interfaceWithAlarmed = buildDefinition({ ...DEFAULTS, kind: 'interface', takesAlarmed: true })
  const implementsLine = interfaceWithAlarmed.guardBotLines[0]
  expect(implementsLine.code).toContain('implements Robot, Alarmed')
  expect(implementsLine.error).toBeFalsy()
})

test('buildDefinition: doJob() line is present when implemented, a dim placeholder when not', () => {
  const implemented = buildDefinition({ ...DEFAULTS, implementsDoJob: true })
  expect(implemented.guardBotLines.some((l) => l.code.includes('void doJob() { ... }'))).toBe(true)

  const missing = buildDefinition({ ...DEFAULTS, implementsDoJob: false })
  const placeholder = missing.guardBotLines.find((l) => l.code.includes('doJob() not implemented'))
  expect(placeholder).toBeTruthy()
  expect(placeholder?.dim).toBe(true)
})

test('buildDefinition: hasChargeBody toggles whether charge() appears in the contract at all, in both modes', () => {
  for (const kind of KIND) {
    const withCharge = buildDefinition({ ...DEFAULTS, kind, hasChargeBody: true })
    const withoutCharge = buildDefinition({ ...DEFAULTS, kind, hasChargeBody: false })
    expect(withCharge.robotLines.some((l) => l.code.includes('charge()'))).toBe(true)
    expect(withoutCharge.robotLines.some((l) => l.code.includes('charge()'))).toBe(false)
  }
  // interface mode's charge() body requires the default keyword (Java 8+)
  const interfaceCharge = buildDefinition({ ...DEFAULTS, kind: 'interface', hasChargeBody: true })
  expect(interfaceCharge.robotLines.some((l) => l.code.includes('default void charge()'))).toBe(true)
})

test('buildDefinition: interface mode never shows an assignment to battery, since interface fields are implicitly final', () => {
  for (const hasBattery of BOOL) {
    const def = buildDefinition({ ...DEFAULTS, kind: 'interface', hasBattery, hasChargeBody: true })
    const chargeLine = def.robotLines.find((l) => l.code.includes('charge()'))
    expect(chargeLine?.code, JSON.stringify({ hasBattery })).not.toContain('battery = 100')
  }

  // Abstract mode is unaffected: battery is a real mutable instance field
  // there, so the assignment is legal and must still be shown.
  const abstractWithBattery = buildDefinition({ ...DEFAULTS, kind: 'abstract', hasBattery: true, hasChargeBody: true })
  const abstractChargeLine = abstractWithBattery.robotLines.find((l) => l.code.includes('charge()'))
  expect(abstractChargeLine?.code).toContain('battery = 100')
})

test('buildDefinition: battery field is present only when toggled on, with a constant comment in interface mode', () => {
  const abstractBattery = buildDefinition({ ...DEFAULTS, kind: 'abstract', hasBattery: true })
  expect(abstractBattery.robotLines.some((l) => l.code.includes('int battery'))).toBe(true)

  const interfaceBattery = buildDefinition({ ...DEFAULTS, kind: 'interface', hasBattery: true })
  const batteryLine = interfaceBattery.robotLines.find((l) => l.code.includes('int battery'))
  expect(batteryLine?.comment).toContain('public static final')

  const noBattery = buildDefinition({ ...DEFAULTS, hasBattery: false })
  expect(noBattery.robotLines.some((l) => l.code.includes('battery'))).toBe(false)
})

test('buildDefinition: new Robot() only appears, struck through, once triedNew is true', () => {
  const before = buildDefinition({ ...DEFAULTS, triedNew: false })
  expect(before.newLine).toBeNull()

  const after = buildDefinition({ ...DEFAULTS, triedNew: true })
  expect(after.newLine?.code).toBe('new Robot();')
  expect(after.newLine?.strike).toBe(true)
})
