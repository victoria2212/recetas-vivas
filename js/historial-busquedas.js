
// js/historial-busquedas.js · Clase HistorialBusquedas
//
// Una CLASE es un molde para crear objetos que juntan datos y las
// funciones que trabajan con esos datos (los métodos).
// Esta clase se encarga solo de GUARDAR y LEER las últimas búsquedas en
// localStorage. Dibujar la lista en la página lo hace listado.js.
//
// Uso:
//   const historial = new HistorialBusquedas('clave', 5, normalizarTexto);
//   historial.registrar('pan');      → la guarda primera
//   historial.leer();                → ['pan', ...]
//   historial.filtrar('pa');         → las que contienen "pa"
//   historial.borrar();              → lo vacía
//
// Requiere: preferencias.js (cargado antes).


class HistorialBusquedas {

  // El constructor se ejecuta al hacer "new HistorialBusquedas(...)".
  // clave      → con qué nombre se guarda en localStorage.
  // maximo     → cuántas búsquedas se recuerdan.
  // normalizar → función para comparar textos sin mayúsculas ni tildes
  //              ("Budín" y "budin" cuentan como la misma búsqueda).
  // this es el objeto que se está creando: cada dato se guarda en él.
  constructor(clave, maximo, normalizar) {
    this.clave = clave;
    this.maximo = maximo;
    this.normalizar = normalizar;
  }


  // Devuelve el array de búsquedas, de la más nueva a la más vieja.
  // localStorage solo guarda TEXTO: el array se guarda como JSON y acá
  // se convierte de nuevo con JSON.parse. Si lo guardado está roto o no
  // es un array de textos, se arranca con el historial vacío.
  leer() {
    try {
      const guardado = JSON.parse(leerPreferencia(this.clave, '[]'));
      if (!Array.isArray(guardado)) {
        return [];
      }
      return guardado
        .filter((busqueda) => typeof busqueda === 'string')
        .slice(0, this.maximo);
    } catch (error) {
      console.warn('El historial guardado no es válido; se ignora:', error);
      return [];
    }
  }


  // Agrega una búsqueda al principio. Si ya estaba, la saca de su lugar
  // (para que no se repita) y la pone primera. Deja solo las últimas.
  registrar(texto) {
    const busqueda = texto.trim();
    if (!busqueda) {
      return;
    }

    const normalizada = this.normalizar(busqueda);
    const sinRepetida = this.leer().filter(
      (anterior) => this.normalizar(anterior) !== normalizada
    );

    const historial = [busqueda, ...sinRepetida].slice(0, this.maximo);
    guardarPreferencia(this.clave, JSON.stringify(historial));
  }


  // Devuelve solo las búsquedas que contienen el texto.
  // Con el texto vacío, includes('') es true: devuelve todas.
  filtrar(texto) {
    const textoNormalizado = this.normalizar(texto.trim());
    return this.leer().filter((busqueda) =>
      this.normalizar(busqueda).includes(textoNormalizado)
    );
  }


  // Borra todo el historial.
  borrar() {
    borrarPreferencia(this.clave);
  }
}
