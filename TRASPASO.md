# Traspaso — FEMAVI / FemWay

Documento para que otra sesión pueda seguir sin volver a preguntar lo ya decidido.
Escrito el **30/09/2026**. Todo lo que dice acá está verificado contra la base y el
repo ese día, no contra la memoria de la conversación.

---

## 1. Objetivo general

Ordenar la logística y la administración de FEMAVI. En concreto:

- Que los **vendedores carguen los pedidos por la web** en vez de mandarlos por
  WhatsApp, teléfono o mail.
- Que el pedido llegue **por mail a santiago@femavi.com.ar y ventas@femavi.com.ar
  con la planilla en Excel adjunta**.
- Que administración pueda **filtrar, controlar y medir** desde el admin.

Acceso: **solo Santiago, su padre (ventas@femavi.com.ar) y Eneas** tienen admin.
Los vendedores solo cargan lo suyo.

Dos reglas de fondo que atraviesan todo:

- **1 L = 1 kg.** El volumen se suma junto, sin mirar el catálogo, así cualquier
  producto que escriban cuenta.
- **La estadística no puede depender del catálogo** ni mezclar proyectos.

---

## 2. Con quién se trabaja

**Santiago Daurat.** Escribe corto, muchas veces por voz (aparecen "femwey",
"fenway", "quit" por CUIT). Decide rápido y corrige rápido; cuando algo no le
gusta lo dice sin vueltas y hay que rehacerlo, no defenderlo.

Cómo responderle, que es lo que funcionó:

- **En castellano rioplatense**, sin jerga técnica salvo que haga falta.
- **Decirle qué se probó y con qué datos reales.** "Lo probé con el 119 y
  apareció GUTIERREZ EDGARDO" vale mucho más que "funciona".
- **Avisarle de los efectos colaterales antes de que los descubra**: números que
  van a quedar en cero, pedidos que van a necesitar un dato nuevo, etc.
- **Si se rompió algo por culpa de uno, decirlo primero y sin adornos.** Pasó (ver
  §9) y lo tomó bien porque se lo dijo de entrada, con lo que se rompió y cómo
  quedó arreglado.
- Limpiar **siempre** lo que se usó para probar: pedidos, clientes, sesiones, y
  **devolver los contadores a donde estaban**. Él lo mira.

---

## 3. Los dos proyectos

**FEMAVI** es la empresa de siempre: ~20.500 clientes en el sistema viejo,
historial desde 1995, vendedores con cartera asignada.

**FemWay** (nombre tentativo, definido el 22/09/2026) es como una empresa adentro
de FEMAVI: **lista de precios propia, comisiones propias, cuenta de banco propia,
clientes nuevos o dormidos recuperados**. Empieza a facturar en **octubre de 2026**.
Todo el proyecto de carga web arrancó por FemWay, no por FEMAVI.

**La regla de oro: nunca mezclar.** La estadística histórica de FEMAVI no se puede
ensuciar con la del proyecto nuevo, y la de FemWay tiene que arrancar limpia.

**Un código de vendedor pertenece a un solo proyecto** (decisión del 23/09/2026).
El que trabaja en los dos tiene dos códigos y elige con cuál entra. De ahí sale
`orders.proyecto`: no hay nada que elegir en la planilla, no hay con qué
equivocarse.

---

## 4. Infraestructura

| Qué | Dónde |
|---|---|
| Repo | `C:\Users\Santiago Daurat\Desktop\femavi-web-main\femavi-web-main` |
| Stack | React + Vite + TypeScript. Tailwind en el admin; estilos en línea en la planilla del vendedor |
| Base | Supabase, project ref **`lhqawwjszwjzxxsonvwa`** |
| Deploy | Vercel, automático al pushear a `main` |
| Sitio | https://www.femavi.com.ar |

**Cómo verificar un deploy:** la API de deployments de GitHub nunca matcheaba el
SHA corto. Lo que sí funciona es bajar el bundle publicado y buscar un símbolo
nuevo:

```bash
curl -s https://www.femavi.com.ar/vendedores/55 | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'
curl -s "https://www.femavi.com.ar/assets/index-XXXX.js" | grep -o 'SellerOrder-[A-Za-z0-9_-]*\.js'
curl -s "https://www.femavi.com.ar/assets/SellerOrder-XXXX.js" | grep -c "texto nuevo"
```

**Cómo probar la pantalla del vendedor sin PIN:** crear una sesión de prueba en la
base y ponerla en `localStorage`. Al terminar, borrar las dos.

```sql
insert into public.seller_sessions (token_hash, seller_code, expires_at)
values (encode(extensions.digest('prueba-x', 'sha256'), 'hex'), '55', now() + interval '15 minutes');
```
```js
localStorage.setItem('femavi_vendedor', JSON.stringify(
  {code:'55', name:'Victor Migueles', token:'prueba-x', proyecto:'femway'}));
```

**Cómo probar una función de admin:** `is_admin()` lee `auth.jwt() ->> 'email'`
contra `admin_emails`. Se simula así:

```sql
set local role authenticated;
set local request.jwt.claims = '{"email":"santiago@femavi.com.ar"}';
```

**Las pantallas del admin no se pueden ver logueado** (no hay password). Lo que se
usó: exponer temporalmente la ruta sin `RequireAuth` en `App.tsx`, mirar, y
**revertir enseguida** (guardar una copia del archivo antes). Para ver datos, un
*stub* temporal en la función del lib que devuelve una ficha de mentira si
`location.pathname` empieza con la ruta de prueba. Nunca commitear eso.

---

## 5. Reglas de negocio decididas (y por qué)

### 5.1 Pedidos

- **El número lo asigna la base** con `order_number_seq`, arrancando en 218000 para
  seguir la numeración del sistema viejo. Nunca lo manda el navegador: dos
  vendedores simultáneos no pueden recibir el mismo.
- **Cantidad = total en litros o kilos**; `envase` dice cómo se compone ("2x200");
  `precio` es por litro o kilo. **Cantidad negativa = bonificación**, que descuenta
  del renglón de arriba y resta del total.
- **Enter no envía el pedido.** Se enviaba y se fue uno a medias. Ahora solo el
  botón; Enter sigue sirviendo en Observaciones (renglón nuevo) y sobre un botón.
- **Administración también carga pedidos** (`/admin/pedidos/nuevo`), eligiendo el
  código de agente. Muchos pedidos llegan por mail y los carga ella.

### 5.2 Clientes y autocompletado

- **Todos los vendedores** tienen autocompletado: escriben el código o la razón
  social y se llena la planilla. Empezó limitado al 10 (Gerencia) mientras se
  probaba; se abrió a todos el 25/09.
- **Cada uno ve solo SU cartera.** El código sale del pase de sesión, nunca de un
  parámetro. Verificado: el 13 pidiendo un cliente del 9 recibe `null`.
- **No se completan condición de IVA ni condición de pago.** En el sistema viejo
  son códigos numéricos (IVA 0..9, pago 02/11/12/22) y **no existe la tabla que
  los explica**. Poner un valor adivinado sería peor que dejarlo vacío. Si Santiago
  pasa la equivalencia, se completan solas.
- **Tampoco el e-mail**: el sistema viejo no lo guarda en la ficha.
- **La provincia es un código numérico** ("02"), así que no se muestra ni se carga;
  va solo la localidad.
- El campo `otros` del sistema viejo ("BAJA 9/2011", "NO VENDER", "DADO A ROBERTO
  04/24") **se muestra como aviso, no se carga en el pedido**.

### 5.3 Clientes de FemWay

- Tienen **registro propio**: tabla `femway_clientes`.
- **El mismo cliente puede estar en los dos proyectos y lleva el mismo código**
  (decisión del 24/09): el 03250 de FEMAVI es el 03250 de FemWay. Los que nacen en
  FemWay toman números de una **serie propia desde 50001**, bien arriba del último
  del sistema viejo (20576), para que nunca se pisen.
- **El cliente se da de alta solo con el pedido.** Casi siempre termina existiendo
  también en el sistema viejo porque administración lo carga ahí para facturar;
  hacer el pase a mano cada vez era la regla en vez de la excepción. Si el CUIT ya
  está en el sistema viejo, nace con **ese** código y **esos** datos (más completos
  que lo que tipeó el vendedor); si no, con los de la planilla.
- **Un alta automática NO cuenta como pase aprobado**: queda con `pasado_el` en
  null, se muestra como "También en FEMAVI · sin confirmar" (ámbar) y el control de
  duplicados **sigue avisando en rojo** hasta que una persona lo confirme desde
  Clientes. Ese control existe justamente para eso.
- **Un cliente de FemWay es de un solo vendedor.** Si el 57 carga un pedido con el
  CUIT de un cliente del 55, **no sale**: no es un aviso, es un freno, y está en
  `create_order` donde el vendedor no lo puede saltear. Solo FemWay, y solo para
  pedidos cargados por el vendedor (si lo carga administración, sabe lo que hace).
- **El vendedor puede escribir las notas** de sus clientes, y nada más. Es la misma
  nota que ve y edita el admin.
- **Al vendedor no se le muestra nada de FEMAVI**: ni el sello "También en FEMAVI"
  ni el "Código en FEMAVI". Eso es del admin (prop `mostrarFemavi`).

### 5.4 Períodos y aprobación

- **"Mis ventas" cuenta recién cuando administración aprueba.** Cargar un pedido no
  es venderlo. Antes de aprobarlo no figura en ningún número ni en la lista; lo
  único que ve el vendedor es "tenés N pedidos esperando la aprobación".
  Cuentan los estados `aprobado, ingresado, facturado, entregado`.
- **FEMAVI mide por CICLO.** Los ciclos son los meses, pero **el corte va variando**
  y no coincide con el calendario, así que **administración elige a mano a qué mes
  pertenece cada pedido** al aprobarlo, de un desplegable con los doce meses del
  año del pedido. **Sin ciclo elegido no se aprueba** (trigger `pedido_exige_ciclo`).
- **FemWay mide por MES CALENDARIO**, del 1 al último día, sacado de la fecha del
  pedido. No hay nada que elegir y **el día 1 de cada mes arranca en cero**. Un
  pedido de FemWay se aprueba sin ciclo.
- Los rótulos cambian según el proyecto: "Este ciclo / Ciclo pasado / Últimos 3
  ciclos / Este año" en FEMAVI; "Este mes / Mes pasado / Últimos 3 meses / Este
  año" en FemWay.
- En FemWay, el recuadro de **Volumen** y el de **Bonificado** se abren y muestran
  el desglose **por separado**: volumen lista **lo facturado, neto de
  bonificaciones** (50 CITRIFEM, 50 ULTRA SKIN), así la lista suma lo mismo que
  la tarjeta; bonificado lista lo bonificado (10 y 10). Solo producto y número.
  (Hasta el 30/09 mostraba lo vendido bruto, 60, y no cerraba: lo pidió Santiago.)
- **El 57 (Mariano Vega) es gerente de FemWay** (`sellers.es_gerente`): solapa
  "Equipo" con el proyecto entero —por vendedor, por cliente, pedido por pedido,
  sin rechazados y sin estados— y la ficha de cualquier cliente de FemWay, solo
  para ver. Funciones `seller_equipo` y `seller_femway_ficha_cliente` (0045, 0046).

### 5.5 Los tres controles antes de aprobar

Definidos por Santiago textualmente el 24/09. Se ven en el detalle del pedido
(`ControlesPedido.tsx`, datos de `admin_controles_pedido`):

1. **Que no sea un cliente que ya existe de FEMAVI**, y si existe, que no tenga
   compras en el último año. Rojo (`duplicado_grave`) solo si es FemWay **y** hay
   coincidencia con compras en los últimos 365 días **y** no hay pase confirmado.
   Cada coincidencia se marca "(en el último año)" o "(dormido)". El match es por
   CUIT exacto o por razón social normalizada con `pg_trgm` a **0.55** de
   similitud (a 0.3, el default, era puro ruido).
2. **Que el CUIT esté bien cargado**, con razón social según ARCA. Valida el
   dígito verificador (prefijos 20/23/24/25/26/27/30/33/34) y consulta el padrón.
3. **Precio**: se tolera **hasta 20% de descuento sobre el precio más barato** de la
   lista; **a partir del 21% avisa**. La lista tiene varios precios por producto y
   el más caro es justo 20% más caro que el más barato. Las **bonificaciones no se
   controlan** (cantidad ≤ 0). Si el renglón no matchea ningún producto (similitud
   < 0.45) dice "no lo encontré en la lista, revisalo a mano".

---

## 6. Estado actual — qué está terminado

Todo lo de abajo está **en producción y verificado con datos reales**.

- Planilla del vendedor con PIN, sesión de 30 días, pedidos, bonificaciones.
- Autocompletado del cliente por código y por razón social, para todos.
- Carga de pedidos desde el admin eligiendo vendedor.
- Registro de clientes de FemWay: alta automática, pase desde FEMAVI, alta manual,
  ficha con ABM e historial, notas del vendedor.
- Solapa "Mis clientes" para los dos proyectos.
- Mis ventas por ciclo/mes, solo aprobados, con desglose de volumen.
- Los tres controles antes de aprobar.
- Ciclo obligatorio para aprobar en FEMAVI.
- Mail del pedido con la planilla en Excel.
- Sincronización del sistema viejo (anda sola desde el 22/09).
- Consulta al padrón de ARCA desde el admin.

### Datos concretos al 30/09/2026

**Vendedores** (tabla `sellers`):

| FEMAVI | | FemWay | |
|---|---|---|---|
| 9 | Dabrowski | 14 | Alberto Nasser |
| 10 | Gerencia | 55 | Victor Migueles |
| 11 | Nasser | 56 | Guillermo Uraguchi |
| 13 | Roberto | 57 | Mariano Vega |
| 18 | Lezama | 93 | Damian Gomez |
| 21 | Poleri | | |
| 28 | Lopardo | | |
| 31 | **Culzoni** (ojo: 21 es Poleri, se confunden) | | |
| 46 | Lezama (segundo código) | | |
| 92 | Damián Gomez | | |

**Pedidos** (7, `order_number_seq` en 218007):

| N° | Vend | Proyecto | Estado | Ciclo | Total |
|---|---|---|---|---|---|
| 218001 | 10 | femavi | aprobado | Octubre 2026 | $675.000 |
| 218002 | 55 | femway | entregado | — | $2.250.000 |
| 218003 | 14 | femway | ingresado | — | $240.000 |
| 218004 | 21 | femavi | ingresado | Septiembre 2026 | $564.000 |
| 218005 | 14 | femway | aprobado | — | $110.000 |
| 218006 | 93 | femway | aprobado | — | $77.000 |
| 218007 | 93 | femway | recibido | — | $1.200.000 |

Los de FemWay sin ciclo **están bien así**: no lo necesitan.

**Clientes de FemWay** (5, `femway_cliente_seq` en 50002 usado):

| Código | Razón social | Vend | Origen |
|---|---|---|---|
| 03886 | TALLERES AUTOMUNDO S.A. | 14 | de FEMAVI, pasado 25/09 |
| 04837 | SILVEIRA LUCAS GASTON | 14 | de FEMAVI, pasado 25/09 |
| 20576 | INDUBOM S.R.L | 55 | de FEMAVI, pasado 24/09 |
| 50001 | Gagliardo Armando | 93 | nuevo, **sin confirmar** |
| 50002 | FRATELLI CURRAO SRL | 93 | nuevo, **sin confirmar** |

Los dos últimos los creó **sola** el alta automática con los pedidos del 93: la
función está andando en producción.

**Otros números:** 20.464 clientes en `hist_clientes`, 184.720 comprobantes,
220 productos en `precios_lista` (proyecto femway, vigencia **09-26**).
Última sincronización del sistema viejo: **30/09/2026 12:23**.

---

## 7. Mapa del código

### Front

| Archivo | Qué es |
|---|---|
| `src/components/PlanillaPedido.tsx` | **La planilla**, compartida por el vendedor y el admin. No sabe de pases ni permisos: la página le pasa de dónde salen los datos del cliente (`cliente`), con qué función se guarda (`guardar`), qué validar de más (`validar`), y cómo revisar el CUIT (`revisarCuit`). Exporta también `C` (paleta), `money`, `campo` y `Casilla`. |
| `src/pages/SellerOrder.tsx` | Pantalla del vendedor: PIN, solapas, pantalla de "pedido enviado". Monta la planilla con `key={intento}` para limpiarla. |
| `src/components/MisVentas.tsx` | Resumen por ciclo/mes, con el desglose de volumen. |
| `src/components/MisClientes.tsx` / `MisClientesFemway.tsx` | Cartera del vendedor, una por proyecto. |
| `src/components/FichaClienteVista.tsx` / `FichaFemwayVista.tsx` | Las fichas. La de FemWay la usan el admin y el vendedor; `mostrarFemavi` y `vendedores`+`alGuardar` son del admin, `guardarNota` es del vendedor. |
| `src/pages/admin/NuevoPedido.tsx` | Carga de pedidos desde el admin. |
| `src/pages/admin/PedidoDetalle.tsx` | Detalle, controles, cambio de estado, desplegable de ciclo. |
| `src/pages/admin/Clientes.tsx` + `components/ClientesFemway.tsx` | Clientes con el corte FEMAVI / FemWay. |
| `src/components/ControlesPedido.tsx` | Los tres controles. |
| `src/lib/historial.ts` | Sistema viejo: listas, fichas, filtros, artículos. |
| `src/lib/femway.ts` | Todo lo de FemWay. |
| `src/lib/adminOrders.ts` | Pedidos y vendedores del admin. |
| `src/lib/sellers.ts` | Sesión del vendedor, `PaseVencidoError`, resumen de ventas. |

### Base — funciones que importan

- `create_order(p, p_token)` — vendedor. Saca el código del pase; **frena el cliente
  de otro vendedor en FemWay**.
- `admin_crear_pedido(p, p_vendedor)` — admin, con el vendedor elegido.
- `pedido_insertar(p, p_seller, p_proyecto)` — el insert común; llama a
  `femway_cliente_desde_pedido` cuando es FemWay.
- `pedido_exige_ciclo()` — trigger sobre `orders`, solo FEMAVI.
- `seller_resumen(p_token, p_periodo)` — `ciclo | ciclo_pasado | ultimos3 | anio`.
- `seller_datos_cliente` / `seller_buscar_cliente` — autocompletado; **se bifurcan
  solos** según el proyecto del vendedor.
- `seller_femway_clientes` / `seller_femway_ficha_cliente` / `seller_femway_guardar_nota`
- `femway_ficha_base` + `admin_femway_ficha_cliente` + `seller_femway_ficha_cliente`
  (patrón base sin permisos + dos puertas, igual que la ficha de FEMAVI).
- `admin_femway_pasar_cliente` — trae de FEMAVI **y también confirma** un alta
  automática.
- `admin_controles_pedido(p_order_id)` — los tres controles.
- `seller_cuit_de_otro(p_token, p_cuit)` — para avisar mientras se escribe.
- `nombre_de_mes(date)` — "Septiembre 2026". **No usar `to_char(..., 'TMMonth')`**:
  depende del idioma del servidor y salía en inglés.

**Permisos:** toda función nueva va con
`revoke all ... from public, anon, authenticated` y después el `grant` explícito.
Revocar **también** a `anon` y `authenticated`, no solo a `public`: por no hacerlo,
`set_seller_pin` quedó abierta al público una vez.

### Migraciones de esta etapa

`0032` datos del cliente en la planilla · `0033` buscar por razón social ·
`0034` pedidos desde el admin · `0035` clientes de FemWay · `0036` autocompletado
y controles · `0037` ficha de FemWay · `0038` alta automática · `0039`
autocompletado para todos · `0040` el ciclo es un mes · `0041` desglose del
volumen · `0042` mis clientes de FemWay · `0043` cliente de un solo vendedor ·
`0044` notas del vendedor.

### Edge functions (Deno, en `supabase/functions/`)

- **`send-order-notification`** (v12+, `verify_jwt: false`). Arma el mail y el Excel.
  Se despliega con:
  `npx supabase@latest functions deploy send-order-notification --project-ref lhqawwjszwjzxxsonvwa --no-verify-jwt`
  Se protege sola: avisa **una sola vez** por pedido (marca `notified_at` de forma
  atómica) y **solo de la última hora**, así nadie la usa para llenar de correo a
  ventas@. Destinatarios fijos; en modo `prueba` solo a santiago@.
- **`arca-padron`** (v8). WSAA + padrón. Secret **`ARCA_SERVICIO`** =
  `ws_sr_constancia_inscripcion,ws_sr_padron_a13`. La constancia usa la operación
  **`getPersona_v2`** (no `getPersona`) contra `personaServiceA5`; A13 devuelve
  campos planos y sin impuestos, y el parser aguanta las dos formas. Cachea 7 días
  en `arca_consultas`. Certificado `femavi-web`, válido hasta el 22/09/2028.

### El Excel del mail

Se arma con ExcelJS dentro de `send-order-notification`. Decisiones:

- **Nada de relleno azul oscuro**: la planilla se imprime y se comía el toner. El
  azul quedó para el texto y tres líneas; el único relleno con color es
  `FFEAF1FA`, apenas un tono.
- **El logo lleva alto fijo y el ancho sale de su proporción real**, leída de la
  cabecera IHDR del PNG (bytes 16–24). Antes se estiraba a un recuadro y salía
  deformado.
- **Recuadro de OBSERVACIONES siempre**, aunque el pedido no traiga ninguna: se
  imprime y administración anota a mano.
- El recuadro se dibuja **sobre la celda combinada de arriba a la izquierda**;
  escribir el borde en cada celda del rango pisa el estilo y queda media caja.

---

## 8. Lo que se descartó y por qué

- **Ciclos con fechas cargados a mano.** Se llegó a construir tabla `ciclos`,
  pantalla `/admin/ciclos`, ABM y restricción de no superposición. Santiago lo
  frenó: *"los ciclos para femavi son los meses también"*. Lo manual es **elegir el
  mes del pedido**, no definir los ciclos. Se borró todo (tabla y funciones) en
  `0040`.
- **Un solo desglose con columnas Vendido / Bonificado / Neto.** Pidió que fueran
  **dos listas separadas**, cada una con su número y nada más.
- **Números de análisis arriba de la ficha** (pedidos, comprado, litros, última
  compra) y tabla "Qué compra". Los sacó: *"armalo igual que el de femavi"*. La
  ficha es **ABM + historial y nada más**; el análisis va en reportes, **si lo pide**.
- **Un código por vendedor compartido entre proyectos.** Primero se hizo que el
  vendedor eligiera proyecto al cargar; se descartó el 23/09 por **un código por
  proyecto**, que no se puede equivocar.
- **Sello "También en FEMAVI" para el vendedor.** Lo sacó; queda solo en el admin.
- **La lista de "clientes que se están cayendo" en el panel del vendedor.**
  Decisión suya: *"dejala solo para nosotros por ahora"*. La función
  `seller_clientes_en_caida` existe pero **tiene el permiso revocado** (migración
  0023): para activarla alcanza un `grant`.

---

## 9. Problemas conocidos y trampas

### Errores que ya se cometieron — no repetirlos

- **Se pisaron datos reales de un cliente probando.** `admin_femway_guardar_cliente`
  sobrescribía **todos** los campos aunque el payload trajera solo algunos; una
  prueba dejó a SILVEIRA sin domicilio, teléfono, responsable ni zona, y creó un
  "Indubom SRL" duplicado con código 50001. Se restauró desde `hist_clientes`, se
  borró el duplicado y se devolvió la secuencia. **La función ya solo cambia lo que
  viene** (`case when p ? 'campo' ...`). Moraleja: **antes de probar sobre una tabla,
  mirar si tiene datos que el usuario ya cargó.**
- **El control de precio se caía en el primer pedido de FemWay**:
  `cannot cast type record to precios_lista — Input has too many columns`. El
  subselect lateral devolvía la fila de la lista **más** la columna `parecido`, y
  `precio_mas_barato()` espera exactamente una fila. Nunca se había disparado
  porque FEMAVI no tiene lista cargada y no existía ningún pedido de FemWay. Ya
  está: la fila viaja entera como `p2 as fila` y se usa `(l.fila).producto`.

### Trampas del entorno (Windows + bash)

- **`node -e "..."` en Bash se come las barras invertidas.** Ya produjo
  `.replace(/\n/g,"\n")` (no-op), `supabase.rpc(seller_perfil, …)` sin comillas y
  un `replace(/D/g,'')` donde iba `/\D/g`. **Para strings exactos, usar Write o
  Edit**, no `node -e`. Si hay backticks adentro, peor: bash los toma como
  sustitución de comandos.
- **Los heredocs de más de ~7 KB se truncan** ("unexpected EOF"). Partir en tramos
  de ~5 KB o usar Write.
- **`create or replace function` no puede cambiar el tipo de retorno ni sacar
  defaults**: hace falta `drop function if exists` antes.
- Para modificar una función larga sin volver a pegarla entera, sirve:
  `do $$ declare d text; begin select pg_get_functiondef(...) into d;
  d := replace(d, 'viejo', 'nuevo'); execute d; end $$;`
- **El monitor de red del navegador no ve los pedidos a supabase.co.** Para saber
  qué devolvió la RPC, usar `curl` con la anon key de `.env`, o un `console.log`
  temporal.
- **Clicks por `ref` a veces no llegan al botón** si el ref es un `<span>` interno.
  Más confiable: `document.querySelector` + `.click()` desde `javascript_tool`.

### Cosas que hoy están mal o a medias

- **La lista de "clientes que se caen" va a mentir.** Un cliente que deja de
  comprarle a FEMAVI porque se mudó a FemWay va a aparecer como perdido en unos
  meses. Falta marcarlo. No corre apuro (recién cuando pase medio año sin comprar),
  está avisado y aceptado.
- **`seller_summary(p_token, p_desde, p_hasta)` quedó sin uso** — la reemplazó
  `seller_resumen`. No se borró para no romper nada durante el deploy. Se puede
  borrar.
- **`start-femavi.bat`** (en el escritorio, un nivel arriba del repo) apunta a
  `...\femavi-web-main\femavi-web-main\femavi-web-main` — **una carpeta de más**, no
  existe. Ofrecido arreglarlo, sin respuesta.
- **El Excel `LISTA DE PRECIOS 09-26.xlsx`** tiene en la fila 2 una nota de trabajo
  ("Completar SOLO la última columna…") que conviene sacar si se lo manda a alguien
  de afuera. Ofrecido, sin respuesta.
- **Tres productos O.K.S. (111, 2661, 371) no tienen precio** en la lista: para esos
  el control dice "revisalo a mano".
- **El nombre del 93 es "Damian Gomez"** (sin tilde) y el del 92 "Damián Gomez"
  (con tilde). Ofrecido igualarlo, sin respuesta.

---

## 10. Límites que se pusieron y Santiago aceptó

**No cruzarlos.** Los aceptó explícitamente y todo el flujo está armado para que él
lo haga por su cuenta.

- **No se cargan PIN de vendedores.** Se guardan con bcrypt y no se pueden leer.
  La pantalla `/admin/vendedores` existe para que los ponga él. Como el sistema no
  deja crear un vendedor sin PIN, **el alta entera la hace él**; después se verifica
  que haya quedado en el proyecto correcto, activo y con PIN (sin ver el PIN).
- **No se toca la clave privada del certificado de ARCA.** Él corrió `openssl` y
  `supabase secrets set`.
- **No se ingresa su Clave Fiscal.** El login en ARCA lo hace él.
- **Antes de tocar su cuenta de ARCA** (Administrador de Relaciones) se le muestra
  el resumen y se le pregunta.

---

## 11. Próximos pasos

### Lo inmediato

1. **Pedido 218007 del 93, en Recibido, $1.200.000.** Es de FemWay, así que se
   aprueba sin ciclo, pero conviene mirar antes los tres controles.
2. **Los clientes 50001 y 50002 están "sin confirmar".** Se dieron de alta solos.
   Si alguno también es cliente de FEMAVI, confirmarlo desde Clientes → FemWay →
   "Traer un cliente de FEMAVI"; si no, no hay nada que hacer.
3. **Decidir sobre el mensaje del CUIT ocupado.** Hoy dice *"Ese CUIT es de
   SILVEIRA LUCAS GASTON, que es cliente de otro vendedor"*. Es la única rendija por
   la que un vendedor puede enterarse del nombre de un cliente ajeno —solo si ya
   tiene el CUIT—. Está ofrecido sacarle el nombre. **Preguntado, sin respuesta.**

### Lo que quedó pedido y nunca se hizo

- **Comisiones.** Es el motivo por el que FemWay carga todo por la web desde el día
  uno. Faltan los parámetros (porcentajes, sobre qué se calcula, cuándo se liquida).
- **Ficha del vendedor** y **estadísticas generales**.
- **Enganchar los pedidos web con las facturas del sistema viejo** por número de
  pedido, que usan la misma numeración (218xxx).
- Filtros de clientes ofrecidos y no elegidos: "compran X pero no compran Y",
  clientes nuevos del período, nunca compraron, exportar a Excel.
- Chequeo crediticio (BCRA / Veraz / Nosis). Mencionado al pasar, nunca pedido.
- **Refrescar `precios_lista` cuando cambie la lista.** Hoy está la 09-26 con 220
  productos. Se carga parseando el XLSX que él manda; su archivo no se modifica.

### Cuando FemWay arranque a facturar (octubre 2026)

- Los vendedores nuevos (55, 56, 57, 93 y 14) no tienen cartera vieja: sus clientes
  se van creando solos con los pedidos.
- Vigilar que **el día 1 de cada mes FemWay arranque en cero** — está implementado y
  probado, pero es la primera vez que pasa de verdad.

---

## 12. Memoria

Hay notas en
`C:\Users\Santiago Daurat\.claude\projects\C--Users-Santiago-Daurat-Desktop-femavi-web-main\memory\`,
con índice en `MEMORY.md`. Las más relevantes para esta etapa:
`femavi-proyecto-femway`, `femavi-que-ve-el-vendedor`,
`femavi-controles-al-autorizar-pedido`, `femavi-arca-padron`,
`femavi-sistema-dos-legado`, `femavi-sincronizacion-legado`,
`femavi-pedidos-cantidad-envase`, `supabase-grants-funciones-nuevas`.

Están al día al 30/09/2026. **Si algo de este documento contradice una nota,
gana este documento**, que se escribió mirando la base.
