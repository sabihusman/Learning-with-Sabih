'use client'

import { useState } from 'react'
import Figure from './Figure'
import ChoiceGroup from './ChoiceGroup'
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
  const neverOpened = `${outsideBase} session${outsideBase === 1 ? '' : 's'} counted at a later step never opened a topic`
  let status = `${steps[2].count} of the ${base} sessions that opened a topic completed it (${fmtPct(completion)})`
  if (!ordered) {
    status =
      outsideBase > 0
        ? `${neverOpened}: this count is not a funnel`
        : 'Old counting: these totals ignore order and the window, so they are not a funnel even where they match'
  }

  return (
    <Figure
      eyebrow="Analytics"
      title="A learning-app conversion funnel"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Set the window to 1 minute and note which step loses the most sessions. Then add the messy sessions, switch to the old counting, and find the exact moment the completion count rises from 45 to 50. Those 5 extra completions are the bug this topic exists to warn about: which sessions are they, and what did each of them actually do?"
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
        <ChoiceGroup
          label="window from first open"
          options={WINDOWS}
          value={windowId}
          onChange={setWindowId}
          testPrefix="window"
        />
        <ChoiceGroup label="cohort" options={COHORTS} value={cohortId} onChange={setCohortId} testPrefix="cohort" />
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
          <p className={styles.note} role="alert" data-testid="old-way-warning">
            {`Old way, incorrect: each step is counted on its own, ignoring order and the window. ${
              outsideBase > 0
                ? `${neverOpened}.`
                : 'On this data the totals happen to match the ordered funnel; add the messy sessions to see them diverge.'
            }`}
          </p>
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
        Every percentage on this page divides by the same base: the sessions that opened a topic (143 in the full
        cohort). The messy sessions are five hand-written sessions added on request; the shared dataset itself fires
        every step in order.
      </p>
    </Figure>
  )
}
