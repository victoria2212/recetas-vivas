//notas para mi
// Se carga con defer, en este orden: librería de Supabase → config.js
// → auth.js → recetas.js → este archivo. Por eso puede usar
// supabaseClient, protegerPagina(), las funciones de recetas.js y
// buscar elementos del HTML sin esperar a que la página termine de cargar.

// Lógica de la PÁGINA "Detalle de receta": leer el id de la
// dirección, traer la receta y dibujar cada sección.
// Lo que habla con Supabase está en recetas.js.


const estadoCarga = document.getElementById('estado-carga');
const errorReceta = document.getElementById('error-receta');
const textoErrorReceta = document.getElementById('texto-error-receta');
const noEncontrada = document.getElementById('no-encontrada');
const detalleReceta = document.getElementById('detalle-receta');

// Elementos de la eliminación
const accionesPropietario = document.getElementById('acciones-propietario');
const btnEditar = document.getElementById('btn-editar');
const btnEliminar = document.getElementById('btn-eliminar');
const confirmarEliminar = document.getElementById('confirmar-eliminar');
const textoConfirmar = document.getElementById('texto-confirmar');
const errorEliminar = document.getElementById('error-eliminar');
const btnConfirmarEliminar = document.getElementById('btn-confirmar-eliminar');
const btnCancelarEliminar = document.getElementById('btn-cancelar-eliminar');

// ESTADO de la página. let porque se completan al cargar.
let usuarioActualId = null; // id del usuario logueado
let recetaActual = null;    // la receta que se está mostrando (para eliminarla)


// lee el id de la receta que viene en la dirección.
//           La tarjeta del listado enlaza a receta.html?id=...
// Devuelve: el id (texto), o null si la dirección no lo trae.
// -----------------------------------------------------------------
function leerIdDeLaDireccion() {
  const parametros = new URLSearchParams(window.location.search);
  return parametros.get('id');
}


// toLocaleString('es-AR') aplica la coma decimal y el punto de miles.
// -----------------------------------------------------------------
function formatearCantidad(cantidad) {
  return Number(cantidad).toLocaleString('es-AR');
}


// dibujarImagenPrincipal(url, titulo). Pone la imagen principal al lado del título, o un recuadro "Sin imagen" si no hay URL.
// Recibe:   url    → URL firmada de la imagen (o undefined).
//           titulo → texto alternativo de la imagen (accesibilidad).

function dibujarImagenPrincipal(url, titulo) {
  const contenedor = document.getElementById('contenedor-imagen');
  contenedor.replaceChildren();

  if (url) {
    const imagen = document.createElement('img');
    imagen.src = url;
    imagen.alt = titulo;
    imagen.className = 'imagen-principal';
    contenedor.appendChild(imagen);
  } else {
    const sinImagen = document.createElement('div');
    sinImagen.className = 'sin-imagen';
    sinImagen.textContent = 'Sin imagen';
    contenedor.appendChild(sinImagen);
  }
}


//completa la etiqueta Pública/Privada, el título y la descripción. También cambia el título de la pestaña.
// Recibe la  receta → el objeto que devolvió traerRecetaPorId().

function dibujarEncabezado(receta) {
  const etiqueta = document.getElementById('etiqueta-visibilidad');
  etiqueta.className = receta.es_publica ? 'etiqueta publica' : 'etiqueta privada';
  etiqueta.textContent = receta.es_publica ? 'Pública' : 'Privada';

  document.getElementById('titulo-receta').textContent = receta.titulo;

  // La descripción es opcional: si no hay, el párrafo se oculta.
  const descripcion = document.getElementById('descripcion-receta');
  descripcion.textContent = receta.descripcion || '';
  descripcion.hidden = !receta.descripcion;

  document.title = `Recetas Vivas · ${receta.titulo}`;
}



// arma UN <li> de ingrediente, con tres partes: [cantidad unidad] nombre — nota     
// Recibe el ingrediente → { orden, nombre, cantidad, unidad, nota }
// Devuelve: el elemento <li>.

function crearItemIngrediente(ingrediente) {
  const item = document.createElement('li');

  // -- Cantidad y unidad (solo si hay cantidad) --
  // cantidad puede ser null ("a gusto"); 0 no se permite en la base.
  if (ingrediente.cantidad !== null) {
   
    const cantidad = document.createElement('span');
    cantidad.className = 'ing-cantidad';
    // filter(Boolean) descarta la unidad si es null, así no queda
    // "2 null"; join(' ') une las partes con un espacio.
    cantidad.textContent = [formatearCantidad(ingrediente.cantidad), ingrediente.unidad]
      .filter(Boolean)
      .join(' ');
    item.appendChild(cantidad);  // Cada parte es opcional salvo el nombre, por eso se arma por
// pedazos y solo se agrega lo que existe.
  }

  // -- Nombre (siempre existe: la base lo exige) --
  
  item.appendChild(document.createTextNode(ingrediente.nombre));

  // Nota opcional
  if (ingrediente.nota) {
    const nota = document.createElement('span');
    nota.className = 'ing-nota';
    nota.textContent = ` — ${ingrediente.nota}`;
    item.appendChild(nota);
  }

  return item;
}


//  vacía la lista y agrega un <li> por ingrediente.
// Recibe los ingredientes → array ya ordenado por "orden".

function dibujarIngredientes(ingredientes) {
  const lista = document.getElementById('lista-ingredientes');
  lista.replaceChildren();

  ingredientes.forEach((ingrediente) => {
    lista.appendChild(crearItemIngrediente(ingrediente));
  });
}



//  vaciar la lista y agrega un <li> por paso, con su texto y, si tiene, su imagen debajo.
// Recibe los pasos → array ya ordenado por "numero".
//           urlsImagenes → objeto ruta → URL firmada.


function dibujarPasos(pasos, urlsImagenes) {
  const lista = document.getElementById('lista-pasos');
  lista.replaceChildren();

  pasos.forEach((paso) => {
    const item = document.createElement('li');

    const texto = document.createElement('p');
    texto.textContent = paso.descripcion;
    item.appendChild(texto);

    // La imagen del paso es opcional. Si la ruta existe pero su URL
    // no se pudo generar, simplemente no se muestra.
    const url = urlsImagenes[paso.imagen];
    if (url) {
      const imagen = document.createElement('img');
      imagen.src = url;
      imagen.alt = `Paso ${paso.numero}`;
      imagen.className = 'imagen-paso';
      imagen.loading = 'lazy'; // carga recién cuando está por verse
      item.appendChild(imagen);
    }

    lista.appendChild(item);
  });
}


//  mostrar los botones "Editar receta" y "Eliminar receta"
//           solo si el usuario logueado es el dueño de la receta.
// Recibe la receta → tiene usuario_id (el dueño).
//
// Las recetas públicas de otros usuarios también se pueden ver, por
// eso hay que comparar. Si alguien mostrara el botón a la fuerza
// (desde DevTools), igual no podría borrar: lo impide RLS.

function mostrarAccionesSiEsPropietario(receta) {
  const esPropietario = receta.usuario_id === usuarioActualId;

  // "Editar" abre el mismo formulario de "Nueva receta", en modo edición.
  btnEditar.href = `nueva-receta.html?id=${encodeURIComponent(receta.id)}`;

  accionesPropietario.hidden = !esPropietario;
  cerrarConfirmacion(); // por si quedó abierta de antes
}



// El foco va a "Cancelar" (y no a "Sí, eliminar"): si alguien aprieta
// Enter sin leer, no borra nada por accidente.

function abrirConfirmacion() {
  textoConfirmar.textContent =
    `¿Desea eliminar por completo la receta: "${recetaActual.titulo}"?`;
  errorEliminar.hidden = true;
  accionesPropietario.hidden = true;
  confirmarEliminar.hidden = false;
  btnCancelarEliminar.focus();
}



//  ocultar la pregunta y vuelve a mostrar "Eliminar receta".
// Se llama al tocar "Cancelar".

function cerrarConfirmacion() {
  confirmarEliminar.hidden = true;
  // Solo se vuelve a mostrar el botón si el usuario es el dueño.
  accionesPropietario.hidden = !recetaActual || recetaActual.usuario_id !== usuarioActualId;
}


// Activar o desactiva "Sí, eliminar" y "Cancelar".
// Recibe:   activos → true para activarlos, false para desactivarlos.

function activarBotonesDeConfirmacion(activos) {
  btnConfirmarEliminar.disabled = !activos;
  btnCancelarEliminar.disabled = !activos;
  btnConfirmarEliminar.textContent = activos ? 'Sí, eliminar' : 'Eliminando...';
}



//  borra la receta (eliminarReceta, en recetas.js) y vuelve
//  al listado con el aviso "Receta eliminada". Si falla,
//  muestra el error dentro del recuadro de confirmación.

async function alConfirmarEliminacion() {
  activarBotonesDeConfirmacion(false);
  errorEliminar.hidden = true;

  try {
    await eliminarReceta(recetaActual);
    // ?eliminada=1 le avisa a app.html que muestre "Receta eliminada".
    // replace (y no href): así el botón "Atrás" del navegador no
    // vuelve a esta página, que ya no existe.
    window.location.replace('app.html?eliminada=1');
  } catch (error) {
    console.error(error);
    errorEliminar.textContent = 'No se pudo eliminar la receta: ' + error.message;
    errorEliminar.hidden = false;
    activarBotonesDeConfirmacion(true);
  }
}

// La página puede estar: cargando, con error, sin encontrar la
// receta, o mostrando la receta. Esta función muestra SOLO la
// parte que se le indica y oculta las otras tres.
function mostrarSolo(elemento) {
  [estadoCarga, errorReceta, noEncontrada, detalleReceta].forEach((el) => {
    el.hidden = el !== elemento;
  });
}


// trae la receta y la dibuja, manejando los estados: cargando → detalle | no encontrada | error.
// Las imágenes se piden aparte (en UNA sola llamada, la principal y
// las de los pasos juntas). Si fallan, la receta se muestra igual,
// sin imágenes: que falle una parte no rompe toda la página.

async function cargarReceta() {
  const id = leerIdDeLaDireccion();

  // Sin id en la dirección no hay nada que buscar.
  if (!id) {
    mostrarSolo(noEncontrada);
    return;
  }

  mostrarSolo(estadoCarga);

  try {
    const receta = await traerRecetaPorId(id);

    if (!receta) {
      mostrarSolo(noEncontrada);
      return;
    }

    // Las imágenes se piden aparte: si fallan, la receta se ve igual.
    const urlsImagenes = await obtenerUrlsDeReceta(receta);
    dibujarReceta(receta, urlsImagenes);
    mostrarSolo(detalleReceta);

  } catch (error) {
    mostrarErrorDeCarga(error);
  }
}


// Dibuja todas las partes de la receta y muestra los botones del dueño.
function dibujarReceta(receta, urlsImagenes) {
  dibujarImagenPrincipal(urlsImagenes[receta.imagen_principal], receta.titulo);
  dibujarEncabezado(receta);
  dibujarIngredientes(receta.ingredientes);
  dibujarPasos(receta.pasos, urlsImagenes);

  recetaActual = receta; // se guarda para poder eliminarla después
  mostrarAccionesSiEsPropietario(receta);
}


// Muestra el estado que corresponde cuando falla la carga.
// Si el id no tiene formato uuid, PostgreSQL responde con el código
// 22P02 (texto inválido para el tipo): para el usuario eso equivale a
// "no existe". Cualquier otro error es de conexión.
function mostrarErrorDeCarga(error) {
  console.error(error);

  if (error.code === '22P02') {
    mostrarSolo(noEncontrada);
    return;
  }

  textoErrorReceta.textContent =
    'No se pudo cargar la receta. Revise su conexión e intente de nuevo. (' + error.message + ')';
  mostrarSolo(errorReceta);
}


// si la página se abrió con ?editada=1 (viene de guardar cambios), muestra el aviso verde "Cambios guardados".

// history.replaceState saca el "&editada=1" de la dirección (dejando
// el id), para que el aviso no vuelva a aparecer al recargar.

function mostrarAvisoSiSeEdito() {
  const parametros = new URLSearchParams(window.location.search);

  if (parametros.get('editada') === '1') {
    document.getElementById('mensaje-exito').hidden = false;
    const id = parametros.get('id');
    history.replaceState(null, '', `receta.html?id=${encodeURIComponent(id)}`);
  }
}


// hay que verificar la sesión (sin sesión, vuelve al inicio),
//           guarda el id del usuario (para saber si es el dueño) y
//           carga la receta.
// -----------------------------------------------------------------
async function iniciarPagina() {
  const sesion = await protegerPagina();
  if (!sesion) return;

  usuarioActualId = sesion.user.id;
  mostrarAvisoSiSeEdito();

  await cargarReceta();
}



// EVENTOS

document.getElementById('btn-reintentar').addEventListener('click', cargarReceta);
document.getElementById('btn-salir').addEventListener('click', cerrarSesion);

// -- Eliminar receta --
btnEliminar.addEventListener('click', abrirConfirmacion);
btnCancelarEliminar.addEventListener('click', cerrarConfirmacion);
btnConfirmarEliminar.addEventListener('click', alConfirmarEliminacion);

// Arranque de la página.
iniciarPagina().catch((error) => {
  console.error(error);
  textoErrorReceta.textContent = 'Ocurrió un error al cargar la página.';
  mostrarSolo(errorReceta);
});
