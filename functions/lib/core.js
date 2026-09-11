export const AUTO_SEND_THRESHOLD = 85
export const UNDO_WINDOW_SECONDS = 10

export function confidenceBucket(confidence) {
  if (confidence >= AUTO_SEND_THRESHOLD) return 'auto'
  if (confidence >= 50) return 'propose'
  return 'judgment'
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function errorResponse(message, status = 400) {
  return json({ error: message }, status)
}

// Supabase `timestamp` columns come back WITHOUT a timezone marker (e.g.
// "2026-09-11T21:37:49.255"), even though the stored value is UTC wall-clock.
// Parsing that with `new Date("...")` treats it as LOCAL time, which breaks the
// undo window in any non-UTC environment (local dev, browsers). Normalize to a
// proper UTC ISO string so every consumer parses it identically.
export function toUtcIso(value) {
  if (!value) return null
  const s = String(value)
  const hasOffset = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)
  return new Date(hasOffset ? s : `${s}Z`).toISOString()
}