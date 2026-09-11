import { useCallback, useEffect, useRef, useState } from 'react'
import DecisionCard from './components/DecisionCard.jsx'
import UndoToast from './components/UndoToast.jsx'
import { fetchNext, submitAction, undoDecision } from './api.js'

export default function App() {
  const [phase, setPhase] = useState('loading') // loading | ready | empty | error
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const inflight = useRef(null)

  const loadNext = useCallback(() => {
    if (inflight.current) return inflight.current
    setPhase('loading')
    setToast(null)
    inflight.current = fetchNext()
      .then((res) => {
        if (res.done) {
          setPhase('empty')
          setData(null)
        } else {
          setData(res)
          setPhase('ready')
          if (res.routing.autoSent) {
            setToast({
              customer: res.ticket.customer_name,
              decisionId: res.decision.id,
              expiresAt: res.routing.undoWindowExpiresAt,
            })
          }
        }
      })
      .catch((e) => {
        setError(e.message)
        setPhase('error')
      })
      .finally(() => {
        inflight.current = null
      })
    return inflight.current
  }, [])

  useEffect(() => {
    loadNext()
  }, [loadNext])

  const runAction = useCallback(
    async (fn) => {
      if (!data || busy) return
      setBusy(true)
      try {
        await fn()
        await loadNext()
      } catch (e) {
        setError(e.message)
        setPhase('error')
      } finally {
        setBusy(false)
      }
    },
    [data, busy, loadNext],
  )

  const handleApprove = useCallback(
    (reply) => runAction(() => submitAction({ decisionId: data.decision.id, action: 'approved', finalReply: reply })),
    [runAction, data],
  )
  const handleEdit = useCallback(
    (reply) => runAction(() => submitAction({ decisionId: data.decision.id, action: 'edited', finalReply: reply })),
    [runAction, data],
  )
  const handleSkip = useCallback(
    () => runAction(() => submitAction({ decisionId: data.decision.id, action: 'skipped' })),
    [runAction, data],
  )

  const handleUndo = useCallback(() => {
    if (!toast) return
    setBusy(true)
    Promise.resolve(undoDecision(toast.decisionId))
      .then(() => {
        setToast(null)
        return loadNext()
      })
      .catch((e) => {
        setError(e.message)
        setPhase('error')
      })
      .finally(() => setBusy(false))
  }, [toast, loadNext])

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center px-4 py-10">
      <header className="mb-10 flex w-full max-w-xl items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/40">
            <svg className="h-3.5 w-3.5 text-emerald-300" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a4 4 0 100 8 4 4 0 000-8zM3 14c0-2 3-3.5 7-3.5s7 1.5 7 3.5v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-1z" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight">Beyond the Chatbot</span>
        </div>
        <span className="text-[11px] text-neutral-500">one decision at a time</span>
      </header>

      <main className="flex w-full flex-1 flex-col items-center justify-start">
        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-800 border-t-emerald-400" />
            <p className="text-sm text-neutral-500">Analyzing next ticket…</p>
          </div>
        )}

        {phase === 'ready' && data && (
          <div className="flex w-full flex-col items-center">
            <DecisionCard
              key={data.decision.id}
              data={data}
              onApprove={handleApprove}
              onEdit={handleEdit}
              onSkip={handleSkip}
              busy={busy}
            />

            {toast && (
              <UndoToast
                customer={toast.customer}
                expiresAt={toast.expiresAt}
                onUndo={handleUndo}
                onExpire={() => setToast(null)}
              />
            )}
          </div>
        )}

        {phase === 'empty' && (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <div className="text-3xl">&#10003;</div>
            <p className="text-base font-medium">Queue cleared</p>
            <p className="max-w-sm text-sm text-neutral-500">
              Every ticket has been triaged and recorded in the audit log. Seed more tickets with{' '}
              <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs text-neutral-300">
                npm run seed -- --reset
              </code>{' '}
              to run it again.
            </p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <p className="text-sm text-red-300">{error}</p>
            <button
              onClick={loadNext}
              className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-700 transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </main>

      <footer className="mt-14 text-[11px] text-neutral-600">
        AI triage &#183; no chatbot &#183; no dashboard &#183; every decision audited
      </footer>
    </div>
  )
}