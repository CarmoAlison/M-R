// Edge Function: gera os lançamentos recorrentes de todas as casas.
// Alternativa ao pg_cron chamando a função SQL diretamente (ver supabase/cron.sql).
// Segredo necessário: CRON_SECRET
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
})

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('Authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const { data, error } = await supabase.rpc('generate_recurring', { p_household: null, p_months_ahead: 1 })
  if (error) return new Response(error.message, { status: 500 })
  return Response.json({ ok: true, inserted: data })
})
