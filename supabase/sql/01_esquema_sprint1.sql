-- =====================================================================
-- RECETAS VIVAS · Esquema de base de datos · Sprint 1
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Tablas: perfiles, recetas, ingredientes, pasos
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PERFILES
-- Datos propios de la aplicación para cada usuario.
-- Supabase guarda los usuarios en auth.users (esquema interno que no se
-- modifica). Esta tabla se vincula a ese usuario usando el MISMO id.
-- Más adelante se agregarán aquí el logo y los colores del emprendimiento.
-- ---------------------------------------------------------------------
create table public.perfiles (
  -- uuid: identificador único universal (lo genera Supabase Auth).
  -- references auth.users: clave foránea; solo puede existir un perfil
  -- si existe el usuario.
  -- on delete cascade: si se borra el usuario, se borra su perfil.
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text,
  -- timestamptz: fecha y hora con zona horaria. now() = momento de inserción.
  created_at  timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 2. RECETAS
-- Una fila por receta.
-- ---------------------------------------------------------------------
create table public.recetas (
  -- gen_random_uuid(): la base genera el id sola; el frontend no lo envía.
  id                uuid primary key default gen_random_uuid(),

  -- Dueño de la receta. default auth.uid() completa automáticamente con
  -- el id del usuario logueado que hace el INSERT: el frontend no lo envía
  -- y nadie puede crear recetas a nombre de otro.
  usuario_id        uuid not null default auth.uid()
                    references public.perfiles (id) on delete cascade,

  -- check: el título no puede estar vacío ni ser solo espacios.
  titulo            text not null check (char_length(trim(titulo)) > 0),
  descripcion       text,

  -- Ruta de la imagen final (resultado) dentro de Storage.
  -- Se guarda la RUTA, no la imagen: los archivos van a Storage.
  -- Es nullable en la base porque primero se crea la receta y luego se
  -- sube la imagen; la obligatoriedad se controla en el formulario.
  imagen_principal  text,

  -- Visibilidad, como un repositorio de GitHub. Por defecto: privada.
  es_publica        boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Índice: PostgreSQL NO indexa automáticamente las claves foráneas.
-- Sin este índice, "traer todas las recetas de un usuario" recorrería
-- la tabla completa.
create index recetas_usuario_id_idx on public.recetas (usuario_id);


-- ---------------------------------------------------------------------
-- 3. INGREDIENTES
-- Una fila por ingrediente. Relación 1:N con recetas.
-- Ejemplos de carga:
--   200 g de harina de almendras → cantidad 200, unidad 'g',     nota null
--   1 pizca de sal               → cantidad 1,   unidad 'pizca', nota null
--   Pimienta a gusto             → cantidad null,unidad null,    nota 'a gusto'
--   2 huevos                     → cantidad 2,   unidad null,    nota null
--   1 cebolla picada fina        → cantidad 1,   unidad null,    nota 'picada fina'
-- ---------------------------------------------------------------------
create table public.ingredientes (
  id         uuid primary key default gen_random_uuid(),
  receta_id  uuid not null references public.recetas (id) on delete cascade,

  -- En SQL las filas no tienen orden garantizado: se guarda explícito.
  orden      int not null check (orden > 0),

  nombre     text not null check (char_length(trim(nombre)) > 0),

  -- numeric: admite decimales exactos (0.5, 1.25). Nullable para "a gusto".
  cantidad   numeric check (cantidad > 0),
  unidad     text,
  -- Aclaraciones libres: 'a gusto', 'picada fina', 'opcional', etc.
  nota       text
);

create index ingredientes_receta_id_idx on public.ingredientes (receta_id);


-- ---------------------------------------------------------------------
-- 4. PASOS
-- Una fila por paso. Relación 1:N con recetas.
-- Imagen opcional por paso (una por paso).
-- ---------------------------------------------------------------------
create table public.pasos (
  id           uuid primary key default gen_random_uuid(),
  receta_id    uuid not null references public.recetas (id) on delete cascade,
  numero       int not null check (numero > 0),
  descripcion  text not null check (char_length(trim(descripcion)) > 0),
  -- Ruta en Storage. null = el paso no tiene imagen (es opcional).
  imagen       text
);

create index pasos_receta_id_idx on public.pasos (receta_id);


-- ---------------------------------------------------------------------
-- 5. RLS (Row Level Security · seguridad a nivel de fila)
-- Al activarla SIN políticas, nadie puede leer ni escribir desde la API:
-- es el punto de partida seguro. Las políticas (quién puede qué) se
-- crean en el Paso 3.
-- ---------------------------------------------------------------------
alter table public.perfiles     enable row level security;
alter table public.recetas      enable row level security;
alter table public.ingredientes enable row level security;
alter table public.pasos        enable row level security;


-- ---------------------------------------------------------------------
-- 6. TRIGGER: updated_at automático
-- Un trigger (disparador) es código que la base ejecuta sola ante un
-- evento. Aquí: antes de cada UPDATE en recetas, actualiza updated_at.
-- Así la fecha de modificación no depende de que el frontend la envíe.
-- ---------------------------------------------------------------------
create function public.actualizar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();   -- new = la fila con los valores nuevos
  return new;
end;
$$;

create trigger recetas_actualizar_updated_at
before update on public.recetas
for each row execute function public.actualizar_updated_at();


-- ---------------------------------------------------------------------
-- 7. TRIGGER: crear el perfil automáticamente al registrarse
-- Cuando alguien inicia sesión por primera vez (Google o mail), Supabase
-- inserta una fila en auth.users. Este trigger crea su fila en perfiles,
-- tomando el nombre de Google si existe, o el mail si no.
-- security definer: la función corre con permisos de su creador, porque
-- el usuario recién creado todavía no tiene permisos sobre perfiles.
-- set search_path = '': medida de seguridad recomendada por Supabase
-- para funciones security definer (obliga a escribir public.perfiles).
-- ---------------------------------------------------------------------
create function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  );
  return new;
end;
$$;

create trigger al_crear_usuario
after insert on auth.users
for each row execute function public.crear_perfil_nuevo_usuario();