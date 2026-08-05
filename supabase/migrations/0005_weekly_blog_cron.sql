-- Programa la Edge Function weekly-blog-post para correr una vez por semana
-- (lunes 09:00 UTC = 06:00 hora Argentina) vía pg_cron + pg_net, sin depender
-- de que ningún proceso local esté abierto.
--
-- El header Authorization usa la anon key pública del proyecto (la misma que ya
-- viaja en el bundle del frontend vía VITE_SUPABASE_ANON_KEY) — solo sirve para
-- pasar la verificación de JWT de la plataforma al invocar la función. La función
-- en sí usa su propia SUPABASE_SERVICE_ROLE_KEY (inyectada automáticamente en su
-- runtime) para escribir en las tablas sin pasar por RLS.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('weekly-blog-post') where exists (
  select 1 from cron.job where jobname = 'weekly-blog-post'
);

select cron.schedule(
  'weekly-blog-post',
  '0 9 * * 1',
  $$
  select net.http_post(
    url := 'https://lhqawwjszwjzxxsonvwa.supabase.co/functions/v1/weekly-blog-post',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxocWF3d2pzendqenh4c29udndhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTQ2NDMsImV4cCI6MjA5MjU5MDY0M30.3Dx6c3mLwqGDgRfQK4mn70ohuSZ5GXV7WvrtlV6A0DM',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
