-- Campañas de mail a clientes (primera: recupero de inactivos de Gerencia,
-- octubre 2026). Las tablas solo las toca la función campaign-send con la
-- service role; nadie desde el navegador.

create table public.campaign_recipients (
  id            bigint generated always as identity primary key,
  campaign      text not null,
  client_code   text,             -- sin ceros, como orders.client_code
  razon_social  text,
  email         text not null,
  origen        text,             -- 'planilla' | 'web'
  status        text not null default 'pendiente'
                check (status in ('pendiente','enviado','error','baja')),
  resend_id     text,
  sent_at       timestamptz,
  error         text,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  created_at    timestamptz not null default now(),
  unique (campaign, email)
);

-- Baja global: quien se da de baja de una campaña no recibe ninguna otra.
create table public.email_unsubscribes (
  email      text primary key,
  campaign   text,
  created_at timestamptz not null default now()
);

-- La clave para usar campaign-send. Se guarda solo el hash.
create table public.campaign_keys (
  id         bigint generated always as identity primary key,
  clave_hash text not null,
  activa     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.campaign_recipients enable row level security;
alter table public.email_unsubscribes  enable row level security;
alter table public.campaign_keys       enable row level security;

revoke all on public.campaign_recipients from anon, authenticated;
revoke all on public.email_unsubscribes  from anon, authenticated;
revoke all on public.campaign_keys       from anon, authenticated;
