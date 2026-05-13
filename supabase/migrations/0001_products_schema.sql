-- Aplicado en el proyecto Supabase FEMAVI (mvtqjsgpahddjdbiuazg).
-- Este archivo queda en el repo como fuente de verdad del schema.

create extension if not exists moddatetime;

create table public.products (
  id bigint generated always as identity primary key,
  slug text unique not null,
  name text not null,
  category text not null,
  headline text,
  description text not null,
  story text,
  industries text[] not null default '{}',
  benefits text[] not null default '{}',
  presentations text[] not null default '{}',
  tags text[] not null default '{}',
  dilution text,
  ph text,
  image_url text,
  featured boolean not null default false,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger products_set_updated_at before update on public.products
  for each row execute procedure moddatetime(updated_at);

create index idx_products_active_featured on public.products(is_active, featured, display_order);
create index idx_products_category on public.products(category) where is_active;

alter table public.products enable row level security;

create policy "products_public_read" on public.products for select
  using (is_active = true);

create policy "products_admin_all" on public.products for all
  using (auth.jwt() ->> 'email' in ('eneasaldabe@gmail.com'))
  with check (auth.jwt() ->> 'email' in ('eneasaldabe@gmail.com'));

insert into storage.buckets (id, name, public)
  values ('product-images','product-images', true)
  on conflict (id) do nothing;

create policy "images_public_read" on storage.objects for select
  using (bucket_id = 'product-images');
create policy "images_admin_insert" on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.jwt() ->> 'email' in ('eneasaldabe@gmail.com'));
create policy "images_admin_update" on storage.objects for update
  using (bucket_id = 'product-images' and auth.jwt() ->> 'email' in ('eneasaldabe@gmail.com'));
create policy "images_admin_delete" on storage.objects for delete
  using (bucket_id = 'product-images' and auth.jwt() ->> 'email' in ('eneasaldabe@gmail.com'));
