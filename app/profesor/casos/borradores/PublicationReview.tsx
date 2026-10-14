'use client';
import { useEffect, useState } from 'react';
import type { TeacherDraftRecord } from '@/lib/cases/v2/teacher-case-draft';

function Content({value}:{value:unknown}) {
 if(value===null||value===undefined)return <span>No indicado</span>;
 if(typeof value!=='object')return <span>{String(value)}</span>;
 if(Array.isArray(value))return <ol>{value.map((v,i)=><li key={i}><Content value={v}/></li>)}</ol>;
 return <dl>{Object.entries(value).map(([k,v])=><div key={k}><dt>{k}</dt><dd><Content value={v}/></dd></div>)}</dl>;
}
const labels={clinical:'Hechos, tratamiento y coherencia clínica',solution:'Solución docente e intervenciones',criteria:'Criterios, aplicabilidad y evidencias',questionnaire:'Cuestionario y claves',correspondence:'Correspondencia completa entre borrador y paquete académico',warnings:'Advertencias y cuestiones pendientes de la auditoría'};
export default function PublicationReview({draft,dirty}:{draft:TeacherDraftRecord;dirty:boolean}) {
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState('');
 const [checks,setChecks]=useState<Record<string,boolean>>({});
 async function load(init?:RequestInit){
  const r=await fetch(`/api/teacher-drafts/${draft.caseId}/review`,{...init,cache:'no-store',headers:{'Content-Type':'application/json'}});
  const d=await r.json();if(!r.ok)throw Error(d.error??'Revisión no disponible.');setData(d);
 }
 useEffect(()=>{setChecks({});setNote('');load().catch(()=>setError('No se pudo cargar la revisión. Comprueba la configuración editorial; no se ha validado ni publicado nada.'));},[draft.versionId]);
 async function act(action:'validate'|'publish'){
  setBusy(true);setError('');
  try{await load({method:'POST',body:JSON.stringify({action,expectedDraftVersionId:draft.versionId,candidateVersionId:data.candidate.versionId,
   ...(action==='validate'?{review:{...checks,note}}:{})})});}catch(e){setError(e instanceof Error?e.message:'Operación no confirmada.');}finally{setBusy(false);}
 }
 return <section aria-label="Revisión y publicación"><h2>Revisar, validar y publicar</h2>
  <p>La estructura correcta no acredita coherencia clínica. La auditoría tampoco sustituye tu revisión humana. Validar registra la aprobación de esta revisión; publicar es una acción distinta.</p>
  {error&&<p role="alert">{error}</p>}
  {dirty&&<p>Guarda los cambios antes de revisar. Toda nueva revisión requiere su propia aprobación.</p>}
  {data&&<><ul><li>Estructura del borrador: {data.checks.draftStructure}</li><li>Aplicabilidad de requisitos: {data.checks.requirements}</li><li>Paquete académico canónico: {data.checks.canonicalPackage}</li><li>Auditoría clínica: {data.checks.clinicalAudit}</li><li>Revisión humana: {data.checks.humanReview}</li></ul>
   {data.checks.requirements==='PENDING'&&<p>Resuelve los requisitos «Por determinar» antes de validar esta revisión. La adherencia no determinable sigue siendo un resultado permitido.</p>}
   {!data.candidate&&<p>Falta preparar y auditar el paquete académico vinculado a esta revisión. Los textos libres no permiten completar automáticamente personalidad, protocolos y evaluación. Este borrador no está listo para publicación; no se inventarán datos ni se simulará la auditoría.</p>}
   {data.candidate&&<><p>Estado: {data.candidate.status} · Auditoría: {data.candidate.auditKind} · {data.candidate.auditReference}</p>
    {data.candidate.auditKind==='SYNTHETIC_TEST'&&<p><strong>Solo demostración sintética en base desechable. No es aprobación clínica real.</strong></p>}
    <details><summary>Paquete académico reservado: hechos, protocolos y evaluación</summary><Content value={data.candidate.content}/></details>
    {data.candidate.reviewedAt&&<p>Aprobación registrada: {String(data.candidate.reviewedAt)} · Docente {data.candidate.reviewerId}. {data.candidate.note}</p>}
   </>}
   <fieldset disabled={busy||dirty||!data.canValidate}><legend>Revisión humana explícita</legend>
    {Object.entries(labels).map(([k,label])=><label key={k} style={{display:'block'}}><input type="checkbox" checked={checks[k]??false} onChange={e=>setChecks({...checks,[k]:e.target.checked})}/>{label}</label>)}
    <label>Justificación y resolución de advertencias<textarea value={note} minLength={10} maxLength={2000} onChange={e=>setNote(e.target.value)}/></label>
   </fieldset>
   <button disabled={busy||dirty||!data.canValidate||Object.keys(labels).some(k=>!checks[k])||note.trim().length<10} onClick={()=>act('validate')}>Validar esta revisión</button>
   <button disabled={busy||dirty||!data.canPublish} onClick={()=>act('publish')}>Publicar versión validada</button>
   <p>Publicar habilita esta versión para nuevas selecciones académicas. No crea sesiones ni notas. Las versiones anteriores conservan su contenido y sus sesiones.</p>
  </>}
 </section>;
}
