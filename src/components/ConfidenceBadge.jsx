const COLORS = {
  auto: { bar: 'bg-emerald-400', label: 'text-emerald-300' },
  propose: { bar: 'bg-amber-400', label: 'text-amber-300' },
  judgment: { bar: 'bg-red-500', label: 'text-red-300' },
}

export default function ConfidenceBadge({ value, bucket }) {
  const c = COLORS[bucket] || COLORS.judgment
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${c.bar}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className={`text-[11px] font-medium tabular-nums ${c.label}`}>{value}&#37;</span>
    </div>
  )
}