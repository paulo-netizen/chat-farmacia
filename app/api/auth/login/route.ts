import { NextResponse } from 'next/server';
import { createUserToken, getUserByEmailAndPassword } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Faltan credenciales' }, { status: 400 });
    }
    const user = await getUserByEmailAndPassword(email, password);
    if (!user) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
    }
    const token = await createUserToken(user);
    const res = NextResponse.json({ ok: true, user });
    res.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error en el login' }, { status: 500 });
  }
}
