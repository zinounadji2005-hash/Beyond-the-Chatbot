const ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions'
export const DEFAULT_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b'

export const SYSTEM_PROMPT = `You are a support ticket triage engine. Analyze the ticket text and respond with ONLY valid JSON, no markdown formatting, no explanation outside the JSON:

{
  "priority": "low" | "medium" | "high" | "urgent",
  "department": "billing" | "technical" | "general" | "refunds",
  "suggested_reply": "a short, professional reply the support agent could send as-is",
  "confidence": <integer 0-100, your genuine confidence that this classification and reply are correct>,
  "reasoning": "one short sentence explaining the priority/department choice"
}

Be honest about confidence. If the ticket is ambiguous, vague, or could belong to multiple categories, give a LOW confidence score (below 50). Do not default to high confidence.`

const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent'])
const DEPARTMENTS = new Set(['billing', 'technical', 'general', 'refunds'])

const FALLBACK_REPLY =
  "Thanks for reaching out. We've received your request and a member of our team is looking into it. We'll get back to you shortly."

const clampInt = (n) => {
  const v = Number.parseInt(n, 10)
  if (Number.isNaN(v)) return 0
  return Math.max(0, Math.min(100, v))
}

export function parseAnalysis(content) {
  let text = String(content ?? '').trim()
  // Strip common fences the model might add despite instructions.
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  let obj = null
  try {
    obj = JSON.parse(text)
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        obj = JSON.parse(m[0])
      } catch {
        obj = null
      }
    }
  }

  if (!obj || typeof obj !== 'object') {
    return {
      fallback: true,
      priority: 'low',
      department: 'general',
      suggested_reply: FALLBACK_REPLY,
      confidence: 0,
      reasoning: 'Model response could not be parsed. Flagged for human judgment.',
      raw: content,
    }
  }

  return {
    fallback: false,
    priority: PRIORITIES.has(obj.priority) ? obj.priority : 'medium',
    department: DEPARTMENTS.has(obj.department) ? obj.department : 'general',
    suggested_reply:
      typeof obj.suggested_reply === 'string' && obj.suggested_reply.trim()
        ? obj.suggested_reply.trim()
        : FALLBACK_REPLY,
    confidence: clampInt(obj.confidence),
    reasoning:
      typeof obj.reasoning === 'string' && obj.reasoning.trim()
        ? obj.reasoning.trim()
        : 'No reasoning provided by the model.',
    raw: content,
  }
}

export async function analyzeTicket({ rawText, apiKey, model }) {
  const body = {
    model: model || DEFAULT_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Ticket text:\n${rawText}` },
    ],
    max_tokens: 800,
    temperature: 0,
    chat_template_kwargs: { enable_thinking: false },
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`NVIDIA API ${res.status}: ${detail.slice(0, 500)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content ?? ''
  return parseAnalysis(content)
}