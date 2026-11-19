# Recetas Vivas

Página web para guardar, organizar y compartir recetas de cocina. Pensada para personas con emprendimientos gastronómicos o para quien quiera tener todas sus recetas en un solo lugar, accesibles desde la computadora o el celular.

**Sitio publicado:** https://recetasvivas.vercel.app

Proyecto final del Curso de JavaScript de CapacitarTec.

---

## Funcionalidades (versión 1.0.0)

- **Inicio de sesión con Google.** Cada usuario ve y administra solo sus propias recetas.
- **Recetas completas:** título, descripción, imagen del resultado final, ingredientes (cantidad, unidad y nota) y paso a paso con una imagen opcional por paso.
- **Editar y eliminar** recetas propias (incluidas sus imágenes).
- **Recetas públicas o privadas**, a elección del autor.
- **Buscador por título** que recuerda las búsquedas recientes.
- **Orden** por más recientes o por nombre (A–Z / Z–A).
- **Mi emprendimiento:** nombre, frase corta y logo, que se muestran como portada en "Mis recetas".
- **Modo claro / oscuro**, que respeta la configuración del dispositivo la primera vez.
- Diseño adaptable a celular.

## Cómo usarla

1. Entrar a https://recetasvivas.vercel.app y tocar **Iniciar sesión con Google**.
2. En **Mis recetas**, tocar **+ Nueva receta**, completar los datos y guardar.
3. Tocar una receta para ver el detalle, editarla o eliminarla.
4. En **Editar** (portada) se cargan el nombre, la frase y el logo del emprendimiento.

## Tecnologías

| Parte | Tecnología |
|---|---|
| Frontend | HTML, CSS y JavaScript (sin frameworks ni compilación) |
| Base de datos, login y almacenamiento de imágenes | [Supabase](https://supabase.com) (PostgreSQL, Auth con Google, Storage) |
| Publicación | [Vercel](https://vercel.com), con deploy automático desde la rama `main` |
| Control de versiones | Git y GitHub, con Gitflow |

La seguridad de los datos está en la base: las **políticas RLS** (Row Level Security, seguridad a nivel de fila) de Supabase impiden que un usuario lea o modifique recetas privadas de otro, aunque tenga la clave pública del frontend.

## Estructura del proyecto

```
recetas-vivas/
├── index.html            Inicio de sesión
├── app.html              Mis recetas (listado, buscador, portada)
├── nueva-receta.html     Crear y editar receta
├── receta.html           Detalle de una receta
├── configuracion.html    Datos del emprendimiento
├── privacidad.html       Política de privacidad
├── css/
│   └── styles.css
├── js/
│   ├── config.js               Conexión con Supabase
│   ├── auth.js                 Login, logout y protección de páginas
│   ├── recetas.js              Acceso a datos de recetas
│   ├── listado.js              Página "Mis recetas"
│   ├── nueva-receta.js         Formulario de alta y edición
│   ├── detalle.js              Página de detalle
│   ├── perfil.js               Datos del perfil y emprendimiento
│   ├── configuracion.js        Página "Mi emprendimiento"
│   ├── recorte-logo.js         Recorte y zoom del logo
│   ├── preferencias.js         Preferencias en localStorage (clases)
│   ├── historial-busquedas.js  Búsquedas recientes
│   ├── tema.js                 Modo oscuro
│   └── inicio.js               Página de inicio de sesión
└── supabase/sql/         Scripts de la base de datos
```

## Ejecutarla en forma local

1. Clonar el repositorio y abrir la carpeta en VS Code.
2. Abrir `index.html` con la extensión **Live Server** (puerto `5500`).
3. Las direcciones `http://localhost:5500` y `http://127.0.0.1:5500` ya están habilitadas en Supabase y Google para el login.

Para montar una base de datos nueva, ejecutar en el editor SQL de Supabase, en este orden:

1. `supabase/sql/01_esquema_sprint1.sql` — tablas y triggers
2. `supabase/sql/02_politicas_rls.sql` — políticas de acceso
3. `supabase/sql/03_storage.sql` — almacenamiento de imágenes
4. `supabase/sql/04_perfil_emprendimiento.sql` — datos del emprendimiento

Luego reemplazar `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` en `js/config.js`. La *secret key* de Supabase nunca debe ir en el código.

## Flujo de trabajo (Gitflow)

- `main`: versión publicada. Cada merge a `main` se publica solo en Vercel.
- `develop`: integración de lo terminado.
- `feature/*`: una rama por funcionalidad, que se integra a `develop`.
- `release/*`: preparación de una versión antes de pasar a `main`.
- `hotfix/*`: correcciones urgentes sobre `main`.

## Próximas versiones

- Categorías de recetas definidas por cada usuario.
- Videos del paso a paso y del resultado final.
- Colores de botones personalizados por emprendimiento.

## Autora

Victoria — [github.com/victoria2212](https://github.com/victoria2212)
