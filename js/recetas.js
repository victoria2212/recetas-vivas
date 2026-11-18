// =====================================================================
// 
//
// Este archivo SOLO habla con Supabase (base de datos y Storage).
// No toca el HTML: no lee formularios ni muestra mensajes. Así la misma
// lógica se puede reutilizar desde otras páginas (por ejemplo, cuando
// hagamos "editar receta").
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


// ---------------------------------------------------------------------
// validarImagen(archivo, etiqueta)
//
// Qué hace: revisa que una imagen tenga un tipo permitido y no supere
//           los 5 MB. Si algo está mal, lanza un error con un mensaje
//           claro para el usuario.
// Recibe:   archivo  → el objeto File que eligió el usuario.
//           etiqueta → texto para el mensaje (ej. "Paso 2").
// Devuelve: nada. Si la imagen es válida, simplemente termina.
//
// Por qué existe: el bucket también controla tipo y tamaño, pero recién
// al subir. Validar ANTES evita crear una receta que después falle.
// ---------------------------------------------------------------------
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


// ---------------------------------------------------------------------
// subirImagen(ruta, archivo)
//
// Qué hace: sube un archivo a Storage, en la ruta indicada.
// Recibe:   ruta    → dónde guardarlo dentro del bucket,
//                     ej. "id-usuario/id-receta/principal-123.jpg".
//           archivo → el objeto File a subir.
// Devuelve: nada. Si falla, lanza el error que devuelve Supabase.
//
// async: la función hace algo que tarda (enviar el archivo por
// internet), así que devuelve una promesa y se usa con await.
// ---------------------------------------------------------------------
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


// ---------------------------------------------------------------------
// guardarReceta(datos)
//
// Qué hace: guarda una receta COMPLETA en Supabase: la receta, su
//           imagen principal, sus ingredientes y sus pasos (con sus
//           imágenes opcionales).
//
// Recibe:   datos = {
//             titulo:          texto (obligatorio),
//             descripcion:     texto (puede estar vacío),
//             esPublica:       true o false,
//             imagenPrincipal: File (obligatorio),
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
// ---------------------------------------------------------------------
async function guardarReceta(datos) {

  // ---- Validaciones previas ----
  // Si alguna imagen es inválida, el error corta acá y no se crea nada.
  validarImagen(datos.imagenPrincipal, 'Imagen principal');

  // forEach recorre los pasos; i es la posición (empieza en 0).
  datos.pasos.forEach((paso, i) => {
    if (paso.imagen) {
      validarImagen(paso.imagen, `Paso ${i + 1}`);
    }
  });

  // ---- ¿Quién está guardando? ----
  // Hace falta el id del usuario para armar la carpeta de las imágenes.
  const sesion = await obtenerSesion();
  if (!sesion) {
    throw new Error('La sesión expiró. Vuelva a iniciar sesión.');
  }
  const usuarioId = sesion.user.id;

  // Variables para recordar qué se creó, por si hay que deshacerlo.
  // Se declaran con let porque cambian durante el proceso.
  let recetaId = null;
  const rutasSubidas = []; // const: el array no se reemplaza, solo se le agregan elementos

  try {
    // ================= 1. CREAR LA RECETA =================
    // No se envía usuario_id: la base lo completa sola con auth.uid()
    // (el usuario logueado). Así nadie puede crear recetas a nombre de otro.
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

    // Date.now() = milisegundos desde 1970. Se usa como nombre único del
    // archivo, en lugar del nombre original, que puede tener espacios o
    // tildes que complican las rutas.
    const marca = Date.now();

    // -- Imagen principal --
    const extPrincipal = EXTENSIONES_PERMITIDAS[datos.imagenPrincipal.type];
    const rutaPrincipal = `${carpeta}/principal-${marca}.${extPrincipal}`;
    await subirImagen(rutaPrincipal, datos.imagenPrincipal);
    rutasSubidas.push(rutaPrincipal); // se anota por si hay que borrarla

    // -- Imágenes de los pasos --
    // Mientras se recorren los pasos, se arma el array de filas que se
    // va a insertar en la tabla pasos.
    // entries() devuelve pares [posición, elemento] para usar en for...of.
    const filasPasos = [];
    for (const [i, paso] of datos.pasos.entries()) {
      let rutaImagen = null; // null = este paso no tiene imagen

      if (paso.imagen) {
        const ext = EXTENSIONES_PERMITIDAS[paso.imagen.type];
        rutaImagen = `${carpeta}/pasos/paso-${i + 1}-${marca}.${ext}`;
        await subirImagen(rutaImagen, paso.imagen);
        rutasSubidas.push(rutaImagen);
      }

      filasPasos.push({
        receta_id: recetaId,
        numero: i + 1,          // los pasos se numeran desde 1
        descripcion: paso.descripcion,
        imagen: rutaImagen
      });
    }

    // ================= 3. GUARDAR EN LAS TABLAS =================

    // -- Ruta de la imagen principal en la receta --
    // Se guarda la RUTA, no la imagen: la imagen ya está en Storage.
    const { error: errorRuta } = await supabaseClient
      .from('recetas')
      .update({ imagen_principal: rutaPrincipal })
      .eq('id', recetaId); // .eq = WHERE id = recetaId
    if (errorRuta) throw errorRuta;

    // -- Ingredientes --
    // map transforma cada ingrediente del formulario en una fila de la
    // tabla. Insertar el array completo hace UNA sola llamada a la base,
    // en lugar de una por ingrediente.
    const filasIngredientes = datos.ingredientes.map((ing, i) => ({
      receta_id: recetaId,
      orden: i + 1,            // el orden se guarda explícito: SQL no garantiza orden
      nombre: ing.nombre,
      cantidad: ing.cantidad,  // null si es "a gusto"
      unidad: ing.unidad || null,
      nota: ing.nota || null
    }));

    const { error: errorIngredientes } = await supabaseClient
      .from('ingredientes')
      .insert(filasIngredientes);
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


// ---------------------------------------------------------------------
// deshacerReceta(recetaId, rutasSubidas)
//
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