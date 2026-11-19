// nueva-receta.js - formulario para crear y editar recetas
// sin id en la url es crear, con ?id=... es editar

const form = document.getElementById('form-receta');
const listaIngredientes = document.getElementById('lista-ingredientes');
const listaPasos = document.getElementById('lista-pasos');
const mensajeError = document.getElementById('mensaje-error');
const btnGuardar = document.getElementById('btn-guardar');
const inputPrincipal = document.getElementById('imagen-principal');
const vistaPrincipal = document.getElementById('vista-principal');

// modo edicion
const tituloPagina = document.getElementById('titulo-pagina');
const estadoCarga = document.getElementById('estado-carga');
const errorCarga = document.getElementById('error-carga');
const textoErrorCarga = document.getElementById('texto-error-carga');
const btnCancelar = document.getElementById('btn-cancelar');
const contenedorImagenActual = document.getElementById('imagen-principal-actual');
const imgPrincipalActual = document.getElementById('img-principal-actual');
const checkQuitarPrincipal = document.getElementById('quitar-imagen-principal');

const recetaIdEditar = new URLSearchParams(window.location.search).get('id');

let recetaOriginal = null;
let textoBotonGuardar = 'Guardar receta';


function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = false;
}

function ocultarError() {
  mensajeError.hidden = true;
}


// clona la plantilla y le conecta el boton de quitar (siempre queda una fila)
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


// URL.createObjectURL muestra la imagen antes de subirla
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


// las filas vacias no se tienen en cuenta
function leerFormulario() {
  const ingredientes = [...listaIngredientes.children]
    .map((fila) => {
      const cantidadTexto = fila.querySelector('.ing-cantidad').value;
      return {
        nombre: fila.querySelector('.ing-nombre').value.trim(),
        cantidad: cantidadTexto === '' ? null : Number(cantidadTexto),
        unidad: fila.querySelector('.ing-unidad').value.trim(),
        nota: fila.querySelector('.ing-nota').value.trim()
      };
    })
    .filter((ing) => ing.nombre || ing.cantidad !== null || ing.unidad || ing.nota);

  const pasos = [...listaPasos.children]
    .map((fila) => ({
      descripcion: fila.querySelector('.paso-descripcion').value.trim(),
      imagen: fila.querySelector('.paso-imagen').files[0] || null,
      imagenActual: fila.dataset.imagenActual || null,
      quitarImagen: fila.querySelector('.paso-quitar-imagen').checked
    }))
    .filter((paso) => paso.descripcion || paso.imagen || (paso.imagenActual && !paso.quitarImagen));

  return {
    titulo: document.getElementById('titulo').value.trim(),
    descripcion: document.getElementById('descripcion').value.trim(),
    esPublica: document.getElementById('es-publica').checked,
    imagenPrincipal: inputPrincipal.files[0] || null,
    quitarImagenPrincipal: checkQuitarPrincipal.checked,
    ingredientes,
    pasos
  };
}


// devuelve el primer error o null
function validar(datos) {
  if (!datos.titulo) {
    return 'Falta el título.';
  }
  
  if (datos.ingredientes.length === 0) {
    return 'Agregue al menos un ingrediente.';
  }
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


function mostrarErrorDeCarga(texto) {
  form.hidden = true;
  estadoCarga.hidden = true;
  textoErrorCarga.textContent = texto;
  errorCarga.hidden = false;
}


function prepararModoEdicion(receta) {
  tituloPagina.textContent = 'Editar receta';
  document.title = `Recetas Vivas · Editar ${receta.titulo}`;

  textoBotonGuardar = 'Guardar cambios';
  btnGuardar.textContent = textoBotonGuardar;

  btnCancelar.href = `receta.html?id=${encodeURIComponent(receta.id)}`;
}


function completarFilaIngrediente(fila, ingrediente) {
  fila.querySelector('.ing-cantidad').value = ingrediente.cantidad ?? '';
  fila.querySelector('.ing-unidad').value = ingrediente.unidad ?? '';
  fila.querySelector('.ing-nombre').value = ingrediente.nombre;
  fila.querySelector('.ing-nota').value = ingrediente.nota ?? '';
}


// guardo la ruta de la imagen en data-imagen-actual para saber cual tenia
function completarFilaPaso(fila, paso, url) {
  fila.querySelector('.paso-descripcion').value = paso.descripcion;

  if (!paso.imagen) {
    return;
  }

  fila.dataset.imagenActual = paso.imagen;

  const bloque = fila.querySelector('.paso-imagen-actual');
  if (url) {
    bloque.querySelector('img').src = url;
  }
  bloque.hidden = false;
}


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

  receta.ingredientes.forEach((ingrediente) => {
    completarFilaIngrediente(agregarFila('plantilla-ingrediente', listaIngredientes), ingrediente);
  });

  receta.pasos.forEach((paso) => {
    completarFilaPaso(agregarFila('plantilla-paso', listaPasos), paso, urlsImagenes[paso.imagen]);
  });

  if (listaIngredientes.children.length === 0) {
    agregarFila('plantilla-ingrediente', listaIngredientes);
  }
  if (listaPasos.children.length === 0) {
    agregarFila('plantilla-paso', listaPasos);
  }
}


// verifico que la receta sea del usuario (las publicas de otros se pueden leer)
async function cargarRecetaParaEditar(usuarioId) {
  form.hidden = true;
  estadoCarga.hidden = false;

  try {
    const receta = await traerRecetaPorId(recetaIdEditar);

    if (!receta || receta.usuario_id !== usuarioId) {
      mostrarErrorDeCarga('No se encontró la receta o no tiene permiso para editarla.');
      return;
    }

    const urlsImagenes = await obtenerUrlsDeReceta(receta);

    recetaOriginal = receta;
    prepararModoEdicion(receta);
    completarFormulario(receta, urlsImagenes);

    estadoCarga.hidden = true;
    form.hidden = false;

  } catch (error) {
    console.error(error);
    const mensaje = error.code === '22P02'
      ? 'No se encontró la receta o no tiene permiso para editarla.'
      : 'No se pudo cargar la receta. Revise su conexión e intente de nuevo. (' + error.message + ')';
    mostrarErrorDeCarga(mensaje);
  }
}


async function alEnviarFormulario(evento) {
  evento.preventDefault();
  ocultarError();

  const datos = leerFormulario();
  const problema = validar(datos);
  if (problema) {
    mostrarError(problema);
    return;
  }

  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando...';

  try {
    if (recetaOriginal) {
      await actualizarReceta(recetaOriginal, datos);
      window.location.replace(
        `receta.html?id=${encodeURIComponent(recetaOriginal.id)}&editada=1`
      );
    } else {
      await guardarReceta(datos);
      window.location.href = 'app.html?guardada=1';
    }
  } catch (error) {
    console.error(error);
    mostrarError('No se pudo guardar la receta: ' + error.message);
    btnGuardar.disabled = false;
    btnGuardar.textContent = textoBotonGuardar;
  }
}


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


document.getElementById('btn-agregar-ingrediente')
  .addEventListener('click', () => agregarFila('plantilla-ingrediente', listaIngredientes));

document.getElementById('btn-agregar-paso')
  .addEventListener('click', () => agregarFila('plantilla-paso', listaPasos));

inputPrincipal.addEventListener('change', mostrarVistaPrevia);
form.addEventListener('submit', alEnviarFormulario);
document.getElementById('btn-salir').addEventListener('click', cerrarSesion);

iniciarPagina().catch((error) => {
  console.error(error);
  mostrarError('Ocurrió un error al cargar la página.');
});
