-- El producto que más compraba cada cliente, para nombrarlo en el mail de
-- recupero (Santiago, 09/10/2026). Vacío = va el texto general.
alter table public.campaign_recipients add column producto text;
