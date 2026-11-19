
// js/perfil.js · Datos del emprendimiento (nombre, frase y logo)
//
// Este archivo SOLO habla con Supabase (tabla perfiles y bucket logos).
// No toca el HTML: eso lo hacen listado.js y configuracion.js.
//
// Requiere que antes estén cargados:
//   - config.js   → supabaseClient
//   - auth.js     → obtenerSesion()
//   - recetas.js  → validarImagen, subirImagen, armarRutaImagen,
//                   obtenerUsuarioId (se reutilizan, no se repiten)


// Bucket creado en 04_perfil_emprendimiento.sql.
const BUCKET_LOGOS = 'logos';


// Trae el perfil del usuario: { nombre, nombre_emprendimiento, frase, logo }.
// nombre es el de la cuenta de Google (para el saludo).
async function traerPerfil(usuarioId) {
  const { data, error } = await supabaseClient
    .from('perfiles')
    .select('nombre, nombre_emprendimiento, frase, logo')
    .eq('id', usuarioId)
    .single();

  if (error) throw error;
  return data;
}


// Devuelve la dirección pública del logo, o null si no tiene.
// El bucket es público: la URL se arma sin pedirle nada al servidor
// (getPublicUrl no hace una llamada por internet).
function obtenerUrlDelLogo(rutaLogo) {
  if (!rutaLogo) {
    return null;
  }
  return supabaseClient.storage.from(BUCKET_LOGOS).getPublicUrl(rutaLogo).data.publicUrl;
}


// Guarda los datos del emprendimiento.
// Recibe: perfilActual → el perfil como estaba (para saber qué logo tenía).
//         datos = { nombreEmprendimiento, frase, logo: File o null, quitarLogo: true/false }
//
// Orden: 1) subir el logo nuevo, 2) guardar los datos, 3) borrar el
// logo viejo. Si falla el paso 2, se borra el logo recién subido: así
// nunca queda un logo nuevo sin usar, ni el perfil apuntando a un
// archivo que no existe.
async function guardarPerfil(perfilActual, datos) {
  if (datos.logo) {
    validarImagen(datos.logo, 'Logo');
  }

  const rutaNueva = await subirLogoNuevo(datos.logo);

  // Logo que queda: el nuevo; si no hay nuevo y marcó quitar, ninguno;
  // si no tocó nada, el que ya tenía.
  const rutaLogo = rutaNueva ?? (datos.quitarLogo ? null : perfilActual.logo);

  try {
    await actualizarFilaPerfil({
      nombre_emprendimiento: datos.nombreEmprendimiento,
      frase: datos.frase || null, // texto vacío → null
      logo: rutaLogo
    });
  } catch (error) {
    await borrarLogos([rutaNueva]);
    throw error;
  }

  // El logo viejo se borra solo si se reemplazó o se quitó.
  if (perfilActual.logo !== rutaLogo) {
    await borrarLogos([perfilActual.logo]);
  }
}


// Sube el logo nuevo a la carpeta del usuario y devuelve su ruta.
// Si no eligió ningún archivo, devuelve null.
async function subirLogoNuevo(archivo) {
  if (!archivo) {
    return null;
  }

  const usuarioId = await obtenerUsuarioId();
  const ruta = armarRutaImagen(usuarioId, 'logo', archivo, Date.now());
  await subirImagen(ruta, archivo, BUCKET_LOGOS);
  return ruta;
}


// Actualiza la fila del perfil del usuario logueado.
// .select('id') devuelve la fila modificada: si RLS no deja modificar,
// Supabase no da error, solo devuelve 0 filas. Así se detecta.
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


// Borra logos de Storage. Descarta los null (filter(Boolean)).
// Si falla, solo lo registra en la consola: los datos ya se guardaron,
// y un archivo que quedó sin borrar no afecta lo que ve el usuario.
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
