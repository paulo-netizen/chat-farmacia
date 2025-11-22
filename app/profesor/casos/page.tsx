import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { pool } from '@/lib/db';

type CaseRow = {
  id: number;
  title: string;
  status: string;
  service_type: string | null;
  difficulty: number | null;
  created_at: string;
};

export const dynamic = 'force-dynamic';

export default async function ProfesorCasosPage() {
  const user = await requireUser();

  // Solo profesor o admin
  if (user.role === 'student') {
    redirect('/chat');
  }

  const { rows } = await pool.query(`
    SELECT id, title, status, service_type, difficulty, created_at
    FROM cases
    ORDER BY id ASC
  `);

  const cases = rows as CaseRow[];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          Chat de Atención Farmacéutica
        </h1>
        <p style={{ fontSize: 13, color: '#64748b' }}>
          Panel del profesor – gestión básica de casos disponibles para los alumnos.
        </p>

        {/* Pequeña navegación entre secciones del panel */}
        <nav
          style={{
            marginTop: 12,
            display: 'flex',
            gap: 12,
            fontSize: 14,
          }}
        >
          <Link href="/profesor">Sesiones</Link>
          <span style={{ color: '#94a3b8' }}>|</span>
          <span style={{ fontWeight: 600 }}>Casos</span>
        </nav>
      </header>

      <section
        style={{
          borderRadius: 8,
          padding: 16,
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Casos clínicos en la base de datos
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
          Aquí ves todos los casos que el sistema puede asignar a los alumnos. Más
          adelante añadiremos creación/edición e integración con IA.
        </p>

        {cases.length === 0 ? (
          <p style={{ fontSize: 13 }}>No hay casos registrados todavía.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Título</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Servicio</th>
                  <th style={thStyle}>Dificultad</th>
                  <th style={thStyle}>Creado</th>
                </tr>
              </thead>
              <tbody>
                {cases.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={tdStyle}>{c.id}</td>
                    <td style={tdStyle}>{c.title}</td>
                    <td style={tdStyle}>{c.status}</td>
                    <td style={tdStyle}>{c.service_type ?? '-'}</td>
                    <td style={tdStyle}>{c.difficulty ?? '-'}</td>
                    <td style={tdStyle}>
                      {new Date(c.created_at).toLocaleString('es-ES', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  borderBottom: '1px solid #e2e8f0',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 8px',
  verticalAlign: 'top',
};
