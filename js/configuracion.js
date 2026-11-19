
// js/configuracion.js · Página "Mi emprendimiento" (configuracion.html)
//
// Carga los datos del emprendimiento en el formulario, los valida y los
// guarda. Lo que habla con Supabase está en perfil.js.


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

// El perfil tal como está guardado (para saber qué logo tenía).
let perfilActual = null;

// Editor para encuadrar el logo nuevo (clase de recorte-logo.js).
const recorte = new RecorteLogo(
  document.getElementById('lienzo-logo'),
  document.getElementById('zoom-logo')
);


function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = false;
}


// Completa el formulario con los datos guardados.
// ?? '' : si el dato es null, el campo queda vacío (y no dice "null").
function completarFormulario(perfil) {
  inputNombre.value = perfil.nombre_emprendimiento ?? '';
  inputFrase.value = perfil.frase ?? '';

  const urlLogo = obtenerUrlDelLogo(perfil.logo);
  if (urlLogo) {
    document.getElementById('img-logo-actual').src = urlLogo;
    logoActual.hidden = false;
  }
}


// Trae el perfil y muestra el formulario. Si falla, muestra el error.
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


// Al elegir un archivo: lo valida y lo abre en el editor, en el lugar
// del logo actual. Si el archivo no sirve (tipo o tamaño), muestra el
// error y vacía la elección.
// Si el usuario cancela la elección, vuelve a mostrar el logo actual.
async function alElegirLogo() {
  const archivo = inputLogo.files[0];
  mensajeError.hidden = true;

  try {
    if (archivo) {
      validarImagen(archivo, 'Logo'); // de recetas.js: tipo y tamaño
      await recorte.cargar(archivo);
    }
    mostrarEditorLogo(Boolean(archivo));
  } catch (error) {
    mostrarError(error.message);
    inputLogo.value = ''; // vacía la elección
    mostrarEditorLogo(false);
  }
}


// Muestra el editor (hay logo nuevo) o el logo actual (si tiene).
function mostrarEditorLogo(hayLogoNuevo) {
  editorLogo.hidden = !hayLogoNuevo;
  logoActual.hidden = hayLogoNuevo || !perfilActual.logo;
}


// Junta los campos en un objeto, con la forma que espera guardarPerfil().
function leerFormulario() {
  return {
    nombreEmprendimiento: inputNombre.value.trim(),
    frase: inputFrase.value.trim(),
    logo: null, // el archivo final lo arma el editor al guardar
    quitarLogo: checkQuitarLogo.checked
  };
}


// Devuelve el texto del primer problema, o null si está todo bien.
// (El tipo y el tamaño del logo los revisa validarImagen, en recetas.js.)
function validar(datos) {
  if (datos.nombreEmprendimiento.length < 2) {
    return 'Escriba el nombre del emprendimiento (al menos 2 letras).';
  }
  return null;
}


// Al tocar "Guardar": valida y guarda. Si sale bien, vuelve a
// "Mis recetas" con el aviso verde (?perfil=1).
async function alEnviarFormulario(evento) {
  evento.preventDefault(); // sin esto, el navegador recargaría la página
  mensajeError.hidden = true;

  const datos = leerFormulario();
  const problema = validar(datos);
  if (problema) {
    mostrarError(problema);
    return;
  }

  btnGuardar.disabled = true; // evita guardar dos veces con doble clic
  btnGuardar.textContent = 'Guardando...';

  try {
    // Si hay un logo nuevo, se guarda tal como quedó encuadrado.
    if (!editorLogo.hidden) {
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


// Verifica la sesión (sin sesión, vuelve al inicio) y carga el perfil.
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
