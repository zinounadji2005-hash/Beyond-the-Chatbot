import { useRef, useState } from 'react'
import ConfidenceBadge from './ConfidenceBadge.jsx'
import WhyExplainer from './WhyExplainer.jsx'

const PRIORITY_STYLE = {
  urgent: 'bg-red-500/10 text-red-300 ring-red-500/40',
  high: 'bg-orange-500/10 text-orange-300 ring-orange-500/40',
  medium: 'bg-yellow-500/10 text-yellow-200 ring-yellow-500/40',
  low: 'bg-gray-500/10 text-gray-300 ring-gray-500/40',
}

const TRUNCATE = 320

const btnPrimary =
  'rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const btnNeutral =
  'rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-700 transition-colors'
const btnGhost =
  'rounded-lg px-4 py-2 text-sm font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 transition-colors'

export default function DecisionCard({ data, onApprove, onEdit, onSkip, busy }) {
  const { ticket, decision, routing } = data
  const bucket = routing.bucket
  const isAuto = bucket === 'auto'
  const isJudgment = bucket === 'judgment'

  const [reply, setReply] = useState(decision.ai_suggested_reply)
  const [editing, setEditing] = useState(false)
  const [ticketOpen, setTicketOpen] = useState(decision.ticket_text.length <= TRUNCATE)
  const [showReply, setShowReply] = useState(isAuto || !isJudgment)
  const textareaRef = useRef(null)

  const startEdit = () => {
    setEditing(true)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const cancelEdit = () => {
    setEditing(false)
    setReply(decision.ai_suggested_reply)
  }

  return (
    <div className="w-full max-w-xl rounded-2xl bg-neutral-900/80 p-6 ring-1 ring-neutral-800 shadow-2xl shadow-black/40">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ${PRIORITY_STYLE[decision.ai_priority]}`}
        >
          {decision.ai_priority}
        </span>
        <ConfidenceBadge value={decision.ai_confidence} bucket={bucket} />
      </div>

      {isAuto && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sent automatically — undo available for {routing.undoWindowSeconds}s
        </div>
      )}

      {isJudgment && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Not confident — this one needs your judgment.
        </div>
      )}

      <div className="mb-4">
        <div className="mb-1 text-[11px] uppercase tracking-widest text-neutral-500">Ticket</div>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-100">
          {ticketOpen ? decision.ticket_text : `${decision.ticket_text.slice(0, TRUNCATE)}…`}
        </p>
        {!ticketOpen && (
          <button
            onClick={() => setTicketOpen(true)}
            className="mt-1 text-xs text-blue-300 hover:text-blue-200"
          >
            Show full ticket
          </button>
        )}
      </div>

      <div className="mb-3">
        <div className="mb-1 text-[11px] uppercase tracking-widest text-neutral-500">
          Suggested reply
        </div>
        {isJudgment && !showReply ? (
          <button
            onClick={() => setShowReply(true)}
            className="w-full rounded-lg border border-dashed border-neutral-700 px-3 py-2.5 text-left text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Reveal suggested reply
          </button>
        ) : (
          <textarea
            ref={textareaRef}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            readOnly={isAuto}
            rows={3}
            className={`w-full resize-y rounded-lg border bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none transition-colors ${
              isAuto
                ? 'cursor-not-allowed border-neutral-800'
                : editing
                  ? 'border-blue-500/60 focus:border-blue-400'
                  : 'border-neutral-800 focus:border-neutral-600'
            } ${isJudgment ? 'opacity-60' : ''}`}
          />
        )}
      </div>

      <WhyExplainer reasoning={decision.ai_reasoning} department={decision.ai_department} />

      {!isAuto && (
        <div className="mt-5 flex items-center gap-2">
          {editing ? (
            <>
              <button className={`${btnPrimary} ${busy ? 'opacity-50 cursor-wait' : ''}`} onClick={() => onEdit(reply)} disabled={busy}>
                Save &amp; Send
              </button>
              <button className={btnGhost} onClick={cancelEdit} disabled={busy}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button className={`${btnPrimary} ${busy ? 'opacity-50 cursor-wait' : ''}`} onClick={() => onApprove(reply)} disabled={busy}>
                Approve &amp; Send
              </button>
              <button className={btnNeutral} onClick={startEdit} disabled={busy}>
                Edit
              </button>
              <button className={btnGhost} onClick={onSkip} disabled={busy}>
                Skip
              </button>
            </>
          )}
        </div>
      )}

      {isAuto && (
        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs text-neutral-500">Auto-sent to {ticket.customer_name}</span>
          <span className="text-xs text-neutral-500">recorded in audit log</span>
        </div>
      )}
    </div>
  )
}