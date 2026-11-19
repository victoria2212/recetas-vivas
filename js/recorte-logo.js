// recorte-logo.js - editor para acomodar el logo antes de subirlo (como en instagram)
// el logo se dibuja en un canvas y lo que se ve en el circulo es lo que se guarda

class RecorteLogo {

  // static: son de la clase, se usan como RecorteLogo.LADO
  static LADO = 400;
  static PASO_TECLADO = 10;

  // todo lo interno es privado
  #canvas;
  #contexto;
  #barraZoom;
  #imagen = null;
  #colorFondo = null;
  #desplazamiento = { x: 0, y: 0 };
  #arrastre = null;


  constructor(canvas, barraZoom) {
    this.#canvas = canvas;
    this.#canvas.width = RecorteLogo.LADO;
    this.#canvas.height = RecorteLogo.LADO;
    this.#contexto = canvas.getContext('2d');
    this.#barraZoom = barraZoom;
    this.#conectarEventos();
  }


  // get y set: se usan como propiedad (recorte.zoom = 2)
  // el set no deja pasarse del min y max de la barra
  get zoom() {
    return Number(this.#barraZoom.value);
  }

  set zoom(valor) {
    const minimo = Number(this.#barraZoom.min);
    const maximo = Number(this.#barraZoom.max);
    this.#barraZoom.value = Math.max(minimo, Math.min(maximo, valor));
    this.#dibujar();
  }

  // solo lectura, no tiene set
  get tieneImagen() {
    return this.#imagen !== null;
  }


  // decode() espera a que la imagen termine de cargar antes de dibujarla
  async cargar(archivo) {
    const imagen = new Image();
    imagen.src = URL.createObjectURL(archivo);
    await imagen.decode();
    URL.revokeObjectURL(imagen.src);

    this.#imagen = imagen;
    this.#colorFondo = this.#leerColorDelBorde(imagen);
    this.centrar();
  }


  // vuelve al tamaño 1 y al centro
  centrar() {
    this.#desplazamiento = { x: 0, y: 0 };
    this.zoom = 1;
  }


  // por si cancela la eleccion del archivo
  descartar() {
    this.#imagen = null;
    this.#contexto.clearRect(0, 0, RecorteLogo.LADO, RecorteLogo.LADO);
  }


  // convierte el canvas en un png. toBlob usa callback, por eso lo envuelvo en una promesa
  obtenerArchivo() {
    return new Promise((resolver, rechazar) => {
      this.#canvas.toBlob((blob) => {
        if (!blob) {
          rechazar(new Error('No se pudo preparar la imagen del logo.'));
          return;
        }
        resolver(new File([blob], 'logo.png', { type: 'image/png' }));
      }, 'image/png');
    });
  }


  // color de la esquina del logo, para pintar lo que sobra del circulo
  // si es transparente devuelve null
  #leerColorDelBorde(imagen) {
    const auxiliar = document.createElement('canvas');
    auxiliar.width = 1;
    auxiliar.height = 1;
    const contexto = auxiliar.getContext('2d');
    contexto.drawImage(imagen, 0, 0, 1, 1, 0, 0, 1, 1);

    const [r, g, b, alfa] = contexto.getImageData(0, 0, 1, 1).data;
    return alfa < 255 ? null : `rgb(${r}, ${g}, ${b})`;
  }


  // con zoom 1 el logo entra entero, el zoom lo agranda hasta 4 veces
  #dibujar() {
    if (!this.#imagen) {
      return;
    }

    const lado = RecorteLogo.LADO;
    const escalaBase = lado / Math.max(this.#imagen.width, this.#imagen.height);
    const ancho = this.#imagen.width * escalaBase * this.zoom;
    const alto = this.#imagen.height * escalaBase * this.zoom;

    this.#contexto.clearRect(0, 0, lado, lado);
    if (this.#colorFondo) {
      this.#contexto.fillStyle = this.#colorFondo;
      this.#contexto.fillRect(0, 0, lado, lado);
    }

    const x = (lado - ancho) / 2 + this.#desplazamiento.x;
    const y = (lado - alto) / 2 + this.#desplazamiento.y;
    this.#contexto.drawImage(this.#imagen, x, y, ancho, alto);
  }


  // el limite es para que no se pueda sacar la imagen del todo
  #mover(dx, dy) {
    const limite = RecorteLogo.LADO / 2;
    this.#desplazamiento.x = Math.max(-limite, Math.min(limite, this.#desplazamiento.x + dx));
    this.#desplazamiento.y = Math.max(-limite, Math.min(limite, this.#desplazamiento.y + dy));
    this.#dibujar();
  }


  // pointer events sirven para mouse y para el dedo en el celu
  #conectarEventos() {
    this.#canvas.addEventListener('pointerdown', (evento) => {
      this.#canvas.setPointerCapture(evento.pointerId);
      this.#arrastre = { x: evento.clientX, y: evento.clientY };
    });
    this.#canvas.addEventListener('pointermove', (evento) => this.#continuarArrastre(evento));
    this.#canvas.addEventListener('pointerup', () => { this.#arrastre = null; });
    this.#canvas.addEventListener('pointercancel', () => { this.#arrastre = null; });
    this.#canvas.addEventListener('keydown', (evento) => this.#moverConTeclado(evento));
    this.#barraZoom.addEventListener('input', () => this.#dibujar());
  }


  // el canvas mide 400 pero se ve de 200, por eso la proporcion
  #continuarArrastre(evento) {
    if (!this.#arrastre) {
      return;
    }

    const proporcion = RecorteLogo.LADO / this.#canvas.getBoundingClientRect().width;
    this.#mover(
      (evento.clientX - this.#arrastre.x) * proporcion,
      (evento.clientY - this.#arrastre.y) * proporcion
    );
    this.#arrastre = { x: evento.clientX, y: evento.clientY };
  }


  // flechas del teclado. preventDefault para que no se mueva la pagina
  #moverConTeclado(evento) {
    const paso = RecorteLogo.PASO_TECLADO;
    const direcciones = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] };
    const direccion = direcciones[evento.key];
    if (direccion) {
      evento.preventDefault();
      this.#mover(direccion[0], direccion[1]);
    }
  }
}
