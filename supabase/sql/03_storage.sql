-- =====================================================================
-- RECETAS VIVAS · Storage (imágenes) 
-- Ejecutar en: Supabase → SQL Editor → New query → Run
--
-- Estructura de rutas dentro del bucket (OBLIGATORIA, las políticas
-- dependen de ella):
--
--   {usuario_id}/{receta_id}/principal-{nombre}.jpg   ← imagen final
--   {usuario_id}/{receta_id}/pasos/{nombre}.jpg       ← imágenes de pasos
--
--   Carpeta 1 = dueño del archivo
--   Carpeta 2 = receta a la que pertenece
--
-- storage.foldername(name) devuelve las carpetas de la ruta como arreglo:
--   'abc/123/pasos/foto.jpg' → {abc, 123, pasos}
--   [1] = 'abc' (usuario), [2] = '123' (receta)   (en SQL se cuenta desde 1)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. BUCKET (contenedor)
-- public = false: los archivos NO tienen una URL abierta permanente.
--   Para mostrarlos, la página pide una "URL firmada" (signed URL), que
--   Supabase solo entrega si las políticas lo permiten y que vence.
--   Así una imagen de una receta privada no queda expuesta.
-- file_size_limit: 5 MB por archivo (5 * 1024 * 1024 bytes).
-- allowed_mime_types: solo imágenes. MIME (Multipurpose Internet Mail
--   Extensions) es el identificador del tipo de archivo.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recetas-imagenes',
  'recetas-imagenes',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
);


-- ---------------------------------------------------------------------
-- 2. POLÍTICAS sobre storage.objects
-- Storage guarda la información de cada archivo en la tabla
-- storage.objects, que ya tiene RLS activado. Cada política se limita
-- al bucket 'recetas-imagenes' para no afectar otros buckets futuros
-- (por ejemplo, el de logos).
-- ---------------------------------------------------------------------

-- Ver (y obtener URL firmada): si la receta de la carpeta 2 es pública
-- o es del usuario logueado. Misma regla que la tabla recetas.
-- Se compara como texto (r.id::text) para que una ruta mal formada no
-- provoque un error de conversión.
create policy "imagenes: ver si la receta es visible"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'recetas-imagenes'
  and exists (
    select 1 from public.recetas r
    where r.id::text = (storage.foldername(name))[2]
      and (r.es_publica = true or r.usuario_id = (select auth.uid()))
  )
);

-- Subir: solo en la propia carpeta (carpeta 1 = mi id) y solo para
-- recetas propias (carpeta 2 = una receta mía).
-- Por eso el orden en la página es: 1) crear la receta, 2) subir fotos.
create policy "imagenes: subir en recetas propias"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'recetas-imagenes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.recetas r
    where r.id::text = (storage.foldername(name))[2]
      and r.usuario_id = (select auth.uid())
  )
);

-- Reemplazar: solo archivos de la propia carpeta.
create policy "imagenes: reemplazar propias"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'recetas-imagenes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'recetas-imagenes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Borrar: solo archivos de la propia carpeta.
create policy "imagenes: borrar propias"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'recetas-imagenes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);