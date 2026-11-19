
// js/preferencias.js · Guardar y leer preferencias en localStorage
//
// Lo usan varias páginas: el modo oscuro (todas), y el orden, la
// búsqueda y el historial del listado.
//
// localStorage puede fallar (por ejemplo, en navegación privada o con
// el almacenamiento lleno). Por eso cada acceso va dentro de un
// try/catch: si falla, la preferencia no se guarda pero la página
// sigue funcionando.


// Guarda un valor (texto) con una clave.
function guardarPreferencia(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch (error) {
    console.warn('No se pudo guardar la preferencia ' + clave + ':', error);
  }
}


// Devuelve el valor guardado con esa clave. Si no hay nada guardado
// (o localStorage falla), devuelve valorPorDefecto.
// ?? usa el valor de la derecha solo si el de la izquierda es null.
function leerPreferencia(clave, valorPorDefecto) {
  try {
    return localStorage.getItem(clave) ?? valorPorDefecto;
  } catch (error) {
    console.warn('No se pudo leer la preferencia ' + clave + ':', error);
    return valorPorDefecto;
  }
}


// Borra la preferencia guardada con esa clave.
function borrarPreferencia(clave) {
  try {
    localStorage.removeItem(clave);
  } catch (error) {
    console.warn('No se pudo borrar la preferencia ' + clave + ':', error);
  }
}
