import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LogoutButton from '../LogoutButton';
import Link from 'next/link';
import React from 'react';

type CaseRow = {
  id: number;
  title: string;
  status: string | null;
  service_type: string | null;
  difficulty: number | null;
  created_at: string | null;
};

async function getCases(): Promise<CaseRow[]> {
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

function StatusBadge({ status }: { status: string | null }) {
  const value = status ?? 'desconocido';

  let bg = '#e5e7eb';
  let color = '#111827';

  if (value === 'approved' || value === 'published') {
    bg = '#dcfce7';
    color = '#166534';
  } else if (value === 'draft') {
    bg = '#fef9c3';
    color = '#92400e';
  } else if (value === 'rejected') {
    bg = '#fee2e2';
    color = '#991b1b';
  }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 9999,
        fontSize: 12,
        backgroundColor: bg,
        color,
        textTransform: 'lowercase',
      }}
    >
      {value}
    </span>
  );
}

export default async function CasesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (user.role !== 'teacher' && user.role !== 'admin') {
    redirect('/chat');
  }

  const cases = await getCases();

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Cabecera: título + logout */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
            Panel del profesor
          </h1>
          <p style={{ fontSize: 14, color: '#64748b' }}>
            Panel del profesor – gestión básica de casos disponibles para los alumnos.
          </p>

          {/* Pestañas Sesiones / Casos */}
          <div style={{ marginTop: 12, fontSize: 14 }}>
            <Link
              href="/profesor"
              style={{ color: '#2563eb', textDecoration: 'none' }}
            >
              Sesiones
            </Link>
            <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
            <span style={{ fontWeight: 600 }}>Casos</span>
          </div>
        </div>

        <LogoutButton />
      </div>

      {/* Bloque principal: tabla de casos */}
      <div
        style={{
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          backgroundColor: 'white',
          padding: 12,
          overflowX: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            Casos clínicos en la base de datos
          </h2>

          {/* En el siguiente paso haremos que este botón cree casos nuevos */}
          <Link
            href="/profesor/casos/nuevo"
            style={{
              fontSize: 13,
              padding: '6px 10px',
              borderRadius: 4,
              border: '1px solid #2563eb',
              color: '#2563eb',
              textDecoration: 'none',
              backgroundColor: 'white',
            }}
          >
            + Nuevo caso
          </Link>
        </div>

        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
          Aquí ves todos los casos que el sistema puede asignar a los alumnos.
          Más adelante añadiremos creación/edición con IA.
        </p>

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
            {cases.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: 12,
                    textAlign: 'center',
                    color: '#64748b',
                  }}
                >
                  Aún no hay casos en la base de datos.
                </td>
              </tr>
            ) : (
              cases.map((c) => {
                const created = c.created_at
                  ? new Date(c.created_at).toLocaleString('es-ES')
                  : '-';
                return (
                  <tr key={c.id}>
                    <td style={tdStyle}>{c.id}</td>
                    <td style={tdStyle}>{c.title}</td>
                    <td style={tdStyle}>
                      <StatusBadge status={c.status} />
                    </td>
                    <td style={tdStyle}>{c.service_type ?? '-'}</td>
                    <td style={tdStyle}>{c.difficulty ?? '-'}</td>
                    <td style={tdStyle}>{created}</td>
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
