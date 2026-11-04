-- "Este ciclo" y "ciclo pasado" se cuentan desde el ciclo en curso de FEMAVI
-- (ciclo_femavi_actual), no desde el mes del calendario. FemWay sigue igual:
-- mes calendario.
do $$
declare d text; n text;
begin
  -- Mis ventas
  select pg_get_functiondef('public.seller_resumen(text,text)'::regprocedure) into d;
  n := replace(d,
    $a$  v_mes     date := date_trunc('month', current_date)::date;$a$,
    $b$  v_mes     date;$b$);
  n := replace(n,
    $a$  if p_periodo in ('ultimos3', 'anio') and not v_seller.es_gerente then$a$,
    $b$  -- En FEMAVI el ciclo va adelante del almanaque: cierra el 20 y pico, así
  -- que el ciclo en curso es el más adelantado que ya tenga pedidos. FemWay se
  -- mide por mes calendario.
  v_mes := case when v_seller.proyecto = 'femavi'
                then public.ciclo_femavi_actual()
                else date_trunc('month', current_date)::date end;

  if p_periodo in ('ultimos3', 'anio') and not v_seller.es_gerente then$b$);
  if n = d or position('ciclo_femavi_actual' in n) = 0 then
    raise exception 'seller_resumen: no pude insertar el ciclo en curso';
  end if;
  execute n;

  -- Lo que ve el gerente
  select pg_get_functiondef('public.seller_equipo(text,text,text)'::regprocedure) into d;
  n := replace(d,
    $a$  v_mes     date := date_trunc('month', current_date)::date;$a$,
    $b$  v_mes     date;$b$);
  n := replace(n,
    $a$  -- Qué meses entran: igual que en seller_resumen.$a$,
    $b$  -- El ciclo en curso de FEMAVI va adelante del almanaque; FemWay no.
  v_mes := case when v_seller.proyecto = 'femavi'
                then public.ciclo_femavi_actual()
                else date_trunc('month', current_date)::date end;

  -- Qué meses entran: igual que en seller_resumen.$b$);
  if n = d or position('ciclo_femavi_actual' in n) = 0 then
    raise exception 'seller_equipo: no pude insertar el ciclo en curso';
  end if;
  execute n;
end $$;
