-- Último estado que informa Resend para cada mail enviado (delivered, bounced,
-- complained...). Lo llena la acción "revisar" de campaign-send.
alter table public.campaign_recipients add column last_event text;
