
// Este archivo SOLO habla con Supabase 
// No toca el HTML: no lee formularios ni muestra mensajes. Así la misma
// lógica se puede reutilizar desde otras páginas (por ejemplo "editar receta").
//
// Requiere que antes estén cargados:
//   - config.js → crea supabaseClient
//   - auth.js   → define obtenerSesion()
// =====================================================================



// Nombre del bucket (contenedor de archivos) creado en 03_storage.sql.
const BUCKET_IMAGENES = 'recetas-imagenes';

// 5 MB expresados en bytes (5 × 1024 × 1024). Es el mismo límite que
// tiene el bucket en Supabase.
const TAMANIO_MAXIMO_IMAGEN = 5 * 1024 * 1024;

// Tipos de imagen permitidos y la extensión que les corresponde.
// La clave es el tipo MIME (Multipurpose Internet Mail Extensions):
// el "documento de identidad" del archivo que informa el navegador.
// Son los mismos tipos que acepta el bucket.
const EXTENSIONES_PERMITIDAS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};


//  revisa que una imagen tenga un tipo permitido y no supere
//           los 5 MB. Si algo está mal, lanza un error con un mensaje para el usuario.
// Recibe    archivo  → el objeto File que eligió el usuario.
//           etiqueta → texto para el mensaje (ej. "Paso 2").
// Devuelve: nada. Si la imagen es válida, simplemente termina.
//
// Por qué existe: el bucket también controla tipo y tamaño, pero recién
// al subir. Validar ANTES evita crear una receta que después falle.

function validarImagen(archivo, etiqueta) {
  // Si el tipo no está en el objeto de permitidos, el resultado es
  // undefined, y !undefined es true → error.
  if (!EXTENSIONES_PERMITIDAS[archivo.type]) {
    throw new Error(`${etiqueta}: solo se aceptan imágenes JPG, PNG o WebP.`);
  }

  // archivo.size viene en bytes.
  if (archivo.size > TAMANIO_MAXIMO_IMAGEN) {
    throw new Error(`${etiqueta}: la imagen supera los 5 MB.`);
  }
}


// sube un archivo a Storage, en la ruta indicada.
// Recibe:   ruta    → dónde guardarlo dentro del bucket,
//                     ej. "id-usuario/id-receta/principal-123.jpg".
//           archivo → el objeto File a subir.
// Devuelve: nada. Si falla, lanza el error que devuelve Supabase.
//
// async: la función hace algo que tarda (enviar el archivo por
// internet), así que devuelve una promesa y se usa con await. Quien la llama usa await para
// esperar ese aviso antes de seguir.

async function subirImagen(ruta, archivo) {
  const { error } = await supabaseClient.storage
    .from(BUCKET_IMAGENES)
    .upload(ruta, archivo, {
      contentType: archivo.type, // le dice a Storage qué tipo de archivo es
      upsert: false              // si ya existe uno igual, da error en vez de pisarlo
    });

  if (error) {
    throw error;
  }
}


// FUNCIONES AUXILIARES DE GUARDADO


//  valida la imagen principal y las imágenes de los pasos,
//           pero solo las que el usuario eligió 
// Recibe:   datos → { imagenPrincipal: File o null, pasos: [{ imagen }] }
// Devuelve: nada. Si una imagen es inválida, lanza el error y se corta
//           ANTES de crear o modificar nada.

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


// devuelve el id del usuario logueado. Hace falta para
//           armar la carpeta de las imágenes: {usuario_id}/{receta_id}/.
// Devuelve: el id (texto). Si la sesión expiró, lanza un error.

async function obtenerUsuarioId() {
  const sesion = await obtenerSesion();
  if (!sesion) {
    throw new Error('La sesión expiró. Vuelva a iniciar sesión.');
  }
  return sesion.user.id;
}


//  arma la ruta donde se guarda una imagen en Storage.
// Recibe:   carpeta → "{usuario_id}/{receta_id}".
//           nombre  → "principal" o "pasos/paso-2", por ejemplo.
//           archivo → el File (para saber su extensión).
//           marca   → número único (Date.now()).
// Devuelve: ej. "id-usuario/id-receta/pasos/paso-2-1731950000000.jpg"
//
// Se usa una marca de tiempo en lugar del nombre original del archivo,
// que puede tener espacios o tildes que complican las rutas. Además,
// al editar, la imagen nueva nunca pisa a la vieja: tienen otra marca.

function armarRutaImagen(carpeta, nombre, archivo, marca) {
  const extension = EXTENSIONES_PERMITIDAS[archivo.type];
  return `${carpeta}/${nombre}-${marca}.${extension}`;
}


// transforma los ingredientes del formulario en filas de la tabla ingredientes.
// Recibe:   recetaId     → id de la receta a la que pertenecen.
//           ingredientes → [{ nombre, cantidad, unidad, nota }]
// Devuelve: el array de filas, listo para insertar con UNA sola llamada.

function armarFilasIngredientes(recetaId, ingredientes) {
  return ingredientes.map((ing, i) => ({
    receta_id: recetaId,
    orden: i + 1,            // el orden se guarda explícito: SQL no garantiza orden
    nombre: ing.nombre,
    cantidad: ing.cantidad,  // null si es "a gusto"
    unidad: ing.unidad || null,
    nota: ing.nota || null
  }));
}


// Qué hace: recorre los pasos, sube las imágenes NUEVAS y arma las
//           filas de la tabla pasos.
// Recibe:   carpeta      → "{usuario_id}/{receta_id}".
//           recetaId     → id de la receta.
//           pasos        → [{ descripcion, imagen, imagenActual, quitarImagen }]
//                          imagen:       File nuevo, o null.
//                          imagenActual: ruta que ya tenía (solo al editar).
//                          quitarImagen: true si se pidió quitarla (solo al editar).
//           marca        → número único (Date.now()).
//           rutasSubidas → array donde se anotan las imágenes subidas,
//                          por si después hay que borrarlas.
// Devuelve: el array de filas para insertar en la tabla pasos.
//
// Qué imagen queda en cada paso:
//   - Si eligió una imagen nueva → la nueva (reemplaza a la actual).
//   - Si no, y marcó "quitar"    → ninguna (null).
//   - Si no, y no tocó nada      → la que ya tenía (o null si no tenía).
// Al crear una receta, imagenActual y quitarImagen no existen
// (undefined), así que se cumple el último caso con null.

async function subirImagenesYArmarFilasPasos(carpeta, recetaId, pasos, marca, rutasSubidas) {
  const filasPasos = [];

  // entries() devuelve pares [posición, elemento] para usar en for...of.
  // Se usa for...of (y no forEach) porque adentro hay await: forEach no
  // espera a las funciones async.
  for (const [i, paso] of pasos.entries()) {
    let rutaImagen = paso.quitarImagen ? null : (paso.imagenActual || null);

    if (paso.imagen) {
      rutaImagen = armarRutaImagen(carpeta, `pasos/paso-${i + 1}`, paso.imagen, marca);
      await subirImagen(rutaImagen, paso.imagen);
      rutasSubidas.push(rutaImagen); // se anota por si hay que borrarla
    }

    filasPasos.push({
      receta_id: recetaId,
      numero: i + 1,          // los pasos se numeran desde 1
      descripcion: paso.descripcion,
      imagen: rutaImagen
    });
  }

  return filasPasos;
}


//  guarda una receta NUEVA y COMPLETA en Supabase: la receta,
//           su imagen principal, sus ingredientes y sus pasos (con sus
//           imágenes opcionales).
//
// Recibe:   datos = {
//             titulo:          texto (obligatorio),
//             descripcion:     texto (puede estar vacío),
//             esPublica:       true o false,
//             imagenPrincipal: File o null (opcional),
//             ingredientes:    [{ nombre, cantidad, unidad, nota }],
//             pasos:           [{ descripcion, imagen: File o null }]
//           }
//
// Devuelve: el id de la receta creada.
//
// Orden obligatorio (lo exigen las políticas de Storage, que solo
// permiten subir imágenes a recetas que ya existen y son del usuario):
//   1) Crear la receta → la base genera su id.
//   2) Subir las imágenes a la carpeta {usuario_id}/{receta_id}/.
//   3) Guardar la ruta de la imagen, los ingredientes y los pasos.
//
// Manejo de errores: desde el navegador no existen las transacciones
// (el "todo o nada" de SQL). Si algo falla a mitad de camino, el bloque
// catch llama a deshacerReceta() para borrar lo que se alcanzó a crear
// y no dejar recetas incompletas.

async function guardarReceta(datos) {

  // Si alguna imagen es inválida, el error corta acá y no se crea nada.
  validarImagenesDeReceta(datos);

  const usuarioId = await obtenerUsuarioId();

  // Variables para recordar qué se creó, por si hay que deshacerlo.
  let recetaId = null;
  const rutasSubidas = []; // const: el array no se reemplaza, solo se le agregan elementos

  try {
    // ================= 1. CREAR LA RECETA =================
    // No se envía usuario_id: la base lo completa sola con auth.uid() (el usuario logueado). 
    // Así nadie puede crear recetas a nombre de otro.
    // .select('id').single() le pide a la base que devuelva el id generado.
    const { data: receta, error: errorReceta } = await supabaseClient
      .from('recetas')
      .insert({
        titulo: datos.titulo,
        descripcion: datos.descripcion || null, // texto vacío → null
        es_publica: datos.esPublica
      })
      .select('id')
      .single();

    if (errorReceta) throw errorReceta;
    recetaId = receta.id;

    // ================= 2. SUBIR LAS IMÁGENES =================
    // Carpeta de esta receta, con el formato que exigen las políticas.
    const carpeta = `${usuarioId}/${recetaId}`;
    const marca = Date.now(); // milisegundos desde 1970: número único

    // -- Imagen principal (opcional) --
    let rutaPrincipal = null;
    if (datos.imagenPrincipal) {
      rutaPrincipal = armarRutaImagen(carpeta, 'principal', datos.imagenPrincipal, marca);
      await subirImagen(rutaPrincipal, datos.imagenPrincipal);
      rutasSubidas.push(rutaPrincipal); // se anota por si hay que borrarla
    }

    // -- Imágenes de los pasos (y filas de la tabla pasos) --
    const filasPasos = await subirImagenesYArmarFilasPasos(
      carpeta, recetaId, datos.pasos, marca, rutasSubidas
    );

    // ================= 3. GUARDAR EN LAS TABLAS =================

    // -- Ruta de la imagen principal en la receta --
    // Se guarda la RUTA, no la imagen: la imagen ya está en Storage.
    // Si no hay imagen, no hace falta actualizar nada: la columna
    // imagen_principal ya quedó en null al crear la receta.
    if (rutaPrincipal) {
      const { error: errorRuta } = await supabaseClient
        .from('recetas')
        .update({ imagen_principal: rutaPrincipal })
        .eq('id', recetaId); // .eq = WHERE id = recetaId
      if (errorRuta) throw errorRuta;
    }

    // -- Ingredientes --
    // Insertar el array completo hace UNA sola llamada a la base, en
    // lugar de una por ingrediente.
    const { error: errorIngredientes } = await supabaseClient
      .from('ingredientes')
      .insert(armarFilasIngredientes(recetaId, datos.ingredientes));
    if (errorIngredientes) throw errorIngredientes;

    // -- Pasos --
    const { error: errorPasos } = await supabaseClient
      .from('pasos')
      .insert(filasPasos);
    if (errorPasos) throw errorPasos;

    // Todo salió bien.
    return recetaId;

  } catch (error) {
    // Algo falló: se borra lo creado y se relanza el error para que la
    // página lo muestre al usuario.
    await deshacerReceta(recetaId, rutasSubidas);
    throw error;
  }
}


// Qué hace: borra lo que se alcanzó a crear antes de un error, para no
//           dejar recetas incompletas ni imágenes huérfanas.
// Recibe:   recetaId     → id de la receta creada (o null si no llegó a crearse).
//           rutasSubidas → array con las rutas de las imágenes ya subidas.
// Devuelve: nada.
//
// Orden: primero las imágenes, porque Storage NO se borra en cascada.
// Después la receta, que SÍ borra en cascada sus ingredientes y pasos
// (on delete cascade del esquema).
// ---------------------------------------------------------------------
async function deshacerReceta(recetaId, rutasSubidas) {
  try {
    if (rutasSubidas.length > 0) {
      await supabaseClient.storage.from(BUCKET_IMAGENES).remove(rutasSubidas);
    }
    if (recetaId) {
      await supabaseClient.from('recetas').delete().eq('id', recetaId);
    }
  } catch (errorLimpieza) {
    // Si la limpieza falla, solo se registra en la consola. No se
    // relanza: el error que importa mostrarle al usuario es el original.
    console.error('No se pudo deshacer la receta incompleta:', errorLimpieza);
  }
}


// EDICIÓN DE UNA RECETA

// Recibe:   recetaOriginal → la receta como estaba antes de editar
//                            (la de traerRecetaPorId). Se usa para
//                            saber qué filas e imágenes viejas borrar.
//           datos = {
//             titulo, descripcion, esPublica,
//             imagenPrincipal:       File nuevo o null,
//             quitarImagenPrincipal: true si se pidió quitar la actual,
//             ingredientes:          [{ nombre, cantidad, unidad, nota }],
//             pasos:                 [{ descripcion, imagen: File o null,
//                                       imagenActual: ruta o null,
//                                       quitarImagen: true o false }]
//           }
// Devuelve: nada. Si algo falla, lanza un error.
//
// ESTRATEGIA para ingredientes y pasos: en lugar de comparar fila por
// fila qué cambió, se reemplazan todos: se INSERTAN los nuevos y, si
// eso salió bien, se BORRAN los viejos (por su id). En ese orden,
// porque si falla el insert, la receta conserva sus datos anteriores
// en vez de quedar vacía.
//
// ORDEN COMPLETO:
//   1) Subir las imágenes nuevas.
//   2) Insertar los ingredientes y pasos nuevos.
//   3) Borrar los ingredientes y pasos viejos.
//   4) Actualizar la receta (título, descripción, visibilidad, imagen).
//   5) Borrar de Storage las imágenes viejas que ya no se usan.
//
// Manejo de errores: si algo falla antes de borrar los ingredientes
// viejos, se deshace todo (se borran las filas insertadas y las
// imágenes subidas) y la receta queda exactamente como estaba. Después
// de ese punto ya hay cambios que no se pueden revertir desde el
// navegador, así que se avisa que el guardado quedó a medias.
//
// (La forma de lograr un "todo o nada" real sería una función SQL en
// Supabase, que corre dentro de una transacción. Queda como mejora futura.)

async function actualizarReceta(recetaOriginal, datos) {

  // ---- Validaciones previas ----
  validarImagenesDeReceta(datos);

  const usuarioId = await obtenerUsuarioId();
  const recetaId = recetaOriginal.id;
  const carpeta = `${usuarioId}/${recetaId}`;
  const marca = Date.now();

  // Para deshacer, si hace falta.
  const rutasSubidas = [];
  let idsIngredientesNuevos = [];
  let idsPasosNuevos = [];

  // false mientras todavía se puede deshacer todo.
  let huboCambiosSinVuelta = false;

  try {
    // ================= 1. IMÁGENES NUEVAS =================

    // -- Imagen principal: cuál queda --
    //   eligió una nueva → la nueva; marcó quitar → null;
    //   no tocó nada → la que ya tenía.
    let rutaPrincipal = datos.quitarImagenPrincipal ? null : recetaOriginal.imagen_principal;
    if (datos.imagenPrincipal) {
      rutaPrincipal = armarRutaImagen(carpeta, 'principal', datos.imagenPrincipal, marca);
      await subirImagen(rutaPrincipal, datos.imagenPrincipal);
      rutasSubidas.push(rutaPrincipal);
    }

    // -- Imágenes de los pasos (y filas nuevas de la tabla pasos) --
    const filasPasos = await subirImagenesYArmarFilasPasos(
      carpeta, recetaId, datos.pasos, marca, rutasSubidas
    );

    // ================= 2. INSERTAR FILAS NUEVAS =================
    // .select('id') devuelve los ids de las filas insertadas: hacen
    // falta para borrarlas si algo falla después.
    const { data: ingredientesNuevos, error: errorIngredientes } = await supabaseClient
      .from('ingredientes')
      .insert(armarFilasIngredientes(recetaId, datos.ingredientes))
      .select('id');
    if (errorIngredientes) throw errorIngredientes;
    idsIngredientesNuevos = ingredientesNuevos.map((fila) => fila.id);

    const { data: pasosNuevos, error: errorPasos } = await supabaseClient
      .from('pasos')
      .insert(filasPasos)
      .select('id');
    if (errorPasos) throw errorPasos;
    idsPasosNuevos = pasosNuevos.map((fila) => fila.id);

    // ================= 3. BORRAR FILAS VIEJAS =================
    // .in('id', [...]) = WHERE id IN (...): borra varias en una llamada.
    const idsIngredientesViejos = recetaOriginal.ingredientes.map((ing) => ing.id);
    if (idsIngredientesViejos.length > 0) {
      const { error } = await supabaseClient
        .from('ingredientes')
        .delete()
        .in('id', idsIngredientesViejos);
      if (error) throw error;
    }

    // Desde acá, los ingredientes viejos ya no existen: los cambios ya
    // no se pueden deshacer.
    huboCambiosSinVuelta = true;

    const idsPasosViejos = recetaOriginal.pasos.map((paso) => paso.id);
    if (idsPasosViejos.length > 0) {
      const { error } = await supabaseClient
        .from('pasos')
        .delete()
        .in('id', idsPasosViejos);
      if (error) throw error;
    }

    // ================= 4. ACTUALIZAR LA RECETA =================
    // updated_at no se envía: lo actualiza solo el trigger de la base.
    const { error: errorReceta } = await supabaseClient
      .from('recetas')
      .update({
        titulo: datos.titulo,
        descripcion: datos.descripcion || null,
        es_publica: datos.esPublica,
        imagen_principal: rutaPrincipal
      })
      .eq('id', recetaId);
    if (errorReceta) throw errorReceta;

    // ================= 5. BORRAR IMÁGENES QUE YA NO SE USAN =================
    // Imágenes que tenía antes la receta...
    const rutasViejas = [
      recetaOriginal.imagen_principal,
      ...recetaOriginal.pasos.map((paso) => paso.imagen)
    ].filter(Boolean);

    // ...e imágenes que tiene ahora.
    const rutasEnUso = [rutaPrincipal, ...filasPasos.map((fila) => fila.imagen)];

    // Se borran las viejas que ya no están en uso (reemplazadas o quitadas).
    const rutasParaBorrar = rutasViejas.filter((ruta) => !rutasEnUso.includes(ruta));
    await borrarImagenesSinUso(rutasParaBorrar);

  } catch (error) {
    if (!huboCambiosSinVuelta) {
      // Todavía no se tocó nada viejo: se deshace todo y la receta
      // queda como estaba.
      await deshacerEdicion(idsIngredientesNuevos, idsPasosNuevos, rutasSubidas);
      throw error;
    }

    // Ya se borraron datos viejos: el guardado quedó a medias.
    throw new Error(
      'Se guardó solo una parte de los cambios. Abra la receta, revísela ' +
      'y vuelva a editarla. (' + error.message + ')'
    );
  }
}


// borra de Storage las imágenes que la receta ya no usa.
// Recibe:   rutas → array de rutas (puede estar vacío).
// Devuelve: nada.
//
// Si falla, solo se registra en la consola y NO se lanza el error: los
// cambios de la receta ya se guardaron bien, y una imagen que quedó sin
// borrar no afecta lo que ve el usuario (solo ocupa espacio).

async function borrarImagenesSinUso(rutas) {
  if (rutas.length === 0) {
    return;
  }

  const { error } = await supabaseClient.storage.from(BUCKET_IMAGENES).remove(rutas);
  if (error) {
    console.error('No se pudieron borrar imágenes viejas:', error);
  }
}


// si la edición falla antes de tocar los datos viejos, borra
//           lo nuevo que se alcanzó a crear, así la receta queda
//           exactamente como estaba.
// Recibe:   idsIngredientes → ids de los ingredientes nuevos insertados.
//           idsPasos        → ids de los pasos nuevos insertados.
//           rutasSubidas    → rutas de las imágenes nuevas subidas.
// Devuelve: nada. Si la limpieza falla, solo se registra en la consola:
//           el error que importa mostrar es el original.

async function deshacerEdicion(idsIngredientes, idsPasos, rutasSubidas) {
  try {
    if (idsIngredientes.length > 0) {
      await supabaseClient.from('ingredientes').delete().in('id', idsIngredientes);
    }
    if (idsPasos.length > 0) {
      await supabaseClient.from('pasos').delete().in('id', idsPasos);
    }
    if (rutasSubidas.length > 0) {
      await supabaseClient.storage.from(BUCKET_IMAGENES).remove(rutasSubidas);
    }
  } catch (errorLimpieza) {
    console.error('No se pudo deshacer la edición:', errorLimpieza);
  }
}




// LECTURA DE RECETAS (listado)


// trae las recetas del usuario logueado, de la más nueva a
//           la más vieja, llamando DIRECTAMENTE a la API REST de
//           Supabase con fetch (sin pasar por la librería).
// Recibe:   nada.
// Devuelve: un array de objetos, uno por receta:
//           [{ id, titulo, descripcion, imagen_principal, es_publica, created_at }, ...]
//
// Por qué con fetch: supabaseClient.from('recetas').select(...) hace
// exactamente esto por dentro. Escribirlo a mano muestra cómo funciona
// la API: una dirección, unos encabezados y una respuesta en JSON.
//
// Cómo se arma la dirección (sintaxis de PostgREST, la API de Supabase):
//   /rest/v1/recetas                 → la tabla
//   ?select=id,titulo,...            → qué columnas traer (como SELECT)
//   &usuario_id=eq.{id}              → filtro: usuario_id = id (como WHERE)
//   &order=created_at.desc           → orden: más nuevas primero (ORDER BY)

async function traerMisRecetas() {
  const sesion = await obtenerSesion();
  if (!sesion) {
    throw new Error('La sesión expiró. Vuelva a iniciar sesión.');
  }

  // URLSearchParams arma la parte de los parámetros (lo que va después
  // del "?") y codifica los caracteres especiales automáticamente.
  const parametros = new URLSearchParams({
    select: 'id,titulo,descripcion,imagen_principal,es_publica,created_at',
    usuario_id: `eq.${sesion.user.id}`,
    order: 'created_at.desc'
  });

  const url = `${SUPABASE_URL}/rest/v1/recetas?${parametros}`;

  // El pedido. Los encabezados (headers) son las credenciales:
  //   apikey        → identifica al PROYECTO (la clave pública).
  //   Authorization → identifica al USUARIO (su token de sesión).
  //                   Con él, las políticas RLS saben quién pide.
  const respuesta = await fetch(url, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${sesion.access_token}`
    }
  });

  // respuesta.ok es true si el código de estado está entre 200 y 299.
  // fetch NO lanza error por un 401 o un 500: hay que revisarlo a mano.
  if (!respuesta.ok) {
    throw new Error(`El servidor respondió con el código ${respuesta.status}.`);
  }

  // .json() lee el cuerpo de la respuesta y lo convierte de texto JSON
  // a un array de objetos de JavaScript. También es asíncrono.
  return await respuesta.json();
}


// pide a Storage una URL firmada (signed URL) para cada ruta.
// Recibe:   rutas → array de rutas guardadas en la base,
//                   ej. ["id-usuario/id-receta/principal-123.jpg", ...].
// Devuelve: un objeto que relaciona cada ruta con su URL:
//           { "id-usuario/.../principal-123.jpg": "https://...", ... }
//
// Por qué URLs firmadas: el bucket es privado, así que las imágenes no
// tienen una dirección pública fija. Supabase entrega una dirección
// temporal (aquí, válida por 1 hora) solo si las políticas lo permiten.
// createSignedUrls (en plural) pide todas en UNA sola llamada.

async function obtenerUrlsDeImagenes(rutas) {
  const urlsPorRuta = {};

  // filter(Boolean) descarta los valores vacíos (recetas sin imagen).
  const rutasValidas = rutas.filter(Boolean);
  if (rutasValidas.length === 0) {
    return urlsPorRuta;
  }

  const SEGUNDOS_DE_VALIDEZ = 60 * 60; // 1 hora

  const { data, error } = await supabaseClient.storage
    .from(BUCKET_IMAGENES)
    .createSignedUrls(rutasValidas, SEGUNDOS_DE_VALIDEZ);

  if (error) {
    throw error;
  }

  // data trae un objeto por ruta: { path, signedUrl, error }.
  // Se guarda solo si esa imagen en particular no dio error.
  data.forEach((item) => {
    if (!item.error) {
      urlsPorRuta[item.path] = item.signedUrl;
    }
  });

  return urlsPorRuta;
}


// ELIMINACIÓN DE UNA RECETA

// borra una receta completa

// Recibe:   receta → el objeto que devuelve traerRecetaPorId(), con
//                    id, imagen_principal y pasos (para saber qué
//                    imágenes borrar).
// Devuelve: nada. Si algo falla, lanza un error.
//
// ORDEN: primero las imágenes, después la receta. ¿Por qué?
//   - Storage NO se borra en cascada: si se borra solo la receta, las
//     imágenes quedan "huérfanas", ocupando espacio para siempre.
//   - Para borrar archivos, Storage exige poder VERLOS, y la política
//     "imagenes: ver si la receta es visible" pide que la receta
//     exista. Si se borrara primero la receta, las imágenes ya no se
//     podrían ver ni, por lo tanto, borrar.
//
// Ingredientes y pasos no se borran a mano: se van solos gracias al
// "on delete cascade" de sus claves foráneas (ver el esquema SQL).
// ---------------------------------------------------------------------
async function eliminarReceta(receta) {

  // ---- 1. Imágenes ----
  // Rutas de la imagen principal y de los pasos. filter(Boolean)
  // descarta los null (receta o pasos sin imagen).
  const rutas = [
    receta.imagen_principal,
    ...receta.pasos.map((paso) => paso.imagen)
  ].filter(Boolean);

  if (rutas.length > 0) {
    const { error: errorImagenes } = await supabaseClient.storage
      .from(BUCKET_IMAGENES)
      .remove(rutas); // borra todas en UNA sola llamada

    if (errorImagenes) {
      throw errorImagenes;
    }
  }

  // ---- 2. Receta (y en cascada, sus ingredientes y pasos) ----
  // .select('id') le pide a la base que devuelva las filas borradas.
  // Hace falta porque, si RLS no permite borrar (la receta no es del
  // usuario), Supabase NO da error: simplemente no borra nada. La única
  // forma de enterarse es ver que volvieron 0 filas.
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




// LECTURA DE UNA RECETA (detalle)



//  trae UNA receta completa: sus datos, sus ingredientes y sus
//           pasos, en UNA sola llamada a la base.
// Recibe:   id → el id (uuid) de la receta, el que viene en la dirección
//                receta.html?id=...
// Devuelve: un objeto con la receta y dos arrays adentro:
//           {
//             id, titulo, descripcion, imagen_principal, es_publica,
//             created_at, usuario_id,
//             ingredientes: [{ id, orden, nombre, cantidad, unidad, nota }, ...],
//             pasos:        [{ id, numero, descripcion, imagen }, ...]
//           }
//           o null si la receta no existe o el usuario no tiene permiso
//           para verla (las políticas RLS la "esconden").
//

// devuelve los ingredientes y pasos ANIDADOS dentro de la receta.
// Es el equivalente a un JOIN, pero con la respuesta ya agrupada.
//
// Orden de los hijos: SQL no garantiza el orden de las filas, por eso
// se ordena explícitamente cada tabla relacionada con referencedTable.
//
// maybeSingle() (en lugar de single()): si no encuentra ninguna fila
// devuelve null en vez de un error. Así se distingue "no existe / no
// tiene permiso" (null) de "falló la conexión" (error).

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

  return data; // null si no se encontró
}
