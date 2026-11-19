
// js/listado.js · Página "Mis recetas" (app.html)


// Lógica de la PÁGINA: saludar, traer el listado, dibujar las
// tarjetas, filtrar con el buscador y ordenar.
// Lo que habla con Supabase está en recetas.js.


// Claves con las que se guardan en localStorage la última búsqueda y
// el orden elegido (ver preferencias.js).
const CLAVE_BUSQUEDA = 'recetas-vivas:busqueda';
const CLAVE_ORDEN = 'recetas-vivas:orden';

// Órdenes posibles del listado (los value del <select id="orden">).
const ORDENES_VALIDOS = ['recientes', 'az', 'za'];

// Las últimas 5 búsquedas. HistorialBusquedas es la clase de
// historial-busquedas.js; normalizarTexto está más abajo en este archivo.
const historial = new HistorialBusquedas('recetas-vivas:historial-busquedas', 5, normalizarTexto);

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
const selectOrden = document.getElementById('orden');

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
//           ?perfil=1    → viene de guardar los datos del emprendimiento.

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
    eliminada: 'Receta eliminada.',
    perfil: 'Datos del emprendimiento guardados.'
  };



  const clave = Object.keys(avisos).find((nombre) => parametros.get(nombre) === '1');

  if (clave) {
    mensajeExito.textContent = avisos[clave];
    mensajeExito.hidden = false;
    history.replaceState(null, '', 'app.html');
  }
}



// Trae el perfil del usuario y con él arma el saludo y la portada.
// Si falla, saluda con el mail y avisa el error, pero la página sigue
// funcionando (la portada queda oculta).
async function mostrarPerfil(sesion) {
  try {
    const perfil = await traerPerfil(sesion.user.id);
    saludo.textContent = 'Hola, ' + perfil.nombre;
    dibujarPortada(perfil);
  } catch (error) {
    console.error(error);
    mostrarError('No se pudo leer el perfil: ' + error.message);
    saludo.textContent = sesion.user.email;
  }
}


// Completa la portada con el logo, el nombre y la frase.
// Si todavía no cargó el nombre del emprendimiento, la portada invita
// a hacerlo y el botón dice "Configurar" en lugar de "Editar".
function dibujarPortada(perfil) {
  const configurado = Boolean(perfil.nombre_emprendimiento);

  document.getElementById('portada-nombre').textContent = configurado
    ? perfil.nombre_emprendimiento
    : 'Agregue el logo y el nombre de su emprendimiento';
  document.getElementById('portada-frase').textContent = configurado
    ? (perfil.frase ?? '')
    : 'Van a aparecer acá, arriba de sus recetas.';
  document.getElementById('portada-editar').textContent = configurado ? 'Editar' : 'Configurar';

  dibujarLogo(perfil);
  document.getElementById('portada').hidden = false;
}


// Pone el logo en la portada. Sin logo, muestra la inicial del
// emprendimiento en un recuadro (o un recuadro vacío si no hay nombre).
function dibujarLogo(perfil) {
  const contenedor = document.getElementById('portada-logo');
  contenedor.replaceChildren();

  const url = obtenerUrlDelLogo(perfil.logo);
  if (url) {
    const imagen = document.createElement('img');
    imagen.src = url;
    imagen.alt = 'Logo de ' + (perfil.nombre_emprendimiento ?? 'su emprendimiento');
    contenedor.appendChild(imagen);
    return;
  }

  // charAt(0) toma la primera letra; ?? '' evita un error si no hay nombre.
  contenedor.textContent = (perfil.nombre_emprendimiento ?? '').charAt(0).toUpperCase();
}


function mostrarHistorial(filtrar) {
  // Operador ternario: si hay que filtrar, se filtra; si no, se usan todas.
  const sugerencias = filtrar ? historial.filtrar(buscador.value) : historial.leer();

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

  // Una opción por búsqueda y, al final, "Borrar historial".
  sugerencias.forEach((busqueda) => {
    listaHistorial.appendChild(crearItemHistorial(busqueda, 'opcion-historial', { busqueda }));
  });
  listaHistorial.appendChild(crearItemHistorial('Borrar historial', 'borrar-historial', { accion: 'borrar' }));

  listaHistorial.hidden = false;
}


// Arma un <li> con un botón adentro, para la lista del historial.
// Recibe el texto del botón, su clase y los datos que se guardan en
// data-* (por ejemplo { busqueda: 'pan' } → data-busqueda="pan").
// Object.assign copia esos datos dentro de boton.dataset.
function crearItemHistorial(texto, clase, datos) {
  const item = document.createElement('li');
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = clase;
  boton.textContent = texto;
  Object.assign(boton.dataset, datos);
  item.appendChild(boton);
  return item;
}


function ocultarHistorial() {
  listaHistorial.hidden = true;
}


function alHacerClicEnHistorial(evento) {
  const boton = evento.target.closest('button');
  if (!boton) {
    return;
  }

  if (boton.dataset.accion === 'borrar') {
    historial.borrar();
    ocultarHistorial();
    return;
  }

  buscador.value = boton.dataset.busqueda;
  filtrarRecetas();
  historial.registrar(buscador.value);
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
    historial.registrar(buscador.value);
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

  tarjeta.appendChild(crearImagenTarjeta(receta));
  tarjeta.appendChild(crearCuerpoTarjeta(receta));
  return tarjeta;
}


// Imagen de la tarjeta, o un recuadro "Sin imagen" si no hay URL.
function crearImagenTarjeta(receta) {
  const url = urlsImagenes[receta.imagen_principal];

  if (!url) {
    const sinImagen = document.createElement('div');
    sinImagen.className = 'sin-imagen';
    sinImagen.textContent = 'Sin imagen';
    return sinImagen;
  }

  const imagen = document.createElement('img');
  imagen.src = url;
  imagen.alt = receta.titulo;
  imagen.loading = 'lazy'; // carga la imagen recién cuando está por verse
  return imagen;
}


// Parte de texto de la tarjeta: etiqueta, título y descripción.
function crearCuerpoTarjeta(receta) {
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

  return cuerpo;
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

  dibujarRecetas(ordenarRecetas(filtradas));
  guardarPreferencia(CLAVE_BUSQUEDA, texto);
}


// Devuelve la lista en el orden elegido en el <select id="orden">:
//   recientes → como llega de la API (las más nuevas primero);
//   az / za   → por título, alfabéticamente.
// [...lista] hace una COPIA: sort modifica el array sobre el que se
// usa, y así el array original no se desordena.
// localeCompare compara textos en español: con sensitivity 'base',
// "Budín" y "budin" quedan juntos (no importan mayúsculas ni tildes).
function ordenarRecetas(lista) {
  if (selectOrden.value === 'recientes') {
    return lista;
  }

  const ordenadas = [...lista].sort((a, b) =>
    a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' })
  );
  return selectOrden.value === 'za' ? ordenadas.reverse() : ordenadas;
}


// Lee el orden guardado. Si no hay uno válido, usa "recientes".
function leerOrdenGuardado() {
  const orden = leerPreferencia(CLAVE_ORDEN, 'recientes');
  return ORDENES_VALIDOS.includes(orden) ? orden : 'recientes';
}


// Al cambiar el orden: lo guarda y vuelve a dibujar el listado.
function alCambiarOrden() {
  guardarPreferencia(CLAVE_ORDEN, selectOrden.value);
  filtrarRecetas();
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
//  2) recupera la última búsqueda y el orden elegido;
//  3) muestra el aviso verde, el saludo y la portada del emprendimiento;
//  4) carga el listado.
//
// La búsqueda y el orden se recuperan ANTES de cargar, para que el
// listado ya aparezca filtrado y ordenado.
// -----------------------------------------------------------------
async function iniciarPagina() {
  const sesion = await protegerPagina();
  if (!sesion) return;

  buscador.value = leerPreferencia(CLAVE_BUSQUEDA, '');
  selectOrden.value = leerOrdenGuardado();
  mostrarAvisoSegunDireccion();

  // Perfil y listado son independientes: se ejecutan a la vez.
  // Promise.all espera a que terminen ambos.
  await Promise.all([mostrarPerfil(sesion), cargarRecetas()]);
}



// EVENTOS: qué función se ejecuta ante cada acción del usuario.


buscador.addEventListener('input', alEscribirEnBuscador);


// focus: al hacer clic (o entrar con Tab) en el buscador, se muestran
// todas las búsquedas recientes.
buscador.addEventListener('focus', () => mostrarHistorial(false));
buscador.addEventListener('keydown', alPresionarTeclaEnBuscador);

// change: se dispara al salir del campo si el texto cambió. Registra
// la búsqueda aunque no se haya presionado Enter.
buscador.addEventListener('change', () => historial.registrar(buscador.value));
contenedorBuscador.addEventListener('focusout', alSalirDelBuscador);
listaHistorial.addEventListener('click', alHacerClicEnHistorial);


listaHistorial.addEventListener('mousedown', (evento) => evento.preventDefault());
selectOrden.addEventListener('change', alCambiarOrden);
document.getElementById('btn-reintentar').addEventListener('click', cargarRecetas);
document.getElementById('btn-salir').addEventListener('click', cerrarSesion);

// Arranque de la página.
iniciarPagina().catch((error) => {
  console.error(error);
  mostrarError('Ocurrió un error al cargar la página.');
});
