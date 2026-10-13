'use client';
import { useState } from 'react';
import type { TeacherDraftRecord } from '@/lib/cases/v2/teacher-case-draft';
import styles from './editor.module.css';
type View={id:string;revision:number;caseVersionId:string;identity:{nombre:string;edad:number;sexo:string};status:string;messages:{role:string;content:string}[]};
async function request(url:string,init?:RequestInit){const r=await fetch(url,{...init,cache:'no-store',headers:{'Content-Type':'application/json'}});const d=await r.json();if(!r.ok)throw Error(`${d.error}${d.fields?' '+d.fields.join(', '):''}`);return d;}
export default function PatientPreview({draft,onBack}:{draft:TeacherDraftRecord;onBack:()=>void}){
  const [view,setView]=useState<View|null>(null),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function start(){setBusy(true);setError('');try{if(view)await request(`/api/teacher-previews/${view.id}`,{method:'DELETE'});const d=await request(`/api/teacher-drafts/${draft.caseId}/test`,{method:'POST',body:JSON.stringify({expectedVersionId:draft.versionId})});setView(d);setText('');}catch(e){setError(e instanceof Error?e.message:'No se pudo abrir la prueba.');}finally{setBusy(false);}}
  async function refresh(){if(!view)return;setBusy(true);try{setView(await request(`/api/teacher-previews/${view.id}`));}catch{setError('No se pudo recuperar el estado. No repitas un envío incierto.');}finally{setBusy(false);}}
  async function send(){if(!view)return;setBusy(true);setError('');try{setView(await request(`/api/teacher-previews/${view.id}`,{method:'POST',body:JSON.stringify({requestId:crypto.randomUUID(),expectedMessages:view.messages.length,...(view.messages.length?{text}:{})})}));setText('');}catch(e){setError(e instanceof Error?e.message:'No se confirmó la respuesta.');setView(v=>v?{...v,status:'BLOCKED'}:v);}finally{setBusy(false);}}
  return <section className={styles.panel} aria-label="Conversación de prueba docente">
    <p className={styles.kicker}>MODO DOCENTE · SIN INTENTO ACADÉMICO</p><h2>Probar paciente</h2>
    <p>Solo se usa la revisión guardada v{view?.revision??draft.revision}. Los cambios posteriores no modifican esta conversación. No introducir datos de pacientes reales.</p>
    <div className={styles.toolbar}><button disabled={busy} onClick={start}>{view?'Reiniciar prueba':'Abrir prueba de la revisión guardada'}</button><button disabled={busy} onClick={onBack}>Volver al editor</button>{view&&<button disabled={busy} onClick={refresh}>Recuperar estado</button>}</div>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {view&&<><section aria-label="Ficha inicial del paciente"><dl><dt>Nombre</dt><dd>{view.identity.nombre}</dd><dt>Edad</dt><dd>{view.identity.edad}</dd><dt>Sexo</dt><dd>{view.identity.sexo}</dd></dl></section>
      <div role="log" aria-label="Mensajes de prueba">{view.messages.map((m,i)=><article key={i}><strong>{m.role==='patient'?view.identity.nombre:'Docente en entrevista'}</strong><p>{m.content}</p></article>)}</div>
      {view.status==='READY'&&(!view.messages.length?<button disabled={busy} onClick={send}>Escuchar demanda del paciente</button>:<form onSubmit={e=>{e.preventDefault();send();}}><label className={styles.field}>Pregunta al paciente<textarea rows={3} maxLength={2000} value={text} onChange={e=>setText(e.target.value)} disabled={busy}/></label><button disabled={busy||!text.trim()} type="submit">Enviar pregunta</button></form>)}
      {view.status!=='READY'&&<p>Estado: {view.status}. No se reenvían solicitudes pendientes o fallidas.</p>}
      {busy&&<p role="status">Procesando con controles de seguridad…</p>}
    </>}
    <p className={styles.footer}>Demanda escrita por el docente y respuestas comprobadas por el runtime seguro. Su aceptación técnica no aprueba el caso académicamente. Las llamadas necesitan habilitación privada y presupuesto disponible.</p>
  </section>;
}
