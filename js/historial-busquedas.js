// historial-busquedas.js - ultimas busquedas del buscador
// hereda de Preferencia (preferencias.js tiene que cargarse antes)

class HistorialBusquedas extends Preferencia {
  #maximo;
  #normalizar;

  // por defecto el historial es un array vacio
  // normalizar es la funcion de listado.js para comparar sin tildes ni mayusculas
  constructor(clave, maximo, normalizar) {
    super(clave, []);
    this.#maximo = maximo;
    this.#normalizar = normalizar;
  }


  // el historial se guarda como JSON. si esta roto, leer() del padre devuelve []
  convertir(texto) {
    const guardado = JSON.parse(texto);
    if (!Array.isArray(guardado)) {
      return [];
    }
    return guardado
      .filter((busqueda) => typeof busqueda === 'string')
      .slice(0, this.#maximo);
  }


  aTexto(lista) {
    return JSON.stringify(lista);
  }


  // la pone primera y si ya estaba la saca de donde estaba, asi no se repite
  registrar(texto) {
    const busqueda = texto.trim();
    if (!busqueda) {
      return;
    }

    const normalizada = this.#normalizar(busqueda);
    const sinRepetida = this.leer().filter(
      (anterior) => this.#normalizar(anterior) !== normalizada
    );

    this.guardar([busqueda, ...sinRepetida].slice(0, this.#maximo));
  }


  // las que contienen el texto (con texto vacio devuelve todas)
  filtrar(texto) {
    const textoNormalizado = this.#normalizar(texto.trim());
    return this.leer().filter((busqueda) =>
      this.#normalizar(busqueda).includes(textoNormalizado)
    );
  }
}
