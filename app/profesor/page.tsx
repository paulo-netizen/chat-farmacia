import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

type ProfessorRow = {
  session_id: string;
  student_name: string;
  student_email: string;
  case_title: string;
  started_at: string | null;
  finished_at: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_eur: string | null;
  score: number | null;
  feedback: string | null;
};

async function getProfessorRows(): Promise<ProfessorRow[]> {
  const result = await pool.query(
    `
    SELECT
      s.id AS session_id,
      u.name AS student_name,
      u.email AS student_email,
      c.title AS case_title,
      s.started_at,
      s.finished_at,
      s.prompt_tokens,
      s.completion_tokens,
      s.cost_eur,
      e.score,
      e.feedback
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN cases c ON c.id = s.case_id
    LEFT JOIN evaluations e ON e.session_id = s.id
    WHERE s.status = 'finished'
    ORDER BY s.finished_at DESC NULLS LAST
    LIMIT 100
    `
  );

  return result.rows as ProfessorRow[];
}

export default async function ProfessorPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (user.role !== 'teacher' && user.role !== 'admin') {
    // Si algún alumno intenta entrar aquí, lo mandamos al chat
    redirect('/chat');
  }

  const rows = await getProfessorRows();

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
          Panel del profesor
        </h1>
        <p style={{ fontSize: 14, color: '#64748b' }}>
          Resumen de casos realizados por los alumnos (últimas 100 sesiones finalizadas).
        </p>
      </div>

      <div
        style={{
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          backgroundColor: 'white',
          padding: 12,
          overflowX: 'auto',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <th style={thStyle}>Alumno</th>
              <th style={thStyle}>Correo</th>
              <th style={thStyle}>Caso</th>
              <th style={thStyle}>Inicio</th>
              <th style={thStyle}>Fin</th>
              <th style={thStyle}>Tokens (P/C/T)</th>
              <th style={thStyle}>Coste (€)</th>
              <th style={thStyle}>Nota</th>
              <th style={thStyle}>Feedback</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 12, textAlign: 'center', color: '#64748b' }}>
                  Aún no hay sesiones finalizadas.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const started =
                  row.started_at ? new Date(row.started_at).toLocaleString('es-ES') : '-';
                const finished =
                  row.finished_at ? new Date(row.finished_at).toLocaleString('es-ES') : '-';

                const prompt = row.prompt_tokens ?? 0;
                const completion = row.completion_tokens ?? 0;
                const totalTokens = prompt + completion;

                const cost =
                  row.cost_eur != null
                    ? Number(row.cost_eur).toFixed(4) // 0.0000 €
                    : '-';

                return (
                  <tr key={row.session_id}>
                    <td style={tdStyle}>{row.student_name}</td>
                    <td style={tdStyle}>{row.student_email}</td>
                    <td style={tdStyle}>{row.case_title}</td>
                    <td style={tdStyle}>{started}</td>
                    <td style={tdStyle}>{finished}</td>
                    <td style={tdStyle}>
                      {prompt}/{completion}/{totalTokens}
                    </td>
                    <td style={tdStyle}>{cost}</td>
                    <td style={tdStyle}>{row.score ?? '-'}</td>
                    <td style={{ ...tdStyle, maxWidth: 320 }}>
                      {row.feedback ?? '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid #e2e8f0',
  fontWeight: 600,
  fontSize: 12,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid #e2e8f0',
  verticalAlign: 'top',
};
