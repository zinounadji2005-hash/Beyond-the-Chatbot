import { useState } from 'react'

export default function WhyExplainer({ reasoning, department }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-neutral-800 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Why this priority?
        <span className="ml-1 px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 text-[10px] uppercase tracking-wide">
          {department}
        </span>
      </button>
      {open && (
        <p className="mt-2 text-sm text-neutral-300 leading-relaxed">{reasoning}</p>
      )}
    </div>
  )
}