// tema.js - modo oscuro
// pone data-tema="oscuro" o "claro" en <html> y el css cambia las variables de colores

const preferenciaTema = new PreferenciaOpcion('recetas-vivas:tema', ['claro', 'oscuro'], null);
const botonTema = document.getElementById('btn-tema');


// si nunca eligio, uso el tema del sistema (compu o celu)
function temaInicial() {
  const delSistema = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  return preferenciaTema.leer() ?? delSistema;
}


// aria-pressed es para lectores de pantalla
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  botonTema.setAttribute('aria-pressed', String(tema === 'oscuro'));
}


function alternarTema() {
  const temaNuevo = document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
  aplicarTema(temaNuevo);
  preferenciaTema.guardar(temaNuevo);
}


aplicarTema(temaInicial());
botonTema.addEventListener('click', alternarTema);
