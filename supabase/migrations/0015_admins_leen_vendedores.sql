-- La bandeja de pedidos muestra el nombre de cada vendedor. Los administradores
-- pueden leer código, nombre y si está activo, pero no el hash del PIN ni los
-- intentos fallidos: el permiso es por columna, no por tabla.
revoke all on public.sellers from anon, authenticated;
grant select (code, name, active, last_login_at) on public.sellers to authenticated;
drop policy if exists sellers_admin_read on public.sellers;
create policy sellers_admin_read on public.sellers for select using (public.is_admin());
