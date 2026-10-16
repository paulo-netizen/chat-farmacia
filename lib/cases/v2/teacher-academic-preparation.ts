import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { SPFA_2026_REFERENCE, teacherDraftFieldsSchema, type TeacherDraftRecord } from './teacher-case-draft';
import { projectTeacherPatient } from './teacher-patient-projection';
import { createStudentCasePublicData } from '../student-session-dto';
import { teacherOfficialFetch } from './teacher-official-fetch';

export const PREPARATION_VERSION = 'teacher-academic-preparation/1';
export const sourceCatalog = {
  metformin850: { registration:'68167', ingredient:'metformina', strength:'850',
    url:'https://cima.aemps.es/cima/dochtml/ft/68167/FichaTecnica_68167.html',
    name:'Metformina cinfa 850 mg — referencia comparativa, no marca atribuida al caso' },
  enalapril20: { registration:'63355', ingredient:'enalapril', strength:'20',
    url:'https://cima.aemps.es/cima/dochtml/ft/63355/FT_63355.html',
    name:'Enalapril cinfa 20 mg — referencia comparativa, no marca atribuida al caso' },
} as const;
export type SourceKey = keyof typeof sourceCatalog;
export const digest = (v:unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
export type SourceEvidence = { key:SourceKey; url:string; retrievedAt:string; status:'AVAILABLE'|'UNAVAILABLE'|'CONTENT_UNVERIFIED'; sha256?:string; excerpt?:string; clinicalText?:string; truncated?:boolean; code?:'SOURCE_UNAVAILABLE'|'SOURCE_CONTENT_UNVERIFIED' };

/** Fixed official sources, no user URL, redirects, credentials, retries or patient data in requests. */
export async function readCimaSource(key:SourceKey, fetcher:typeof fetch=teacherOfficialFetch):Promise<SourceEvidence> {
  const source=sourceCatalog[key];
  const base={key,url:source.url,retrievedAt:new Date().toISOString()};
  try {
    const response=await fetcher(source.url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error();
    const reader=response.body?.getReader();if(!reader)throw Error();
    const chunks:Uint8Array[]=[];let bytes=0;
    for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>1000000){await reader.cancel();throw Error();}chunks.push(part.value);}
    const html=Buffer.concat(chunks).toString('utf8');
    const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ')
      .replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_match,code:string)=>{
        const n=code.toLowerCase().startsWith('x')?parseInt(code.slice(1),16):parseInt(code,10);
        return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'�';
      }).replace(/&(nbsp|amp|lt|gt|quot|apos);/g,(_,key:string)=>({nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[key]!)).replace(/\s+/g,' ').trim();
    const normalized=text.toLocaleLowerCase('es');
    if(!normalized.includes(source.ingredient)||!normalized.includes(source.strength)||!normalized.includes('indicaciones terapéuticas'))return {...base,status:'CONTENT_UNVERIFIED',code:'SOURCE_CONTENT_UNVERIFIED'};
    const start=normalized.indexOf('indicaciones terapéuticas');
    const end=normalized.indexOf('propiedades farmacológicas',start);
    const clinical=text.slice(start,end>start?end:text.length);
    return {...base,status:'AVAILABLE',sha256:createHash('sha256').update(html).digest('hex'),excerpt:text.slice(start,start+650),clinicalText:clinical.slice(0,24000),truncated:clinical.length>24000};
  } catch {return {...base,status:'UNAVAILABLE',code:'SOURCE_UNAVAILABLE'};}
}

export const preparationRequestSchema=z.object({expectedDraftVersionId:z.string(),sourceKeys:z.array(z.enum(['metformin850','enalapril20'])).max(2)}).strict()
  .refine(v=>new Set(v.sourceKeys).size===v.sourceKeys.length);

export function prepareAcademicReview(input:TeacherDraftRecord) {
  const draft=structuredClone(input);draft.fields=teacherDraftFieldsSchema.parse(draft.fields);
  const f=draft.fields;
  return {
    contractVersion:PREPARATION_VERSION, draftVersionId:draft.versionId, draftHash:digest(draft),
    sourceRevision:draft.revision, title:f.title,
    studentPublic:createStudentCasePublicData(f.identity),
    patient:projectTeacherPatient(draft),
    teacher:{facts:f.facts, treatment:f.treatment, solution:f.teacherSolution, adherence:f.adherence,
      protocol:{...SPFA_2026_REFERENCE,service:f.service,requirements:f.requirements.map((r,i)=>({id:`requirement-${i+1}`,...r,approval:'PROPOSED' as const}))},
      questionnaire:f.questionnaire.map((q,i)=>({id:`question-${i+1}`,...q,format:'OPEN_RESPONSE_REVIEW' as const,approval:'PROPOSED' as const})),
    },
    // This is a complete review dossier, NOT a fabricated native execution bundle.
    nativePackage:{status:'BLOCKED' as const,format:'GENERATED_CASE_BUNDLE_V2',missing:[
      {code:'COMMUNICATION_PROFILE_UNDEFINED',field:'patient.communicationProfile',decision:'Definir explícitamente el perfil de representación; no inferir personalidad de la adherencia.'},
      {code:'RNM_DECISION_UNRESOLVED',field:'evaluator.rnmAssessments',decision:'El contrato nativo exige RNM/riesgo/no RNM. No determinable no equivale a ausencia. Conservar la incertidumbre y resolver su representación antes de publicar.'},
      {code:'REFERRAL_DECISION_UNRESOLVED',field:'evaluator.referral',decision:'Completar la decisión y los criterios de derivación con su fuente y aplicabilidad; no inferir no derivación.'},
      {code:'CLINICAL_MAPPING_UNREVIEWED',field:'evaluator.versions',decision:'Revisar taxonomías, relaciones y criterios tipados; el texto no constituye una clasificación académica aprobada.'},
      {code:'QUESTIONNAIRE_REVIEW_PENDING',field:'teacher.questionnaire',decision:'Revisar respuestas y justificaciones; las preguntas abiertas no se convierten automáticamente en preguntas calificables de opción única.'},
    ]},
  };
}
export type AcademicReviewPackage=ReturnType<typeof prepareAcademicReview>;
export const auditDimensions=['problem_treatment','regimen','context','prm','rnm','adherence_barrier','barrier_strategy','intervention','referral','internal_consistency','spain','questionnaire'] as const;
export function auditAcademicReview(pkg:AcademicReviewPackage,sources:SourceEvidence[]) {
  const snapshot=structuredClone(pkg), evidence=structuredClone(sources);
  return {
    contractVersion:'teacher-clinical-audit/1',packageHash:digest(snapshot),draftVersionId:snapshot.draftVersionId,
    structural:{status:'PASS',scope:'Validación del expediente, bindings y referencias. No equivale al paquete ejecutable ni a coherencia clínica.'},
    sources:{status:evidence.length&&evidence.every(s=>s.status==='AVAILABLE')?'AVAILABLE':'PENDING',evidence,
      scope:'Consulta de fichas comparativas CIMA. No identifica la marca del paciente ni demuestra adecuación individual de pauta, seguridad o efectividad.'},
    auditor:{status:'PENDING',method:'bounded-prerequisite-review/1',
      findings:snapshot.nativePackage.missing,
      dimensions:auditDimensions.map(id=>({id,status:'PENDING',reason:'Juicio clínico independiente no ejecutado; no deducir PASS de la disponibilidad de una fuente.'})),
    },
    human:{status:'PENDING'},status:'PENDING',
  };
}
