-- Una sola lista de quién administra el sitio. Antes cada tabla tenía su
-- regla: productos y cotizaciones listaban dos mails, pero pedidos, artículos
-- y temas del blog aceptaban a CUALQUIER usuario logueado. Con el registro
-- abierto, cualquiera podía crearse una cuenta y ver o modificar pedidos, o
-- editar y publicar artículos en el sitio.
create table if not exists public.admin_emails (
  email      text primary key,
  nombre     text,
  created_at timestamptz not null default now()
);

comment on table public.admin_emails is
  'Quién puede administrar el sitio. Para dar acceso a alguien: una fila acá y una invitación desde Authentication > Users.';

-- Sin políticas: nadie la lee ni la toca por la API. Solo is_admin() y service_role.
alter table public.admin_emails enable row level security;

insert into public.admin_emails (email, nombre) values
  ('santiago@femavi.com.ar', 'Santiago'),
  ('eneasaldabe@gmail.com',  'Eneas')
on conflict (email) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.admin_emails
     where lower(email) = lower(auth.jwt() ->> 'email')
  );
$fn$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ── Pedidos ──
drop policy if exists auth_select_orders on public.orders;
drop policy if exists auth_update_orders on public.orders;
-- Los formularios guardan por create_order(), que no depende de esta política:
-- el insert directo desde afuera se cierra, así nadie puede meter un pedido
-- salteándose las validaciones y la numeración.
drop policy if exists anon_insert_orders on public.orders;
drop policy if exists orders_admin_all   on public.orders;
create policy orders_admin_all on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

-- ── Cotizaciones (mismo comportamiento, ahora desde la lista) ──
drop policy if exists quote_requests_admin_all on public.quote_requests;
create policy quote_requests_admin_all on public.quote_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- ── Productos (ídem) ──
drop policy if exists products_admin_all on public.products;
create policy products_admin_all on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- ── Artículos del blog ──
drop policy if exists "authenticated can do everything" on public.articles;
drop policy if exists articles_admin_all on public.articles;
create policy articles_admin_all on public.articles
  for all using (public.is_admin()) with check (public.is_admin());

-- ── Temas del blog ──
drop policy if exists "authenticated can do everything" on public.content_topics;
drop policy if exists content_topics_admin_all on public.content_topics;
create policy content_topics_admin_all on public.content_topics
  for all using (public.is_admin()) with check (public.is_admin());
