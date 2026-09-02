import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

console.log('Supabase Init:', { 
  url: supabaseUrl, 
  keyPrefix: supabaseKey ? supabaseKey.substring(0, 15) + '...' : 'MISSING' 
})

export const supabase = createClient(supabaseUrl, supabaseKey)
