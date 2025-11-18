import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat Atención Farmacéutica',
  description: 'Paciente virtual para entrenar Atención Farmacéutica',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen" style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
          <header style={{ marginBottom: 24, borderBottom: '1px solid #cbd5f5', paddingBottom: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>Chat de Atención Farmacéutica</h1>
            <p style={{ fontSize: 13, color: '#64748b' }}>
              Simulación de entrevista con paciente virtual
            </p>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
