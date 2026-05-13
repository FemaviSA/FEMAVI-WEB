# FEMAVI — Sitio + CMS de productos

Sitio público de FEMAVI (home + catálogo) y panel de administración para cargar productos sin tocar código.

**Stack**: Vite 8 + React 19 + TypeScript + React Router 7 + Tailwind v4 + Supabase (Postgres + Auth + Storage) + Lucide.

---

## Estructura

```
src/
├── pages/
│   ├── Home.tsx            # /  – home con hero, verticales, productos destacados, contacto
│   ├── Catalog.tsx         # /catalogo – catálogo con filtros e ítems detallados
│   └── admin/
│       ├── Login.tsx       # /admin/login
│       ├── Dashboard.tsx   # /admin – tabla de productos
│       └── ProductForm.tsx # /admin/products/:id – crear/editar
├── lib/
│   ├── supabase.ts         # cliente
│   ├── products.ts         # listProducts, upsertProduct, softDeleteProduct, uploadImage
│   └── seed.ts             # 12 productos en TS (fallback offline)
├── hooks/
│   ├── useProducts.ts
│   └── useAuth.ts
├── components/
│   ├── ProductCard.tsx
│   ├── ProductModal.tsx
│   └── RequireAuth.tsx
└── types/product.ts
supabase/migrations/   (informativo — ya aplicado al proyecto FEMAVI)
```

---

## Desarrollo local

```bash
npm install
cp .env.example .env.local       # ya tenés .env.local cargado
npm run dev                      # http://localhost:5173
```

`.env.local` apunta al proyecto Supabase **FEMAVI** en la cuenta `santidaurat@gmail.com` (ref `lhqawwjszwjzxxsonvwa`, region us-east-1, plan free).

---

## Cómo usar el panel de administración

1. **Crear el usuario admin (una sola vez)**:
   - Entrá a https://supabase.com/dashboard/project/lhqawwjszwjzxxsonvwa/auth/users
   - Click en **Add user → Create new user**
   - Email: `eneasaldabe@gmail.com` · contraseña: la que elijas
   - Marcá "Auto Confirm User" (sino el usuario tiene que verificar el email)
   - Solo este email tiene permisos de escritura por las RLS policies. Para agregar más admins, hay que actualizar las policies en SQL.

2. **Acceder al panel**:
   - `https://tu-dominio.com/admin` → te redirige a `/admin/login`
   - Login con el email y contraseña que creaste arriba.

3. **Operaciones**:
   - **Listar**: `/admin` muestra todos los productos (incluso ocultos) con búsqueda en vivo.
   - **Crear**: botón "Nuevo producto" → form completo con upload de imagen al bucket `product-images` de Supabase.
   - **Editar**: click en el icono de lápiz.
   - **Ocultar (soft delete)**: icono basura → marca `is_active=false`. El producto desaparece del sitio público pero queda en la DB.
   - **Reactivar**: icono restaurar (al lado del de basura) cuando el producto está oculto.

---

## Base de datos

Tabla `public.products`:

| campo | tipo | nota |
|---|---|---|
| id | bigint identity | PK |
| slug | text unique | URL slug |
| name, category | text | obligatorios |
| headline | text | frase corta |
| description | text | obligatorio |
| story | text | "historia detrás del producto" |
| industries, benefits, presentations, tags | text[] | arrays de strings |
| dilution, ph | text | datos técnicos |
| image_url | text | URL pública (Storage o externa) |
| featured | boolean | aparece en home |
| display_order | int | orden ascendente |
| is_active | boolean | soft delete |
| created_at, updated_at | timestamptz | auto |

**RLS policies**:
- Lectura pública: solo `is_active = true`.
- Escritura: solo el JWT con `email = 'eneasaldabe@gmail.com'`.

**Storage bucket** `product-images`:
- Lectura pública.
- Escritura/borrado: solo el admin allowlist.

---

## Deploy a Vercel (cuenta nueva, distinta de la que tenés conectada)

> **Importante**: yo no puedo loguearme en tu cuenta de Vercel. Estos pasos los corrés vos. El proyecto está 100% listo (`vercel.json` + build sin errores).

### Opción A — Por CLI (más rápido)

```bash
# 1. Si no tenés Vercel CLI:
npm i -g vercel

# 2. Cerrar la sesión actual y loguearte con la cuenta NUEVA
vercel logout
vercel login                    # abre el navegador, elegís la cuenta nueva

# 3. Linkear (desde la carpeta del proyecto)
cd C:\Users\eneas\Downloads\FEMAVI-Pack-Completo
vercel link                     # te pregunta scope (cuenta) y nombre

# 4. Setear las env vars (3 ambientes — production, preview, development)
vercel env add VITE_SUPABASE_URL production
# pegá: https://lhqawwjszwjzxxsonvwa.supabase.co
vercel env add VITE_SUPABASE_ANON_KEY production
# pegá: sb_publishable_OVOrWR112Ot4EGUv8l_ZrQ_hjxR_LE9

vercel env add VITE_SUPABASE_URL preview
vercel env add VITE_SUPABASE_ANON_KEY preview
vercel env add VITE_SUPABASE_URL development
vercel env add VITE_SUPABASE_ANON_KEY development

# 5. Deploy
vercel deploy --prod
```

### Opción B — Por dashboard (GitHub)

1. Subí el proyecto a un repo nuevo de GitHub.
2. En la cuenta Vercel **nueva**, en el dashboard: **Add New → Project → Import Git Repository**.
3. Framework preset: **Vite** (auto-detectado).
4. **Environment Variables** (Settings):
   - `VITE_SUPABASE_URL` = `https://lhqawwjszwjzxxsonvwa.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_OVOrWR112Ot4EGUv8l_ZrQ_hjxR_LE9`
5. **Deploy**.

---

## Verificación post-deploy

- [ ] `https://tu-dominio.com/` carga la home con productos destacados.
- [ ] `https://tu-dominio.com/catalogo` muestra 12 productos.
- [ ] `https://tu-dominio.com/admin/login` permite loguearte.
- [ ] Crear/editar un producto desde el admin se refleja en `/catalogo` sin redeploy.
- [ ] Subir una imagen desde el form la guarda en Supabase Storage y la muestra en el sitio.

---

## Scripts

```bash
npm run dev         # vite dev server
npm run build       # tsc + vite build (chequea tipos)
npm run lint        # eslint
npm run typecheck   # solo tsc (sin emitir)
npm run preview     # servir el build localmente
```

---

## Sobre los archivos originales

Los archivos de partida (`femavi-redesign.jsx`, `femavi-catalogo-v3.jsx`, `femavi-web-completa.html`) están en `C:\Users\eneas\Downloads\femavi-pack\` (carpeta hermana). Esos archivos NO se usan en este proyecto — sólo sirvieron como fuente para el port a TS. Pueden archivarse.

Los 12 productos hardcodeados originales viven ahora en la tabla `products` de Supabase y en `src/lib/seed.ts` como fallback.
