import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const envPath = join(root, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w-]+)\s*=\s*(.*)\s*$/)
    if (m && m[1]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

loadEnv()

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY. Create a .env file (see .env.example).')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })
const reset = process.argv.includes('--reset')

async function main() {
  if (reset) {
    console.log('Resetting tables…')
    await supabase.from('ticket_decisions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('tickets').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  }

  const { count: existing, error: countErr } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })

  if (countErr) throw countErr

  if (existing > 0) {
    console.log(`tickets table already has ${existing} rows. Use "npm run seed -- --reset" to wipe and reseed.`)
    return
  }

  const seedPath = join(root, 'data', 'seed-tickets.json')
  const tickets = JSON.parse(readFileSync(seedPath, 'utf8')).map((t) => ({
    raw_text: t.raw_text,
    customer_name: t.customer_name,
    status: 'pending',
  }))

  const { data, error: insErr } = await supabase.from('tickets').insert(tickets).select('id, customer_name')
  if (insErr) throw insErr

  console.log(`Seeded ${data.length} pending tickets.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})