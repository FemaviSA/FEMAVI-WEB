-- El control "ya existe en el sistema" busca solo por el mismo CUIT. Las
-- coincidencias por nombre parecido (FABRIMET → BRIMETAL, FAEM, FAMECA...)
-- confundían más de lo que ayudaban al aprobar. Santiago, 07/10/2026.

do $$
declare d text; n text;
begin
  select pg_get_functiondef('public.admin_controles_pedido(bigint)'::regprocedure) into d;
  n := regexp_replace(d,
    $r$\s*or \(v_nombre is not null and length\(v_nombre\) >= 4\s+and public\.normalizar_razon\(c\.razon_social\) % v_nombre\s+and extensions\.similarity\(public\.normalizar_razon\(c\.razon_social\), v_nombre\) >= 0\.55\)$r$,
    '');
  if n = d then raise exception 'admin_controles_pedido: no encontre el texto'; end if;
  execute n;
end $$;
