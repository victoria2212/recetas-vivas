
// js/listado.js · Página "Mis recetas" (app.html)


// Lógica de la PÁGINA  saludar, traer el listado,
// dibujar las tarjetas y filtrar con el buscador.
// Lo que habla con Supabase está en recetas.js.


// Clave con la que se guarda la búsqueda en localStorage.

const CLAVE_BUSQUEDA = 'recetas-vivas:busqueda';

// Clave del historial: las últimas búsquedas, guardadas como un array de textos en formato JSON.
const CLAVE_HISTORIAL = 'recetas-vivas:historial-busquedas';

// Cuántas búsquedas recientes se recuerdan como máximo.
const MAXIMO_HISTORIAL = 5;

const saludo = document.getElementById('saludo');
const mensajeError = document.getElementById('mensaje-error');
const buscador = document.getElementById('buscador');
const estadoCarga = document.getElementById('estado-carga');
const errorListado = document.getElementById('error-listado');
const textoErrorListado = document.getElementById('texto-error-listado');
const sinRecetas = document.getElementById('sin-recetas');
const sinResultados = document.getElementById('sin-resultados');
const listaRecetas = document.getElementById('lista-recetas');
const contenedorBuscador = document.getElementById('contenedor-buscador');
const listaHistorial = document.getElementById('historial-busquedas');

// ESTADO de la página: los datos que llegan de la API.

let recetas = [];       // TODAS las recetas del usuario
let urlsImagenes = {};  // ruta de la imagen → URL firmada para mostrarla


function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = false;
}


// mostrar el aviso verde según de dónde se viene:
//           ?guardada=1  → viene de guardar una receta.
//           ?eliminada=1 → viene de eliminar una receta.

// URLSearchParams lee los parámetros que van después del "?" en la
// dirección. history.replaceState limpia la dirección para que el
// aviso no vuelva a aparecer si se recarga la página.

function mostrarAvisoSegunDireccion() {
  const parametros = new URLSearchParams(window.location.search);
  const mensajeExito = document.getElementById('mensaje-exito');

  // Objeto que relaciona cada parámetro con su mensaje. Así, para
  // sumar un aviso nuevo alcanza con agregar una línea acá.
  const avisos = {
    guardada: 'Receta guardada correctamente.',
    eliminada: 'Receta eliminada.'
  };



  const clave = Object.keys(avisos).find((nombre) => parametros.get(nombre) === '1');

  if (clave) {
    mensajeExito.textContent = avisos[clave];
    mensajeExito.hidden = false;
    history.replaceState(null, '', 'app.html');
  }
}



// Recibe la sesion → la sesión actual (para saber el id del usuario).
// Si falla, muestra el mail en su lugar y avisa el error, pero la
// página sigue funcionando.

async function saludarUsuario(sesion) {
  const { data: perfil, error } = await supabaseClient
    .from('perfiles')
    .select('nombre')
    .eq('id', sesion.user.id)
    .single();

  if (error) {
    console.error(error);
    mostrarError('No se pudo leer el perfil: ' + error.message);
    saludo.textContent = sesion.user.email;
    return;
  }

  saludo.textContent = 'Hola, ' + perfil.nombre;
}


function guardarBusqueda(texto) {
  try {
    localStorage.setItem(CLAVE_BUSQUEDA, texto);
  } catch (error) {
    console.warn('No se pudo guardar la búsqueda:', error);
  }
}


function leerBusquedaGuardada() {
  try {
    return localStorage.getItem(CLAVE_BUSQUEDA) ?? '';
  } catch (error) {
    console.warn('No se pudo leer la búsqueda guardada:', error);
    return '';
  }
}


// localStorage solo guarda TEXTO. El array se guarda convertido a
// texto JSON (JSON.stringify) y al leerlo se convierte de nuevo a
// array (JSON.parse).

function leerHistorial() {
  try {
    const texto = localStorage.getItem(CLAVE_HISTORIAL);
    if (!texto) {
      return [];
    }

    const historial = JSON.parse(texto);

    // Aunque sea JSON válido, podría no ser un array de textos
    // (por ejemplo, un número). Array.isArray lo comprueba y filter
    // descarta cualquier elemento que no sea texto.
    if (!Array.isArray(historial)) {
      return [];
    }
    return historial
      .filter((busqueda) => typeof busqueda === 'string')
      .slice(0, MAXIMO_HISTORIAL);

  } catch (error) {
    console.warn('El historial guardado no es válido; se ignora:', error);
    return [];
  }
}


//  guarda el array de búsquedas en localStorage, como JSON.
// Recibe el historial → array de textos.
// Si localStorage falla, el historial no se guarda pero la página sigue funcionando.

function guardarHistorial(historial) {
  try {
    localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(historial));
  } catch (error) {
    console.warn('No se pudo guardar el historial:', error);
  }
}


function registrarBusqueda(texto) {
  const busqueda = texto.trim();
  if (!busqueda) {
    return;
  }

  const normalizada = normalizarTexto(busqueda);

  // filter arma un array nuevo SIN la búsqueda repetida.
  const sinRepetida = leerHistorial().filter(
    (anterior) => normalizarTexto(anterior) !== normalizada
  );

  
  const historial = [busqueda, ...sinRepetida].slice(0, MAXIMO_HISTORIAL);
  guardarHistorial(historial);
}


function mostrarHistorial(filtrar) {
  const textoNormalizado = normalizarTexto(buscador.value.trim());

  // Operador ternario: si hay que filtrar, se filtra; si no, se usan todas.
  const sugerencias = filtrar
    ? leerHistorial().filter((busqueda) => normalizarTexto(busqueda).includes(textoNormalizado))
    : leerHistorial();

  listaHistorial.replaceChildren();

  if (sugerencias.length === 0) {
    listaHistorial.hidden = true;
    return;
  }

  // Título de la lista (no se puede elegir: es solo texto)
  const titulo = document.createElement('li');
  titulo.className = 'titulo-historial';
  titulo.textContent = 'Búsquedas recientes';
  listaHistorial.appendChild(titulo);

  // Una opción por búsqueda 
  sugerencias.forEach((busqueda) => {
    const item = document.createElement('li');
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'opcion-historial';
    boton.textContent = busqueda;
    boton.dataset.busqueda = busqueda; // queda como data-busqueda="..."
    item.appendChild(boton);
    listaHistorial.appendChild(item);
  });

  // Botón para borrar todo el historial
  const itemBorrar = document.createElement('li');
  const botonBorrar = document.createElement('button');
  botonBorrar.type = 'button';
  botonBorrar.className = 'borrar-historial';
  botonBorrar.textContent = 'Borrar historial';
  botonBorrar.dataset.accion = 'borrar';
  itemBorrar.appendChild(botonBorrar);
  listaHistorial.appendChild(itemBorrar);

  listaHistorial.hidden = false;
}


function ocultarHistorial() {
  listaHistorial.hidden = true;
}


function borrarHistorial() {
  try {
    localStorage.removeItem(CLAVE_HISTORIAL);
  } catch (error) {
    console.warn('No se pudo borrar el historial:', error);
  }
  ocultarHistorial();
}


function alHacerClicEnHistorial(evento) {
  const boton = evento.target.closest('button');
  if (!boton) {
    return;
  }

  if (boton.dataset.accion === 'borrar') {
    borrarHistorial();
    return;
  }

  buscador.value = boton.dataset.busqueda;
  filtrarRecetas();
  registrarBusqueda(buscador.value);
  ocultarHistorial();
}

function alEscribirEnBuscador() {
  filtrarRecetas();
  mostrarHistorial(true);
}


// La búsqueda se registra al presionar Enter (y al salir del campo,
// ver el evento "change") y NO con cada tecla: si no, el historial se
// llenaría de búsquedas a medio escribir ("p", "pa", "pan"...).

function alPresionarTeclaEnBuscador(evento) {
  if (evento.key === 'Enter') {
    registrarBusqueda(buscador.value);
    ocultarHistorial();
  } else if (evento.key === 'Escape') {
    ocultarHistorial();
  }
}


//  cierra las sugerencias cuando el foco sale del buscador
//           y de su lista (por ejemplo, al hacer clic en otra parte).
// Recibe:   evento → "focusout"; evento.relatedTarget es el elemento
//           que RECIBE el foco (o null si es ninguno).
//
// Si el foco pasa del campo a un botón de la lista (con Tab), sigue
// dentro del contenedor: la lista NO se cierra.
// -----------------------------------------------------------------
function alSalirDelBuscador(evento) {
  if (!contenedorBuscador.contains(evento.relatedTarget)) {
    ocultarHistorial();
  }
}


// pasa el texto a minúsculas y le quita las tildes, para
//           que "Budín", "budin" y "BUDÍN" se consideren iguales.
// Recibe:   texto → cualquier texto.
// Devuelve: el texto normalizado.

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ARMA el HTML de UNA tarjeta a partir de un objeto receta.
// Recibe:   receta → { id, titulo, descripcion, imagen_principal, es_publica }
// Devuelve: el elemento <a> de la tarjeta, listo para agregar.
//
// La tarjeta es un enlace a receta.html?id=..., así toda la tarjeta
// se puede tocar para ver el detalle.
// Se usa createElement + textContent (y no innerHTML) para que un
// título con símbolos como < o > se muestre como texto y no se
// interprete como HTML.

function crearTarjeta(receta) {
  const tarjeta = document.createElement('a');
  tarjeta.className = 'tarjeta-receta';
  // encodeURIComponent protege el id dentro de la dirección.
  tarjeta.href = `receta.html?id=${encodeURIComponent(receta.id)}`;

  // Imagen (o un recuadro vacío si no hay URL) 
  const url = urlsImagenes[receta.imagen_principal];
  if (url) {
    const imagen = document.createElement('img');
    imagen.src = url;
    imagen.alt = receta.titulo;
    imagen.loading = 'lazy'; // carga la imagen recién cuando está por verse
    tarjeta.appendChild(imagen);
  } else {
    const sinImagen = document.createElement('div');
    sinImagen.className = 'sin-imagen';
    sinImagen.textContent = 'Sin imagen';
    tarjeta.appendChild(sinImagen);
  }

  // Contenido de texto 
  const cuerpo = document.createElement('div');
  cuerpo.className = 'cuerpo-tarjeta';

  // Etiqueta de visibilidad. El operador ternario (condición ? a : b)
  // elige el texto y la clase según es_publica.
  const etiqueta = document.createElement('span');
  etiqueta.className = receta.es_publica ? 'etiqueta publica' : 'etiqueta privada';
  etiqueta.textContent = receta.es_publica ? 'Pública' : 'Privada';
  cuerpo.appendChild(etiqueta);

  const titulo = document.createElement('h2');
  titulo.textContent = receta.titulo;
  cuerpo.appendChild(titulo);

  // La descripción es opcional: solo se agrega si existe.
  if (receta.descripcion) {
    const descripcion = document.createElement('p');
    descripcion.textContent = receta.descripcion;
    cuerpo.appendChild(descripcion);
  }

  tarjeta.appendChild(cuerpo);
  return tarjeta;
}


// borra las tarjetas anteriores y dibuja las de la lista.
//           Además decide qué aviso mostrar si no hay nada que ver.
// Recibe lista → array de recetas a mostrar (puede ser filtrado).
// -----------------------------------------------------------------
function dibujarRecetas(lista) {
  // replaceChildren() sin argumentos vacía el contenedor.
  listaRecetas.replaceChildren();

  // ¿El usuario no tiene ninguna receta? (no es lo mismo que "la
  // búsqueda no encontró nada", por eso se mira el array COMPLETO).
  sinRecetas.hidden = recetas.length > 0;

  // Tiene recetas, pero ninguna coincide con la búsqueda
  const busquedaSinResultados = recetas.length > 0 && lista.length === 0;
  sinResultados.hidden = !busquedaSinResultados;
  if (busquedaSinResultados) {
    sinResultados.textContent = `Ninguna receta coincide con "${buscador.value.trim()}".`;
  }


  lista.forEach((receta) => {
    listaRecetas.appendChild(crearTarjeta(receta));
  });
}



// filter devuelve un array NUEVO solo con los elementos que cumplen
// la condición; el array original "recetas" no se modifica.
// Si el buscador está vacío, includes('') es true para todos: se
// muestran todas las recetas.

function filtrarRecetas() {
  const texto = buscador.value.trim();
  const textoNormalizado = normalizarTexto(texto);

  const filtradas = recetas.filter((receta) =>
    normalizarTexto(receta.titulo).includes(textoNormalizado)
  );

  dibujarRecetas(filtradas);
  guardarBusqueda(texto);
}



//  TRAE las recetas de la API y las muestra, manejando los tres estados: cargando → listo, o cargando → error.

// Las imágenes se piden aparte: si fallan, las recetas se muestran
// igual, sin imagen. Que falle una parte no rompe toda la página.
// finally se ejecuta SIEMPRE, haya salido bien o mal: por eso ahí se
// oculta el "Cargando...".

async function cargarRecetas() {
  estadoCarga.hidden = false;
  errorListado.hidden = true;
  sinRecetas.hidden = true;
  sinResultados.hidden = true;
  listaRecetas.replaceChildren();

  try {
    recetas = await traerMisRecetas();

    try {
      // map arma un array solo con las rutas de las imágenes.
      urlsImagenes = await obtenerUrlsDeImagenes(
        recetas.map((receta) => receta.imagen_principal)
      );
    } catch (errorImagenes) {
      console.error('No se pudieron cargar las imágenes:', errorImagenes);
      urlsImagenes = {};
    }

    filtrarRecetas(); // dibuja aplicando la búsqueda actual

  } catch (error) {
    console.error(error);
    textoErrorListado.textContent =
      'No se pudieron cargar las recetas. Revise su conexión e intente de nuevo. (' + error.message + ')';
    errorListado.hidden = false;

  } finally {
    estadoCarga.hidden = true;
  }
}


//  1) verifica la sesión (sin sesión, vuelve al inicio);
//  2) recupera la última búsqueda en el buscador;
//  3) saluda y muestra el aviso ("receta guardada" o "eliminada");
//  4) carga el listado.
//
// La búsqueda se recupera ANTES de cargar, para que el listado ya
// aparezca filtrado.
// -----------------------------------------------------------------
async function iniciarPagina() {
  const sesion = await protegerPagina();
  if (!sesion) return;

  buscador.value = leerBusquedaGuardada();
  mostrarAvisoSegunDireccion();

  // Saludo y listado son independientes: se ejecutan a la vez.
  // Promise.all espera a que terminen ambos.
  await Promise.all([saludarUsuario(sesion), cargarRecetas()]);
}



// EVENTOS: qué función se ejecuta ante cada acción del usuario.


buscador.addEventListener('input', alEscribirEnBuscador);


// focus: al hacer clic (o entrar con Tab) en el buscador, se muestran
// todas las búsquedas recientes.
buscador.addEventListener('focus', () => mostrarHistorial(false));
buscador.addEventListener('keydown', alPresionarTeclaEnBuscador);

// change: se dispara al salir del campo si el texto cambió. Registra
// la búsqueda aunque no se haya presionado Enter.
buscador.addEventListener('change', () => registrarBusqueda(buscador.value));
contenedorBuscador.addEventListener('focusout', alSalirDelBuscador);
listaHistorial.addEventListener('click', alHacerClicEnHistorial);


listaHistorial.addEventListener('mousedown', (evento) => evento.preventDefault());
document.getElementById('btn-reintentar').addEventListener('click', cargarRecetas);
document.getElementById('btn-salir').addEventListener('click', cerrarSesion);

// Arranque de la página.
iniciarPagina().catch((error) => {
  console.error(error);
  mostrarError('Ocurrió un error al cargar la página.');
});
