// vistas.js - partes de la pagina que usan varias paginas
// (la tarjeta de una receta y el logo del emprendimiento)
// solo arman html, no hablan con supabase


// tarjeta que lleva al detalle de la receta
// urlImagen puede venir vacia: en ese caso muestra "Sin imagen"
// conEtiqueta: en el perfil publico no hace falta, todas son publicas
function crearTarjeta(receta, urlImagen, conEtiqueta = true) {
  const tarjeta = document.createElement('a');
  tarjeta.className = 'tarjeta-receta';
  tarjeta.href = `receta.html?id=${encodeURIComponent(receta.id)}`;

  tarjeta.appendChild(crearImagenTarjeta(receta, urlImagen));
  tarjeta.appendChild(crearCuerpoTarjeta(receta, conEtiqueta));
  return tarjeta;
}


function crearImagenTarjeta(receta, urlImagen) {
  if (!urlImagen) {
    const sinImagen = document.createElement('div');
    sinImagen.className = 'sin-imagen';
    sinImagen.textContent = 'Sin imagen';
    return sinImagen;
  }

  const imagen = document.createElement('img');
  imagen.src = urlImagen;
  imagen.alt = receta.titulo;
  imagen.loading = 'lazy';
  return imagen;
}


function crearCuerpoTarjeta(receta, conEtiqueta) {
  const cuerpo = document.createElement('div');
  cuerpo.className = 'cuerpo-tarjeta';

  if (conEtiqueta) {
    const etiqueta = document.createElement('span');
    etiqueta.className = receta.es_publica ? 'etiqueta publica' : 'etiqueta privada';
    etiqueta.textContent = receta.es_publica ? 'Pública' : 'Privada';
    cuerpo.appendChild(etiqueta);
  }

  const titulo = document.createElement('h2');
  titulo.textContent = receta.titulo;
  cuerpo.appendChild(titulo);

  if (receta.descripcion) {
    const descripcion = document.createElement('p');
    descripcion.textContent = receta.descripcion;
    cuerpo.appendChild(descripcion);
  }

  return cuerpo;
}


// dibuja el logo dentro del circulo; sin logo muestra la inicial del nombre
function dibujarLogo(contenedor, perfil) {
  contenedor.replaceChildren();

  const nombre = perfil.nombre_emprendimiento || perfil.nombre || '';
  const url = obtenerUrlDelLogo(perfil.logo);

  if (url) {
    const imagen = document.createElement('img');
    imagen.src = url;
    imagen.alt = 'Logo de ' + (nombre || 'el emprendimiento');
    contenedor.appendChild(imagen);
    return;
  }

  contenedor.textContent = nombre.charAt(0).toUpperCase();
}
