'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewCasePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'approved' | 'rejected'>('approved');
  const [serviceType, setServiceType] = useState('SAT');
  const [difficulty, setDifficulty] = useState(1);
  const [spec, setSpec] = useState(
    `{
  "nombre": "Paciente nuevo",
  "edad": 60,
  "sexo": "F",
  "motivo_consulta": "Revisión de medicación",
  "antecedentes": "Hipertensión diagnosticada hace X años",
  "tratamiento": "Medicamento X 1 vez al día",
  "contexto": "Vive sola..."
}`
  );
  const [groundTruth, setGroundTruth] = useState(
    `{
  "tipo_no_adherencia": "no intencional",
  "barrera_principal": "olvido",
  "intervenciones_recomendadas": [
    "Uso de pastillero",
    "Educación sobre la importancia de la adherencia"
  ]
}`
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          status,
          service_type: serviceType,
          difficulty,
          spec,
          ground_truth: groundTruth,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error creando el caso');
        return;
      }

      // Volvemos a la lista de casos
      router.push('/profesor/casos');
    } catch (err) {
      console.error(err);
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
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
            Nuevo caso clínico
          </h1>
          <p style={{ fontSize: 14, color: '#64748b' }}>
            Crea un caso de forma manual. Más adelante podremos generar y
            completar esta información con IA.
          </p>
        </div>

        <Link
          href="/profesor/casos"
          style={{
            fontSize: 13,
            padding: '6px 10px',
            borderRadius: 4,
            border: '1px solid #e2e8f0',
            backgroundColor: 'white',
            textDecoration: 'none',
          }}
        >
          Volver a casos
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          backgroundColor: 'white',
          padding: 12,
          display: 'grid',
          gap: 12,
        }}
      >
        {error && (
          <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>
        )}

        <div>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
            Título
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{
              width: '100%',
              borderRadius: 4,
              border: '1px solid #cbd5f5',
              padding: '8px 10px',
              fontSize: 13,
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
            Descripción breve
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              borderRadius: 4,
              border: '1px solid #cbd5f5',
              padding: '8px 10px',
              fontSize: 13,
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <label
              style={{ display: 'block', fontSize: 13, marginBottom: 4 }}
            >
              Estado
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as 'approved' | 'rejected')
              }
  style={{
    borderRadius: 4,
    border: '1px solid #cbd5f5',
    padding: '6px 8px',
    fontSize: 13,
  }}
>
  <option value="approved">approved (activo para alumnos)</option>
  <option value="rejected">rejected</option>
</select>
          </div>

          <div>
            <label
              style={{ display: 'block', fontSize: 13, marginBottom: 4 }}
            >
              Servicio
            </label>
            <input
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              style={{
                borderRadius: 4,
                border: '1px solid #cbd5f5',
                padding: '6px 8px',
                fontSize: 13,
              }}
            />
          </div>

          <div>
            <label
              style={{ display: 'block', fontSize: 13, marginBottom: 4 }}
            >
              Dificultad
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              style={{
                width: 80,
                borderRadius: 4,
                border: '1px solid #cbd5f5',
                padding: '6px 8px',
                fontSize: 13,
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label
              style={{ display: 'block', fontSize: 13, marginBottom: 4 }}
            >
              spec (JSON con ficha del paciente)
            </label>
            <textarea
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              rows={8}
              style={{
                width: '100%',
                borderRadius: 4,
                border: '1px solid #cbd5f5',
                padding: '8px 10px',
                fontSize: 12,
                fontFamily: 'monospace',
              }}
            />
          </div>

          <div>
            <label
              style={{ display: 'block', fontSize: 13, marginBottom: 4 }}
            >
              ground_truth (JSON con solución del caso)
            </label>
            <textarea
              value={groundTruth}
              onChange={(e) => setGroundTruth(e.target.value)}
              rows={8}
              style={{
                width: '100%',
                borderRadius: 4,
                border: '1px solid #cbd5f5',
                padding: '8px 10px',
                fontSize: 12,
                fontFamily: 'monospace',
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: 4,
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
          {saving ? 'Guardando...' : 'Guardar caso'}
        </button>
      </form>
    </div>
  );
}
