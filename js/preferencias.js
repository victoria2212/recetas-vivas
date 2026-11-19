// preferencias.js - cosas que se guardan en localStorage
// (ultima busqueda, tema, orden e historial)
//
// Preferencia es la clase padre: leer, guardar y borrar estan una sola vez aca.
// las hijas (PreferenciaOpcion y HistorialBusquedas) solo cambian convertir()
// y aTexto(), asi cada una lee lo guardado a su manera (polimorfismo)

class Preferencia {
  // privados (#): solo se usan adentro de la clase
  #clave;
  #valorPorDefecto;

  constructor(clave, valorPorDefecto) {
    this.#clave = clave;
    this.#valorPorDefecto = valorPorDefecto;
  }


  // getter para que las clases hijas puedan leerlo (el # no se hereda)
  get valorPorDefecto() {
    return this.#valorPorDefecto;
  }


  // si localStorage falla o lo guardado esta roto, devuelve el valor por defecto
  leer() {
    try {
      const texto = localStorage.getItem(this.#clave);
      return texto === null ? this.#valorPorDefecto : this.convertir(texto);
    } catch (error) {
      console.warn('No se pudo leer la preferencia ' + this.#clave + ':', error);
      return this.#valorPorDefecto;
    }
  }


  // localStorage solo guarda texto, por eso pasa por aTexto()
  guardar(valor) {
    try {
      localStorage.setItem(this.#clave, this.aTexto(valor));
    } catch (error) {
      console.warn('No se pudo guardar la preferencia ' + this.#clave + ':', error);
    }
  }


  borrar() {
    try {
      localStorage.removeItem(this.#clave);
    } catch (error) {
      console.warn('No se pudo borrar la preferencia ' + this.#clave + ':', error);
    }
  }


  // estas dos las sobrescriben las hijas
  convertir(texto) {
    return texto;
  }


  aTexto(valor) {
    return String(valor);
  }
}


// preferencia que solo acepta ciertos valores (tema y orden)
// si lo guardado no es una opcion valida usa el valor por defecto
class PreferenciaOpcion extends Preferencia {
  #opciones;

  constructor(clave, opciones, valorPorDefecto) {
    // super llama al constructor del padre, va antes de usar this
    super(clave, valorPorDefecto);
    this.#opciones = opciones;
  }


  convertir(texto) {
    return this.#opciones.includes(texto) ? texto : this.valorPorDefecto;
  }
}
