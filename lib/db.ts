import { Pool } from 'pg';

// Relajamos la verificación de certificados SIEMPRE para este proyecto
// (solo afecta a este proceso de Node, no a todo el sistema).
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

// Usamos variables de entorno: primero SUPABASE_DB_URL y, si no, DATABASE_URL
const connectionString =
  process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('SUPABASE_DB_URL / DATABASE_URL no está definida');
}

console.log('USANDO CADENA DE CONEXIÓN:', connectionString);

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});
