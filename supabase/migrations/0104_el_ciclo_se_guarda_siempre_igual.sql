-- El ciclo se guarda siempre igual: "Noviembre 2026".
--
-- Mis ventas y el equipo comparan el texto del ciclo contra "Mes AAAA". El
-- campo es libre, y un pedido de Poleri de $5,98M quedó con "11/2026": el admin
-- lo veía (Facturación cuenta por fecha) pero el vendedor no. Lo mismo un
-- pedido de octubre del 10 escrito "OCTUBRE".
--
-- Ahora la base entiende "11/2026", "11-26", "noviembre", "NOV", "Noviembr",
-- "nov 2026" y lo guarda como "Noviembre 2026". Si no trae año, toma el más
-- cercano a la fecha del pedido. Si no se entiende y el pedido de FEMAVI se
-- está aprobando, frena con un mensaje en vez de guardar algo que no suma.

create or replace function public.ciclo_ordenado(p_texto text, p_ref date default current_date)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_meses text[] := array['enero','febrero','marzo','abril','mayo','junio','julio',
                          'agosto','septiembre','octubre','noviembre','diciembre'];
  v_s     text := lower(btrim(coalesce(p_texto, '')));
  v_m     int;
  v_a     int;
  v_pal   text;
  v_resto text;
  v_mejor date;
  v_cand  date;
  i       int;
begin
  if v_s = '' then return null; end if;
  v_s := translate(v_s, 'áéíóú', 'aeiou');

  -- "11/2026", "11-26", "11.2026"
  if v_s ~ '^\d{1,2}\s*[/.-]\s*(\d{2}|\d{4})$' then
    v_m := substring(v_s from '^(\d{1,2})')::int;
    v_a := substring(v_s from '(\d{2}|\d{4})$')::int;
  else
    v_pal   := substring(v_s from '^([a-z]+)');
    v_resto := btrim(substring(v_s from '^[a-z]+\.?\s*(.*)$'));
    if v_pal is null or length(v_pal) < 3 then return null; end if;
    if v_pal = 'set' then v_pal := 'sep'; end if;
    for i in 1..12 loop
      if v_meses[i] like v_pal || '%' or v_pal like v_meses[i] || '%' then
        v_m := i; exit;
      end if;
    end loop;
    if v_m is null then return null; end if;
    if v_resto ~ '^(\d{2}|\d{4})$' then
      v_a := v_resto::int;
    elsif v_resto <> '' then
      return null;
    end if;
  end if;

  if v_m not between 1 and 12 then return null; end if;
  if v_a is not null and v_a < 100 then v_a := v_a + 2000; end if;

  if v_a is null then
    -- Sin año: el mes más cercano a la fecha del pedido.
    for i in -1..1 loop
      v_cand := make_date(extract(year from p_ref)::int + i, v_m, 1);
      if v_mejor is null
         or abs(v_cand - date_trunc('month', p_ref)::date)
            < abs(v_mejor - date_trunc('month', p_ref)::date) then
        v_mejor := v_cand;
      end if;
    end loop;
  else
    v_mejor := make_date(v_a, v_m, 1);
  end if;

  return public.nombre_de_mes(v_mejor);
end;
$$;

revoke all on function public.ciclo_ordenado(text, date) from public, anon, authenticated;

create or replace function public.pedido_ciclo_ordenado()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_ord text;
begin
  if nullif(btrim(coalesce(new.sales_cycle, '')), '') is null then
    new.sales_cycle := null;
    return new;
  end if;
  v_ord := public.ciclo_ordenado(new.sales_cycle,
             (coalesce(new.created_at, now()) at time zone 'America/Argentina/Buenos_Aires')::date);
  if v_ord is not null then
    new.sales_cycle := v_ord;
  elsif new.proyecto = 'femavi'
        and new.status in ('aprobado', 'ingresado', 'facturado', 'entregado') then
    raise exception 'No entiendo el ciclo "%". Escribilo como "Noviembre 2026".', new.sales_cycle
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.pedido_ciclo_ordenado() from public, anon, authenticated;

-- Corre antes que pedido_exige_ciclo (los triggers van por orden alfabético).
drop trigger if exists pedido_ciclo_ordenado on public.orders;
create trigger pedido_ciclo_ordenado
  before insert or update of sales_cycle, status on public.orders
  for each row execute function public.pedido_ciclo_ordenado();

-- Los que ya estaban mal escritos.
update public.orders
   set sales_cycle = public.ciclo_ordenado(sales_cycle,
         (created_at at time zone 'America/Argentina/Buenos_Aires')::date)
 where sales_cycle is not null
   and public.mes_de_nombre(sales_cycle) is null
   and public.ciclo_ordenado(sales_cycle,
         (created_at at time zone 'America/Argentina/Buenos_Aires')::date) is not null;
