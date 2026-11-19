
// js/tema.js · Modo oscuro
//
// El tema se marca en la etiqueta <html> con un atributo:
//   <html data-tema="oscuro">  o  <html data-tema="claro">
// styles.css cambia los colores según ese atributo (variables CSS).
//
// Se recuerda con localStorage. La primera vez, si el usuario no eligió
// nada, se usa el tema de su computadora o celular.
//
// Requiere: preferencias.js (cargado antes).


const CLAVE_TEMA = 'recetas-vivas:tema';
const botonTema = document.getElementById('btn-tema');


// Devuelve el tema con el que arranca la página: el guardado o, si no
// hay ninguno válido, el del sistema.
// matchMedia pregunta al navegador si el sistema está en modo oscuro.
function temaInicial() {
  const guardado = leerPreferencia(CLAVE_TEMA, null);
  if (guardado === 'claro' || guardado === 'oscuro') {
    return guardado;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}


// Aplica un tema: lo marca en <html> y actualiza el botón.
// aria-pressed le indica a los lectores de pantalla si el modo oscuro
// está activado (true) o no (false).
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema; // dataset.tema = atributo data-tema
  botonTema.setAttribute('aria-pressed', String(tema === 'oscuro'));
}


// Al tocar el botón: pasa al otro tema y lo guarda.
function alternarTema() {
  const temaNuevo = document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
  aplicarTema(temaNuevo);
  guardarPreferencia(CLAVE_TEMA, temaNuevo);
}


aplicarTema(temaInicial());
botonTema.addEventListener('click', alternarTema);
