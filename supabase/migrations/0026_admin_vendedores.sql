-- Alta y administración de vendedores desde el panel, para no depender de nadie
-- para crear un vendedor nuevo o cambiarle el PIN.
--
-- El PIN nunca se guarda ni se devuelve: entra por acá, se hashea con bcrypt y
-- queda solo el hash. No hay forma de leerlo después, ni para un administrador
-- ni para quien tenga acceso a la base: si se olvida, se pone uno nuevo.
-- Todo esto solo lo puede hacer un administrador (is_admin()).

create or replace function public.admin_listar_vendedores()
returns table (
  code text, name text, active boolean, proyectos text[],
  last_login_at timestamptz, locked_until timestamptz, tiene_pin boolean,
  pedidos bigint, ultimo_pedido timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  return query
  select s.code, s.name, s.active, s.proyectos, s.last_login_at, s.locked_until,
         s.pin_hash is not null,
         count(o.id), max(o.created_at)
    from public.sellers s
    left join public.orders o on o.seller_code = s.code
   group by s.code, s.name, s.active, s.proyectos, s.last_login_at, s.locked_until, s.pin_hash
   order by s.code::int;
end;
$fn$;
revoke all on function public.admin_listar_vendedores() from public, anon, authenticated;
grant execute on function public.admin_listar_vendedores() to authenticated;

-- Crea o actualiza un vendedor. El PIN es opcional: si no viene, no se toca.
create or replace function public.admin_guardar_vendedor(
  p_code text,
  p_name text,
  p_proyectos text[] default array['femavi'],
  p_active boolean default true,
  p_pin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_code text := btrim(coalesce(p_code, ''));
  v_name text := btrim(coalesce(p_name, ''));
  v_hash text := null;
  v_nuevo boolean;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  if v_code !~ '^[0-9]{1,4}$' then raise exception 'El código tiene que ser un número de hasta 4 dígitos.'; end if;
  if length(v_name) < 2 then raise exception 'Falta el nombre del vendedor.'; end if;
  if not (p_proyectos <@ array['femavi', 'femway']) or coalesce(array_length(p_proyectos, 1), 0) = 0 then
    raise exception 'Elegí al menos un proyecto.';
  end if;

  if p_pin is not null then
    if btrim(p_pin) !~ '^[0-9]{4,8}$' then raise exception 'El PIN tiene que ser de 4 a 8 números.'; end if;
    v_hash := crypt(btrim(p_pin), gen_salt('bf'));
  end if;

  select not exists (select 1 from public.sellers where code = v_code) into v_nuevo;
  if v_nuevo and v_hash is null then
    raise exception 'Un vendedor nuevo necesita un PIN.';
  end if;

  insert into public.sellers (code, name, proyectos, active, pin_hash, failed_attempts, locked_until)
  values (v_code, v_name, p_proyectos, coalesce(p_active, true), v_hash, 0, null)
  on conflict (code) do update set
    name = excluded.name,
    proyectos = excluded.proyectos,
    active = excluded.active,
    pin_hash = coalesce(v_hash, public.sellers.pin_hash),
    -- Un PIN nuevo destraba al vendedor bloqueado por intentos fallidos.
    failed_attempts = case when v_hash is null then public.sellers.failed_attempts else 0 end,
    locked_until = case when v_hash is null then public.sellers.locked_until else null end,
    updated_at = now();

  -- Si se le cambia el PIN o se lo da de baja, las sesiones abiertas dejan de servir.
  if v_hash is not null or coalesce(p_active, true) = false then
    delete from public.seller_sessions where seller_code = v_code;
  end if;

  return jsonb_build_object('code', v_code, 'nuevo', v_nuevo, 'pin_cambiado', v_hash is not null);
end;
$fn$;
revoke all on function public.admin_guardar_vendedor(text, text, text[], boolean, text) from public, anon, authenticated;
grant execute on function public.admin_guardar_vendedor(text, text, text[], boolean, text) to authenticated;

-- Cierra las sesiones abiertas de un vendedor (por ejemplo si perdió el celular).
create or replace function public.admin_cerrar_sesiones_vendedor(p_code text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare n integer;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  delete from public.seller_sessions where seller_code = btrim(p_code);
  get diagnostics n = row_count;
  return n;
end;
$fn$;
revoke all on function public.admin_cerrar_sesiones_vendedor(text) from public, anon, authenticated;
grant execute on function public.admin_cerrar_sesiones_vendedor(text) to authenticated;
