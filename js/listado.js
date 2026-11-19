// listado.js - pagina mis recetas (app.html)

// lo que se recuerda con localStorage (clases de preferencias.js)
const preferenciaBusqueda = new Preferencia('recetas-vivas:busqueda', '');

const preferenciaOrden = new PreferenciaOpcion('recetas-vivas:orden', ['recientes', 'az', 'za'], 'recientes');

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


// todas las recetas que trajo la api (el buscador filtra sobre esto)
let recetas = [];
let urlsImagenes = {};

// para armar el link del perfil publico
let usuarioId = null;
let nombreParaCompartir = 'Mis recetas';


function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = false;
}


// aviso verde segun de donde viene (?guardada=1, ?eliminada=1, ?perfil=1)
function mostrarAvisoSegunDireccion() {
  const parametros = new URLSearchParams(window.location.search);
  const mensajeExito = document.getElementById('mensaje-exito');

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


// saludo + portada del emprendimiento
async function mostrarPerfil(sesion) {
  try {
    const perfil = await traerPerfil(sesion.user.id);
    saludo.textContent = 'Hola, ' + perfil.nombre;
    nombreParaCompartir = perfil.nombre_emprendimiento || perfil.nombre;
    dibujarPortada(perfil);
  } catch (error) {
    console.error(error);
    mostrarError('No se pudo leer el perfil: ' + error.message);
    saludo.textContent = sesion.user.email;
  }
}


// si no cargo el nombre del emprendimiento, la portada invita a configurarlo
function dibujarPortada(perfil) {
  const configurado = Boolean(perfil.nombre_emprendimiento);

  document.getElementById('portada-nombre').textContent = configurado
    ? perfil.nombre_emprendimiento
    : 'Agregue el logo y el nombre de su emprendimiento';
  document.getElementById('portada-frase').textContent = configurado
    ? (perfil.frase ?? '')
    : 'Van a aparecer acá, arriba de sus recetas.';
  document.getElementById('portada-editar').textContent = configurado ? 'Editar' : 'Configurar';

  dibujarLogo(document.getElementById('portada-logo'), perfil);
  document.getElementById('portada').hidden = false;
}


// filtrar en true mientras escribe, en false al hacer clic en el buscador
function mostrarHistorial(filtrar) {
  const sugerencias = filtrar ? historial.filtrar(buscador.value) : historial.leer();

  listaHistorial.replaceChildren();

  if (sugerencias.length === 0) {
    listaHistorial.hidden = true;
    return;
  }

  const titulo = document.createElement('li');
  titulo.className = 'titulo-historial';
  titulo.textContent = 'Búsquedas recientes';
  listaHistorial.appendChild(titulo);

  sugerencias.forEach((busqueda) => {
    listaHistorial.appendChild(crearItemHistorial(busqueda, 'opcion-historial', { busqueda }));
  });
  listaHistorial.appendChild(crearItemHistorial('Borrar historial', 'borrar-historial', { accion: 'borrar' }));

  listaHistorial.hidden = false;
}


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


// un solo listener para toda la lista (delegacion de eventos)
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


// guardo la busqueda con enter y no con cada tecla (si no se llena de "p", "pa"...)
function alPresionarTeclaEnBuscador(evento) {
  if (evento.key === 'Enter') {
    historial.registrar(buscador.value);
    ocultarHistorial();
  } else if (evento.key === 'Escape') {
    ocultarHistorial();
  }
}


function alSalirDelBuscador(evento) {
  if (!contenedorBuscador.contains(evento.relatedTarget)) {
    ocultarHistorial();
  }
}


// minusculas y sin tildes, para que "Budín" encuentre "budin"
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}


function dibujarRecetas(lista) {
  listaRecetas.replaceChildren();

  sinRecetas.hidden = recetas.length > 0;

  const busquedaSinResultados = recetas.length > 0 && lista.length === 0;
  sinResultados.hidden = !busquedaSinResultados;
  if (busquedaSinResultados) {
    sinResultados.textContent = `Ninguna receta coincide con "${buscador.value.trim()}".`;
  }


  lista.forEach((receta) => {
    listaRecetas.appendChild(crearTarjeta(receta, urlsImagenes[receta.imagen_principal]));
  });
}


function filtrarRecetas() {
  const texto = buscador.value.trim();
  const textoNormalizado = normalizarTexto(texto);

  const filtradas = recetas.filter((receta) =>
    normalizarTexto(receta.titulo).includes(textoNormalizado)
  );

  dibujarRecetas(ordenarRecetas(filtradas));
  preferenciaBusqueda.guardar(texto);
}


// [...lista] para no desordenar el array original (sort lo modifica)
function ordenarRecetas(lista) {
  if (selectOrden.value === 'recientes') {
    return lista;
  }

  const ordenadas = [...lista].sort((a, b) =>
    a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' })
  );
  return selectOrden.value === 'za' ? ordenadas.reverse() : ordenadas;
}


function alCambiarOrden() {
  preferenciaOrden.guardar(selectOrden.value);
  filtrarRecetas();
}


async function cargarRecetas() {
  estadoCarga.hidden = false;
  errorListado.hidden = true;
  sinRecetas.hidden = true;
  sinResultados.hidden = true;
  listaRecetas.replaceChildren();

  try {
    recetas = await traerMisRecetas();

    try {
      urlsImagenes = await obtenerUrlsDeImagenes(
        recetas.map((receta) => receta.imagen_principal)
      );
    } catch (errorImagenes) {
      console.error('No se pudieron cargar las imágenes:', errorImagenes);
      urlsImagenes = {};
    }

    filtrarRecetas();

  } catch (error) {
    console.error(error);
    textoErrorListado.textContent =
      'No se pudieron cargar las recetas. Revise su conexión e intente de nuevo. (' + error.message + ')';
    errorListado.hidden = false;

  } finally {
    estadoCarga.hidden = true;
  }
}


function mostrarAviso(texto) {
  const mensajeExito = document.getElementById('mensaje-exito');
  mensajeExito.textContent = texto;
  mensajeExito.hidden = false;
}


// link absoluto al perfil publico, sirve igual en localhost y en vercel
function armarLinkDelPerfil() {
  const ruta = `perfil-publico.html?u=${encodeURIComponent(usuarioId)}`;
  return new URL(ruta, window.location.href).href;
}


// en el celu abre el menu de compartir del sistema (whatsapp, instagram...)
// si el navegador no lo tiene, copia el link al portapapeles
async function alCompartirPerfil() {
  mensajeError.hidden = true;

  // sin recetas publicas el perfil no se puede ver (RLS), no tiene sentido compartirlo
  if (!recetas.some((receta) => receta.es_publica)) {
    mostrarError('Todavía no tiene recetas públicas. Marque al menos una como "Pública" para que su perfil se pueda ver.');
    return;
  }

  const link = armarLinkDelPerfil();

  try {
    if (navigator.share) {
      await navigator.share({ title: nombreParaCompartir, text: 'Mirá mis recetas', url: link });
    } else {
      await navigator.clipboard.writeText(link);
      mostrarAviso('Link copiado. Ya puede pegarlo donde quiera compartirlo.');
    }
  } catch (error) {
    // AbortError = cerro el menu de compartir sin elegir nada, no es un error
    if (error.name === 'AbortError') {
      return;
    }
    console.error(error);
    mostrarError('No se pudo compartir. Copie este link: ' + link);
  }
}


// busqueda y orden antes de cargar, asi aparece ya filtrado
async function iniciarPagina() {
  const sesion = await protegerPagina();
  if (!sesion) return;

  usuarioId = sesion.user.id;
  buscador.value = preferenciaBusqueda.leer();
  selectOrden.value = preferenciaOrden.leer();
  mostrarAvisoSegunDireccion();

  await Promise.all([mostrarPerfil(sesion), cargarRecetas()]);
}


buscador.addEventListener('input', alEscribirEnBuscador);


buscador.addEventListener('focus', () => mostrarHistorial(false));
buscador.addEventListener('keydown', alPresionarTeclaEnBuscador);

buscador.addEventListener('change', () => historial.registrar(buscador.value));
contenedorBuscador.addEventListener('focusout', alSalirDelBuscador);
listaHistorial.addEventListener('click', alHacerClicEnHistorial);


// sin esto el buscador pierde el foco antes del clic y la lista se cierra
listaHistorial.addEventListener('mousedown', (evento) => evento.preventDefault());
selectOrden.addEventListener('change', alCambiarOrden);
document.getElementById('btn-reintentar').addEventListener('click', cargarRecetas);
document.getElementById('btn-salir').addEventListener('click', cerrarSesion);
document.getElementById('btn-compartir').addEventListener('click', alCompartirPerfil);

iniciarPagina().catch((error) => {
  console.error(error);
  mostrarError('Ocurrió un error al cargar la página.');
});
