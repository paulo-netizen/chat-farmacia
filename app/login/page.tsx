'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('alumno001@demo.local');
  const [password, setPassword] = useState('Alumno123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Error en el login');
      } else {
        router.push('/chat');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '32px auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Iniciar sesión</h2>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
            Correo electrónico
          </label>
          <input
            type="email"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #cbd5f5' }}
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
            Contraseña
          </label>
          <input
            type="password"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #cbd5f5' }}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p style={{ fontSize: 13, color: '#dc2626' }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '8px 12px',
            borderRadius: 4,
            border: 'none',
            backgroundColor: '#2563eb',
            color: 'white',
            fontWeight: 500,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        <p style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
          Ejemplo alumno: alumno001@demo.local / Alumno123!<br />
          Ejemplo profesor: profesor@demo.local / Profe123!
        </p>
      </form>
    </div>
  );
}
