// detalle.js - pagina de una receta (receta.html)

const estadoCarga = document.getElementById('estado-carga');
const errorReceta = document.getElementById('error-receta');
const textoErrorReceta = document.getElementById('texto-error-receta');
const noEncontrada = document.getElementById('no-encontrada');
const detalleReceta = document.getElementById('detalle-receta');

const accionesPropietario = document.getElementById('acciones-propietario');
const btnEditar = document.getElementById('btn-editar');
const btnEliminar = document.getElementById('btn-eliminar');
const confirmarEliminar = document.getElementById('confirmar-eliminar');
const textoConfirmar = document.getElementById('texto-confirmar');
const errorEliminar = document.getElementById('error-eliminar');
const btnConfirmarEliminar = document.getElementById('btn-confirmar-eliminar');
const btnCancelarEliminar = document.getElementById('btn-cancelar-eliminar');

const enlaceVolver = document.getElementById('enlace-volver');
const btnSalir = document.getElementById('btn-salir');

let usuarioActualId = null;
let recetaActual = null;


// el id viene en la url: receta.html?id=...
function leerIdDeLaDireccion() {
  const parametros = new URLSearchParams(window.location.search);
  return parametros.get('id');
}


// 0.5 -> 0,5 y 1500 -> 1.500
function formatearCantidad(cantidad) {
  return Number(cantidad).toLocaleString('es-AR');
}


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


// textContent y no innerHTML para que no se interprete html
function dibujarEncabezado(receta) {
  const etiqueta = document.getElementById('etiqueta-visibilidad');
  etiqueta.className = receta.es_publica ? 'etiqueta publica' : 'etiqueta privada';
  etiqueta.textContent = receta.es_publica ? 'Pública' : 'Privada';

  document.getElementById('titulo-receta').textContent = receta.titulo;

  const descripcion = document.getElementById('descripcion-receta');
  descripcion.textContent = receta.descripcion || '';
  descripcion.hidden = !receta.descripcion;

  document.title = `Recetas Vivas · ${receta.titulo}`;
}


// cantidad y unidad, nombre y nota. solo el nombre es obligatorio
function crearItemIngrediente(ingrediente) {
  const item = document.createElement('li');

  if (ingrediente.cantidad !== null) {
   
    const cantidad = document.createElement('span');
    cantidad.className = 'ing-cantidad';
    cantidad.textContent = [formatearCantidad(ingrediente.cantidad), ingrediente.unidad]
      .filter(Boolean)
      .join(' ');
    item.appendChild(cantidad);
  }

  
  item.appendChild(document.createTextNode(ingrediente.nombre));

  if (ingrediente.nota) {
    const nota = document.createElement('span');
    nota.className = 'ing-nota';
    nota.textContent = ` — ${ingrediente.nota}`;
    item.appendChild(nota);
  }

  return item;
}


function dibujarIngredientes(ingredientes) {
  const lista = document.getElementById('lista-ingredientes');
  lista.replaceChildren();

  ingredientes.forEach((ingrediente) => {
    lista.appendChild(crearItemIngrediente(ingrediente));
  });
}


// el numero del paso lo pone el <ol>
function dibujarPasos(pasos, urlsImagenes) {
  const lista = document.getElementById('lista-pasos');
  lista.replaceChildren();

  pasos.forEach((paso) => {
    const item = document.createElement('li');

    const texto = document.createElement('p');
    texto.textContent = paso.descripcion;
    item.appendChild(texto);

    const url = urlsImagenes[paso.imagen];
    if (url) {
      const imagen = document.createElement('img');
      imagen.src = url;
      imagen.alt = `Paso ${paso.numero}`;
      imagen.className = 'imagen-paso';
      imagen.loading = 'lazy';
      item.appendChild(imagen);
    }

    lista.appendChild(item);
  });
}


// editar y eliminar solo para el dueño (igual RLS no deja a otros)
function mostrarAccionesSiEsPropietario(receta) {
  const esPropietario = receta.usuario_id === usuarioActualId;

  btnEditar.href = `nueva-receta.html?id=${encodeURIComponent(receta.id)}`;

  accionesPropietario.hidden = !esPropietario;
  cerrarConfirmacion();
}


// el foco va a cancelar para no borrar sin querer
function abrirConfirmacion() {
  textoConfirmar.textContent =
    `¿Desea eliminar por completo la receta: "${recetaActual.titulo}"?`;
  errorEliminar.hidden = true;
  accionesPropietario.hidden = true;
  confirmarEliminar.hidden = false;
  btnCancelarEliminar.focus();
}


function cerrarConfirmacion() {
  confirmarEliminar.hidden = true;
  accionesPropietario.hidden = !recetaActual || recetaActual.usuario_id !== usuarioActualId;
}


// desactivados mientras borra, por el doble clic
function activarBotonesDeConfirmacion(activos) {
  btnConfirmarEliminar.disabled = !activos;
  btnCancelarEliminar.disabled = !activos;
  btnConfirmarEliminar.textContent = activos ? 'Sí, eliminar' : 'Eliminando...';
}


// replace para que atras no vuelva a una receta que ya no existe
async function alConfirmarEliminacion() {
  activarBotonesDeConfirmacion(false);
  errorEliminar.hidden = true;

  try {
    await eliminarReceta(recetaActual);
    window.location.replace('app.html?eliminada=1');
  } catch (error) {
    console.error(error);
    errorEliminar.textContent = 'No se pudo eliminar la receta: ' + error.message;
    errorEliminar.hidden = false;
    activarBotonesDeConfirmacion(true);
  }
}

// muestra solo uno: cargando, error, no encontrada o la receta
function mostrarSolo(elemento) {
  [estadoCarga, errorReceta, noEncontrada, detalleReceta].forEach((el) => {
    el.hidden = el !== elemento;
  });
}


async function cargarReceta() {
  const id = leerIdDeLaDireccion();

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

    const urlsImagenes = await obtenerUrlsDeReceta(receta);
    dibujarReceta(receta, urlsImagenes);
    mostrarSolo(detalleReceta);

  } catch (error) {
    mostrarErrorDeCarga(error);
  }
}


function dibujarReceta(receta, urlsImagenes) {
  dibujarImagenPrincipal(urlsImagenes[receta.imagen_principal], receta.titulo);
  dibujarEncabezado(receta);
  dibujarIngredientes(receta.ingredientes);
  dibujarPasos(receta.pasos, urlsImagenes);

  recetaActual = receta;
  mostrarAccionesSiEsPropietario(receta);
  ajustarEnlaceVolver(receta);
}


// el dueño vuelve a mis recetas; cualquier otro va al perfil publico del autor
function ajustarEnlaceVolver(receta) {
  if (receta.usuario_id === usuarioActualId) {
    return;
  }

  enlaceVolver.href = `perfil-publico.html?u=${encodeURIComponent(receta.usuario_id)}`;
  enlaceVolver.textContent = '← Más recetas del autor';
}


// 22P02 = el id no tiene formato uuid, lo tomo como que no existe
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


// viene de editar (?editada=1). limpio la url para que no aparezca de nuevo al recargar
function mostrarAvisoSiSeEdito() {
  const parametros = new URLSearchParams(window.location.search);

  if (parametros.get('editada') === '1') {
    document.getElementById('mensaje-exito').hidden = false;
    const id = parametros.get('id');
    history.replaceState(null, '', `receta.html?id=${encodeURIComponent(id)}`);
  }
}


// se puede ver sin sesion: las recetas publicas son para cualquiera.
// si es privada y no es del usuario, RLS no la devuelve y se ve "no encontrada"
async function iniciarPagina() {
  const sesion = await obtenerSesion();

  usuarioActualId = sesion ? sesion.user.id : null;
  btnSalir.hidden = !sesion;

  if (!sesion) {
    enlaceVolver.href = 'index.html';
    enlaceVolver.textContent = '← Inicio';
  }

  mostrarAvisoSiSeEdito();

  await cargarReceta();
}


document.getElementById('btn-reintentar').addEventListener('click', cargarReceta);
btnSalir.addEventListener('click', cerrarSesion);

btnEliminar.addEventListener('click', abrirConfirmacion);
btnCancelarEliminar.addEventListener('click', cerrarConfirmacion);
btnConfirmarEliminar.addEventListener('click', alConfirmarEliminacion);

iniciarPagina().catch((error) => {
  console.error(error);
  textoErrorReceta.textContent = 'Ocurrió un error al cargar la página.';
  mostrarSolo(errorReceta);
});
