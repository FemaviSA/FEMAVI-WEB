-- set_seller_pin quedaba ejecutable por anon: Supabase da execute explícito a
-- anon y authenticated en las funciones nuevas, y "revoke ... from public" no
-- lo saca. Cualquiera podía cambiar el PIN de un vendedor y entrar como él.
revoke execute on function public.set_seller_pin(text, text) from public, anon, authenticated;

-- El contador de pedidos solo lo usa create_order(), que corre como dueño.
-- Con usage, cualquiera podía llamar nextval() y quemar números.
revoke usage, select, update on sequence public.order_number_seq from anon, authenticated;
