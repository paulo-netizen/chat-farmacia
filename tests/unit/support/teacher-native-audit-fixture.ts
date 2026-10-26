import {auditDimensions,digest,sourceCatalog,type SourceEvidence} from '@/lib/cases/v2/teacher-academic-preparation';
import {AUDITOR_VERSION,AUDITOR_WIRE,auditorRequest} from '@/lib/cases/v2/teacher-clinical-auditor';
export const syntheticSources:SourceEvidence[]=[{key:'metformin850',url:sourceCatalog.metformin850.url,retrievedAt:'2026-10-26T10:00:00Z',status:'AVAILABLE',sha256:'a'.repeat(64),clinicalText:'Fuente sintética para probar el vínculo, no evidencia clínica real.'}];
export function syntheticResult(input:Parameters<typeof auditorRequest>[0],sources:SourceEvidence[],status:'PASS'|'WARNING'|'FAIL'|'INSUFFICIENT'='PASS'){
 return {version:AUDITOR_VERSION,packageHash:digest(input),requestHash:digest(auditorRequest(input,sources)),model:AUDITOR_WIRE.model,judgment:{dimensions:auditDimensions.map(id=>({id,status,reason:'Juicio sintético técnico; no aprobación real.',factRefs:['F1'],sourceKeys:[] as ('metformin850'|'enalapril20')[],proposal:''}))},usage:{input:10,output:10,cachedRead:0,cachedWrite:0},requestId:'req_synthetic_native',countRequestId:undefined,costMicroUsd:140,reservation:96025,countCost:null};
}
