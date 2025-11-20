import { cookies } from 'next/headers';
import * as jose from 'jose';
import { pool } from './db';

const APP_SECRET = process.env.APP_SECRET;

if (!APP_SECRET) {
  throw new Error('APP_SECRET no está definida');
}

const secret = new TextEncoder().encode(APP_SECRET);

export type UserToken = {
  id: number;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  name: string;
};

export async function createUserToken(user: UserToken) {
  const token = await new jose.SignJWT(user)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret);
  return token;
}

export async function getCurrentUser(): Promise<UserToken | null> {
  const cookieStore = cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return payload as UserToken;
  } catch {
    return null;
  }
}

/**
 * Función usada por las APIs (como /api/sessions) para obtener
 * el usuario autenticado a partir de la cookie.
 * De momento simplemente reutiliza getCurrentUser.
 */
export async function getUserFromRequest(_req?: Request): Promise<UserToken | null> {
  return getCurrentUser();
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHENTICATED');
  }
  return user;
}

export async function getUserByEmailAndPassword(email: string, password: string) {
  const result = await pool.query(
    `select id, email, name, role
     from users
     where email = $1 and password_hash = crypt($2, password_hash)`,
    [email, password]
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id as number,
    email: row.email as string,
    name: row.name as string,
    role: row.role as 'student' | 'teacher' | 'admin',
  };
}
