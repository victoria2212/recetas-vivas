// recetas.js - todo lo que habla con supabase sobre las recetas
// (guardar, editar, eliminar, traer e imagenes)

// bucket y limites (los mismos que configure en supabase)
const BUCKET_IMAGENES = 'recetas-imagenes';

const TAMANIO_MAXIMO_IMAGEN = 5 * 1024 * 1024;

const EXTENSIONES_PERMITIDAS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};


// tira un error si la imagen no es jpg/png/webp o pesa mas de 5mb
function validarImagen(archivo, etiqueta) {
  if (!EXTENSIONES_PERMITIDAS[archivo.type]) {
    throw new Error(`${etiqueta}: solo se aceptan imágenes JPG, PNG o WebP.`);
  }

  if (archivo.size > TAMANIO_MAXIMO_IMAGEN) {
    throw new Error(`${etiqueta}: la imagen supera los 5 MB.`);
  }
}


// el bucket por defecto es el de recetas, el logo usa otro
async function subirImagen(ruta, archivo, bucket = BUCKET_IMAGENES) {
  const { error } = await supabaseClient.storage
    .from(bucket)
    .upload(ruta, archivo, {
      contentType: archivo.type,
      upsert: false
    });

  if (error) {
    throw error;
  }
}


// valida todas antes de crear nada
function validarImagenesDeReceta(datos) {
  if (datos.imagenPrincipal) {
    validarImagen(datos.imagenPrincipal, 'Imagen principal');
  }

  datos.pasos.forEach((paso, i) => {
    if (paso.imagen) {
      validarImagen(paso.imagen, `Paso ${i + 1}`);
    }
  });
}


// el id del usuario hace falta para la carpeta de las imagenes
async function obtenerUsuarioId() {
  const sesion = await obtenerSesion();
  if (!sesion) {
    throw new Error('La sesión expiró. Vuelva a iniciar sesión.');
  }
  return sesion.user.id;
}


// uso Date.now() en vez del nombre del archivo (puede tener espacios o tildes)
function armarRutaImagen(carpeta, nombre, archivo, marca) {
  const extension = EXTENSIONES_PERMITIDAS[archivo.type];
  return `${carpeta}/${nombre}-${marca}.${extension}`;
}


function armarFilasIngredientes(recetaId, ingredientes) {
  return ingredientes.map((ing, i) => ({
    receta_id: recetaId,
    orden: i + 1,
    nombre: ing.nombre,
    cantidad: ing.cantidad,
    unidad: ing.unidad || null,
    nota: ing.nota || null
  }));
}


// sube las imagenes nuevas de los pasos y arma las filas.
// imagen de cada paso: la nueva, o null si la quito, o la que ya tenia
// for...of y no forEach porque adentro hay await
async function subirImagenesYArmarFilasPasos(carpeta, recetaId, pasos, marca, rutasSubidas) {
  const filasPasos = [];

  for (const [i, paso] of pasos.entries()) {
    let rutaImagen = paso.quitarImagen ? null : (paso.imagenActual || null);

    if (paso.imagen) {
      rutaImagen = armarRutaImagen(carpeta, `pasos/paso-${i + 1}`, paso.imagen, marca);
      await subirImagen(rutaImagen, paso.imagen);
      rutasSubidas.push(rutaImagen);
    }

    filasPasos.push({
      receta_id: recetaId,
      numero: i + 1,
      descripcion: paso.descripcion,
      imagen: rutaImagen
    });
  }

  return filasPasos;
}


// todas las imagenes de una receta (principal + pasos), sin los null
function rutasDeImagenes(receta) {
  return [
    receta.imagen_principal,
    ...receta.pasos.map((paso) => paso.imagen)
  ].filter(Boolean);
}


// null si no eligio imagen
async function subirImagenPrincipal(carpeta, archivo, marca, rutasSubidas) {
  if (!archivo) {
    return null;
  }

  const ruta = armarRutaImagen(carpeta, 'principal', archivo, marca);
  await subirImagen(ruta, archivo);
  rutasSubidas.push(ruta);
  return ruta;
}


// usuario_id no se manda, lo pone la base con auth.uid()
async function crearFilaReceta(datos) {
  const { data, error } = await supabaseClient
    .from('recetas')
    .insert({
      titulo: datos.titulo,
      descripcion: datos.descripcion || null,
      es_publica: datos.esPublica
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}


async function actualizarFilaReceta(recetaId, cambios) {
  const { error } = await supabaseClient
    .from('recetas')
    .update(cambios)
    .eq('id', recetaId);

  if (error) throw error;
}


// devuelve los ids por si despues hay que borrarlas
async function insertarFilas(tabla, filas) {
  const { data, error } = await supabaseClient
    .from(tabla)
    .insert(filas)
    .select('id');

  if (error) throw error;
  return data.map((fila) => fila.id);
}


async function borrarFilasPorId(tabla, ids) {
  if (ids.length === 0) {
    return;
  }

  const { error } = await supabaseClient.from(tabla).delete().in('id', ids);
  if (error) throw error;
}


// guarda una receta nueva completa
// primero se crea la receta porque storage solo deja subir imagenes a recetas que existen.
// si algo falla, deshacerReceta borra lo que se llego a crear
async function guardarReceta(datos) {

  validarImagenesDeReceta(datos);

  const usuarioId = await obtenerUsuarioId();

  let recetaId = null;
  const rutasSubidas = [];

  try {
    recetaId = await crearFilaReceta(datos);

    const carpeta = `${usuarioId}/${recetaId}`;
    const marca = Date.now();
    const rutaPrincipal = await subirImagenPrincipal(carpeta, datos.imagenPrincipal, marca, rutasSubidas);
    const filasPasos = await subirImagenesYArmarFilasPasos(carpeta, recetaId, datos.pasos, marca, rutasSubidas);

    if (rutaPrincipal) {
      await actualizarFilaReceta(recetaId, { imagen_principal: rutaPrincipal });
    }
    await insertarFilas('ingredientes', armarFilasIngredientes(recetaId, datos.ingredientes));
    await insertarFilas('pasos', filasPasos);

    return recetaId;

  } catch (error) {
    await deshacerReceta(recetaId, rutasSubidas);
    throw error;
  }
}


async function deshacerReceta(recetaId, rutasSubidas) {
  try {
    if (rutasSubidas.length > 0) {
      await supabaseClient.storage.from(BUCKET_IMAGENES).remove(rutasSubidas);
    }
    if (recetaId) {
      await supabaseClient.from('recetas').delete().eq('id', recetaId);
    }
  } catch (errorLimpieza) {
    console.error('No se pudo deshacer la receta incompleta:', errorLimpieza);
  }
}


// editar: en vez de comparar fila por fila, inserto los ingredientes y pasos
// nuevos y despues borro los viejos. si falla antes de borrar, la receta queda como estaba
async function actualizarReceta(recetaOriginal, datos) {
  validarImagenesDeReceta(datos);

  const usuarioId = await obtenerUsuarioId();
  const recetaId = recetaOriginal.id;
  const carpeta = `${usuarioId}/${recetaId}`;
  const marca = Date.now();

  const nuevos = { rutasSubidas: [], idsIngredientes: [], idsPasos: [] };

  let huboCambiosSinVuelta = false;

  try {
    const rutaPrincipal =
      (await subirImagenPrincipal(carpeta, datos.imagenPrincipal, marca, nuevos.rutasSubidas)) ??
      (datos.quitarImagenPrincipal ? null : recetaOriginal.imagen_principal);
    const filasPasos = await subirImagenesYArmarFilasPasos(carpeta, recetaId, datos.pasos, marca, nuevos.rutasSubidas);

    nuevos.idsIngredientes = await insertarFilas('ingredientes', armarFilasIngredientes(recetaId, datos.ingredientes));
    nuevos.idsPasos = await insertarFilas('pasos', filasPasos);

    await borrarFilasPorId('ingredientes', recetaOriginal.ingredientes.map((ing) => ing.id));
    // desde aca ya no se puede deshacer
    huboCambiosSinVuelta = true;
    await borrarFilasPorId('pasos', recetaOriginal.pasos.map((paso) => paso.id));

    await actualizarFilaReceta(recetaId, {
      titulo: datos.titulo,
      descripcion: datos.descripcion || null,
      es_publica: datos.esPublica,
      imagen_principal: rutaPrincipal
    });

    // borro de storage las imagenes viejas que ya no se usan
    const rutasEnUso = [rutaPrincipal, ...filasPasos.map((fila) => fila.imagen)];
    await borrarImagenesSinUso(rutasDeImagenes(recetaOriginal).filter((ruta) => !rutasEnUso.includes(ruta)));

  } catch (error) {
    throw await prepararErrorDeEdicion(error, huboCambiosSinVuelta, nuevos);
  }
}


// si ya se borro algo viejo aviso que se guardo a medias
async function prepararErrorDeEdicion(error, huboCambiosSinVuelta, nuevos) {
  if (!huboCambiosSinVuelta) {
    await deshacerEdicion(nuevos);
    return error;
  }

  return new Error(
    'Se guardó solo una parte de los cambios. Abra la receta, revísela ' +
    'y vuelva a editarla. (' + error.message + ')'
  );
}


// si falla no corto nada, los cambios ya estan guardados
async function borrarImagenesSinUso(rutas) {
  if (rutas.length === 0) {
    return;
  }

  const { error } = await supabaseClient.storage.from(BUCKET_IMAGENES).remove(rutas);
  if (error) {
    console.error('No se pudieron borrar imágenes viejas:', error);
  }
}


async function deshacerEdicion(nuevos) {
  try {
    await borrarFilasPorId('ingredientes', nuevos.idsIngredientes);
    await borrarFilasPorId('pasos', nuevos.idsPasos);
    if (nuevos.rutasSubidas.length > 0) {
      await supabaseClient.storage.from(BUCKET_IMAGENES).remove(nuevos.rutasSubidas);
    }
  } catch (errorLimpieza) {
    console.error('No se pudo deshacer la edición:', errorLimpieza);
  }
}


// listado con fetch directo a la API REST de supabase (pedido por la consigna)
async function traerMisRecetas() {
  const sesion = await obtenerSesion();
  if (!sesion) {
    throw new Error('La sesión expiró. Vuelva a iniciar sesión.');
  }

  const parametros = new URLSearchParams({
    select: 'id,titulo,descripcion,imagen_principal,es_publica,created_at',
    usuario_id: `eq.${sesion.user.id}`,
    order: 'created_at.desc'
  });

  const url = `${SUPABASE_URL}/rest/v1/recetas?${parametros}`;

  const respuesta = await fetch(url, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${sesion.access_token}`
    }
  });

  if (!respuesta.ok) {
    throw new Error(`El servidor respondió con el código ${respuesta.status}.`);
  }

  return await respuesta.json();
}


// recetas publicas de un usuario, para su perfil publico (funciona sin sesion)
async function traerRecetasPublicas(usuarioId) {
  const { data, error } = await supabaseClient
    .from('recetas')
    .select('id, titulo, descripcion, imagen_principal, es_publica, created_at')
    .eq('usuario_id', usuarioId)
    .eq('es_publica', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}


// el bucket de recetas es privado: pido urls firmadas que duran un rato
async function obtenerUrlsDeImagenes(rutas) {
  const urlsPorRuta = {};

  const rutasValidas = rutas.filter(Boolean);
  if (rutasValidas.length === 0) {
    return urlsPorRuta;
  }

  const SEGUNDOS_DE_VALIDEZ = 60 * 60;

  const { data, error } = await supabaseClient.storage
    .from(BUCKET_IMAGENES)
    .createSignedUrls(rutasValidas, SEGUNDOS_DE_VALIDEZ);

  if (error) {
    throw error;
  }

  data.forEach((item) => {
    if (!item.error) {
      urlsPorRuta[item.path] = item.signedUrl;
    }
  });

  return urlsPorRuta;
}


// si fallan las imagenes la receta se muestra igual
async function obtenerUrlsDeReceta(receta) {
  try {
    return await obtenerUrlsDeImagenes(rutasDeImagenes(receta));
  } catch (error) {
    console.error('No se pudieron cargar las imágenes:', error);
    return {};
  }
}


// primero las imagenes (storage no borra en cascada y despues ya no se podrian borrar)
// ingredientes y pasos se borran solos por el on delete cascade
async function eliminarReceta(receta) {

  const rutas = rutasDeImagenes(receta);

  if (rutas.length > 0) {
    const { error: errorImagenes } = await supabaseClient.storage
      .from(BUCKET_IMAGENES)
      .remove(rutas);

    if (errorImagenes) {
      throw errorImagenes;
    }
  }

  const { data: borradas, error: errorReceta } = await supabaseClient
    .from('recetas')
    .delete()
    .eq('id', receta.id)
    .select('id');

  if (errorReceta) {
    throw errorReceta;
  }
  if (borradas.length === 0) {
    throw new Error('La receta no existe o no le pertenece.');
  }
}


// trae la receta con ingredientes y pasos en una sola consulta.
// maybeSingle devuelve null si no existe (o es privada de otro)
async function traerRecetaPorId(id) {
  const { data, error } = await supabaseClient
    .from('recetas')
    .select(`
      id, titulo, descripcion, imagen_principal, es_publica, created_at, usuario_id,
      ingredientes ( id, orden, nombre, cantidad, unidad, nota ),
      pasos ( id, numero, descripcion, imagen )
    `)
    .eq('id', id)
    .order('orden', { referencedTable: 'ingredientes', ascending: true })
    .order('numero', { referencedTable: 'pasos', ascending: true })
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
