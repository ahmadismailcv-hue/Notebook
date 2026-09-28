import { createClient } from '@supabase/supabase-js'

// Publishable key: safe to ship in the client. Row Level Security restricts every row to its owner.
const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://rrphbfegwaggyjesikpm.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_CCnr0gmDmDvfCjWW6FXFZQ_AzfC6O6c'

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})
