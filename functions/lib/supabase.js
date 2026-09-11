import { createClient } from '@supabase/supabase-js'

export function getSupabase(env) {
  const url = env.SUPABASE_URL
  const key = env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing from environment')
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  })
}