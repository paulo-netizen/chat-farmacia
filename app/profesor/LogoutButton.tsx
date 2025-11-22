'use client';

export default function LogoutButton() {
  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // aunque falle, intentamos redirigir igual
    } finally {
      window.location.href = '/login';
    }
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        fontSize: 13,
        color: '#dc2626',
        border: '1px solid #fecaca',
        padding: '6px 10px',
        borderRadius: 4,
        backgroundColor: 'white',
        cursor: 'pointer',
      }}
    >
      Cerrar sesión
    </button>
  );
}
