-- sellers se lee por columna, para que el hash del PIN no salga nunca. La
-- columna es_distribuidor quedó afuera y el panel entero fallaba con
-- "permission denied for table sellers" al listar los vendedores.
--
-- Al agregar una columna a sellers hay que acordarse de este grant.
grant select (es_distribuidor) on public.sellers to authenticated;
