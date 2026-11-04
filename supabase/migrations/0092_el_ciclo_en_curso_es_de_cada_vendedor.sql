-- El ciclo no cierra el mismo día para todos: cada vendedor cierra el suyo
-- cuando termina de recorrer, así que el ciclo en curso se calcula por
-- vendedor. Sin vendedor (la vista del gerente, que suma a todos) se toma el
-- más adelantado del proyecto.

drop function if exists public.ciclo_femavi_actual();

create or replace function public.ciclo_femavi_actual(p_vendedor text default null)
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
                   and (p_vendedor is null or o.seller_code = p_vendedor)
                   and nullif(btrim(coalesce(o.sales_cycle, '')), '') is not null),
               date_trunc('month', current_date)::date),
      -- Tope: un mes adelante y no más, para que un ciclo tipeado de más no
      -- corra la vista entera.
      (date_trunc('month', current_date) + interval '1 month')::date
    )
  );
$$;

revoke all on function public.ciclo_femavi_actual(text) from public, anon, authenticated;
grant execute on function public.ciclo_femavi_actual(text) to anon, authenticated;

-- Mis ventas: el ciclo del vendedor que está mirando.
do $$
declare d text; n text;
begin
  select pg_get_functiondef('public.seller_resumen(text,text)'::regprocedure) into d;
  n := replace(d,
    $a$then public.ciclo_femavi_actual()$a$,
    $b$then public.ciclo_femavi_actual(v_seller.code)$b$);
  if n = d then raise exception 'seller_resumen: no encontre la llamada al ciclo'; end if;
  execute n;
end $$;
