// =====================================================================
// js/detalle.js · Página "Detalle de receta" (receta.html)
//
// Antes este código estaba escrito dentro del HTML. Se pasó a un
// archivo aparte para poder cargarlo con defer y para que el HTML
// quede solo con la estructura de la página.
//
// Se carga con defer, en este orden: librería de Supabase → config.js
// → auth.js → recetas.js → este archivo. Por eso puede usar
// supabaseClient, protegerPagina(), las funciones de recetas.js y
// buscar elementos del HTML sin esperar a que la página termine de cargar.
// =====================================================================

// ===================================================================
// Lógica de la PÁGINA "Detalle de receta": leer el id de la
// dirección, traer la receta y dibujar cada sección.
// Lo que habla con Supabase está en recetas.js.
// ===================================================================

// Referencias a los elementos que se usan varias veces.
const estadoCarga = document.getElementById('estado-carga');
const errorReceta = document.getElementById('error-receta');
const textoErrorReceta = document.getElementById('texto-error-receta');
const noEncontrada = document.getElementById('no-encontrada');
const detalleReceta = document.getElementById('detalle-receta');

// Elementos de la eliminación
const accionesPropietario = document.getElementById('acciones-propietario');
const btnEliminar = document.getElementById('btn-eliminar');
const confirmarEliminar = document.getElementById('confirmar-eliminar');
const textoConfirmar = document.getElementById('texto-confirmar');
const errorEliminar = document.getElementById('error-eliminar');
const btnConfirmarEliminar = document.getElementById('btn-confirmar-eliminar');
const btnCancelarEliminar = document.getElementById('btn-cancelar-eliminar');

// ESTADO de la página. let porque se completan al cargar.
let usuarioActualId = null; // id del usuario logueado
let recetaActual = null;    // la receta que se está mostrando (para eliminarla)


// -----------------------------------------------------------------
// leerIdDeLaDireccion()
// Qué hace: lee el id de la receta que viene en la dirección.
//           La tarjeta del listado enlaza a receta.html?id=...
// Devuelve: el id (texto), o null si la dirección no lo trae.
// -----------------------------------------------------------------
function leerIdDeLaDireccion() {
  const parametros = new URLSearchParams(window.location.search);
  return parametros.get('id');
}


// -----------------------------------------------------------------
// formatearCantidad(cantidad)
// Qué hace: muestra el número con el formato de Argentina:
//           0.5 → "0,5" ; 1500 → "1.500".
// Recibe:   cantidad → número (o texto numérico) que viene de la base.
// Devuelve: el texto formateado.
//
// Number() asegura que sea un número antes de formatearlo.
// toLocaleString('es-AR') aplica la coma decimal y el punto de miles.
// -----------------------------------------------------------------
function formatearCantidad(cantidad) {
  return Number(cantidad).toLocaleString('es-AR');
}


// -----------------------------------------------------------------
// dibujarImagenPrincipal(url, titulo)
// Qué hace: pone la imagen principal al lado del título, o un
//           recuadro "Sin imagen" si no hay URL.
// Recibe:   url    → URL firmada de la imagen (o undefined).
//           titulo → texto alternativo de la imagen (accesibilidad).
// -----------------------------------------------------------------
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


// -----------------------------------------------------------------
// dibujarEncabezado(receta)
// Qué hace: completa la etiqueta Pública/Privada, el título y la
//           descripción. También cambia el título de la pestaña.
// Recibe:   receta → el objeto que devolvió traerRecetaPorId().
//
// Se usa textContent (y no innerHTML) para que el texto del usuario
// se muestre tal cual y nunca se interprete como HTML.
// -----------------------------------------------------------------
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


// -----------------------------------------------------------------
// crearItemIngrediente(ingrediente)
// Qué hace: arma UN <li> de ingrediente, con tres partes:
//           [cantidad unidad] nombre — nota
//           Ej.: "200 g  harina de almendras — tamizada"
//                "2  huevos"
//                "Pimienta — a gusto"   (sin cantidad)
// Recibe:   ingrediente → { orden, nombre, cantidad, unidad, nota }
// Devuelve: el elemento <li>.
//
// Cada parte es opcional salvo el nombre, por eso se arma por
// pedazos y solo se agrega lo que existe.
// -----------------------------------------------------------------
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
    item.appendChild(cantidad);
  }

  // -- Nombre (siempre existe: la base lo exige) --
  // createTextNode agrega texto suelto, sin etiqueta alrededor.
  item.appendChild(document.createTextNode(ingrediente.nombre));

  // -- Nota (opcional) --
  if (ingrediente.nota) {
    const nota = document.createElement('span');
    nota.className = 'ing-nota';
    nota.textContent = ` — ${ingrediente.nota}`;
    item.appendChild(nota);
  }

  return item;
}


// -----------------------------------------------------------------
// dibujarIngredientes(ingredientes)
// Qué hace: vacía la lista y agrega un <li> por ingrediente.
// Recibe:   ingredientes → array ya ordenado por "orden".
// -----------------------------------------------------------------
function dibujarIngredientes(ingredientes) {
  const lista = document.getElementById('lista-ingredientes');
  lista.replaceChildren();

  ingredientes.forEach((ingrediente) => {
    lista.appendChild(crearItemIngrediente(ingrediente));
  });
}


// -----------------------------------------------------------------
// dibujarPasos(pasos, urlsImagenes)
// Qué hace: vacía la lista y agrega un <li> por paso, con su texto
//           y, si tiene, su imagen debajo.
// Recibe:   pasos        → array ya ordenado por "numero".
//           urlsImagenes → objeto ruta → URL firmada.
//
// El número del paso no se escribe a mano: lo pone el <ol>. Como
// los pasos llegan ordenados, el 1.º <li> es el paso 1, y así.
// -----------------------------------------------------------------
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


// -----------------------------------------------------------------
// mostrarAccionesSiEsPropietario(receta)
// Qué hace: muestra el botón "Eliminar receta" solo si el usuario
//           logueado es el dueño de la receta.
// Recibe:   receta → tiene usuario_id (el dueño).
//
// Las recetas públicas de otros usuarios también se pueden ver, por
// eso hay que comparar. Si alguien mostrara el botón a la fuerza
// (desde DevTools), igual no podría borrar: lo impide RLS.
// -----------------------------------------------------------------
function mostrarAccionesSiEsPropietario(receta) {
  const esPropietario = receta.usuario_id === usuarioActualId;
  accionesPropietario.hidden = !esPropietario;
  cerrarConfirmacion(); // por si quedó abierta de antes
}


// -----------------------------------------------------------------
// abrirConfirmacion()
// Qué hace: al tocar "Eliminar receta", muestra la pregunta de
//           confirmación en la página y oculta el botón original.
//
// El foco va a "Cancelar" (y no a "Sí, eliminar"): si alguien aprieta
// Enter sin leer, no borra nada por accidente.
// -----------------------------------------------------------------
function abrirConfirmacion() {
  textoConfirmar.textContent =
    `¿Desea eliminar por completo la receta: "${recetaActual.titulo}"?`;
  errorEliminar.hidden = true;
  accionesPropietario.hidden = true;
  confirmarEliminar.hidden = false;
  btnCancelarEliminar.focus();
}


// -----------------------------------------------------------------
// cerrarConfirmacion()
// Qué hace: oculta la pregunta y vuelve a mostrar "Eliminar receta".
// Se llama al tocar "Cancelar".
// -----------------------------------------------------------------
function cerrarConfirmacion() {
  confirmarEliminar.hidden = true;
  // Solo se vuelve a mostrar el botón si el usuario es el dueño.
  accionesPropietario.hidden = !recetaActual || recetaActual.usuario_id !== usuarioActualId;
}


// -----------------------------------------------------------------
// activarBotonesDeConfirmacion(activos)
// Qué hace: activa o desactiva "Sí, eliminar" y "Cancelar".
// Recibe:   activos → true para activarlos, false para desactivarlos.
// Mientras se borra, se desactivan para evitar un doble clic.
// -----------------------------------------------------------------
function activarBotonesDeConfirmacion(activos) {
  btnConfirmarEliminar.disabled = !activos;
  btnCancelarEliminar.disabled = !activos;
  btnConfirmarEliminar.textContent = activos ? 'Sí, eliminar' : 'Eliminando...';
}


// -----------------------------------------------------------------
// alConfirmarEliminacion()
// Qué hace: borra la receta (eliminarReceta, en recetas.js) y vuelve
//           al listado con el aviso "Receta eliminada". Si falla,
//           muestra el error dentro del recuadro de confirmación.
// -----------------------------------------------------------------
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


// -----------------------------------------------------------------
// mostrarSolo(elemento)
// Qué hace: oculta todos los estados y muestra solo el indicado.
// Recibe:   elemento → el estado a mostrar (o null para ocultar todos).
// Centralizarlo evita olvidarse de ocultar alguno.
// -----------------------------------------------------------------
function mostrarSolo(elemento) {
  [estadoCarga, errorReceta, noEncontrada, detalleReceta].forEach((el) => {
    el.hidden = el !== elemento;
  });
}


// -----------------------------------------------------------------
// cargarReceta()
// Qué hace: trae la receta y la dibuja, manejando los estados:
//           cargando → detalle | no encontrada | error.
//
// Las imágenes se piden aparte (en UNA sola llamada, la principal y
// las de los pasos juntas). Si fallan, la receta se muestra igual,
// sin imágenes: que falle una parte no rompe toda la página.
// -----------------------------------------------------------------
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

    // Rutas de TODAS las imágenes: la principal + las de cada paso.
    // El spread (...) "despliega" el array de rutas de los pasos
    // dentro del array nuevo. obtenerUrlsDeImagenes descarta los null.
    let urlsImagenes = {};
    try {
      urlsImagenes = await obtenerUrlsDeImagenes([
        receta.imagen_principal,
        ...receta.pasos.map((paso) => paso.imagen)
      ]);
    } catch (errorImagenes) {
      console.error('No se pudieron cargar las imágenes:', errorImagenes);
    }

    dibujarImagenPrincipal(urlsImagenes[receta.imagen_principal], receta.titulo);
    dibujarEncabezado(receta);
    dibujarIngredientes(receta.ingredientes);
    dibujarPasos(receta.pasos, urlsImagenes);

    recetaActual = receta; // se guarda para poder eliminarla después
    mostrarAccionesSiEsPropietario(receta);

    mostrarSolo(detalleReceta);

  } catch (error) {
    console.error(error);

    // Si el id no tiene formato uuid, PostgreSQL responde con el
    // código 22P02 (texto inválido para el tipo). Para el usuario
    // eso equivale a "no existe".
    if (error.code === '22P02') {
      mostrarSolo(noEncontrada);
      return;
    }

    textoErrorReceta.textContent =
      'No se pudo cargar la receta. Revise su conexión e intente de nuevo. (' + error.message + ')';
    mostrarSolo(errorReceta);
  }
}


// -----------------------------------------------------------------
// iniciarPagina()
// Qué hace: verifica la sesión (sin sesión, vuelve al inicio),
//           guarda el id del usuario (para saber si es el dueño) y
//           carga la receta.
// -----------------------------------------------------------------
async function iniciarPagina() {
  const sesion = await protegerPagina();
  if (!sesion) return;

  usuarioActualId = sesion.user.id;

  await cargarReceta();
}


// ===================================================================
// EVENTOS
// ===================================================================
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
