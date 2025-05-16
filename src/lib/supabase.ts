import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from './database.types'

// Client per componenti con gestione cookie automatica
export const supabase = createClientComponentClient<Database>()

// Per operazioni admin, usa il client component ma con la chiave di servizio
export const supabaseAdmin = createClientComponentClient<Database>({
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}) 