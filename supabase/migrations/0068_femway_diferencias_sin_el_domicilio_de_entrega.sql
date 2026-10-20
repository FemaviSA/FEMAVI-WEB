-- El domicilio de entrega del sistema viejo no sirve para comparar: ahí se
-- escriben horarios y códigos pegados a la calle ("COCHABAMBA 2044 8A12Y13A16HS",
-- "ACEVEDO 3950-(125-E-3)", "IDEM 8A12HS"), así que casi todos los clientes
-- aparecían distintos sin estar distintos. Se comparan la identidad fiscal, el
-- domicilio y las dos localidades: con eso se ve si el cliente se mudó, que es
-- lo que pasó con TALOS.
--
-- (Aplicada en Supabase como 0047_femway_diferencias_sin_el_domicilio_de_entrega.)

create or replace function public.femway_diferencias_cliente(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with par as (
    select f.razon_social      as f_razon, f.cuit      as f_cuit,
           f.domicilio         as f_dom,   f.localidad as f_loc,
           f.entrega_localidad as f_eloc,
           h.razon_social      as h_razon,
           nullif(btrim(replace(coalesce(h.cuit_formateado, h.cuit, ''), '*', '')), '') as h_cuit,
           h.domicilio         as h_dom,   h.localidad as h_loc,
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

revoke all on function public.femway_diferencias_cliente(text) from public, anon, authenticated;
