
// auth.js · Funciones de autenticación
// Requiere que config.js esté cargado antes (usa supabaseClient).


// Inicia el login con Google.
// Redirige a la pantalla de Google; al terminar, Supabase devuelve al
// usuario a app.html (dirección que debe estar en Redirect URLs).
async function iniciarSesionConGoogle() {
  // new URL('app.html', ...) arma la dirección completa de app.html
  // relativa a la página actual
  const destino = new URL('app.html', window.location.href).href;

  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: destino }
  });

  if (error) {
    throw error;
  }
}

// Cierra la sesión y vuelve a la página de inicio.
async function cerrarSesion() {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
}

// Devuelve la sesión actual, o null si no hay nadie logueado.
// Al volver de Google, Supabase lee los datos de la URL y crea la
// sesión; getSession espera a que ese proceso termine.
async function obtenerSesion() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

// Para páginas privadas (app.html, nueva-receta.html...):
// si no hay sesión, manda al usuario al inicio.
async function protegerPagina() {
  const sesion = await obtenerSesion();
  if (!sesion) {
    window.location.href = 'index.html';
    return null;
  }
  return sesion;
}

// Para la página de inicio (index.html):
// si ya hay sesión, no tiene sentido mostrar el login.
async function redirigirSiHaySesion() {
  const sesion = await obtenerSesion();
  if (sesion) {
    window.location.href = 'app.html';
  }
}