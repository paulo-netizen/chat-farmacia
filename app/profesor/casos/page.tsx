import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

type CaseRow = {
  id: number;
  title: string;
  status: 'draft' | 'approved' | 'rejected';
  service_type: string | null;
  difficulty: number | null;
  created_at: string;
};

async function getCasesForProfessor(): Promise<CaseRow[]> {
  const result = await pool.query(
    `
    SELECT
      id,
      title,
      status,
      service_type,
      difficulty,
      created_at
    FROM cases
    ORDER BY id ASC
    `
  );

  return result.rows as CaseRow[];
}

export default async function ProfessorCasesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (user.role !== 'teacher' && user.role !== 'admin') {
    redirect('/chat');
  }

  const rows = await getCasesForProfessor();

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
          Panel del profesor
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>
          Panel del profesor – gestión básica de casos disponibles para los alumnos.
        </p>

        {/* Navegación simple entre pestañas */}
        <div style={{ fontSize: 14, marginBottom: 12 }}>
          <Link href="/profesor" style={{ marginRight: 8, color: '#2563eb' }}>
            Sesiones
          </Link>
          <span style={{ margin: '0 4px' }}>|</span>
          <span style={{ fontWeight: 600 }}>Casos</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
          Casos clínicos en la base de datos
        </h2>
        <Link
          href="/profesor/casos/nuevo"
          style={{
            fontSize: 13,
            padding: '6px 10px',
            borderRadius: 4,
            border: 'none',
            backgroundColor: '#2563eb',
            color: 'white',
            textDecoration: 'none',
          }}
        >
          + Nuevo caso
        </Link>
      </div>

      <p style={{ fontSize: 13, color: '#64748b' }}>
        Aquí ves todos los casos que el sistema puede asignar a los alumnos.
        Más adelante añadiremos creación/edición con IA.
      </p>

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
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Título</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Servicio</th>
              <th style={thStyle}>Dificultad</th>
              <th style={thStyle}>Creado</th>
              <th style={thStyle}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 12, textAlign: 'center', color: '#64748b' }}>
                  Aún no hay casos en la base de datos.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const created = new Date(row.created_at).toLocaleString('es-ES');
                return (
                  <tr key={row.id}>
                    <td style={tdStyle}>{row.id}</td>
                    <td style={tdStyle}>{row.title}</td>
                    <td style={tdStyle}>
                      <span style={statusBadge(row.status)}>
                        {row.status}
                      </span>
                    </td>
                    <td style={tdStyle}>{row.service_type ?? '-'}</td>
                    <td style={tdStyle}>{row.difficulty ?? '-'}</td>
                    <td style={tdStyle}>{created}</td>
                    <td style={tdStyle}>
                      <Link
                        href={`/profesor/casos/${row.id}`}
                        style={{ fontSize: 12, color: '#2563eb' }}
                      >
                        Editar
                      </Link>
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

function statusBadge(status: CaseRow['status']): React.CSSProperties {
  let bg = '#e5e7eb';
  let color = '#111827';
  if (status === 'approved') {
    bg = '#dcfce7';
    color = '#166534';
  } else if (status === 'draft') {
    bg = '#fef9c3';
    color = '#92400e';
  } else if (status === 'rejected') {
    bg = '#fee2e2';
    color = '#b91c1c';
  }
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 9999,
    backgroundColor: bg,
    color,
    fontSize: 11,
    textTransform: 'lowercase',
  };
}

