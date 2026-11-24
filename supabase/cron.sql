-- =====================================================================
-- Agendamentos (rode no SQL Editor do Supabase DEPOIS das migrations
-- e do deploy das Edge Functions).
--
-- 1) Em Database > Extensions, habilite "pg_cron" e "pg_net".
-- 2) Troque <PROJECT_REF> e <CRON_SECRET> abaixo.
-- =====================================================================

-- Lançamentos recorrentes: todo dia às 06:00 UTC (03:00 em Brasília)
select cron.schedule(
  'generate-recurring-daily',
  '0 6 * * *',
  $$ select public.generate_recurring(null, 1); $$
);

-- (alternativa via Edge Function, se preferir)
-- select cron.schedule(
--   'generate-recurring-fn',
--   '0 6 * * *',
--   $$ select net.http_post(
--        url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/generate-recurring',
--        headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>', 'Content-Type', 'application/json'),
--        body    := '{}'::jsonb
--      ); $$
-- );

-- Notificações push: a cada hora (cada pessoa recebe no horário que escolheu)
select cron.schedule(
  'send-push-hourly',
  '0 * * * *',
  $$ select net.http_post(
       url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-push',
       headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>', 'Content-Type', 'application/json'),
       body    := '{}'::jsonb
     ); $$
);

-- Para conferir / remover:
-- select * from cron.job;
-- select cron.unschedule('send-push-hourly');
