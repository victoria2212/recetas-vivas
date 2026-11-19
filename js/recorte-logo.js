
// js/recorte-logo.js · Clase RecorteLogo
//
// Permite ENCUADRAR el logo antes de subirlo, como al cambiar la foto
// de perfil en Instagram o LinkedIn: el usuario lo mueve arrastrando y
// lo agranda o achica con una barra.
//
// Cómo funciona: la imagen se dibuja en un <canvas> (un "lienzo" donde
// JavaScript puede pintar). Lo que se ve en el círculo es EXACTAMENTE lo
// que se guarda: al final, el contenido del lienzo se convierte en un
// archivo PNG cuadrado y ese archivo es el que se sube.
//
// Si el logo queda más chico que el círculo, el espacio que sobra se
// pinta con el color del borde de la imagen (por ejemplo, el fondo
// crema de un logo), así no quedan bordes vacíos.
//
// Uso (ver configuracion.js):
//   const recorte = new RecorteLogo(canvas, barraZoom);
//   await recorte.cargar(archivo);       → muestra la imagen
//   const archivo = await recorte.obtenerArchivo();  → el PNG final


class RecorteLogo {

  // canvas    → el <canvas> donde se dibuja.
  // barraZoom → el <input type="range"> del tamaño.
  constructor(canvas, barraZoom) {
    this.canvas = canvas;
    this.contexto = canvas.getContext('2d'); // el "pincel" del lienzo
    this.barraZoom = barraZoom;
    this.imagen = null;         // la imagen cargada
    this.colorFondo = null;     // color para el espacio que sobra (o null = transparente)
    this.desplazamiento = { x: 0, y: 0 };
    this.arrastre = null;       // datos del arrastre en curso

    this.conectarEventos();
  }


  // Carga el archivo elegido y lo dibuja centrado y entero.
  // await imagen.decode() espera a que el navegador termine de leer la
  // imagen antes de dibujarla.
  async cargar(archivo) {
    const imagen = new Image();
    imagen.src = URL.createObjectURL(archivo);
    await imagen.decode();
    URL.revokeObjectURL(imagen.src); // ya no hace falta la dirección temporal

    this.imagen = imagen;
    this.colorFondo = this.leerColorDelBorde(imagen);
    this.centrar();
  }


  // Vuelve al encuadre inicial: tamaño 1 (el logo entero) y centrado.
  centrar() {
    this.barraZoom.value = 1;
    this.desplazamiento = { x: 0, y: 0 };
    this.dibujar();
  }


  // Devuelve el color del píxel de la esquina superior izquierda, como
  // texto "rgb(r, g, b)". Si es transparente (logos PNG sin fondo),
  // devuelve null y el espacio que sobra queda transparente.
  // Para leer un píxel hay que dibujar la imagen en un lienzo auxiliar.
  leerColorDelBorde(imagen) {
    const auxiliar = document.createElement('canvas');
    auxiliar.width = 1;
    auxiliar.height = 1;
    const contexto = auxiliar.getContext('2d');
    contexto.drawImage(imagen, 0, 0, 1, 1, 0, 0, 1, 1);

    const [r, g, b, alfa] = contexto.getImageData(0, 0, 1, 1).data;
    return alfa < 255 ? null : `rgb(${r}, ${g}, ${b})`;
  }


  // Dibuja la imagen en el lienzo según el tamaño y el desplazamiento.
  // escalaBase hace que, con tamaño 1, el logo ENTERO entre en el lienzo;
  // la barra lo multiplica (hasta 4 veces más grande).
  dibujar() {
    if (!this.imagen) {
      return;
    }

    const lado = this.canvas.width;
    const escalaBase = lado / Math.max(this.imagen.width, this.imagen.height);
    const escala = escalaBase * Number(this.barraZoom.value);
    const ancho = this.imagen.width * escala;
    const alto = this.imagen.height * escala;

    this.contexto.clearRect(0, 0, lado, lado);
    if (this.colorFondo) {
      this.contexto.fillStyle = this.colorFondo;
      this.contexto.fillRect(0, 0, lado, lado);
    }

    // Esquina donde empieza la imagen: centrada + lo que se movió.
    const x = (lado - ancho) / 2 + this.desplazamiento.x;
    const y = (lado - alto) / 2 + this.desplazamiento.y;
    this.contexto.drawImage(this.imagen, x, y, ancho, alto);
  }


  // Mueve la imagen dx, dy píxeles del lienzo y la vuelve a dibujar.
  // Math.min/Math.max la limitan para que no se pueda sacar del todo.
  mover(dx, dy) {
    const limite = this.canvas.width / 2;
    this.desplazamiento.x = Math.max(-limite, Math.min(limite, this.desplazamiento.x + dx));
    this.desplazamiento.y = Math.max(-limite, Math.min(limite, this.desplazamiento.y + dy));
    this.dibujar();
  }


  // Conecta el arrastre (mouse y dedo), las flechas del teclado y la barra.
  // Los "pointer events" (pointerdown, pointermove, pointerup) funcionan
  // igual con mouse y con el dedo en el celular.
  conectarEventos() {
    this.canvas.addEventListener('pointerdown', (evento) => this.empezarArrastre(evento));
    this.canvas.addEventListener('pointermove', (evento) => this.continuarArrastre(evento));
    this.canvas.addEventListener('pointerup', () => this.terminarArrastre());
    this.canvas.addEventListener('pointercancel', () => this.terminarArrastre());
    this.canvas.addEventListener('keydown', (evento) => this.moverConTeclado(evento));
    this.barraZoom.addEventListener('input', () => this.dibujar());
  }


  // setPointerCapture: el lienzo sigue recibiendo el movimiento aunque
  // el puntero salga del círculo mientras se arrastra.
  empezarArrastre(evento) {
    this.canvas.setPointerCapture(evento.pointerId);
    this.arrastre = { x: evento.clientX, y: evento.clientY };
  }


  // El lienzo se ve más chico de lo que mide por dentro (se ve de 200px
  // pero tiene 400px). proporcion convierte los píxeles de la pantalla
  // en píxeles del lienzo, para que la imagen siga al dedo.
  continuarArrastre(evento) {
    if (!this.arrastre) {
      return;
    }

    const proporcion = this.canvas.width / this.canvas.getBoundingClientRect().width;
    this.mover(
      (evento.clientX - this.arrastre.x) * proporcion,
      (evento.clientY - this.arrastre.y) * proporcion
    );
    this.arrastre = { x: evento.clientX, y: evento.clientY };
  }


  terminarArrastre() {
    this.arrastre = null;
  }


  // Con el lienzo seleccionado (Tab), las flechas mueven la imagen.
  // preventDefault evita que la página se desplace con las flechas.
  moverConTeclado(evento) {
    const pasos = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
    const paso = pasos[evento.key];
    if (paso) {
      evento.preventDefault();
      this.mover(paso[0], paso[1]);
    }
  }


  // Convierte lo que se ve en el lienzo en un archivo PNG.
  // toBlob es asíncrono y avisa con una función (callback); new Promise
  // lo "envuelve" para poder usarlo con await.
  obtenerArchivo() {
    return new Promise((resolver, rechazar) => {
      this.canvas.toBlob((blob) => {
        if (!blob) {
          rechazar(new Error('No se pudo preparar la imagen del logo.'));
          return;
        }
        resolver(new File([blob], 'logo.png', { type: 'image/png' }));
      }, 'image/png');
    });
  }
}
