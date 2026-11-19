

// La misma página sirve para crear y para editar, así el formulario y
// sus validaciones están escritos una sola vez:
//   - nueva-receta.html         → modo CREAR (formulario vacío).
//   - nueva-receta.html?id=...  → modo EDITAR (formulario cargado con
//                                 los datos de esa receta).

// Lógica de la PÁGINA: leer el formulario, validar, mostrar mensajes
// y agregar o quitar filas. Lo que habla con Supabase está en
// recetas.js (funciones guardarReceta y actualizarReceta).

const form = document.getElementById('form-receta');
const listaIngredientes = document.getElementById('lista-ingredientes');
const listaPasos = document.getElementById('lista-pasos');
const mensajeError = document.getElementById('mensaje-error');
const btnGuardar = document.getElementById('btn-guardar');
const inputPrincipal = document.getElementById('imagen-principal');
const vistaPrincipal = document.getElementById('vista-principal');

const tituloPagina = document.getElementById('titulo-pagina');
const estadoCarga = document.getElementById('estado-carga');
const errorCarga = document.getElementById('error-carga');
const textoErrorCarga = document.getElementById('texto-error-carga');
const btnCancelar = document.getElementById('btn-cancelar');
const contenedorImagenActual = document.getElementById('imagen-principal-actual');
const imgPrincipalActual = document.getElementById('img-principal-actual');
const checkQuitarPrincipal = document.getElementById('quitar-imagen-principal');

// ¿Se está editando? Si la dirección trae ?id=..., sí.
// get devuelve null si no hay id → modo crear.
const recetaIdEditar = new URLSearchParams(window.location.search).get('id');

// ESTADO de la página 
let recetaOriginal = null;                // la receta tal como estaba (solo al editar)
let textoBotonGuardar = 'Guardar receta'; // cambia a "Guardar cambios" al editar


function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = false;
}

function ocultarError() {
  mensajeError.hidden = true;
}


//  copia una plantilla, le conecta el botón ✕ y agrega la
//           fila nueva al final de la lista.
// Recibe:   idPlantilla → id del <template> a copiar.
//           lista       → elemento donde se agrega la fila.
// Devuelve: la fila creada.
//
// content.firstElementChild es el primer elemento dentro del molde;
// cloneNode(true) lo copia con todo su contenido.
// El ✕ no deja quitar la última fila: la receta necesita al menos
// un ingrediente y un paso.

function agregarFila(idPlantilla, lista) {
  const plantilla = document.getElementById(idPlantilla);
  const fila = plantilla.content.firstElementChild.cloneNode(true);

  fila.querySelector('.btn-quitar').addEventListener('click', () => {
    if (lista.children.length > 1) {
      fila.remove();
    }
  });

  lista.appendChild(fila);
  return fila;
}


//  muestra la imagen principal elegida antes de subirla.

// URL.createObjectURL crea una dirección temporal que apunta al
// archivo en la computadora del usuario. revokeObjectURL libera la
// anterior para no ocupar memoria si cambia de imagen.

function mostrarVistaPrevia() {
  const archivo = inputPrincipal.files[0];

  if (vistaPrincipal.src) {
    URL.revokeObjectURL(vistaPrincipal.src);
  }

  if (archivo) {
    vistaPrincipal.src = URL.createObjectURL(archivo);
    vistaPrincipal.hidden = false;
  } else {
    vistaPrincipal.hidden = true;
  }
}


// junta todos los campos en un objeto con la forma que
//           espera guardarReceta() de recetas.js.
// Devuelve: { titulo, descripcion, esPublica, imagenPrincipal,
//             ingredientes: [...], pasos: [...] }
//
// [...lista.children] convierte las filas en un array para poder
// usar map (transformar) y filter (descartar).
// Las filas que el usuario dejó totalmente vacías se descartan.

function leerFormulario() {
  const ingredientes = [...listaIngredientes.children]
    .map((fila) => {
      const cantidadTexto = fila.querySelector('.ing-cantidad').value;
      return {
        nombre: fila.querySelector('.ing-nombre').value.trim(), // trim quita espacios sobrantes
        // Campo vacío → null (ej. "a gusto"); si no, se convierte a número.
        cantidad: cantidadTexto === '' ? null : Number(cantidadTexto),
        unidad: fila.querySelector('.ing-unidad').value.trim(),
        nota: fila.querySelector('.ing-nota').value.trim()
      };
    })
    // Se queda solo con las filas que tienen algo escrito.
    .filter((ing) => ing.nombre || ing.cantidad !== null || ing.unidad || ing.nota);

  const pasos = [...listaPasos.children]
    .map((fila) => ({
      descripcion: fila.querySelector('.paso-descripcion').value.trim(),
      // files[0] es el archivo elegido; || null si no eligió ninguno.
      imagen: fila.querySelector('.paso-imagen').files[0] || null,
      // Solo al editar: la imagen que el paso ya tenía (ruta guardada en
      // data-imagen-actual) y si se pidió quitarla. Al crear, quedan
      // en null y false.
      imagenActual: fila.dataset.imagenActual || null,
      quitarImagen: fila.querySelector('.paso-quitar-imagen').checked
    }))
    // Un paso se tiene en cuenta si tiene texto, una imagen nueva o una
    // imagen actual que no se quitó.
    .filter((paso) => paso.descripcion || paso.imagen || (paso.imagenActual && !paso.quitarImagen));

  return {
    titulo: document.getElementById('titulo').value.trim(),
    descripcion: document.getElementById('descripcion').value.trim(),
    esPublica: document.getElementById('es-publica').checked, // checked: true si está tildada
    imagenPrincipal: inputPrincipal.files[0] || null,
    quitarImagenPrincipal: checkQuitarPrincipal.checked, // solo se usa al editar
    ingredientes,
    pasos
  };
}


function validar(datos) {
  if (!datos.titulo) {
    return 'Falta el título.';
  }
  
  if (datos.ingredientes.length === 0) {
    return 'Agregue al menos un ingrediente.';
  }
  // some: ¿hay ALGÚN ingrediente que cumpla la condición?
  if (datos.ingredientes.some((ing) => !ing.nombre)) {
    return 'Hay un ingrediente sin nombre.';
  }
  if (datos.ingredientes.some((ing) => ing.cantidad !== null && !(ing.cantidad > 0))) {
    return 'Las cantidades deben ser mayores que cero.';
  }
  if (datos.pasos.length === 0) {
    return 'Agregue al menos un paso.';
  }
  if (datos.pasos.some((paso) => !paso.descripcion)) {
    return 'Hay un paso con imagen pero sin descripción.';
  }
  return null;
}


// MODO EDICIÓN: cargar la receta en el formulario

function mostrarErrorDeCarga(texto) {
  form.hidden = true;
  estadoCarga.hidden = true;
  textoErrorCarga.textContent = texto;
  errorCarga.hidden = false;
}


// recibe la receta → la receta que se va a editar.

function prepararModoEdicion(receta) {
  tituloPagina.textContent = 'Editar receta';
  document.title = `Recetas Vivas · Editar ${receta.titulo}`;

  textoBotonGuardar = 'Guardar cambios';
  btnGuardar.textContent = textoBotonGuardar;

  btnCancelar.href = `receta.html?id=${encodeURIComponent(receta.id)}`;
}



//escribe los datos de un ingrediente en una fila del formulario.
// Recibe:   fila        → la fila creada con agregarFila().
//           ingrediente → { cantidad, unidad, nombre, nota }
//
// ?? '' : si el dato es null (por ejemplo, sin unidad), el campo
// queda vacío en lugar de mostrar la palabra "null".

function completarFilaIngrediente(fila, ingrediente) {
  fila.querySelector('.ing-cantidad').value = ingrediente.cantidad ?? '';
  fila.querySelector('.ing-unidad').value = ingrediente.unidad ?? '';
  fila.querySelector('.ing-nombre').value = ingrediente.nombre;
  fila.querySelector('.ing-nota').value = ingrediente.nota ?? '';
}


// La ruta se guarda en fila.dataset.imagenActual (data-imagen-actual
// en el HTML). Así, al guardar, leerFormulario() sabe qué imagen tenía
// el paso, aunque el usuario lo haya movido o borrado otros pasos.

function completarFilaPaso(fila, paso, url) {
  fila.querySelector('.paso-descripcion').value = paso.descripcion;

  if (!paso.imagen) {
    return; // el paso no tenía imagen: no hay nada más que mostrar
  }

  fila.dataset.imagenActual = paso.imagen;

  // Se muestra el bloque aunque la URL no se haya podido generar: así
  // el usuario igual puede quitar o reemplazar la imagen.
  const bloque = fila.querySelector('.paso-imagen-actual');
  if (url) {
    bloque.querySelector('img').src = url;
  }
  bloque.hidden = false;
}


//  llena todo el formulario con los datos de la receta.
// Recibe:   receta       → la que devuelve traerRecetaPorId().
//           urlsImagenes → objeto ruta → URL firmada.
// -----------------------------------------------------------------
function completarFormulario(receta, urlsImagenes) {
  document.getElementById('titulo').value = receta.titulo;
  document.getElementById('descripcion').value = receta.descripcion ?? '';
  document.getElementById('es-publica').checked = receta.es_publica;

  
  if (receta.imagen_principal) {
    const url = urlsImagenes[receta.imagen_principal];
    if (url) {
      imgPrincipalActual.src = url;
    }
    contenedorImagenActual.hidden = false;
  }

  // Una fila por ingrediente y una por paso, ya completas
  receta.ingredientes.forEach((ingrediente) => {
    completarFilaIngrediente(agregarFila('plantilla-ingrediente', listaIngredientes), ingrediente);
  });

  receta.pasos.forEach((paso) => {
    completarFilaPaso(agregarFila('plantilla-paso', listaPasos), paso, urlsImagenes[paso.imagen]);
  });

  // Si la receta no tenía ingredientes o pasos (no debería pasar), se
  // deja al menos una fila vacía para completar.
  if (listaIngredientes.children.length === 0) {
    agregarFila('plantilla-ingrediente', listaIngredientes);
  }
  if (listaPasos.children.length === 0) {
    agregarFila('plantilla-paso', listaPasos);
  }
}


// trae la receta, verifica que sea del usuario y completa
//           el formulario. Mientras tanto, el formulario está oculto
//           y se ve "Cargando receta...".
// Recibe:   usuarioId → id del usuario logueado.

// Se verifica el dueño porque las recetas públicas de otros usuarios
// también se pueden LEER. Si alguien escribiera a mano el id de una
// receta ajena, ni siquiera vería el formulario (y aunque lo forzara,
// las políticas RLS no le dejarían guardar).

async function cargarRecetaParaEditar(usuarioId) {
  form.hidden = true;
  estadoCarga.hidden = false;

  try {
    const receta = await traerRecetaPorId(recetaIdEditar);

    if (!receta || receta.usuario_id !== usuarioId) {
      mostrarErrorDeCarga('No se encontró la receta o no tiene permiso para editarla.');
      return;
    }

    // Las imágenes se piden aparte: si fallan, se puede editar igual.
    let urlsImagenes = {};
    try {
      urlsImagenes = await obtenerUrlsDeImagenes([
        receta.imagen_principal,
        ...receta.pasos.map((paso) => paso.imagen)
      ]);
    } catch (errorImagenes) {
      console.error('No se pudieron cargar las imágenes:', errorImagenes);
    }

    recetaOriginal = receta; // se guarda para saber qué cambió al guardar
    prepararModoEdicion(receta);
    completarFormulario(receta, urlsImagenes);

    estadoCarga.hidden = true;
    form.hidden = false;

  } catch (error) {
    console.error(error);
    // 22P02: el id de la dirección no tiene formato uuid → "no existe".
    const mensaje = error.code === '22P02'
      ? 'No se encontró la receta o no tiene permiso para editarla.'
      : 'No se pudo cargar la receta. Revise su conexión e intente de nuevo. (' + error.message + ')';
    mostrarErrorDeCarga(mensaje);
  }
}


//  se ejecuta al tocar "Guardar receta" / "Guardar cambios".
//           Lee, valida y, si todo está bien:
//           - al CREAR: guarda la receta y vuelve a app.html;
//           - al EDITAR: guarda los cambios y vuelve al detalle.
// Recibe:   evento → información del envío que da el navegador.

async function alEnviarFormulario(evento) {
  // Sin esto, el navegador recargaría la página al enviar el form.
  evento.preventDefault();
  ocultarError();

  const datos = leerFormulario();
  const problema = validar(datos);
  if (problema) {
    mostrarError(problema);
    return; // corta acá: no se intenta guardar
  }

  // Se desactiva el botón para evitar guardar dos veces con doble clic.
  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando...';

  try {
    if (recetaOriginal) {
      //Modo EDITAR 
      await actualizarReceta(recetaOriginal, datos);
      // ?editada=1 le avisa al detalle que muestre "Cambios guardados".
      // replace (y no href): así "Atrás" no vuelve al formulario.
      window.location.replace(
        `receta.html?id=${encodeURIComponent(recetaOriginal.id)}&editada=1`
      );
    } else {
      // Modo CREAR
      await guardarReceta(datos);
      // ?guardada=1 le avisa a app.html que muestre "Receta guardada".
      window.location.href = 'app.html?guardada=1';
    }
  } catch (error) {
    console.error(error); // detalle técnico para usted, en la consola (F12)
    mostrarError('No se pudo guardar la receta: ' + error.message);
    btnGuardar.disabled = false;
    btnGuardar.textContent = textoBotonGuardar;
  }
}


//  primero verifica la sesión (sin sesión, vuelve al inicio). Después:
//           - al EDITAR: carga la receta en el formulario;
//           - al CREAR: deja una fila de ingrediente y una de paso
//             listas para completar.

async function iniciarPagina() {
  const sesion = await protegerPagina();
  if (!sesion) return;

  if (recetaIdEditar) {
    await cargarRecetaParaEditar(sesion.user.id);
    return;
  }

  agregarFila('plantilla-ingrediente', listaIngredientes);
  agregarFila('plantilla-paso', listaPasos);
}


// EVENTOS: qué función se ejecuta ante cada acción del usuario.

document.getElementById('btn-agregar-ingrediente')
  .addEventListener('click', () => agregarFila('plantilla-ingrediente', listaIngredientes));

document.getElementById('btn-agregar-paso')
  .addEventListener('click', () => agregarFila('plantilla-paso', listaPasos));

inputPrincipal.addEventListener('change', mostrarVistaPrevia);
form.addEventListener('submit', alEnviarFormulario);
document.getElementById('btn-salir').addEventListener('click', cerrarSesion);

// Arranque de la página.
iniciarPagina().catch((error) => {
  console.error(error);
  mostrarError('Ocurrió un error al cargar la página.');
});
