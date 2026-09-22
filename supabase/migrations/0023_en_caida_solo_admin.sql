-- Por ahora la lista de clientes que se caen es solo para el admin: los
-- vendedores no la ven. La función queda escrita, pero sin permiso de uso.
-- Para activarla alcanza con volver a dar el grant.
revoke execute on function public.seller_clientes_en_caida(text, text, numeric, text, integer, integer) from anon, authenticated;
