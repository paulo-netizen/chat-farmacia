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

  // ⚠️ Solo en desarrollo: permitimos certificados autofirmados globalmente
  // para evitar el error SELF_SIGNED_CERT_IN_CHAIN en tu máquina local.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// 🔰 Pool de PostgreSQL
export const pool = new Pool({
  connectionString,
  // Forzamos SSL, pero al tener NODE_TLS_REJECT_UNAUTHORIZED=0 en dev
  // no fallará por certificados autofirmados.
  ssl: {
    rejectUnauthorized: false,
  },
});
