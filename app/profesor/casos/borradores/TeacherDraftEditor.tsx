'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adherenceLabels, studentDraftPreview, type TeacherDraftFields, type TeacherDraftRecord } from '@/lib/cases/v2/teacher-case-draft';
import styles from './editor.module.css';
import PatientPreview from './PatientPreview';
import PublicationReview from './PublicationReview';
import NativeAuthoring from './NativeAuthoring';

type Summary = {caseId:string;title:string;revision:number};
type Section = 'edit'|'student'|'teacher'|'test'|'review';
async function request(url: string, init?: RequestInit) {
  const res=await fetch(url,{...init,cache:'no-store',headers:{'Content-Type':'application/json'}});
  const data=await res.json();
  if (!res.ok) throw new Error(`${data.error ?? 'No se pudo completar la operación.'}${data.fields?.length ? ' Campos: '+data.fields.join(', '):''}`);
  return data;
}
function Field({label,value,onChange,multiline=false}: {label:string;value:string;onChange:(v:string)=>void;multiline?:boolean}) {
  return <label className={styles.field}><span>{label}</span>{multiline ? <textarea value={value} onChange={e=>onChange(e.target.value)} rows={3} maxLength={4000}/> : <input value={value} onChange={e=>onChange(e.target.value)} maxLength={4000}/>}</label>;
}
export default function TeacherDraftEditor() {
  const [list,setList]=useState<Summary[]>([]);
  const [draft,setDraft]=useState<TeacherDraftRecord|null>(null);
  const [section,setSection]=useState<Section>('edit');
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  async function refresh() { const data=await request('/api/teacher-drafts');setList(data.drafts); }
  useEffect(()=>{ refresh().catch(()=>setError('No se pudieron cargar los borradores. Comprueba el acceso y la configuración de la base de pruebas.')); },[]);
  useEffect(()=>{ const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  async function load(id: string, template=false) {
    if(dirty){setError('Guarda o descarta los cambios antes de abrir otro borrador.');return;}
    setBusy(true);setError('');setNotice('');
    try { const d=await request(template?'/api/teacher-drafts':`/api/teacher-drafts/${id}`,template?{method:'POST',body:JSON.stringify({templateId:id})}:undefined);setDraft(d);setSection('edit');setDirty(false);await refresh(); }
    catch(e){setError(e instanceof Error?e.message:'No se pudo abrir el borrador.');}finally{setBusy(false);}
  }
  function change(next: TeacherDraftFields) {if(draft){setDraft({...draft,fields:next});setDirty(true);setNotice('');}}
  async function save() {
    if(!draft)return;setBusy(true);setError('');setNotice('');
    try {const d=await request(`/api/teacher-drafts/${draft.caseId}`,{method:'PUT',body:JSON.stringify({expectedVersionId:draft.versionId,fields:draft.fields})});setDraft(d);setDirty(false);setNotice(`Guardado como borrador. Versión ${d.revision}.`);await refresh();}
    catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}finally{setBusy(false);}
  }
  const f=draft?.fields;
  const refs=(values:string[],onChange:(v:string[])=>void)=><div className={styles.refs}><span>Hechos de soporte:</span>{f?.facts.map(fact=><label key={fact.id}><input type="checkbox" checked={values.includes(fact.id)} onChange={e=>onChange(e.target.checked?[...values,fact.id]:values.filter(v=>v!==fact.id))}/>{fact.id}</label>)}</div>;
  let preview: ReturnType<typeof studentDraftPreview> | null=null;
  if(f&&section==='student'){try{preview=studentDraftPreview(f);}catch{ /* Keep incomplete edits editable. */ }}
  return <main className={styles.main}>
    <header><Link href="/profesor/casos">← Casos del docente</Link><p className={styles.kicker}>AUTORÍA · SPFA 2026</p><h1>Borradores de desarrollo</h1><p>Edita hechos y criterios, guarda una nueva versión y revisa las dos vistas. La publicación requiere auditoría y aprobación explícitas de una revisión concreta. La previsualización no crea sesiones de estudiante.</p></header>
    <div className={styles.layout}>
      <aside className={styles.sidebar}><h2>Casos de partida</h2><p>Al abrirlos por primera vez se guarda una copia de trabajo para tu cuenta. Volver a abrir conserva tus cambios.</p>
        <button disabled={busy} onClick={()=>load('lucia',true)}>Abrir Lucía · Indicación</button><button disabled={busy} onClick={()=>load('maria',true)}>Abrir María · Dispensación</button>
        <h2>Guardados</h2>{list.length===0?<p>Todavía no hay borradores guardados.</p>:list.map(d=><button key={d.caseId} disabled={busy} onClick={()=>load(d.caseId)}>{d.title}<small>Versión {d.revision}</small></button>)}
      </aside>
      <div className={styles.workspace}>
        {error&&<div role="alert" className={styles.error}>{error}</div>}{notice&&<div role="status" className={styles.notice}>{notice}</div>}
        {!f||!draft?<section className={styles.panel}><h2>Elige un caso para comenzar</h2><p>La solución docente y los tratamientos son información reservada. Las plantillas y sus etiquetas requieren revisión docente; no acreditan puntos.</p></section>:<>
          <div className={styles.toolbar}><span className={styles.badge}>BORRADOR · v{draft.revision}{dirty?' · Sin guardar':''}</span><button disabled={busy||!dirty} onClick={save}>{busy?'Procesando…':'Guardar borrador'}</button><button disabled={busy} onClick={()=>{if(dirty){setError('Hay cambios sin guardar. Guarda o utiliza «Descartar cambios y cerrar».');return;}setDraft(null);setNotice('Borrador cerrado. Puedes volver a abrirlo desde Guardados.');}}>Cerrar</button>{dirty&&<button disabled={busy} onClick={()=>{setDraft(null);setDirty(false);setError('');}}>Descartar cambios y cerrar</button>}</div>
          <nav className={styles.tabs} aria-label="Vistas del borrador">{(['edit','student','teacher','review'] as const).map((tab,i)=><button key={tab} aria-pressed={section===tab} onClick={()=>setSection(tab)}>{['Editar','Vista estudiante','Vista docente','Revisión y publicación'][i]}</button>)}</nav>
          <fieldset disabled={busy} className={styles.editor}>
          {section==='review'&&<PublicationReview key={draft.versionId} draft={draft} dirty={dirty}/>}
          {section==='test'&&<PatientPreview key={draft.versionId} draft={draft} onBack={()=>setSection('edit')}/>}
          {section!=='test'&&<p><button disabled={dirty||busy} onClick={()=>setSection('test')}>Probar paciente</button>{dirty&&' Guarda los cambios antes de probar esta revisión.'}</p>}
          {section==='student'&&!preview&&<p role="alert">Completa nombre, edad y sexo para previsualizar la ficha.</p>}
          {section==='student'&&preview&&<section className={styles.panel} aria-label="Ficha inicial del estudiante"><h2>Ficha inicial del estudiante</h2><p>Antes de la entrevista. Vista previa de los campos actuales{dirty?', todavía sin guardar':''}.</p><dl><dt>Nombre</dt><dd>{preview.nombre}</dd><dt>Edad</dt><dd>{preview.edad}</dd><dt>Sexo</dt><dd>{preview.sexo}</dd></dl><p>El resto se descubre durante la entrevista. Aquí no se inicia una conversación ni un intento académico.</p></section>}
          {section==='teacher'&&<section className={styles.panel} aria-label="Contenido reservado al docente"><h2>Contenido reservado al docente</h2><p>{f.title} · {f.service==='INDICATION'?'Indicación':'Dispensación'}</p><h3>Demanda inicial</h3><p>{f.initialDemand}</p><h3>Tratamiento</h3><p>{f.treatment}</p><h3>Hechos y revelación</h3>{f.facts.map(x=><article key={x.id}><h4>{x.id} · {x.label}</h4><p>{x.value}</p><p><strong>Revelación: </strong>{x.disclosure}</p></article>)}<h3>Adherencia</h3><p>{adherenceLabels[f.adherence.conclusion]}</p><p>{f.adherence.period}</p><p>{f.adherence.evidence}</p><p>{f.adherence.interpretation}</p><h3>Solución propuesta</h3><p>{f.teacherSolution}</p><h3>Requisitos propuestos</h3>{f.requirements.map((r,i)=><article key={i}><h4>{r.label} · {r.applicability}</h4><p>{r.goal}</p><p>{r.rationale}</p><small>Hechos {r.factRefs.join(', ')} · Guía pp. {r.guidePages}</small></article>)}<h3>Cuestionario y respuestas</h3>{f.questionnaire.map((q,i)=><article key={i}><h4>{q.question}</h4><p>{q.gradable?q.gradable.options.filter(o=>q.gradable!.correctOptionIds.includes(o.id)).map(o=>o.text).join(' / '):q.answer}</p>{q.gradable&&<><ul>{q.gradable.options.map(o=><li key={o.id}>{o.id}: {o.text}</li>)}</ul><p>{q.gradable.justification}</p></>}<small>Hechos {q.factRefs.join(', ')}</small></article>)}</section>}
          {section==='edit'&&<>
            <NativeAuthoring fields={f} templateId={draft.templateId} caseId={draft.caseId} versionId={draft.versionId} change={change} setBusy={setBusy}/>
            <section className={styles.panel}><h2>Identidad y demanda</h2><Field label="Título del borrador" value={f.title} onChange={title=>change({...f,title})}/><label className={styles.field}>Servicio de entrada<select value={f.service} onChange={e=>change({...f,service:e.target.value as TeacherDraftFields['service']})}><option value="INDICATION">Indicación Farmacéutica</option><option value="DISPENSATION">Dispensación</option></select></label>
              <div className={styles.columns}><Field label="Nombre" value={f.identity.nombre} onChange={nombre=>change({...f,identity:{...f.identity,nombre}})}/><label className={styles.field}>Edad<input type="number" min={0} max={120} value={Number.isNaN(f.identity.edad)?'':f.identity.edad} onChange={e=>change({...f,identity:{...f.identity,edad:e.target.value===''?NaN:Number(e.target.value)}})}/></label><Field label="Sexo" value={f.identity.sexo} onChange={sexo=>change({...f,identity:{...f.identity,sexo}})}/></div>
              <Field label="Demanda inicial" value={f.initialDemand} multiline onChange={initialDemand=>change({...f,initialDemand})}/><Field label="Tratamiento reservado" value={f.treatment} multiline onChange={treatment=>change({...f,treatment})}/>
            </section>
            <section className={styles.panel}><h2>Hechos y reglas de revelación</h2><p>Lo no definido permanece desconocido. El tratamiento no se incorpora a la ficha inicial.</p>{f.facts.map((x,i)=><article key={x.id}><h3>{x.id}</h3><Field label={`Etiqueta ${x.id}`} value={x.label} onChange={label=>change({...f,facts:f.facts.map((v,j)=>j===i?{...v,label}:v)})}/><Field label={`Hecho ${x.id}`} value={x.value} multiline onChange={value=>change({...f,facts:f.facts.map((v,j)=>j===i?{...v,value}:v)})}/><Field label={`Revelación ${x.id}`} value={x.disclosure} multiline onChange={disclosure=>change({...f,facts:f.facts.map((v,j)=>j===i?{...v,disclosure}:v)})}/><button onClick={()=>change({...f,facts:f.facts.filter((_,j)=>j!==i)})}>Eliminar hecho {x.id}</button></article>)}<button onClick={()=>{const n=Math.max(0,...f.facts.map(x=>Number(x.id.slice(1))))+1;change({...f,facts:[...f.facts,{id:`F${n}`,label:'',value:'',disclosure:''}]});}}>Añadir hecho</button></section>
            <section className={styles.panel}><h2>Adherencia y solución docente</h2><p>No detectar omisiones no demuestra adherencia. Explicita periodo, fuente y límites.</p><label className={styles.field}>Conclusión de adherencia<select value={f.adherence.conclusion} onChange={e=>change({...f,adherence:{...f.adherence,conclusion:e.target.value as TeacherDraftFields['adherence']['conclusion']}})}>{Object.entries(adherenceLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>{(['period','evidence','interpretation'] as const).map((key,i)=><Field key={key} label={['Periodo evaluado','Evidencia disponible','Interpretación y límites'][i]} value={f.adherence[key]} multiline onChange={value=>change({...f,adherence:{...f.adherence,[key]:value}})}/>)}{refs(f.adherence.factRefs,factRefs=>change({...f,adherence:{...f.adherence,factRefs}}))}<Field label="Solución docente propuesta" value={f.teacherSolution} multiline onChange={teacherSolution=>change({...f,teacherSolution})}/></section>
            <section className={styles.panel}><h2>Requisitos aplicables</h2><p>Propuestas sin pesos ni aprobación automática. No configures otros servicios.</p>{f.requirements.map((r,i)=><article key={i}>{(['label','goal','rationale','guidePages'] as const).map((key,j)=><Field key={key} label={`${['Requisito','Desempeño observable','Justificación de aplicabilidad','Páginas de la guía'][j]} ${i+1}`} value={r[key]} multiline={key==='goal'||key==='rationale'} onChange={value=>change({...f,requirements:f.requirements.map((v,k)=>k===i?{...v,[key]:value}:v)})}/>)}<label className={styles.field}>Aplicabilidad {i+1}<select value={r.applicability} onChange={e=>change({...f,requirements:f.requirements.map((v,k)=>k===i?{...v,applicability:e.target.value as typeof r.applicability}:v)})}><option value="APPLICABLE">Aplicable</option><option value="NOT_APPLICABLE">No aplicable</option><option value="UNDETERMINED">Por determinar</option></select></label>{refs(r.factRefs,factRefs=>change({...f,requirements:f.requirements.map((v,k)=>k===i?{...v,factRefs}:v)}))}<button onClick={()=>change({...f,requirements:f.requirements.filter((_,j)=>j!==i)})}>Eliminar requisito {i+1}</button></article>)}<button onClick={()=>change({...f,requirements:[...f.requirements,{label:'',goal:'',rationale:'',guidePages:'',factRefs:[],applicability:'UNDETERMINED'}]})}>Añadir requisito</button></section>
            <section className={styles.panel}><h2>Cuestionario reservado</h2>{f.questionnaire.map((q,i)=><article key={i}><Field label={`Pregunta ${i+1}`} value={q.question} multiline onChange={question=>change({...f,questionnaire:f.questionnaire.map((v,j)=>j===i?{...v,question}:v)})}/>{q.gradable?<p>Respuesta derivada de la clave: {q.gradable.options.filter(o=>q.gradable!.correctOptionIds.includes(o.id)).map(o=>o.text).join(' / ')}</p>:<Field label={`Respuesta docente ${i+1}`} value={q.answer} multiline onChange={answer=>change({...f,questionnaire:f.questionnaire.map((v,j)=>j===i?{...v,answer}:v)})}/>}{refs(q.factRefs,factRefs=>change({...f,questionnaire:f.questionnaire.map((v,j)=>j===i?{...v,factRefs}:v)}))}<button onClick={()=>change({...f,questionnaire:f.questionnaire.filter((_,j)=>j!==i)})}>Eliminar pregunta {i+1}</button></article>)}<button onClick={()=>change({...f,questionnaire:[...f.questionnaire,{question:'',answer:'',factRefs:[]}]})}>Añadir pregunta</button></section>
          </>}
          </fieldset>
          <p className={styles.footer}>La prueba docente usa la revisión guardada y requiere habilitación privada del runtime. La pestaña Revisión y publicación muestra los requisitos pendientes del paquete académico y de su auditoría. No introducir datos identificativos de pacientes reales.</p>
        </>}
      </div>
    </div>
  </main>;
}
