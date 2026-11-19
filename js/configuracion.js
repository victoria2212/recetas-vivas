// configuracion.js - pagina mi emprendimiento

const form = document.getElementById('form-perfil');
const estadoCarga = document.getElementById('estado-carga');
const errorCarga = document.getElementById('error-carga');
const textoErrorCarga = document.getElementById('texto-error-carga');
const mensajeError = document.getElementById('mensaje-error');
const btnGuardar = document.getElementById('btn-guardar');
const inputNombre = document.getElementById('nombre-emprendimiento');
const inputFrase = document.getElementById('frase');
const inputLogo = document.getElementById('logo');
const editorLogo = document.getElementById('editor-logo');
const logoActual = document.getElementById('logo-actual');
const checkQuitarLogo = document.getElementById('quitar-logo');

let perfilActual = null;

const recorte = new RecorteLogo(
  document.getElementById('lienzo-logo'),
  document.getElementById('zoom-logo')
);


function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = false;
}


function completarFormulario(perfil) {
  inputNombre.value = perfil.nombre_emprendimiento ?? '';
  inputFrase.value = perfil.frase ?? '';

  const urlLogo = obtenerUrlDelLogo(perfil.logo);
  if (urlLogo) {
    document.getElementById('img-logo-actual').src = urlLogo;
    logoActual.hidden = false;
  }
}


async function cargarPerfil(usuarioId) {
  try {
    perfilActual = await traerPerfil(usuarioId);
    completarFormulario(perfilActual);
    form.hidden = false;
  } catch (error) {
    console.error(error);
    textoErrorCarga.textContent =
      'No se pudieron cargar los datos. Revise su conexión e intente de nuevo. (' + error.message + ')';
    errorCarga.hidden = false;
  } finally {
    estadoCarga.hidden = true;
  }
}


// valida el archivo y lo abre en el editor
async function alElegirLogo() {
  const archivo = inputLogo.files[0];
  mensajeError.hidden = true;

  try {
    if (archivo) {
      validarImagen(archivo, 'Logo');
      await recorte.cargar(archivo);
    }
    mostrarEditorLogo(Boolean(archivo));
  } catch (error) {
    mostrarError(error.message);
    inputLogo.value = '';
    mostrarEditorLogo(false);
  }
}


function mostrarEditorLogo(hayLogoNuevo) {
  if (!hayLogoNuevo) {
    recorte.descartar();
  }
  editorLogo.hidden = !hayLogoNuevo;
  logoActual.hidden = hayLogoNuevo || !perfilActual.logo;
}


function leerFormulario() {
  return {
    nombreEmprendimiento: inputNombre.value.trim(),
    frase: inputFrase.value.trim(),
    logo: null,
    quitarLogo: checkQuitarLogo.checked
  };
}


function validar(datos) {
  if (datos.nombreEmprendimiento.length < 2) {
    return 'Escriba el nombre del emprendimiento (al menos 2 letras).';
  }
  return null;
}


async function alEnviarFormulario(evento) {
  evento.preventDefault();
  mensajeError.hidden = true;

  const datos = leerFormulario();
  const problema = validar(datos);
  if (problema) {
    mostrarError(problema);
    return;
  }

  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando...';

  try {
    // si eligio logo nuevo lo guardo como quedo en el editor
    if (recorte.tieneImagen) {
      datos.logo = await recorte.obtenerArchivo();
    }
    await guardarPerfil(perfilActual, datos);
    window.location.href = 'app.html?perfil=1';
  } catch (error) {
    console.error(error);
    mostrarError('No se pudieron guardar los datos: ' + error.message);
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar';
  }
}


async function iniciarPagina() {
  const sesion = await protegerPagina();
  if (!sesion) return;

  await cargarPerfil(sesion.user.id);
}


inputLogo.addEventListener('change', alElegirLogo);
document.getElementById('btn-centrar-logo').addEventListener('click', () => recorte.centrar());
form.addEventListener('submit', alEnviarFormulario);
document.getElementById('btn-salir').addEventListener('click', cerrarSesion);

iniciarPagina().catch((error) => {
  console.error(error);
  mostrarError('Ocurrió un error al cargar la página.');
});
