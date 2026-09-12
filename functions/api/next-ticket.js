import { getSupabase } from '../lib/supabase.js'
import { analyzeTicket, DEFAULT_MODEL } from '../lib/groq.js'
import { json, errorResponse, AUTO_SEND_THRESHOLD, UNDO_WINDOW_SECONDS, confidenceBucket, toUtcIso } from '../lib/core.js'

export async function onRequestGet(context) {
  let supabase
  try {
    supabase = getSupabase(context.env)
  } catch (err) {
    return errorResponse(err.message, 500)
  }

  const apiKey = context.env.GROQ_API_KEY
  if (!apiKey) return errorResponse('GROQ_API_KEY missing from environment', 500)
  const model = context.env.GROQ_MODEL || DEFAULT_MODEL

  const { data: ticket, error: ticketErr } = await supabase
    .from('tickets')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (ticketErr) return errorResponse(`tickets query failed: ${ticketErr.message}`, 500)
  if (!ticket) return json({ done: true, ticket: null })

  let analysis
  try {
    analysis = await analyzeTicket({ rawText: ticket.raw_text, apiKey, model })
  } catch (err) {
    analysis = {
      fallback: true,
      priority: 'low',
      department: 'general',
      suggested_reply: "We couldn't analyze this ticket automatically. A support agent will review it manually.",
      confidence: 0,
      reasoning: `AI inference failed (${err.message}). Flagged for human judgment.`,
    }
  }

  const willAutoSend = !analysis.fallback && analysis.confidence >= AUTO_SEND_THRESHOLD

  const decisionRow = {
    ticket_id: ticket.id,
    ticket_text: ticket.raw_text,
    ai_priority: analysis.priority,
    ai_department: analysis.department,
    ai_suggested_reply: analysis.suggested_reply,
    ai_confidence: analysis.confidence,
    ai_reasoning: analysis.reasoning,
    user_action: willAutoSend ? 'auto_sent' : null,
    final_reply: willAutoSend ? analysis.suggested_reply : null,
    undo_window_expires_at: willAutoSend
      ? new Date(Date.now() + UNDO_WINDOW_SECONDS * 1000).toISOString()
      : null,
  }

  const { data: decision, error: insertErr } = await supabase
    .from('ticket_decisions')
    .insert(decisionRow)
    .select()
    .single()

  if (insertErr) return errorResponse(`decision insert failed: ${insertErr.message}`, 500)

  if (willAutoSend) {
    const { error: markErr } = await supabase
      .from('tickets')
      .update({ status: 'processed' })
      .eq('id', ticket.id)
    if (markErr) return errorResponse(`ticket update failed: ${markErr.message}`, 500)
  }

  return json({
    done: false,
    ticket: { id: ticket.id, customer_name: ticket.customer_name },
    decision,
    routing: {
      bucket: confidenceBucket(decision.ai_confidence),
      fallback: analysis.fallback || undefined,
      autoSent: decision.user_action === 'auto_sent',
      undoWindowSeconds: decision.user_action === 'auto_sent' ? UNDO_WINDOW_SECONDS : null,
      undoWindowExpiresAt: toUtcIso(decision.undo_window_expires_at),
    },
  })
}