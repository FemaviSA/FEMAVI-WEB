-- La copia que FemWay tiene de un cliente de FEMAVI es una foto de un momento:
-- se saca cuando el cliente se pasa (o cuando entra su primer pedido) y nunca
-- se vuelve a leer. Si después se corrige el cliente en el sistema viejo —o si
-- el vendedor cargó algo distinto— las dos fichas quedan diciendo cosas
-- distintas y nadie se enteraba. Con TALOS S.R.L. eso mandó a facturar una
-- dirección de hace años.
--
-- No se sincroniza solo a propósito: en la ficha de FemWay se editan datos a
-- mano y un refresco automático los pisaría. Lo que se hace es mostrar la
-- diferencia y dejar un botón para traer el dato del sistema viejo.
--
-- (Aplicada en Supabase como 0046_femway_diferencias_con_el_sistema_viejo.)

-- Para comparar: sin mayúsculas y sin espacios de más.
create or replace function public.texto_comparable(p text)
returns text
language sql
immutable
set search_path to 'pg_temp'
as $$ select nullif(btrim(regexp_replace(upper(coalesce(p, '')), '\s+', ' ', 'g')), '') $$;

create or replace function public.femway_diferencias_cliente(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with par as (
    select f.razon_social       as f_razon, f.cuit      as f_cuit,
           f.domicilio          as f_dom,   f.localidad as f_loc,
           f.entrega_domicilio  as f_edom,  f.entrega_localidad as f_eloc,
           h.razon_social       as h_razon,
           nullif(btrim(replace(coalesce(h.cuit_formateado, h.cuit, ''), '*', '')), '') as h_cuit,
           h.domicilio          as h_dom,   h.localidad as h_loc,
           coalesce(h.entrega_domicilio, h.domicilio) as h_edom,
           coalesce(h.entrega_localidad, h.localidad) as h_eloc
      from public.femway_clientes f
      join public.hist_clientes h on h.codigo = f.cliente_femavi
     where f.codigo = p_codigo
       and f.origen = 'femavi'
  ),
  campos as (
    select v.campo, v.femway, v.femavi
      from par,
           lateral (values
             ('Razón social'::text,   par.f_razon, par.h_razon),
             ('CUIT',                 par.f_cuit,  par.h_cuit),
             ('Domicilio',            par.f_dom,   par.h_dom),
             ('Localidad',            par.f_loc,   par.h_loc),
             ('Domicilio de entrega', par.f_edom,  par.h_edom),
             ('Localidad de entrega', par.f_eloc,  par.h_eloc)
           ) as v(campo, femway, femavi)
  )
  select coalesce(jsonb_agg(jsonb_build_object('campo', campo, 'femway', femway, 'femavi', femavi)
                            order by campo), '[]'::jsonb)
    from campos
   where case when campo = 'CUIT'
              then nullif(regexp_replace(coalesce(femway, ''), '\D', '', 'g'), '')
                     is distinct from nullif(regexp_replace(coalesce(femavi, ''), '\D', '', 'g'), '')
              else public.texto_comparable(femway) is distinct from public.texto_comparable(femavi)
         end;
$$;

-- Lo que ve el admin: todos los clientes de FemWay que no coinciden con el
-- sistema viejo, para revisar de un saque cuál de los dos hay que corregir.
create or replace function public.admin_femway_diferencias()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;

  select coalesce(jsonb_agg(x order by x->>'codigo'), '[]'::jsonb) into v
    from (
      select jsonb_build_object(
               'codigo', f.codigo, 'razon_social', f.razon_social,
               'vendedor', f.vendedor, 'campos', d.campos) as x
        from public.femway_clientes f
        cross join lateral (select public.femway_diferencias_cliente(f.codigo) as campos) d
       where f.origen = 'femavi'
         and jsonb_array_length(d.campos) > 0
    ) t;
  return v;
end;
$$;

-- Trae del sistema viejo los datos de facturación y entrega. No toca vendedor,
-- notas ni el código: eso es de FemWay.
create or replace function public.admin_femway_traer_de_femavi(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_cod text := lpad(nullif(regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g'), ''), 5, '0');
  v_h   public.hist_clientes%rowtype;
  v_f   public.femway_clientes%rowtype;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;

  select * into v_f from public.femway_clientes where codigo = v_cod;
  if not found then raise exception 'No existe el cliente % en FemWay.', v_cod; end if;
  if v_f.cliente_femavi is null then
    raise exception 'Ese cliente nació en FemWay: no hay nada que traer.';
  end if;

  select * into v_h from public.hist_clientes where codigo = v_f.cliente_femavi;
  if not found then
    raise exception 'El cliente % ya no está en el sistema viejo.', v_f.cliente_femavi;
  end if;

  update public.femway_clientes set
    razon_social      = v_h.razon_social,
    cuit              = coalesce(nullif(btrim(replace(coalesce(v_h.cuit_formateado, v_h.cuit, ''), '*', '')), ''), cuit),
    domicilio         = v_h.domicilio,
    localidad         = v_h.localidad,
    telefonos         = coalesce(v_h.telefonos, telefonos),
    resp_compras      = coalesce(v_h.resp_compras, resp_compras),
    entrega_domicilio = coalesce(v_h.entrega_domicilio, v_h.domicilio),
    entrega_localidad = coalesce(v_h.entrega_localidad, v_h.localidad),
    entrega_telefono  = coalesce(v_h.entrega_telefono, entrega_telefono),
    updated_at        = now()
   where codigo = v_cod;

  return jsonb_build_object('codigo', v_cod, 'razon_social', v_h.razon_social);
end;
$$;

revoke all on function public.texto_comparable(text) from public;
revoke all on function public.femway_diferencias_cliente(text) from public, anon, authenticated;
revoke all on function public.admin_femway_diferencias() from public, anon, authenticated;
revoke all on function public.admin_femway_traer_de_femavi(text) from public, anon, authenticated;
grant execute on function public.texto_comparable(text) to authenticated;
grant execute on function public.admin_femway_diferencias() to authenticated;
grant execute on function public.admin_femway_traer_de_femavi(text) to authenticated;
