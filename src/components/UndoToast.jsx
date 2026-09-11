import { useEffect, useState } from 'react'

const R = 9
const CIRC = 2 * Math.PI * R

export default function UndoToast({ customer, expiresAt, onUndo, onExpire }) {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now()
      setRemaining(Math.max(0, ms / 1000))
      if (ms <= 0) {
        clearInterval(interval)
        onExpire?.()
      }
    }
    tick()
    const interval = setInterval(tick, 100)
    return () => clearInterval(interval)
  }, [expiresAt, onExpire])

  const secondsLeft = Math.ceil(remaining)
  const progress = remaining / 10
  const dashOffset = CIRC * (1 - Math.min(1, progress))

  return (
    <div className="fixed bottom-6 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-neutral-900 ring-1 ring-neutral-700 pl-4 pr-2 py-2 text-sm shadow-2xl shadow-black/50">
        <span className="text-neutral-300">
          Sent to <span className="font-semibold text-neutral-100">{customer}</span>
        </span>
        <div className="relative w-6 h-6">
          <svg viewBox="0 0 24 24" className="w-6 h-6 -rotate-90">
            <circle
              cx="12"
              cy="12"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-neutral-700"
            />
            <circle
              cx="12"
              cy="12"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
              className="text-emerald-400 transition-all duration-100"
            />
          </svg>
          <span className="absolute inset-0 grid place-items-center text-[9px] font-semibold text-emerald-300 tabular-nums">
            {secondsLeft}
          </span>
        </div>
        <button
          onClick={onUndo}
          className="rounded-full px-3 py-1.5 font-semibold text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 transition-colors"
        >
          Undo
        </button>
      </div>
    </div>
  )
}