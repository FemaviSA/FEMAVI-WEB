-- Controles al autorizar un pedido. Por ahora dos:
--   1. El CUIT: que esté bien formado y que el dígito verificador cierre.
--      (La consulta a ARCA para saber la condición —monotributo, responsable
--      inscripto— necesita certificado propio y queda para cuando lo tengamos.)
--   2. Que un cliente nuevo de FemWay no sea, en realidad, un cliente de FEMAVI
--      que ya existe: se compara por CUIT y por razón social parecida.
-- No bloquean nada: avisan, y administración decide.

create extension if not exists pg_trgm with schema extensions;

-- Para buscar razones sociales parecidas sin recorrer los 20.000 clientes.
create index if not exists hist_clientes_razon_trgm
  on public.hist_clientes using gin (razon_social extensions.gin_trgm_ops);
create index if not exists hist_clientes_cuit_idx on public.hist_clientes (cuit);

/**
 * Deja una razón social comparable: sin acentos, sin puntuación y sin las
 * formas societarias, que son las que ensucian la comparación
 * ("T.G.S. S.A." y "TGS SOCIEDAD ANONIMA" tienen que parecerse).
 */
create or replace function public.normalizar_razon(p text)
returns text
language sql
immutable
as $fn$
  select nullif(btrim(regexp_replace(
    regexp_replace(
      regexp_replace(
        translate(upper(coalesce(p, '')), 'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑ', 'AAAAEEEEIIIIOOOOUUUUN'),
        '\y(S\.?\s?A\.?\s?(C\.?\s?I\.?)?(\s?Y\s?M\.?)?|S\.?\s?R\.?\s?L\.?|S\.?\s?A\.?\s?S\.?|SOCIEDAD\s+ANONIMA|S\.?\s?C\.?\s?A\.?|S\.?\s?H\.?|CIA|Y\s+CIA|LTDA?)\y', ' ', 'g'),
      '[^A-Z0-9 ]', ' ', 'g'),
    '\s+', ' ', 'g')), '');
$fn$;

/** Valida un CUIT: 11 dígitos, prefijo conocido y dígito verificador. */
create or replace function public.cuit_control(p text)
returns jsonb
language plpgsql
immutable
as $fn$
declare
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  pesos int[] := array[5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  suma int := 0;
  dv int;
  prefijo text;
begin
  if d = '' then
    return jsonb_build_object('estado', 'falta', 'mensaje', 'El pedido no trae CUIT.');
  end if;
  if length(d) <> 11 then
    return jsonb_build_object('estado', 'invalido', 'digitos', d,
      'mensaje', 'El CUIT tiene ' || length(d) || ' dígitos; tienen que ser 11.');
  end if;

  prefijo := left(d, 2);
  if prefijo not in ('20', '23', '24', '25', '26', '27', '30', '33', '34') then
    return jsonb_build_object('estado', 'invalido', 'digitos', d,
      'mensaje', 'El CUIT empieza con ' || prefijo || ', que no es un prefijo válido.');
  end if;

  for i in 1..10 loop
    suma := suma + substr(d, i, 1)::int * pesos[i];
  end loop;
  dv := 11 - (suma % 11);
  if dv = 11 then dv := 0; end if;

  if dv > 9 or dv <> substr(d, 11, 1)::int then
    return jsonb_build_object('estado', 'invalido', 'digitos', d,
      'mensaje', 'El dígito verificador no cierra: puede estar mal tipeado.');
  end if;

  return jsonb_build_object(
    'estado', 'ok',
    'digitos', d,
    'formateado', substr(d, 1, 2) || '-' || substr(d, 3, 8) || '-' || substr(d, 11, 1),
    'tipo', case when prefijo in ('30', '33', '34') then 'Empresa' else 'Persona' end);
end;
$fn$;
revoke all on function public.cuit_control(text) from public, anon, authenticated;
grant execute on function public.cuit_control(text) to authenticated;

/**
 * Controles de un pedido, para mirarlos antes de aprobarlo.
 * Devuelve avisos, no bloquea: la decisión es de administración.
 */
create or replace function public.admin_controles_pedido(p_order_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  o public.orders%rowtype;
  v_cuit jsonb;
  v_dig text;
  v_nombre text;
  v_dup jsonb;
  v_dup_web jsonb;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  select * into o from public.orders where id = p_order_id;
  if not found then return null; end if;

  v_cuit := public.cuit_control(o.cuit);
  v_dig := v_cuit->>'digitos';
  v_nombre := public.normalizar_razon(coalesce(o.company, o.client_name));

  -- ¿Ya existe en el sistema viejo? Por CUIT o por razón social parecida.
  select coalesce(jsonb_agg(x order by x.coincide_por, x.parecido desc), '[]'::jsonb) into v_dup
    from (
      select c.codigo, c.razon_social, c.cuit, c.localidad, c.vendedor, r.ultima_compra,
             case when v_dig is not null and c.cuit = v_dig then 'cuit' else 'nombre' end as coincide_por,
             round(extensions.similarity(public.normalizar_razon(c.razon_social), v_nombre)::numeric, 2) as parecido
        from public.hist_clientes c
        left join public.hist_resumen_cliente r on r.codigo = c.codigo
       where (v_dig is not null and c.cuit = v_dig)
          or (v_nombre is not null and length(v_nombre) >= 4
              -- El % usa el índice; el 0.55 saca el ruido (dos "DISTRIBUIDORA"
              -- cualquiera se parecen un 40% y no son el mismo cliente).
              and public.normalizar_razon(c.razon_social) % v_nombre
              and extensions.similarity(public.normalizar_razon(c.razon_social), v_nombre) >= 0.55)
       order by case when v_dig is not null and c.cuit = v_dig then 0 else 1 end,
                extensions.similarity(public.normalizar_razon(c.razon_social), v_nombre) desc
       limit 5
    ) x;

  -- ¿Y en otros pedidos de la web? (por ejemplo cargado dos veces como nuevo)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'numero', p.order_number, 'fecha', p.created_at, 'proyecto', p.proyecto,
           'company', p.company, 'cuit', p.cuit, 'vendedor', p.seller_code, 'estado', p.status)
         order by p.created_at desc), '[]'::jsonb) into v_dup_web
    from (
      select * from public.orders p
       where p.id <> o.id
         and p.status <> 'rechazado'
         and ((v_dig is not null and regexp_replace(coalesce(p.cuit, ''), '\D', '', 'g') = v_dig)
              or (v_nombre is not null and length(v_nombre) >= 4
                  and public.normalizar_razon(p.company) = v_nombre))
       order by p.created_at desc
       limit 5
    ) p;

  return jsonb_build_object(
    'pedido', jsonb_build_object('id', o.id, 'numero', o.order_number, 'proyecto', o.proyecto,
                                 'cliente_nuevo', o.is_new_client, 'estado', o.status),
    'cuit', v_cuit,
    'duplicados_sistema', v_dup,
    'duplicados_web', v_dup_web,
    -- El aviso de duplicado importa sobre todo en FemWay: un cliente nuevo de
    -- FemWay no puede ser uno que ya compra en FEMAVI.
    'duplicado_grave', (o.proyecto = 'femway' and jsonb_array_length(v_dup) > 0),
    'precio', jsonb_build_object('estado', 'sin_lista',
      'mensaje', 'Falta cargar la lista de precios para poder comparar.')
  );
end;
$fn$;
revoke all on function public.admin_controles_pedido(bigint) from public, anon, authenticated;
grant execute on function public.admin_controles_pedido(bigint) to authenticated;
