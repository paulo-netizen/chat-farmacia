'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type CaseStatus = 'draft' | 'approved' | 'rejected';

export type EditableCase = {
  id: number;
  title: string;
  description: string | null;
  spec: any;
  ground_truth: any;
  difficulty: number | null;
  status: CaseStatus;
  service_type: string | null;
};

type Props = {
  initialCase: EditableCase;
};

export default function EditCaseClient({ initialCase }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(initialCase.title);
  const [description, setDescription] = useState(initialCase.description ?? '');
  const [difficulty, setDifficulty] = useState(
    initialCase.difficulty ?? 1
  );
  const [status, setStatus] = useState<CaseStatus>(initialCase.status);
  const [specText, setSpecText] = useState(
    JSON.stringify(initialCase.spec ?? {}, null, 2)
  );
  const [gtText, setGtText] = useState(
    JSON.stringify(initialCase.ground_truth ?? {}, null, 2)
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // aviso si pasa a 'approved'
    if (initialCase.status !== 'approved' && status === 'approved') {
      const ok = window.confirm(
        'Al aprobar este caso, podrá ser asignado a los alumnos. ¿Deseas continuar?'
      );
      if (!ok) return;
    }

    let specObj: any;
    let gtObj: any;

    try {
      specObj = specText.trim() ? JSON.parse(specText) : {};
    } catch {
      setError('El JSON de la ficha del paciente (spec) no es válido.');
      return;
    }

    try {
      gtObj = gtText.trim() ? JSON.parse(gtText) : {};
    } catch {
      setError('El JSON de las respuestas correctas (ground_truth) no es válido.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${initialCase.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          difficulty: Number(difficulty),
          status,
          spec: specObj,
          ground_truth: gtObj,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Error al guardar el caso');
        return;
      }

      setSuccess('Caso guardado correctamente.');
      // refresca datos de la página y, si quieres, vuelve al listado
      router.refresh();
      // router.push('/profesor/casos');
    } catch (err) {
      console.error(err);
      setError('Error de conexión al guardar el caso');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
      {error && (
        <div
          style={{
            padding: 8,
            borderRadius: 4,
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: 8,
            borderRadius: 4,
            backgroundColor: '#dcfce7',
            color: '#166534',
            fontSize: 13,
          }}
        >
          {success}
        </div>
      )}

      <div>
        <label style={labelStyle}>
          Título
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <div>
        <label style={labelStyle}>
          Descripción breve
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={textareaStyle}
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>
            Dificultad (número entero, p. ej. 1–5)
            <input
              type="number"
              min={1}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>
            Estado
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CaseStatus)}
              style={inputStyle}
            >
              <option value="draft">draft (borrador)</option>
              <option value="approved">approved (aprobado)</option>
              <option value="rejected">rejected (rechazado)</option>
            </select>
          </label>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>
            Servicio
            <input
              type="text"
              value={initialCase.service_type ?? 'SAT'}
              readOnly
              style={{ ...inputStyle, backgroundColor: '#f8fafc' }}
            />
          </label>
        </div>
      </div>

      <div>
        <label style={labelStyle}>
          Ficha del paciente (JSON – <strong>spec</strong>)
          <textarea
            value={specText}
            onChange={(e) => setSpecText(e.target.value)}
            rows={10}
            style={textareaStyle}
          />
        </label>
        <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
          Aquí va todo lo que ve el alumno en la ficha del paciente
          (nombre, edad, contexto, tratamiento…).
        </p>
      </div>

      <div>
        <label style={labelStyle}>
          Respuestas correctas / solución del caso (JSON – <strong>ground_truth</strong>)
          <textarea
            value={gtText}
            onChange={(e) => setGtText(e.target.value)}
            rows={8}
            style={textareaStyle}
          />
        </label>
        <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
          Por ejemplo: tipo de no adherencia, barrera principal, lista de
          intervenciones recomendadas, etc.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: '8px 12px',
            borderRadius: 4,
            border: 'none',
            backgroundColor: '#16a34a',
            color: 'white',
            fontWeight: 500,
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>

        <button
          type="button"
          onClick={() => router.push('/profesor/casos')}
          style={{
            padding: '8px 12px',
            borderRadius: 4,
            border: '1px solid #e2e8f0',
            backgroundColor: 'white',
            color: '#111827',
            fontSize: 13,
          }}
        >
          Volver al listado
        </button>
      </div>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 4,
  border: '1px solid #cbd5f5',
  fontSize: 13,
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 4,
  border: '1px solid #cbd5f5',
  fontSize: 13,
  fontFamily: 'monospace',
};
