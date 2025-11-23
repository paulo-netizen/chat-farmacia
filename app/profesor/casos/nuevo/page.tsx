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
  "diagnostico_principal": "",
  "problema_farmacoterapeutico": "",
  "tipo_no_adherencia": "no intencional",
  "barrera_principal": "olvido",
  "otras_barreras": [],
  "intervenciones_recomendadas": [
    "Uso de pastillero",
    "Educación sobre la importancia de la adherencia"
  ],
  "personalidad_paciente": "",
  "objetivos_aprendizaje": []
}`
  );

  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ----- IA: rellenar caso automáticamente -----
  async function handleGenerateWithAI() {
    try {
      setAiLoading(true);
      setError(null);

      const res = await fetch('/api/cases/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_type: serviceType,
          difficulty,
          area: 'hipertensión arterial',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Error generando el caso con IA');
        return;
      }

      const data = await res.json();

      setTitle(data.title || '');
      setDescription(data.summary || '');
      if (data.spec) {
        setSpec(JSON.stringify(data.spec, null, 2));
      }
      if (data.ground_truth) {
        setGroundTruth(JSON.stringify(data.ground_truth, null, 2));
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión al generar el caso con IA');
    } finally {
      setAiLoading(false);
    }
  }

  // ----- Guardar caso en la BD -----
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Solo validamos que el JSON sea correcto, pero seguimos enviando los strings
      try {
        JSON.parse(spec);
        JSON.parse(groundTruth);
      } catch {
        setError('Revisa el JSON de spec o ground_truth: no es válido.');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          status,
          service_type: serviceType,
          difficulty,
          spec,           // <- enviamos la cadena, como antes
          ground_truth: groundTruth, // <- idem
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Error creando el caso');
        return;
      }

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
            Puedes crear el caso manualmente o pedir a la IA que te proponga un
            borrador clínicamente realista para España.
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
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              style={{
                borderRadius: 4,
                border: '1px solid #cbd5f5',
                padding: '6px 8px',
                fontSize: 13,
              }}
            >
              <option value="SAT">
                SAT (Servicio de Adherencia Terapéutica)
              </option>
            </select>
          </div>

          <div>
            <label
              style={{ display: 'block', fontSize: 13, marginBottom: 4 }}
            >
              Dificultad (1–5)
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

        {/* Botón IA */}
        <button
          type="button"
          onClick={handleGenerateWithAI}
          disabled={aiLoading}
          style={{
            alignSelf: 'flex-start',
            padding: '6px 12px',
            borderRadius: 4,
            border: 'none',
            backgroundColor: '#2563eb',
            color: 'white',
            fontSize: 13,
            cursor: aiLoading ? 'default' : 'pointer',
            opacity: aiLoading ? 0.7 : 1,
          }}
        >
          {aiLoading ? 'Generando caso con IA…' : 'Rellenar con IA'}
        </button>

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
