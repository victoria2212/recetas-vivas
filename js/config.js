// =====================================================================
// config.js · Conexión con Supabase
// Se carga en TODAS las páginas, después de la librería de Supabase.
// =====================================================================

// Dirección de su backend (Project URL).
const SUPABASE_URL = 'https://oboqtbtqtyytckrryktq.supabase.co';

// Clave pública (publishable key). Es seguro que esté en el frontend:
// lo que protege los datos son las políticas RLS, no esta clave.
// NUNCA poner aquí la secret key.
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_dkOYno-Y3wc7_rUxBMyjSQ_gHKbS7Rl';

// La librería cargada por CDN crea la variable global "supabase".
// Con ella se crea el cliente: el objeto que usan todas las demás
// funciones para hablar con la base de datos, Auth y Storage.
// Se llama supabaseClient para no pisar la variable global "supabase".
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);