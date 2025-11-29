// lib/db.ts
import { Pool } from 'pg';

const connectionString =
  process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('SUPABASE_DB_URL / DATABASE_URL no está definida');
}

// 🔐 Log más seguro: solo en desarrollo y sin credenciales
if (process.env.NODE_ENV !== 'production') {
  const safe = connectionString.replace(/:\/\/[^@]+@/, '://***@');
  console.log('USANDO CADENA DE CONEXIÓN:', safe);
}

// 🔰 Pool de PostgreSQL
export const pool = new Pool({
  connectionString,
  ssl: {
    // Pedimos SSL, pero la verificación global la vamos a controlar
    // con la variable de entorno NODE_TLS_REJECT_UNAUTHORIZED.
    rejectUnauthorized: false,
  },
});
