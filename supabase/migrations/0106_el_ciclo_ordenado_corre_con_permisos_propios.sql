-- Arreglo de 0104: al aprobar desde el admin salía "permission denied for
-- function ciclo_ordenado". El trigger corría con el usuario logueado, y
-- ciclo_ordenado no se le había dado a nadie. El trigger pasa a correr con
-- permisos propios (security definer); ciclo_ordenado sigue cerrada al público.

alter function public.pedido_ciclo_ordenado() security definer;
