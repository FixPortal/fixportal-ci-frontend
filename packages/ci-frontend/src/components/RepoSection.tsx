export function RepoSection({ label, count, collapsed, onToggle }: {
  label: string
  count: number
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className="repo-section"
      aria-expanded={!collapsed}
      onClick={onToggle}
    >
      <span className="repo-section__chevron" aria-hidden="true">
        {collapsed ? '▸' : '▾'}
      </span>
      <span className="repo-section__label">{label}</span>
      <span className="repo-section__count" aria-hidden="true">· {count}</span>
    </button>
  )
}
