// perfil-publico.js - pagina publica de un emprendimiento (perfil-publico.html)
// se ve sin iniciar sesion: logo, nombre, frase y recetas publicas
// del usuario que viene en la url (perfil-publico.html?u=...)
// lo que se puede ver lo decide RLS en supabase, no esta pagina

const estadoCarga = document.getElementById('estado-carga');
const errorPerfil = document.getElementById('error-perfil');
const textoErrorPerfil = document.getElementById('texto-error-perfil');
const noEncontrado = document.getElementById('no-encontrado');
const contenidoPerfil = document.getElementById('contenido-perfil');


function leerUsuarioDeLaDireccion() {
  const parametros = new URLSearchParams(window.location.search);
  return parametros.get('u');
}


// muestra solo uno: cargando, error, no encontrado o el perfil
function mostrarSolo(elemento) {
  [estadoCarga, errorPerfil, noEncontrado, contenidoPerfil].forEach((el) => {
    el.hidden = el !== elemento;
  });
}


// si no cargo el nombre del emprendimiento uso el de la cuenta de google
function dibujarEncabezadoPerfil(perfil) {
  const nombre = perfil.nombre_emprendimiento || perfil.nombre;

  document.getElementById('perfil-nombre').textContent = nombre;

  const frase = document.getElementById('perfil-frase');
  frase.textContent = perfil.frase || '';
  frase.hidden = !perfil.frase;

  dibujarLogo(document.getElementById('perfil-logo'), perfil);
  document.title = `${nombre} · Recetas Vivas`;
}


function dibujarRecetasPublicas(recetas, urlsImagenes) {
  const lista = document.getElementById('lista-recetas');
  lista.replaceChildren();

  recetas.forEach((receta) => {
    lista.appendChild(crearTarjeta(receta, urlsImagenes[receta.imagen_principal], false));
  });
}


// si fallan las imagenes las recetas se muestran igual
async function traerUrlsSinFallar(recetas) {
  try {
    return await obtenerUrlsDeImagenes(recetas.map((receta) => receta.imagen_principal));
  } catch (error) {
    console.error('No se pudieron cargar las imágenes:', error);
    return {};
  }
}


async function cargarPerfil() {
  const usuarioId = leerUsuarioDeLaDireccion();

  if (!usuarioId) {
    mostrarSolo(noEncontrado);
    return;
  }

  mostrarSolo(estadoCarga);

  try {
    // las dos consultas a la vez, no dependen una de la otra
    const [perfil, recetas] = await Promise.all([
      traerPerfilPublico(usuarioId),
      traerRecetasPublicas(usuarioId)
    ]);

    // RLS solo deja ver perfiles con al menos una receta publica
    if (!perfil) {
      mostrarSolo(noEncontrado);
      return;
    }

    const urlsImagenes = await traerUrlsSinFallar(recetas);
    dibujarEncabezadoPerfil(perfil);
    dibujarRecetasPublicas(recetas, urlsImagenes);
    mostrarSolo(contenidoPerfil);

  } catch (error) {
    mostrarErrorDeCarga(error);
  }
}


// 22P02 = el id no tiene formato uuid, lo tomo como que no existe
function mostrarErrorDeCarga(error) {
  console.error(error);

  if (error.code === '22P02') {
    mostrarSolo(noEncontrado);
    return;
  }

  textoErrorPerfil.textContent =
    'No se pudo cargar el perfil. Revise su conexión e intente de nuevo. (' + error.message + ')';
  mostrarSolo(errorPerfil);
}


document.getElementById('btn-reintentar').addEventListener('click', cargarPerfil);

cargarPerfil();
