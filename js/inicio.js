// inicio.js - pagina de login (index.html)

const mensajeError = document.getElementById('mensaje-error');

function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = false;
}


// si falla el login muestro el error en la pagina
async function alHacerClicEnGoogle() {
  try {
    await iniciarSesionConGoogle();
  } catch (error) {
    console.error(error);
    mostrarError('No se pudo iniciar sesión con Google: ' + error.message);
  }
}

// si ya hay sesion paso directo a mis recetas
redirigirSiHaySesion().catch((error) => {
  console.error(error);
  mostrarError('No se pudo verificar la sesión.');
});

document.getElementById('btn-google').addEventListener('click', alHacerClicEnGoogle);
