import styles from './Figure.module.css'

/**
 * Presentational chrome that every interaction plugs into.
 *
 * Two archetypes it serves without baking either in:
 *   (a) Time-stepped (gradient descent): pass controls with play/pause/step/reset
 *       onClick handlers; pass a status string; pass readouts for live values.
 *   (b) State-driven, no clock (SQL join toggle): pass controls as labeled toggle
 *       buttons with active:true on the selected one; omit status/readouts.
 *
 * The interaction component owns all state and animation; it passes this shell
 * only the display config it needs.
 *
 * Props
 * -----
 * eyebrow?  string                      section category label above the title
 * title?    string                      visualization title
 * children                              the visualization (SVG, Canvas, etc.)
 * controls? Array<{
 *   label: string
 *   onClick: () => void
 *   disabled?: boolean
 *   active?: boolean     highlighted (for toggle-style button groups)
 *   variant?: 'primary'  filled-dark style for the main action button
 * }>
 * status?   string                      one-line status shown beside controls
 * readouts? Array<{ label: string, value: string | number }>
 * tryThis?  string                      callout text in the left-border aside
 */
export default function Figure({
  eyebrow,
  title,
  children,
  controls,
  status,
  readouts,
  tryThis,
}) {
  return (
    <figure className={styles.figure}>
      {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
      {title && <h3 className={styles.title}>{title}</h3>}

      <div className={styles.card}>{children}</div>

      {/* Render the bar when there are controls OR a status line. Some figures pass
          a status but no controls (e.g. overfitting, temperature, select-where-case);
          without this the status was silently dropped. */}
      {((controls && controls.length > 0) || status) && (
        <div className={styles.controlsBar}>
          {controls &&
            controls.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={c.onClick}
                disabled={!!c.disabled}
                data-active={c.active ? 'true' : undefined}
                data-variant={c.variant ?? undefined}
                className={styles.button}
              >
                {c.label}
              </button>
            ))}
          {status && <span className={styles.status}>{status}</span>}
        </div>
      )}

      {readouts && readouts.length > 0 && (
        <dl className={styles.readouts}>
          {readouts.map((r) => (
            <div key={r.label} className={styles.readout}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {tryThis && (
        <aside className={styles.tryThis}>
          <span className={styles.tryLabel}>Try this</span>
          {tryThis}
        </aside>
      )}
    </figure>
  )
}
