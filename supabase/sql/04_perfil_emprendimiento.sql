-- =====================================================================
-- RECETAS VIVAS · Datos del emprendimiento (nombre, frase y logo)
-- La tabla perfiles ya existe (01_esquema_sprint1.sql) y ya tiene sus
-- políticas: cada usuario puede ver y modificar SOLO su perfil
-- (02_politicas_rls.sql). Acá se le agregan tres columnas y un bucket
-- nuevo para los logos.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. COLUMNAS NUEVAS en perfiles
-- Todas opcionales (pueden quedar en null): el usuario las completa
-- cuando quiera, desde la página de configuración.
-- logo guarda la RUTA del archivo en Storage, no la imagen.
-- Los check limitan el largo, igual que el maxlength del formulario
-- (la base no confía en lo que manda el navegador).
-- ---------------------------------------------------------------------
alter table public.perfiles
  add column nombre_emprendimiento text
    check (char_length(nombre_emprendimiento) <= 80),
  add column frase text
    check (char_length(frase) <= 140),
  add column logo text;


-- ---------------------------------------------------------------------
-- 2. BUCKET "logos"
-- public = true: cada logo tiene una URL fija que no vence, porque es la
-- imagen de marca del emprendimiento (no es un dato privado). Así no
-- hace falta pedir una URL firmada cada vez.
-- Mismo límite y tipos que las imágenes de recetas: 5 MB, JPG/PNG/WebP.
--
-- Estructura de rutas:   {usuario_id}/logo-{marca}.jpg
-- Carpeta 1 = dueño del logo.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
);


-- ---------------------------------------------------------------------
-- 3. POLÍTICAS del bucket "logos"
-- Ver: aunque el bucket sea público para MOSTRAR los logos, Storage
-- pide permiso de "ver" para poder borrar o reemplazar un archivo desde
-- la página. Por eso cada usuario puede "ver" su propia carpeta.
-- Subir, reemplazar y borrar: solo en la propia carpeta.
-- ---------------------------------------------------------------------
create policy "logos: ver propios"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "logos: subir en carpeta propia"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "logos: reemplazar propios"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "logos: borrar propios"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
