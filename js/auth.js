// auth.js - login con google y manejo de la sesion
// usa supabaseClient de config.js

// abre el login de google. cuando termina, supabase vuelve a app.html
// (esa url tiene que estar en Redirect URLs de supabase)
async function iniciarSesionConGoogle() {
  // arma la url completa de app.html a partir de la pagina actual
  const destino = new URL('app.html', window.location.href).href;

  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: destino }
  });

  if (error) {
    throw error;
  }
}

// cierra sesion y vuelve al inicio
async function cerrarSesion() {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
}

// devuelve la sesion o null si no hay nadie logueado
async function obtenerSesion() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

// para las paginas privadas: si no hay sesion manda al inicio
async function protegerPagina() {
  const sesion = await obtenerSesion();
  if (!sesion) {
    window.location.href = 'index.html';
    return null;
  }
  return sesion;
}

// en el inicio: si ya esta logueado no tiene sentido mostrar el login
async function redirigirSiHaySesion() {
  const sesion = await obtenerSesion();
  if (sesion) {
    window.location.href = 'app.html';
  }
}