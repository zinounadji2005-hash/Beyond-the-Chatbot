import { getSupabase } from '../lib/supabase.js'
import { json, errorResponse, toUtcIso } from '../lib/core.js'

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

  const { decisionId } = body
  if (!decisionId) return errorResponse('decisionId is required', 400)

  const { data: decision, error: findErr } = await supabase
    .from('ticket_decisions')
    .select('*')
    .eq('id', decisionId)
    .maybeSingle()

  if (findErr) return errorResponse(`decision query failed: ${findErr.message}`, 500)
  if (!decision) return errorResponse('Decision not found', 404)

  if (decision.user_action !== 'auto_sent') {
    return errorResponse(`Only auto-sent decisions can be undone (current state: ${decision.user_action})`, 409)
  }

  const now = new Date()
  const expiresAt = decision.undo_window_expires_at
    ? new Date(toUtcIso(decision.undo_window_expires_at))
    : null
  if (!expiresAt || now > expiresAt) {
    return errorResponse('Undo window has expired', 409)
  }

  const { data: updated, error: updErr } = await supabase
    .from('ticket_decisions')
    .update({ user_action: 'undone' })
    .eq('id', decision.id)
    .select()
    .single()

  if (updErr) return errorResponse(`decision update failed: ${updErr.message}`, 500)

  // Requeue the ticket so it comes back through triage.
  const { error: queErr } = await supabase
    .from('tickets')
    .update({ status: 'pending' })
    .eq('id', decision.ticket_id)

  if (queErr) return errorResponse(`ticket requeue failed: ${queErr.message}`, 500)

  return json({ ok: true, decision: updated })
}