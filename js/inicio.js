

const mensajeError = document.getElementById('mensaje-error');

function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = false;
}


// inicia el login con Google (función de auth.js). Si
//           funciona, Google redirige a otra página y este código ya
//           no sigue; si falla, muestra el error en la página.

async function alHacerClicEnGoogle() {
  try {
    await iniciarSesionConGoogle();
  } catch (error) {
    console.error(error);
    mostrarError('No se pudo iniciar sesión con Google: ' + error.message);
  }
}

// ARRANQUE Y EVENTOS
// Si ya hay una sesión iniciada, no tiene sentido mostrar el login:
// pasa directo a app.html. Si la verificación falla, se avisa.
redirigirSiHaySesion().catch((error) => {
  console.error(error);
  mostrarError('No se pudo verificar la sesión.');
});

document.getElementById('btn-google').addEventListener('click', alHacerClicEnGoogle);
