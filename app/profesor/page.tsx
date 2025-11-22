import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { pool } from '@/lib/db';

type ProfessorRow = {
  session_id: string;
  student_email: string;
  student_name: string | null;
  case_title: string;
  started_at: string | null;
  finished_at: string | null;
  score: number | null;
  feedback: string | null;
};

async function getProfessorData(): Promise<ProfessorRow[]> {
  const result = await pool.query(
    `
    SELECT
      s.id AS session_id,
      u.email AS student_email,
      u.name AS student_name,
      c.title AS case_title,
      s.started_at,
      s.finished_at,
      e.score,
      e.feedback
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    JOIN cases c ON s.case_id = c.id
    LEFT JOIN evaluations e ON e.session_id = s.id
    WHERE s.status = 'finished'
    ORDER BY s.finished_at DESC NULLS LAST
    LIMIT 50;
    `
  );

  return result.rows;
}

export default async function ProfessorPage() {
  // 1) Comprobar que el usuario está logueado
  const user = await requireUser();

  // 2) Restringir a teacher / admin
  if (user.role !== 'teacher' && user.role !== 'admin') {
    redirect('/'); // o /login si prefieres
  }

  // 3) Cargar datos de sesiones + evaluaciones
  const rows = await getProfessorData();

  return (
    <main
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '24px 16px 48px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
        Panel del profesor
      </h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>
        Resumen de las últimas sesiones realizadas por los alumnos. Se muestran
        solo las sesiones marcadas como finalizadas.
      </p>

      <div
        style={{
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          backgroundColor: 'white',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
          }}
        >
          <thead style={{ backgroundColor: '#f8fafc' }}>
            <tr>
              <th style={thStyle}>Alumno</th>
              <th style={thStyle}>Caso</th>
              <th style={thStyle}>Inicio</th>
              <th style={thStyle}>Fin</th>
              <th style={thStyle}>Puntuación</th>
              <th style={thStyle}>Feedback</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                  Todavía no hay sesiones finalizadas.
                </td>
              </tr>
            )}

            {rows.map((row) => (
              <tr key={row.session_id} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 500 }}>
                    {row.student_name || '(sin nombre)'}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>
                    {row.student_email}
                  </div>
                </td>
                <td style={tdStyle}>{row.case_title}</td>
                <td style={tdStyle}>
                  {row.started_at
                    ? new Date(row.started_at).toLocaleString('es-ES')
                    : '-'}
                </td>
                <td style={tdStyle}>
                  {row.finished_at
                    ? new Date(row.finished_at).toLocaleString('es-ES')
                    : '-'}
                </td>
                <td style={tdStyle}>
                  {row.score !== null ? `${row.score} / 3` : 'Sin evaluación'}
                </td>
                <td style={{ ...tdStyle, maxWidth: 280 }}>
                  <span style={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                    {row.feedback || '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

// Estilos compartidos para la tabla
const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  borderBottom: '1px solid #e5e7eb',
  fontWeight: 500,
  color: '#4b5563',
  fontSize: 12,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'top',
};
