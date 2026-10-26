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
const dimensionLabels:Record<string,string>={problem_treatment:'Problema y tratamiento',regimen:'Pauta',context:'Contexto',prm:'PRM',rnm:'RNM',adherence_barrier:'Adherencia y barrera',barrier_strategy:'Barrera y estrategia',intervention:'Intervención',referral:'Derivación',internal_consistency:'Coherencia interna',spain:'Adecuación a España',questionnaire:'Cuestionario'};
export default function PublicationReview({draft,dirty}:{draft:TeacherDraftRecord;dirty:boolean}) {
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState('');
 const [checks,setChecks]=useState<Record<string,boolean>>({});
 const [sources,setSources]=useState<string[]>([]);
 const [nativeIssues,setNativeIssues]=useState<{field:string;decision:string}[]>([]);
 async function convert(){setBusy(true);setError('');try{
  const response=await fetch(`/api/teacher-drafts/${draft.caseId}/native`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedDraftVersionId:draft.versionId})});
  const result=await response.json();if(!response.ok)throw Error(`${result.error??'Conversión no confirmada.'}${result.fields?.length?' Campos: '+result.fields.join(', '):''}`);
  setNativeIssues(result.missing??[]);await load();
 }catch(e){setError(e instanceof Error?e.message:'Conversión no confirmada.');}finally{setBusy(false);}}
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
 async function prepare(){
  setBusy(true);setError('');
  try{const r=await fetch(`/api/teacher-drafts/${draft.caseId}/prepare`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedDraftVersionId:draft.versionId,sourceKeys:sources})});
   if(!r.ok)throw Error('No se pudo conservar la preparación. Comprueba la revisión guardada y vuelve a cargar.');await load();
  }catch(e){setError(e instanceof Error?e.message:'Preparación no confirmada.');}finally{setBusy(false);}
 }
 async function audit(){setBusy(true);setError('');try{
  const r=await fetch(`/api/teacher-drafts/${draft.caseId}/audit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({preparationId:data.preparation.id})});
  if(!r.ok)throw Error('Auditoría no confirmada. Requiere autorización privada y presupuesto; no repitas una solicitud incierta.');await load();
 }catch(e){setError(e instanceof Error?e.message:'Auditoría no confirmada.');}finally{setBusy(false);}}
 return <section aria-label="Revisión y publicación"><h2>Revisar, validar y publicar</h2>
  <p>La estructura correcta no acredita coherencia clínica. La auditoría tampoco sustituye tu revisión humana. Validar registra la aprobación de esta revisión; publicar es una acción distinta.</p>
  {error&&<p role="alert">{error}</p>}
  {dirty&&<p>Guarda los cambios antes de revisar. Toda nueva revisión requiere su propia aprobación.</p>}
  <section aria-label="Conversión nativa"><h3>Crear paquete académico desde la revisión guardada</h3><p>Convierte hechos, perfil, evaluación, protocolo y cuestionario con validación nativa. No crea otro expediente, no ejecuta IA ni aprueba o publica el caso.</p><button disabled={busy||dirty} onClick={convert}>Convertir a paquete nativo</button>{nativeIssues.length>0&&<ul role="alert">{nativeIssues.map((x,i)=><li key={i}><strong>{x.field}</strong>: {x.decision}</li>)}</ul>}</section>
  {!draft.fields.nativeAuthoring&&<fieldset disabled={busy||dirty}><legend>Preparar expediente de esta revisión</legend>
   <p>Conserva hechos, proyecciones, protocolo, solución y cuestionario sin rellenar lagunas. Selecciona las fichas oficiales que deseas consultar como comparación; no se atribuye una marca al paciente. Consultar CIMA no ejecuta una auditoría clínica IA ni aprueba la pauta individual.</p>
   {([['metformin850','Metformina 850 mg · CIMA 68167'],['enalapril20','Enalapril 20 mg · CIMA 63355']] as const).map(([key,label])=><label key={key} style={{display:'block'}}><input type="checkbox" checked={sources.includes(key)} onChange={e=>setSources(e.target.checked?[...sources,key]:sources.filter(s=>s!==key))}/>{label}</label>)}
   <button onClick={prepare}>Preparar y comprobar fuentes</button>
  </fieldset>}
  {draft.fields.nativeAuthoring&&<p>La auditoría de revisiones anteriores no aprueba este paquete. El candidato nativo permanece con auditoría pendiente; no se crea otro expediente.</p>}
  {data&&<><ul><li>Estructura del borrador: {data.checks.draftStructure}</li><li>Aplicabilidad de requisitos: {data.checks.requirements}</li><li>Paquete académico canónico: {data.checks.canonicalPackage}</li><li>Auditoría clínica: {data.checks.clinicalAudit}</li><li>Revisión humana: {data.checks.humanReview}</li></ul>
   {data.preparation&&<section aria-label="Expediente académico preparado"><h3>Expediente conservado para revisión</h3>
    <p>Revisión {data.preparation.package.sourceRevision} · {data.preparation.created_at}. Vinculado a {data.preparation.package.draftVersionId}.</p>
    <p>Estructura del expediente: {data.preparation.audit.structural.status}. Fuentes: {data.preparation.audit.sources.status}. Juicio clínico independiente: {data.preparation.clinical_result?'RECIBIDO · requiere revisión':data.preparation.audit.auditor.status}. Aprobación docente: PENDING.</p>
    <p>Este expediente no sustituye un paquete ejecutable validado. No se ha publicado ni creado ninguna sesión.</p>
    <button disabled={busy||dirty||!!data.preparation.clinical_result} onClick={audit}>Solicitar juicio del auditor</button>
    <p>Solo disponible con autorización privada vinculada a este expediente. Una llamada, sin reintentos. El juicio no sustituye tu aprobación.</p>
    {data.preparation.clinical_result&&<><h4>Juicio del auditor · {data.preparation.clinical_result.version}</h4>
     <p>PASS expresa suficiencia en la dimensión examinada, no aprobación del caso. WARNING requiere revisión; INSUFFICIENT indica información insuficiente; FAIL señala una incompatibilidad sustentada.</p>
     {data.preparation.clinical_result.judgment.dimensions.map((d:any)=><article key={d.id}><h5>{dimensionLabels[d.id]} · {d.status}</h5><p>{d.reason}</p><p><strong>Propuesta para revisión:</strong> {d.proposal||'Sin propuesta adicional.'}</p><p>Hechos: {d.factRefs.join(', ')||'No citados'} · Fuentes: {d.sourceKeys.join(', ')||'No citadas'}</p></article>)}
     <p>Hallazgos y propuestas pendientes de revisión; no se han aplicado cambios al caso.</p></>}
    <h4>Campos y decisiones pendientes</h4><ul>{data.preparation.package.nativePackage.missing.map((m:any)=><li key={m.code}><strong>{m.field}</strong>: {m.decision}</li>)}</ul>
    <h4>Fuentes consultadas</h4>{data.preparation.audit.sources.evidence.map((s:any)=><article key={s.key}><p><a href={s.url} target="_blank" rel="noreferrer">Ficha CIMA</a> · {s.status} · {s.retrievedAt}</p>{s.truncated&&<p>Extracto truncado: no acredita revisión de la ficha completa. El auditor debe conservar las comprobaciones insuficientes.</p>}{s.excerpt&&<blockquote>{s.excerpt}</blockquote>}<p>Huella: {s.sha256??'No disponible'}</p></article>)}
    <details><summary>Ficha completa para Paulo: hechos, solución, criterios y respuestas</summary><Content value={data.preparation.package.teacher}/></details>
   </section>}
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
