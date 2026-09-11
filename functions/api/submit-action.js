import { getSupabase } from '../lib/supabase.js'
import { json, errorResponse } from '../lib/core.js'

const ACTIONS = new Set(['approved', 'edited', 'skipped'])

export async function onRequestPost(context) {
  let supabase
  try {
    supabase = getSupabase(context.env)
  } catch (err) {
    return errorResponse(err.message, 500)
  }

  let body
  try {
    body = await context.request.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const { decisionId, action, finalReply } = body
  if (!ACTIONS.has(action)) return errorResponse(`action must be one of: ${[...ACTIONS].join(', ')}`, 400)

  const { data: decision, error: findErr } = await supabase
    .from('ticket_decisions')
    .select('*')
    .eq('id', decisionId)
    .maybeSingle()

  if (findErr) return errorResponse(`decision query failed: ${findErr.message}`, 500)
  if (!decision) return errorResponse('Decision not found', 404)
  if (decision.user_action) {
    return errorResponse(`Decision already handled (${decision.user_action})`, 409)
  }

  let reply = decision.ai_suggested_reply
  if (action === 'edited') {
    if (!finalReply || !String(finalReply).trim()) {
      return errorResponse('finalReply is required for an edited action', 400)
    }
    reply = String(finalReply).trim()
  }

  const { data: updated, error: updErr } = await supabase
    .from('ticket_decisions')
    .update({ user_action: action, final_reply: reply })
    .eq('id', decision.id)
    .select()
    .single()

  if (updErr) return errorResponse(`decision update failed: ${updErr.message}`, 500)

  // Mark the ticket processed. Skipped is also recorded and moves the queue on —
  // the full audit trail lives in ticket_decisions.
  const { error: markErr } = await supabase
    .from('tickets')
    .update({ status: 'processed' })
    .eq('id', decision.ticket_id)

  if (markErr) return errorResponse(`ticket update failed: ${markErr.message}`, 500)

  return json({ ok: true, decision: updated })
}