import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import EditCaseClient, { EditableCase } from './EditCaseClient';

async function getCaseById(id: number): Promise<EditableCase | null> {
  const result = await pool.query(
    `
    SELECT
      id,
      title,
      description,
      spec,
      ground_truth,
      difficulty,
      status,
      service_type
    FROM cases
    WHERE id = $1
    `,
    [id]
  );

  if (result.rowCount === 0) return null;
  const row = result.rows[0];

  return {
    id: row.id as number,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    spec: row.spec,
    ground_truth: row.ground_truth,
    difficulty: (row.difficulty as number | null) ?? null,
    status: row.status as 'draft' | 'approved' | 'rejected',
    service_type: (row.service_type as string | null) ?? null,
  };
}

export default async function EditCasePage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (user.role !== 'teacher' && user.role !== 'admin') {
    redirect('/chat');
  }

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    notFound();
  }

  const dbCase = await getCaseById(id);
  if (!dbCase) {
    notFound();
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
          Editar caso #{dbCase.id}
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>
          Modifica la información visible para el alumno y las respuestas
          correctas que se utilizan en la evaluación automática.
        </p>
        <a
          href="/profesor/casos"
          style={{ fontSize: 13, color: '#2563eb' }}
        >
          ← Volver al listado de casos
        </a>
      </div>

      <div
        style={{
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          backgroundColor: 'white',
          padding: 12,
        }}
      >
        <EditCaseClient initialCase={dbCase} />
      </div>
    </div>
  );
}
