'use client'

import { useState } from 'react'
import Figure from './Figure'
import { STEP_EVENTS, COHORTS, WINDOWS, MODES, MESSY_SESSIONS, computeFunnel, fmtPct, buildSql } from './funnelData'
import { INK, ACCENT, BLUE, BLUE_SOFT, BLUE_BG, LINE, MONO } from './vizPalette'
import shared from './vizShared.module.css'
import styles from './FunnelViz.module.css'

// Funnel shades, darkest at the top (widest) step. The two lighter steps carry
// ink text since white would not read on them.
const STEP_FILL = [BLUE, BLUE_SOFT, BLUE_BG]
const STEP_TEXT = ['#ffffff', INK, INK]
const GHOST_FILL = LINE

// ── SVG geometry ──────────────────────────────────────────────────────────────
const VB_W = 560
const CENTER_X = VB_W / 2
const TOP = 24
const BAR_H = 50
const GAP = 46
const MAX_BAR_W = 440

const barTop = (i) => TOP + i * (BAR_H + GAP)
const VB_H = barTop(STEP_EVENTS.length - 1) + BAR_H + 26

function Choice({ label, options, value, onChange, testPrefix }) {
  return (
    <fieldset className={`${shared.group} ${styles.fieldset}`}>
      <legend className={shared.groupLabel}>{label}</legend>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={shared.btn}
          aria-pressed={value === o.id}
          data-testid={`${testPrefix}-${o.id}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  )
}

export default function FunnelViz() {
  const [showDropoff, setShowDropoff] = useState(false)
  const [cohortId, setCohortId] = useState('all')
  const [mode, setMode] = useState('ordered')
  const [windowId, setWindowId] = useState('30')
  const [messy, setMessy] = useState(false)

  const windowMinutes = WINDOWS.find((w) => w.id === windowId).minutes
  const ordered = mode === 'ordered'
  const { steps, base, completion, outsideBase } = computeFunnel({ cohortId, mode, windowMinutes, messy })
  const cohortLabel = COHORTS.find((c) => c.id === cohortId).label

  // Bars scale against step 1, the funnel's one denominator.
  const barW = (count) => (base === 0 ? 0 : Math.min(1, count / base) * MAX_BAR_W)

  const controls = [
    ...MODES.map((m) => ({ label: m.label, onClick: () => setMode(m.id), active: mode === m.id })),
    { label: showDropoff ? 'Hide drop-off' : 'Show drop-off', onClick: () => setShowDropoff((d) => !d), active: showDropoff },
  ]
  const readouts = [
    { label: 'topic_opened', value: steps[0].count },
    { label: 'interactive_used', value: steps[1].count },
    { label: 'topic_completed', value: steps[2].count },
    { label: 'completion (of openers)', value: fmtPct(completion) },
  ]
  const status =
    outsideBase > 0
      ? `${outsideBase} session${outsideBase === 1 ? '' : 's'} counted at a later step never opened a topic: this count is not a funnel`
      : `${steps[2].count} of the ${base} sessions that opened a topic completed it (${fmtPct(completion)})`

  return (
    <Figure
      eyebrow="Analytics"
      title="A learning-app conversion funnel"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Start with the ordered funnel and shrink the window: at 2 minutes some completions fall outside it, at 1 minute most of them do. Then add the messy sessions and switch to Each step on its own: the later steps grow, and some of the sessions they count never opened a topic at all, which an ordered funnel can never do. Every percentage is a share of the sessions that opened a topic, so the steps are always comparable."
    >
      <div className={shared.scroll}>
        <svg
          role="img"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className={styles.svg}
          aria-label={`${cohortLabel}, ${ordered ? 'ordered funnel' : 'each step counted on its own'}: topic_opened ${steps[0].count}, interactive_used ${steps[1].count}, topic_completed ${steps[2].count} sessions, each shown as a share of the ${base} sessions that opened a topic.`}
        >
          {steps.map((s, i) => {
            const w = barW(s.count)
            const x = CENTER_X - w / 2
            const top = barTop(i)
            const prevW = i === 0 ? w : barW(steps[i - 1].count)
            const ghostX = CENTER_X - prevW / 2
            return (
              <g key={`${cohortId}-${mode}-${windowId}-${messy}-${s.event}`}>
                {showDropoff && s.dropped != null && s.dropped > 0 && (
                  <g className={styles.dropoff}>
                    <rect x={ghostX} y={top} width={prevW} height={BAR_H} rx={4} fill={GHOST_FILL} opacity={0.6} />
                    <text
                      x={CENTER_X + w / 2 + (prevW - w) / 4}
                      y={top + BAR_H / 2 + 3.5}
                      fontSize={10.5}
                      fill={ACCENT}
                      fontFamily={MONO}
                      fontWeight={700}
                      textAnchor="middle"
                    >
                      {`-${s.dropped}`}
                    </text>
                  </g>
                )}

                <rect
                  className={styles.bar}
                  style={{ animationDelay: `${i * 130}ms` }}
                  x={x}
                  y={top}
                  width={w}
                  height={BAR_H}
                  rx={4}
                  fill={STEP_FILL[i]}
                />

                <text x={CENTER_X} y={top - 7} fontSize={10.5} fill={INK} fontFamily={MONO} textAnchor="middle">
                  {i === 0 ? s.event : `${s.event}: ${fmtPct(s.shareOfBase)} of openers`}
                </text>

                <text
                  x={CENTER_X}
                  y={top + BAR_H / 2 + 6}
                  fontSize={18}
                  fill={STEP_TEXT[i]}
                  fontFamily={MONO}
                  fontWeight={700}
                  textAnchor="middle"
                  data-testid={`step-${i}`}
                >
                  {s.count}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className={styles.controls}>
        <Choice
          label="window from first open"
          options={WINDOWS}
          value={windowId}
          onChange={setWindowId}
          testPrefix="window"
        />
        <Choice label="cohort" options={COHORTS} value={cohortId} onChange={setCohortId} testPrefix="cohort" />
        <div className={shared.group}>
          <button
            type="button"
            className={shared.btn}
            aria-pressed={messy}
            data-testid="messy"
            onClick={() => setMessy((m) => !m)}
          >
            {`Add ${MESSY_SESSIONS.length} messy sessions: ${messy ? 'on' : 'off'}`}
          </button>
          <span className={styles.base} data-testid="base">{`denominator: ${base} sessions that opened a topic`}</span>
        </div>
        {!ordered && (
          <p className={styles.note}>The window does not apply here: counting each step on its own ignores order and time.</p>
        )}
      </div>

      <pre className={styles.sql} data-testid="sql">
        {buildSql({ cohortId, mode, windowMinutes })}
      </pre>

      {messy && (
        <ul className={styles.messy}>
          {MESSY_SESSIONS.map((s) => (
            <li key={s.session_id}>
              {`session ${s.session_id}: ${s.story}`}
            </li>
          ))}
        </ul>
      )}

      <p className={shared.caption}>
        Counts come from the shared events table, run through exactly the SQL shown. The five messy sessions are
        hand-written examples of how real event data goes wrong; they exist only in this figure, because the shared
        data happens to fire every step in order.
      </p>
    </Figure>
  )
}
