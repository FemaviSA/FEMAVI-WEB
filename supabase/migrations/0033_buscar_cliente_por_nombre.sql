-- Buscar el cliente por razón social, además de por código.
--
-- El vendedor empieza a escribir el nombre y elige de una lista; al elegir se
-- completa el código y, con él, toda la planilla (ver 0032). Se buscan solo
-- sus clientes, y solo para los códigos habilitados en seller_datos_cliente.

create or replace function public.seller_buscar_cliente(p_token text, p_q text)
returns table (codigo text, razon_social text, localidad text, cuit text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  CODIGOS_HABILITADOS constant text[] := array['10'];
  v_code    text := public.seller_de_token(p_token);
  q         text := nullif(btrim(coalesce(p_q, '')), '');
  q_digitos text := nullif(regexp_replace(coalesce(p_q, ''), '\D', '', 'g'), '');
begin
  if not (v_code = any (CODIGOS_HABILITADOS)) then return; end if;
  if q is null or length(q) < 3 then return; end if;

  return query
  select c.codigo, c.razon_social, c.localidad, c.cuit
    from public.hist_clientes c
    left join public.hist_resumen_cliente r on r.codigo = c.codigo
   where c.vendedor = lpad(v_code, 3, '0')
     and (c.razon_social ilike '%' || q || '%'
          or (q_digitos is not null and c.cuit like '%' || q_digitos || '%'))
   -- Primero los que compraron hace poco: es el que casi siempre se busca.
   order by r.ultima_compra desc nulls last, c.razon_social
   limit 8;
end;
$fn$;

revoke all on function public.seller_buscar_cliente(text, text) from public, anon, authenticated;
grant execute on function public.seller_buscar_cliente(text, text) to anon, authenticated;
