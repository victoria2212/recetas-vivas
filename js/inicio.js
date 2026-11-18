// =====================================================================
// js/inicio.js · Página de inicio de sesión (index.html)
//
// Antes este código estaba escrito dentro del HTML. Se pasó a un
// archivo aparte para poder cargarlo con defer y para que el HTML
// quede solo con la estructura de la página.
//
// Se carga con defer, en este orden: librería de Supabase → config.js
// → auth.js → este archivo. Por eso puede usar las funciones de
// auth.js y buscar elementos del HTML sin esperar a que la página
// termine de cargar.
// =====================================================================

// Párrafo donde se muestran los errores (empieza oculto con hidden).
const mensajeError = document.getElementById('mensaje-error');


// ---------------------------------------------------------------------
// mostrarError(texto)
// Qué hace: escribe el mensaje en el párrafo de error y lo muestra.
// Recibe:   texto → el mensaje para el usuario.
// textContent (y no innerHTML) muestra el texto tal cual, sin
// interpretarlo como HTML.
// ---------------------------------------------------------------------
function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = false;
}


// ---------------------------------------------------------------------
// alHacerClicEnGoogle()
// Qué hace: inicia el login con Google (función de auth.js). Si
//           funciona, Google redirige a otra página y este código ya
//           no sigue; si falla, muestra el error en la página.
//
// Antes era una función anónima (sin nombre) dentro del
// addEventListener. Con nombre se entiende mejor qué hace el evento.
// ---------------------------------------------------------------------
async function alHacerClicEnGoogle() {
  try {
    await iniciarSesionConGoogle();
  } catch (error) {
    console.error(error);
    mostrarError('No se pudo iniciar sesión con Google: ' + error.message);
  }
}


// ===================================================================
// ARRANQUE Y EVENTOS
// ===================================================================

// Si ya hay una sesión iniciada, no tiene sentido mostrar el login:
// pasa directo a app.html. Si la verificación falla, se avisa.
redirigirSiHaySesion().catch((error) => {
  console.error(error);
  mostrarError('No se pudo verificar la sesión.');
});

document.getElementById('btn-google').addEventListener('click', alHacerClicEnGoogle);
