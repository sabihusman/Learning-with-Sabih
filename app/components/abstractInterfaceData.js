// Data and rules for "Two kinds of contract" (R6): the reader builds GuardBot
// against either an abstract class or an interface contract and the figure
// computes whether it compiles. Every rule below is verified against the
// official Oracle Java Tutorial / JLS, not memory:
//
//   - A concrete subclass that does not implement an inherited abstract
//     method fails to compile (the class itself would have to be declared
//     abstract instead). https://docs.oracle.com/javase/tutorial/java/IandI/abstract.html
//   - Interface fields are implicitly public, static, and final: a shared
//     constant, not per-instance state. Declaring one is NOT an error.
//     https://docs.oracle.com/javase/tutorial/java/IandI/interfaceDef.html
//   - A class extends only one class (abstract or not) but can implement any
//     number of interfaces. https://docs.oracle.com/javase/tutorial/java/IandI/abstract.html
//   - An interface method with a body needs the `default` keyword (Java 8+).
//     https://docs.oracle.com/javase/tutorial/java/IandI/defaultmethods.html
//   - Neither an abstract class nor an interface can be instantiated with a
//     plain `new`. JLS 15.9.1: a class instance creation expression's type
//     "must denote a class that is accessible, non-abstract"; an interface
//     identifier does not satisfy that at all. https://docs.oracle.com/javase/specs/jls/se17/html/jls-15.html#jls-15.9
//
// One control has NO effect on the verdict, by design (confirmed, not
// guessed): whether the contract's charge() has a working body. It only
// changes what the contract's own definition looks like (whether charge()
// is part of the contract at all, and whether it needs the `default`
// keyword in interface mode); no combination of it with anything else here
// produces a compile error, so it never appears in evaluate().

export const DEFAULTS = {
  kind: 'abstract', // 'abstract' | 'interface'
  implementsDoJob: true,
  hasBattery: true,
  takesAlarmed: false,
  hasChargeBody: true,
  triedNew: false,
}

// The single rule function every verdict is derived from. Priority order is
// a design choice (not a Java fact): attempting `new Robot()` always wins,
// then an illegal second parent, then a missing required method, then the
// interface-field note last since it is informational, not an error.
export function evaluate({ kind, implementsDoJob, hasBattery, takesAlarmed, triedNew }) {
  const isAbstract = kind === 'abstract'
  const contractName = isAbstract ? 'abstract class Robot' : 'interface Robot'

  if (triedNew) {
    return {
      compiles: false,
      message: `new Robot() does not compile: Robot is ${isAbstract ? 'abstract' : 'an interface'} and cannot be instantiated.`,
    }
  }
  if (isAbstract && takesAlarmed) {
    return {
      compiles: false,
      message: 'class GuardBot extends Robot, Alarmed does not compile: a class can extend only one class.',
    }
  }
  if (!implementsDoJob) {
    return {
      compiles: false,
      message: `GuardBot does not compile: it does not implement doJob(), required by ${contractName}.`,
    }
  }
  if (!isAbstract && hasBattery) {
    return {
      compiles: true,
      message:
        'GuardBot compiles. Note: battery is implicitly public static final, a constant shared by every implementer, not per-object state.',
    }
  }
  return { compiles: true, message: 'GuardBot compiles.' }
}

// Builds the displayed Robot / GuardBot definitions from the same live
// state, so the code shown always matches the toggles (nothing hand-typed
// per combination). `error` flags a line that is itself illegal to write;
// `strike` flags an expression that fails when used, mirroring the
// Encapsulation figure's existing "does not compile" treatment.
export function buildDefinition({ kind, implementsDoJob, hasBattery, takesAlarmed, hasChargeBody, triedNew }) {
  const isAbstract = kind === 'abstract'

  const robotLines = [{ code: `${isAbstract ? 'abstract class' : 'interface'} Robot {` }]
  if (hasBattery) {
    robotLines.push(
      isAbstract
        ? { code: '    int battery = 100;', comment: '// instance state: allowed', hot: true }
        : { code: '    int battery = 100;', comment: '// implicitly public static final', hot: true }
    )
  }
  if (hasChargeBody) {
    // The body only references battery when that field actually exists on the
    // contract, so the displayed code never reads a field that is not there.
    const body = (hasBattery && isAbstract) ? '{ battery = 100; }' : '{ /* recharge */ }'
    robotLines.push(
      isAbstract
        ? { code: `    void charge() ${body}`, comment: '// implemented: allowed', hot: true }
        : { code: `    default void charge() ${body}`, comment: '// default method, Java 8+', hot: true }
    )
  }
  robotLines.push(
    isAbstract
      ? { code: '    abstract void doJob();', comment: '// implementer MUST implement', hot: true }
      : { code: '    void doJob();', comment: '// implementer MUST implement', hot: true }
  )
  robotLines.push({ code: '}' })

  const parentKeyword = isAbstract ? 'extends' : 'implements'
  const parents = takesAlarmed ? 'Robot, Alarmed' : 'Robot'
  const guardBotLines = [
    { code: `class GuardBot ${parentKeyword} ${parents} {`, error: isAbstract && takesAlarmed },
    implementsDoJob
      ? { code: '    void doJob() { ... }' }
      : { code: '    // doJob() not implemented', dim: true },
    { code: '}' },
  ]

  const newLine = triedNew ? { code: 'new Robot();', strike: true } : null

  return { robotLines, guardBotLines, newLine }
}
