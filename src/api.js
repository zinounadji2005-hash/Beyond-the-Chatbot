async function req(path, options) {
  const res = await fetch(path, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export const fetchNext = () => req('/api/next-ticket')

export const submitAction = (payload) =>
  req('/api/submit-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

export const undoDecision = (decisionId) =>
  req('/api/undo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisionId }),
  })