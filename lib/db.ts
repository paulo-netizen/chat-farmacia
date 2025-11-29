// lib/db.ts
import { Pool } from 'pg';

// ⚠️ Relajamos la verificación de certificados SIEMPRE para este proyecto.
// Esto evita el error SELF_SIGNED_CERT_IN_CHAIN tanto en local como en Render.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

export const pool = new Pool({
  connectionString,
  ssl: {
    // Igual que antes, pero ahora sabemos seguro que no fallará por certificados
    rejectUnauthorized: false,
  },
});
