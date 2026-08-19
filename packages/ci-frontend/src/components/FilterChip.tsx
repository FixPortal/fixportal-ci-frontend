// src/components/FilterChip.tsx
// A pressed-state filter toggle. Lives on its own because the chips are split
// across two rows: most sit in RepoFilterBar, while Ready to merge sits beside
// the search box in the toolbar.
//
// `tone` maps a chip to a status colour class so Failing reads red and Passing
// green, matching the board's status palette; others use the neutral accent.
export function FilterChip(props: {
  label: string
  pressed: boolean
  tone?: 'failing' | 'passing'
  onClick: () => void
}) {
  const tone = props.tone ? ` repo-filter__chip--${props.tone}` : ''
  return (
    <button
      type="button"
      className={`repo-filter__chip${tone}${props.pressed ? ' repo-filter__chip--on' : ''}`}
      aria-pressed={props.pressed}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  )
}
