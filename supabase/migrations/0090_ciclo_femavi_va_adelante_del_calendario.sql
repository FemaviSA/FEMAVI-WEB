-- Los ciclos de FEMAVI cierran alrededor del 20 y pico, así que el ciclo en
-- curso va adelante del almanaque: el 25 de octubre ya se cargan pedidos con
-- ciclo "Noviembre 2026". "Este ciclo" tomaba el mes del calendario, así que
-- en esos días mostraba octubre —un ciclo que ya cerró— y lo de noviembre no
-- aparecía en ningún lado hasta el 1°.
--
-- Ahora el ciclo en curso de FEMAVI es el más adelantado que ya tenga pedidos
-- cargados, con un tope de un mes por delante del calendario: así un ciclo
-- tipeado de más (diciembre en octubre) no corre la vista entera.
--
-- FemWay no se toca: se mide por mes calendario, del 1 al 30.
--
-- (0092 lo vuelve a definir por vendedor: cada uno cierra su ciclo cuando
-- termina de recorrer.)

-- "Noviembre 2026" -> 2026-11-01. Es el inverso de nombre_de_mes; cualquier
-- otra cosa (el viejo "OCTUBRE" sin año) devuelve null y se ignora.
create or replace function public.mes_de_nombre(p_nombre text)
returns date
language sql
immutable
set search_path to 'pg_temp'
as $$
  select case
    when p_nombre is null then null
    when array_position(
           array['enero','febrero','marzo','abril','mayo','junio','julio',
                 'agosto','septiembre','octubre','noviembre','diciembre'],
           lower(split_part(btrim(p_nombre), ' ', 1))) is null then null
    when split_part(btrim(p_nombre), ' ', 2) !~ '^[0-9]{4}$' then null
    else make_date(
      split_part(btrim(p_nombre), ' ', 2)::int,
      array_position(
        array['enero','febrero','marzo','abril','mayo','junio','julio',
              'agosto','septiembre','octubre','noviembre','diciembre'],
        lower(split_part(btrim(p_nombre), ' ', 1)))::int,
      1)
  end;
$$;

-- El ciclo en curso de FEMAVI, como primer día de ese mes.
create or replace function public.ciclo_femavi_actual()
returns date
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select greatest(
    date_trunc('month', current_date)::date,
    least(
      coalesce((select max(public.mes_de_nombre(btrim(o.sales_cycle)))
                  from public.orders o
                 where o.proyecto = 'femavi'
                   and o.status <> 'rechazado'
                   and nullif(btrim(coalesce(o.sales_cycle, '')), '') is not null),
               date_trunc('month', current_date)::date),
      -- Tope: un mes adelante y no más.
      (date_trunc('month', current_date) + interval '1 month')::date
    )
  );
$$;

revoke all on function public.mes_de_nombre(text) from public, anon, authenticated;
revoke all on function public.ciclo_femavi_actual() from public, anon, authenticated;
grant execute on function public.mes_de_nombre(text) to authenticated;
grant execute on function public.ciclo_femavi_actual() to anon, authenticated;
