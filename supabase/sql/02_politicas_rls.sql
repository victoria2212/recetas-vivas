-- =====================================================================
-- RECETAS VIVAS · Políticas RLS · Sprint 1
-- RLS = Row Level Security (seguridad a nivel de fila)
-- Ejecutar en: Supabase → SQL Editor → New query → Run
--
-- Conceptos:
--   * Una política es una regla: "este ROL puede hacer esta OPERACIÓN
--     sobre las filas que cumplan esta CONDICIÓN".
--   * Roles de Supabase:
--       anon          = visitante sin sesión iniciada
--       authenticated = usuario con sesión iniciada
--   * auth.uid() = id del usuario logueado que hace el pedido
--     (null si es anon). Se escribe (select auth.uid()) porque así
--     PostgreSQL lo calcula una sola vez por consulta y no una vez por
--     fila: es la forma recomendada por Supabase por rendimiento.
--   * using (...)      = qué filas EXISTENTES puede ver/modificar/borrar.
--   * with check (...) = cómo deben quedar las filas NUEVAS o MODIFICADAS.
--   * Lo que no está permitido por ninguna política, está prohibido.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PERFILES
-- ---------------------------------------------------------------------

-- Ver: el propio perfil, o el perfil de alguien que tenga al menos una
-- receta pública (para poder mostrar el autor en recetas públicas).
-- Así no se expone el nombre de usuarios que solo tienen recetas privadas.
create policy "perfiles: ver propio o de autores con recetas públicas"
on public.perfiles
for select
to anon, authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1 from public.recetas r
    where r.usuario_id = perfiles.id
      and r.es_publica = true
  )
);

-- Modificar: solo el propio perfil.
create policy "perfiles: modificar solo el propio"
on public.perfiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- INSERT: no hay política a propósito. El perfil lo crea el trigger
-- al registrarse (security definer), nunca el frontend.
-- DELETE: no hay política a propósito. El perfil se borra en cascada
-- si se elimina el usuario.


-- ---------------------------------------------------------------------
-- RECETAS
-- ---------------------------------------------------------------------

-- Ver: cualquiera (incluso sin sesión) ve las públicas;
-- el dueño ve además las suyas privadas.
create policy "recetas: ver públicas o propias"
on public.recetas
for select
to anon, authenticated
using (
  es_publica = true
  or usuario_id = (select auth.uid())
);

-- Crear: solo usuarios logueados, y solo a su propio nombre.
-- (usuario_id ya tiene default auth.uid(); el with check impide que
-- alguien envíe a mano el id de otra persona.)
create policy "recetas: crear propias"
on public.recetas
for insert
to authenticated
with check (usuario_id = (select auth.uid()));

-- Modificar: solo las propias, y no se pueden "regalar" a otro usuario.
create policy "recetas: modificar propias"
on public.recetas
for update
to authenticated
using (usuario_id = (select auth.uid()))
with check (usuario_id = (select auth.uid()));

-- Borrar: solo las propias. Ingredientes y pasos se borran en cascada.
create policy "recetas: borrar propias"
on public.recetas
for delete
to authenticated
using (usuario_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- INGREDIENTES
-- No tienen usuario_id: el dueño se averigua a través de su receta.
-- ---------------------------------------------------------------------

-- Ver: si la receta a la que pertenecen es pública o propia.
create policy "ingredientes: ver si la receta es visible"
on public.ingredientes
for select
to anon, authenticated
using (
  exists (
    select 1 from public.recetas r
    where r.id = ingredientes.receta_id
      and (r.es_publica = true or r.usuario_id = (select auth.uid()))
  )
);

-- Crear: solo en recetas propias. Sin esto, alguien podría agregar
-- ingredientes a la receta de otra persona enviando su receta_id.
create policy "ingredientes: crear en recetas propias"
on public.ingredientes
for insert
to authenticated
with check (
  exists (
    select 1 from public.recetas r
    where r.id = ingredientes.receta_id
      and r.usuario_id = (select auth.uid())
  )
);

-- Modificar: solo en recetas propias, y no se pueden mover a una
-- receta ajena (por eso se repite la condición en with check).
create policy "ingredientes: modificar en recetas propias"
on public.ingredientes
for update
to authenticated
using (
  exists (
    select 1 from public.recetas r
    where r.id = ingredientes.receta_id
      and r.usuario_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.recetas r
    where r.id = ingredientes.receta_id
      and r.usuario_id = (select auth.uid())
  )
);

-- Borrar: solo en recetas propias.
create policy "ingredientes: borrar en recetas propias"
on public.ingredientes
for delete
to authenticated
using (
  exists (
    select 1 from public.recetas r
    where r.id = ingredientes.receta_id
      and r.usuario_id = (select auth.uid())
  )
);


-- ---------------------------------------------------------------------
-- PASOS
-- Misma lógica que ingredientes.
-- ---------------------------------------------------------------------

create policy "pasos: ver si la receta es visible"
on public.pasos
for select
to anon, authenticated
using (
  exists (
    select 1 from public.recetas r
    where r.id = pasos.receta_id
      and (r.es_publica = true or r.usuario_id = (select auth.uid()))
  )
);

create policy "pasos: crear en recetas propias"
on public.pasos
for insert
to authenticated
with check (
  exists (
    select 1 from public.recetas r
    where r.id = pasos.receta_id
      and r.usuario_id = (select auth.uid())
  )
);

create policy "pasos: modificar en recetas propias"
on public.pasos
for update
to authenticated
using (
  exists (
    select 1 from public.recetas r
    where r.id = pasos.receta_id
      and r.usuario_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.recetas r
    where r.id = pasos.receta_id
      and r.usuario_id = (select auth.uid())
  )
);

create policy "pasos: borrar en recetas propias"
on public.pasos
for delete
to authenticated
using (
  exists (
    select 1 from public.recetas r
    where r.id = pasos.receta_id
      and r.usuario_id = (select auth.uid())
  )
);