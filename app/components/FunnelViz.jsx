'use client'

import { useState } from 'react'
import Figure from './Figure'
import { STEP_EVENTS, COHORTS, computeFunnel, fmtPct, buildSql } from './funnelData'
import styles from './FunnelViz.module.css'

const INK = '#1a1a1a'
const FADE = '#9b9892'
const ACCENT = '#c0392b'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

// Funnel shades, darkest at the top (widest) step.
const STEP_FILL = ['#2c6e7f', '#4f97a3', '#84bcc4']
const GHOST_FILL = '#ded8cf'

// ── SVG geometry ──────────────────────────────────────────────────────────────
const VB_W = 560
const CENTER_X = VB_W / 2
const TOP = 24
const BAR_H = 50
const GAP = 46
const MAX_BAR_W = 440

// Bar widths are scaled against the largest possible step-0 count (the unfiltered
// funnel), so switching cohorts shrinks the bars rather than rescaling the whole chart.
const maxCount = computeFunnel('all').steps[0].count
const barW = (count) => (count / maxCount) * MAX_BAR_W
const barTop = (i) => TOP + i * (BAR_H + GAP)
const VB_H = barTop(STEP_EVENTS.length - 1) + BAR_H + 26

export default function FunnelViz() {
  const [showDropoff, setShowDropoff] = useState(false)
  const [cohort, setCohort] = useState('all')

  const { steps, stepStats, totalSessions, overallRate } = computeFunnel(cohort)

  const controls = [
    { label: showDropoff ? 'Hide drop-off' : 'Show drop-off', onClick: () => setShowDropoff((d) => !d), active: showDropoff },
    ...COHORTS.map((c) => ({
      label: c === 'all' ? 'All sessions' : `${c[0].toUpperCase()}${c.slice(1)} plan`,
      onClick: () => setCohort(c),
      active: cohort === c,
    })),
  ]
  const readouts = [
    { label: 'topic_opened', value: steps[0].count },
    { label: 'interactive_used', value: steps[1].count },
    { label: 'topic_completed', value: steps[2].count },
    { label: 'overall completion', value: fmtPct(overallRate) },
  ]
  const status = `${steps[2].count} of ${totalSessions} sessions completed (${fmtPct(overallRate)})`

  return (
    <Figure
      eyebrow="Analytics"
      title="A learning-app conversion funnel"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Each bar is the number of distinct sessions that reached a step: a session counts at a step if it ever fired that event. The percentages between bars are step-to-step conversion, and the overall completion rate is the final step over all sessions in view. Switch between All sessions, Pro plan, and Free plan to recompute every count live from a real join against each session's owning user: pro sessions convert noticeably better end to end than free ones, and the two cohorts don't necessarily leak at the same step. Turn on drop-off to see how many sessions are lost at each step. The SQL builds one set of distinct sessions per step (filtered by plan when a cohort is selected), then counts each."
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: '100%', maxWidth: 560, height: 'auto', display: 'block', margin: '0 auto' }}
        aria-label={`A three-step conversion funnel for ${cohort === 'all' ? 'all sessions' : `the ${cohort} plan`}: topic_opened ${steps[0].count}, interactive_used ${steps[1].count}, topic_completed ${steps[2].count}, with step-to-step conversion percentages and optional drop-off.`}
      >
        {stepStats.map((s, i) => {
          const w = barW(s.count)
          const x = CENTER_X - w / 2
          const top = barTop(i)
          const prevW = s.prevCount == null ? w : barW(s.prevCount)
          const ghostX = CENTER_X - prevW / 2
          return (
            <g key={s.event}>
              {/* drop-off wings: the previous step's width behind this bar */}
              {showDropoff && s.dropped != null && s.dropped > 0 && (
                <g className={styles.dropoff} key={`ghost-${showDropoff}-${s.event}`}>
                  <rect x={ghostX} y={top} width={prevW} height={BAR_H} rx={4} fill={GHOST_FILL} opacity={0.6} />
                  <text
                    x={CENTER_X + w / 2 + (prevW - w) / 4}
                    y={top + BAR_H / 2 + 3.5}
                    fontSize={10.5}
                    fill={ACCENT}
                    fontFamily={MONO}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {`-${s.dropped}`}
                  </text>
                </g>
              )}

              {/* the step bar (animated grow) */}
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

              {/* event name above the bar */}
              <text x={CENTER_X} y={top - 7} fontSize={10.5} fill={INK} fontFamily={MONO} textAnchor="middle">
                {s.event}
              </text>

              {/* distinct-session count inside the bar */}
              <text x={CENTER_X} y={top + BAR_H / 2 + 6} fontSize={18} fill="#ffffff" fontFamily={MONO} fontWeight="bold" textAnchor="middle">
                {s.count}
              </text>

              {/* step-to-step conversion in the gap above this bar */}
              {s.conversion != null && (
                <text x={CENTER_X} y={top - 24} fontSize={11} fill={ACCENT} fontFamily={MONO} fontWeight="bold" textAnchor="middle">
                  {`${fmtPct(s.conversion)} continued${showDropoff ? `   (${fmtPct(s.dropRate)} lost)` : ''}`}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* SQL: one CTE of distinct sessions per step, then count each */}
      <pre
        style={{
          marginTop: 14,
          padding: '12px 14px',
          background: '#f0ede6',
          border: '1px solid #e2e0d8',
          borderRadius: 6,
          fontFamily: MONO,
          fontSize: 12,
          lineHeight: 1.5,
          color: INK,
          overflowX: 'auto',
        }}
      >
        {buildSql(cohort)}
      </pre>

      <p className={styles.note}>
        A session is counted once per step, by COUNT(DISTINCT session_id), so repeat events within a session do not
        inflate the funnel.
      </p>
    </Figure>
  )
}
