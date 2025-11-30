'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type CaseSpec = {
  nombre?: string;
  edad?: number;
  sexo?: string;
  motivo_consulta?: string;
  antecedentes?: string;
  tratamiento?: string;
  contexto?: string;
  descripcion_paciente?: string;
};

type CaseData = {
  id: number;
  title: string;
  description: string;
  spec: CaseSpec;
};

type ChatMessage = {
  role: 'student' | 'patient';
  content: string;
};

export default function ChatClient() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingCase, setLoadingCase] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEval, setShowEval] = useState(false);
  const [evalTipo, setEvalTipo] = useState('');
  const [evalBarrera, setEvalBarrera] = useState('');
  const [evalInterv, setEvalInterv] = useState('');
  const [evalResult, setEvalResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initSession() {
      try {
        const res = await fetch('/api/sessions', { method: 'POST' });
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login');
            return;
          }
          const data = await res.json().catch(() => ({}));
          setError(data.error || 'No se pudo crear la sesión');
          setLoadingCase(false);
          return;
        }
        const data = await res.json();
        setSessionId(data.sessionId);
        setCaseData(data.case);
        setMessages([
          {
            role: 'patient' as const,
            content:
              'Hola, soy el paciente. Puedes hacerme las preguntas que consideres para entender mejor mi situación con la medicación.',
          },
        ]);
      } catch (err) {
        console.error(err);
        setError('Error conectando con el servidor');
      } finally {
        setLoadingCase(false);
      }
    }
    initSession();
  }, [router]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!sessionId || !input.trim()) return;
    setError(null);
    const text = input.trim();
    setInput('');
    const newMsgs: ChatMessage[] = [
      ...messages,
      { role: 'student' as const, content: text },
    ];
    setMessages(newMsgs);
    setSending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Error en el chat');
        return;
      }
      const data = await res.json();
      setMessages([
        ...newMsgs,
        { role: 'patient' as const, content: data.reply },
      ]);
    } catch (err) {
      console.error(err);
      setError('Error de conexión');
    } finally {
      setSending(false);
    }
  }

  async function handleEvalSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sessionId) return;
    const intervenciones = evalInterv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          tipo_no_adherencia: evalTipo,
          barrera: evalBarrera,
          intervenciones,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Error guardando evaluación');
        return;
      }
      const data = await res.json();
      setEvalResult(data);
    } catch (err) {
      console.error(err);
      setError('Error de conexión');
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (loadingCase) {
    return <p>Cargando caso clínico...</p>;
  }

  if (error) {
    return (
      <div>
        <p style={{ color: '#dc2626', marginBottom: 12 }}>{error}</p>
        <button
          onClick={() => router.refresh()}
          style={{
            padding: '8px 12px',
            borderRadius: 4,
            border: '1px solid #2563eb',
            backgroundColor: 'white',
            color: '#2563eb',
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!caseData || !sessionId) {
    return <p>No se pudo inicializar la sesión.</p>;
  }

  const spec = caseData.spec;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Cabecera: solo botón de cerrar sesión (no mostramos título/descr. del caso) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
        }}
      >
        <button
          onClick={handleLogout}
          style={{
            fontSize: 13,
            color: '#dc2626',
            border: '1px solid #fecaca',
            padding: '4px 8px',
            borderRadius: 4,
            backgroundColor: 'white',
          }}
        >
          Cerrar sesión
        </button>
      </div>

      <div
        style={{
          borderRadius: 8,
          padding: 12,
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
        }}
      >
<ul style={{ fontSize: 13, margin: 0, paddingLeft: 18 }}>
  <li>
    <strong>Nombre:</strong> {spec.nombre}
  </li>
  <li>
    <strong>Edad:</strong> {spec.edad}
  </li>
  <li>
    <strong>Sexo:</strong> {spec.sexo}
  </li>

  {/* Motivo, antecedentes y contexto NO se muestran al alumno,
      pero siguen existiendo en spec para que el profesor los vea
      en el editor de casos. */}

  <li>
    <strong>Tratamiento disponible en Receta Electrónica:</strong>{' '}
    {spec.tratamiento}
  </li>
</ul>
      </div>

      <div
        style={{
          borderRadius: 8,
          padding: 12,
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Chat con el paciente</h3>
        <div
          style={{
            height: 260,
            overflowY: 'auto',
            borderRadius: 6,
            border: '1px solid #e2e8f0',
            padding: 8,
            backgroundColor: '#f8fafc',
            marginBottom: 10,
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                textAlign: m.role === 'student' ? 'right' : 'left',
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 8px',
                  borderRadius: 9999,
                  backgroundColor:
                    m.role === 'student' ? '#2563eb' : 'white',
                  color: m.role === 'student' ? 'white' : '#0f172a',
                  border:
                    m.role === 'student'
                      ? 'none'
                      : '1px solid #cbd5f5',
                  fontSize: 13,
                }}
              >
                <strong style={{ marginRight: 4 }}>
                  {m.role === 'student' ? 'Tú:' : 'Paciente:'}
                </strong>
                {m.content}
              </span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
          <input
            style={{
              flex: 1,
              borderRadius: 4,
              border: '1px solid #cbd5f5',
              padding: '8px 10px',
              fontSize: 14,
            }}
            placeholder="Escribe tu pregunta al paciente..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending || showEval}
          />
          <button
            type="submit"
            disabled={sending || !input.trim() || showEval}
            style={{
              padding: '8px 12px',
              borderRadius: 4,
              border: 'none',
              backgroundColor: '#2563eb',
              color: 'white',
              fontWeight: 500,
              opacity: sending || !input.trim() || showEval ? 0.6 : 1,
              cursor:
                sending || !input.trim() || showEval
                  ? 'default'
                  : 'pointer',
            }}
          >
            Enviar
          </button>
        </form>

        <button
          onClick={() => setShowEval(true)}
          disabled={showEval}
          style={{
            marginTop: 8,
            fontSize: 13,
            borderRadius: 4,
            border: '1px solid #e2e8f0',
            backgroundColor: 'white',
            padding: '6px 10px',
          }}
        >
          Finalizar caso y evaluar
        </button>
      </div>

      {showEval && (
        <div
          style={{
            borderRadius: 8,
            padding: 12,
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
          }}
        >
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>
            Evaluación del caso
          </h3>
          <p style={{ fontSize: 13, marginBottom: 10 }}>
            Responde según tu juicio clínico tras la entrevista. Después verás
            la corrección y un breve feedback.
          </p>
          <form
            onSubmit={handleEvalSubmit}
            style={{ display: 'grid', gap: 10 }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  marginBottom: 4,
                }}
              >
                Tipo de no adherencia (por ejemplo: "no intencionada",
                "intencionada", "combinada")
              </label>
              <input
                style={{
                  width: '100%',
                  borderRadius: 4,
                  border: '1px solid #cbd5f5',
                  padding: '8px 10px',
                  fontSize: 13,
                }}
                value={evalTipo}
                onChange={(e) => setEvalTipo(e.target.value)}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  marginBottom: 4,
                }}
              >
                Barrera principal (por ejemplo: "barrera práctica", "barrera de percepción"
                )
              </label>
              <input
                style={{
                  width: '100%',
                  borderRadius: 4,
                  border: '1px solid #cbd5f5',
                  padding: '8px 10px',
                  fontSize: 13,
                }}
                value={evalBarrera}
                onChange={(e) => setEvalBarrera(e.target.value)}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  marginBottom: 4,
                }}
              >
                Intervenciones propuestas (separadas por coma)
              </label>
              <input
                style={{
                  width: '100%',
                  borderRadius: 4,
                  border: '1px solid #cbd5f5',
                  padding: '8px 10px',
                  fontSize: 13,
                }}
                placeholder="Ej: Uso de pastillero, Educación sobre la importancia..."
                value={evalInterv}
                onChange={(e) => setEvalInterv(e.target.value)}
              />
            </div>
            <button
              type="submit"
              style={{
                padding: '8px 12px',
                borderRadius: 4,
                border: 'none',
                backgroundColor: '#16a34a',
                color: 'white',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Enviar evaluación
            </button>
          </form>

          {evalResult && (
            <div
              style={{
                marginTop: 12,
                borderTop: '1px solid #e2e8f0',
                paddingTop: 8,
                fontSize: 13,
              }}
            >
              <p>
                <strong>Puntuación:</strong> {evalResult.score} / 3
              </p>
              <p style={{ marginTop: 6 }}>
                <strong>Feedback:</strong> {evalResult.feedback}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

