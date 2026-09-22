-- Buzón para que la PC de la oficina mande texto de diagnóstico (por ejemplo el
-- listado de archivos del sistema) sin tener que ir con un pendrive.
-- Usa la misma clave del sincronizador; solo escribe, no lee nada.
create table if not exists public.hist_sync_notas (
  id        bigint generated always as identity primary key,
  clave_id  bigint not null references public.hist_sync_claves(id) on delete cascade,
  asunto    text not null,
  texto     text not null,
  creada_at timestamptz not null default now()
);
alter table public.hist_sync_notas enable row level security;
revoke all on public.hist_sync_notas from public, anon, authenticated;

create or replace function public.hist_sync_nota(p_key text, p_asunto text, p_texto text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_id bigint := public.hist_sync_validar(p_key);
  v_nota bigint;
begin
  if length(coalesce(p_texto, '')) > 200000 then raise exception 'texto demasiado largo'; end if;
  insert into public.hist_sync_notas (clave_id, asunto, texto)
  values (v_id, left(coalesce(p_asunto, 'sin asunto'), 200), coalesce(p_texto, ''))
  returning id into v_nota;
  -- Se guardan solo las últimas 50 notas.
  delete from public.hist_sync_notas where id <= v_nota - 50;
  return v_nota;
end;
$fn$;
revoke all on function public.hist_sync_nota(text, text, text) from public, anon, authenticated;
grant execute on function public.hist_sync_nota(text, text, text) to anon;
