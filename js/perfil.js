// perfil.js - datos del emprendimiento (nombre, frase y logo)
// solo habla con supabase, no toca el html
// reusa funciones de recetas.js (validarImagen, subirImagen, etc)

const BUCKET_LOGOS = 'logos';


// nombre es el de la cuenta de google, lo uso para el saludo
async function traerPerfil(usuarioId) {
  const { data, error } = await supabaseClient
    .from('perfiles')
    .select('nombre, nombre_emprendimiento, frase, logo')
    .eq('id', usuarioId)
    .single();

  if (error) throw error;
  return data;
}


// para el perfil publico: devuelve null si no existe o si RLS no deja verlo
// (solo se ven los perfiles con al menos una receta publica)
async function traerPerfilPublico(usuarioId) {
  const { data, error } = await supabaseClient
    .from('perfiles')
    .select('nombre, nombre_emprendimiento, frase, logo')
    .eq('id', usuarioId)
    .maybeSingle();

  if (error) throw error;
  return data;
}


// el bucket de logos es publico, la url no vence
function obtenerUrlDelLogo(rutaLogo) {
  if (!rutaLogo) {
    return null;
  }
  return supabaseClient.storage.from(BUCKET_LOGOS).getPublicUrl(rutaLogo).data.publicUrl;
}


// orden: subir logo nuevo, guardar datos y despues borrar el viejo
// si falla al guardar, borro el logo que acabo de subir
async function guardarPerfil(perfilActual, datos) {
  if (datos.logo) {
    validarImagen(datos.logo, 'Logo');
  }

  const rutaNueva = await subirLogoNuevo(datos.logo);

  // el nuevo, o null si lo quito, o el que ya tenia
  const rutaLogo = rutaNueva ?? (datos.quitarLogo ? null : perfilActual.logo);

  try {
    await actualizarFilaPerfil({
      nombre_emprendimiento: datos.nombreEmprendimiento,
      frase: datos.frase || null,
      logo: rutaLogo
    });
  } catch (error) {
    await borrarLogos([rutaNueva]);
    throw error;
  }

  if (perfilActual.logo !== rutaLogo) {
    await borrarLogos([perfilActual.logo]);
  }
}


async function subirLogoNuevo(archivo) {
  if (!archivo) {
    return null;
  }

  const usuarioId = await obtenerUsuarioId();
  const ruta = armarRutaImagen(usuarioId, 'logo', archivo, Date.now());
  await subirImagen(ruta, archivo, BUCKET_LOGOS);
  return ruta;
}


// si RLS no deja modificar no tira error, devuelve 0 filas. por eso el select
async function actualizarFilaPerfil(cambios) {
  const usuarioId = await obtenerUsuarioId();

  const { data, error } = await supabaseClient
    .from('perfiles')
    .update(cambios)
    .eq('id', usuarioId)
    .select('id');

  if (error) throw error;
  if (data.length === 0) {
    throw new Error('No se encontró su perfil.');
  }
}


// si falla solo lo muestro en consola, los datos ya se guardaron
async function borrarLogos(rutas) {
  const rutasValidas = rutas.filter(Boolean);
  if (rutasValidas.length === 0) {
    return;
  }

  const { error } = await supabaseClient.storage.from(BUCKET_LOGOS).remove(rutasValidas);
  if (error) {
    console.error('No se pudo borrar el logo anterior:', error);
  }
}
