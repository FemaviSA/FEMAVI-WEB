-- Un cliente de FemWay es de un solo vendedor. Si el 57 carga un pedido con el
-- CUIT de un cliente del 55, no sale: no es un aviso, es un freno.
--
-- Vale solo para FemWay, donde la cartera la asigna administración, y solo para
-- pedidos cargados por el vendedor: si lo carga administración, sabe lo que
-- hace y para eso están los controles de antes de aprobar.
--
-- El freno está acá y no en la pantalla. La pantalla avisa mientras se escribe
-- el CUIT, que es lo cómodo, pero lo que no se puede saltear es esto.

-- Devuelve el cliente si el CUIT es de OTRO vendedor de FemWay; null si está
-- libre o si es suyo. La usa la planilla mientras se escribe.
create or replace function public.seller_cuit_de_otro(p_token text, p_cuit text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_code text := public.seller_de_token(p_token);
  v_proy text;
  v_dig  text := nullif(regexp_replace(coalesce(p_cuit, ''), '\D', '', 'g'), '');
  v_c    public.femway_clientes%rowtype;
begin
  if v_dig is null or length(v_dig) <> 11 then return null; end if;
  select proyecto into v_proy from public.sellers where code = v_code;
  if v_proy <> 'femway' then return null; end if;

  select * into v_c from public.femway_clientes
   where regexp_replace(coalesce(cuit, ''), '\D', '', 'g') = v_dig
     and vendedor is not null
     and vendedor <> v_code
   limit 1;
  if not found then return null; end if;

  return jsonb_build_object('codigo', v_c.codigo, 'razon_social', v_c.razon_social);
end;
$fn$;
revoke all on function public.seller_cuit_de_otro(text, text) from public, anon, authenticated;
grant execute on function public.seller_cuit_de_otro(text, text) to anon, authenticated;

create or replace function public.create_order(p jsonb, p_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_seller   text := null;
  v_proyecto text := 'femavi';
  v_dig      text;
  v_dueno    text;
begin
  if nullif(btrim(coalesce(p_token, '')), '') is not null then
    select s.seller_code, v.proyecto into v_seller, v_proyecto
      from public.seller_sessions s
      join public.sellers v on v.code = s.seller_code and v.active
     where s.token_hash = encode(digest(p_token, 'sha256'), 'hex')
       and s.expires_at > now();
    if v_seller is null then
      raise exception 'sesion_vencida' using errcode = 'P0001';
    end if;
  end if;

  if v_proyecto = 'femway' and v_seller is not null then
    v_dig := nullif(regexp_replace(coalesce(p->>'cuit', ''), '\D', '', 'g'), '');
    if v_dig is not null then
      select f.vendedor into v_dueno
        from public.femway_clientes f
       where regexp_replace(coalesce(f.cuit, ''), '\D', '', 'g') = v_dig
         and f.vendedor is not null
         and f.vendedor <> v_seller
       limit 1;
      if v_dueno is not null then
        raise exception 'cliente_de_otro_vendedor' using errcode = 'P0001';
      end if;
    end if;
  end if;

  return public.pedido_insertar(p, v_seller, v_proyecto);
end;
$fn$;
revoke all on function public.create_order(jsonb, text) from public;
grant execute on function public.create_order(jsonb, text) to anon, authenticated;
