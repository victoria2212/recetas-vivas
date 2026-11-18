// =====================================================================
// js/nueva-receta.js · Página "Nueva receta" (nueva-receta.html)
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
// Lógica de la PÁGINA: leer el formulario, validar, mostrar mensajes
// y agregar o quitar filas. Lo que habla con Supabase está en
// recetas.js (función guardarReceta).
// ===================================================================

// Referencias a los elementos que se usan varias veces.
// Se buscan una sola vez y se guardan en constantes.
const form = document.getElementById('form-receta');
const listaIngredientes = document.getElementById('lista-ingredientes');
const listaPasos = document.getElementById('lista-pasos');
const mensajeError = document.getElementById('mensaje-error');
const btnGuardar = document.getElementById('btn-guardar');
const inputPrincipal = document.getElementById('imagen-principal');
const vistaPrincipal = document.getElementById('vista-principal');


// -----------------------------------------------------------------
// mostrarError(texto)
// Qué hace: escribe el mensaje en el párrafo de error y lo muestra.
// Recibe:   texto → el mensaje para el usuario.
// textContent (y no innerHTML) evita que un texto con etiquetas
// HTML se interprete como código.
// -----------------------------------------------------------------
function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = false;
}


// -----------------------------------------------------------------
// ocultarError()
// Qué hace: esconde el mensaje de error (se llama antes de cada
//           intento de guardar, para no mostrar errores viejos).
// -----------------------------------------------------------------
function ocultarError() {
  mensajeError.hidden = true;
}


// -----------------------------------------------------------------
// agregarFila(idPlantilla, lista)
// Qué hace: copia una plantilla, le conecta el botón ✕ y agrega la
//           fila nueva al final de la lista.
// Recibe:   idPlantilla → id del <template> a copiar.
//           lista       → elemento donde se agrega la fila.
// Devuelve: la fila creada.
//
// content.firstElementChild es el primer elemento dentro del molde;
// cloneNode(true) lo copia con todo su contenido.
// El ✕ no deja quitar la última fila: la receta necesita al menos
// un ingrediente y un paso.
// -----------------------------------------------------------------
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


// -----------------------------------------------------------------
// mostrarVistaPrevia()
// Qué hace: muestra la imagen principal elegida antes de subirla.
//
// URL.createObjectURL crea una dirección temporal que apunta al
// archivo en la computadora del usuario. revokeObjectURL libera la
// anterior para no ocupar memoria si cambia de imagen.
// -----------------------------------------------------------------
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


// -----------------------------------------------------------------
// leerFormulario()
// Qué hace: junta todos los campos en un objeto con la forma que
//           espera guardarReceta() de recetas.js.
// Devuelve: { titulo, descripcion, esPublica, imagenPrincipal,
//             ingredientes: [...], pasos: [...] }
//
// [...lista.children] convierte las filas en un array para poder
// usar map (transformar) y filter (descartar).
// Las filas que el usuario dejó totalmente vacías se descartan.
// -----------------------------------------------------------------
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
      imagen: fila.querySelector('.paso-imagen').files[0] || null
    }))
    .filter((paso) => paso.descripcion || paso.imagen);

  return {
    titulo: document.getElementById('titulo').value.trim(),
    descripcion: document.getElementById('descripcion').value.trim(),
    esPublica: document.getElementById('es-publica').checked, // checked: true si está tildada
    imagenPrincipal: inputPrincipal.files[0] || null,
    ingredientes,
    pasos
  };
}


// -----------------------------------------------------------------
// validar(datos)
// Qué hace: revisa las reglas de la receta, en orden.
// Recibe:   datos → el objeto que devuelve leerFormulario().
// Devuelve: el texto del PRIMER problema encontrado, o null si
//           todo está bien.
// (Las reglas de tipo y tamaño de imágenes están en recetas.js.)
// -----------------------------------------------------------------
function validar(datos) {
  if (!datos.titulo) {
    return 'Falta el título.';
  }
  if (!datos.imagenPrincipal) {
    return 'Falta la imagen del resultado final.';
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


// -----------------------------------------------------------------
// alEnviarFormulario(evento)
// Qué hace: se ejecuta al tocar "Guardar receta". Lee, valida y, si
//           todo está bien, guarda la receta y vuelve a app.html.
// Recibe:   evento → información del envío que da el navegador.
// -----------------------------------------------------------------
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
    await guardarReceta(datos);
    // ?guardada=1 le avisa a app.html que muestre "Receta guardada".
    window.location.href = 'app.html?guardada=1';
  } catch (error) {
    console.error(error); // detalle técnico para usted, en la consola (F12)
    mostrarError('No se pudo guardar la receta: ' + error.message);
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar receta';
  }
}


// -----------------------------------------------------------------
// iniciarPagina()
// Qué hace: primero verifica la sesión (sin sesión, vuelve al
//           inicio) y después deja una fila de ingrediente y una de
//           paso listas para completar.
// -----------------------------------------------------------------
async function iniciarPagina() {
  const sesion = await protegerPagina();
  if (!sesion) return;

  agregarFila('plantilla-ingrediente', listaIngredientes);
  agregarFila('plantilla-paso', listaPasos);
}


// ===================================================================
// EVENTOS: qué función se ejecuta ante cada acción del usuario.
// ===================================================================
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
