'use client'

import shared from './vizShared.module.css'

// A labelled set of mutually exclusive in-card buttons: a <fieldset> with a
// <legend>, so the group is announced as one control, styled like the shared
// button group. Each button carries data-testid `${testPrefix}-${option.id}`.
export default function ChoiceGroup({ label, options, value, onChange, testPrefix }) {
  return (
    <fieldset className={`${shared.group} ${shared.fieldset}`}>
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
