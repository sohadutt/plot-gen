export function ZoomIndicator({ percent }) {
  if (!percent) return null

  return (
    <div className="pointer-events-none absolute bottom-5 left-5 z-[60] rounded-md border border-line bg-surface/90 px-2 py-1 font-mono text-xs text-ink-muted shadow-panel backdrop-blur-sm">
      {percent}%
    </div>
  )
}
