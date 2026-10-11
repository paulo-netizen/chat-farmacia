import { z } from 'zod';
import { personalizationAdjudicationSchemaV3, type PersonalizationRequestV3, type PersonalizationEvaluationV3 } from './personalization-contract';
import { CovDiagnosticError, covDiagnostic, type CovIssue, type CovDiagnosticCode } from './cov-diagnostics';
import { resolveSourceLiteral, validateSourceSpan } from './cov-source-citations';

const oldLink = personalizationAdjudicationSchemaV3.shape.links.element;
// Difficulty is recorded once, per proposal. Responses refer to its evidence by zero-based index.
const link = oldLink.extend({
  patientResponse: oldLink.shape.patientResponse.unwrap().extend({ kind: z.enum(['ACCEPTANCE', 'UNCERTAIN']) }).strict().optional(),
  responseToDifficulty: z.object({ difficultyIndex: z.number().int().nonnegative(), response: oldLink.shape.proposal }).strict().optional(),
}).strict();
export const cov3AdjudicationV4 = personalizationAdjudicationSchemaV3.omit({ difficulty: true }).extend({
  contractVersion: z.literal('personalization-adjudication/4'), links: z.array(link),
}).strict();
export type Cov3RequestV4 = Omit<PersonalizationRequestV3, 'contractVersion' | 'instructionsVersion'> & {
  contractVersion: 'personalization-request/4'; instructionsVersion: 'personalization-instructions/5';
};
export type Cov3RuntimeV4 = Readonly<{ runtimeRef: string; adjudicate(request: Cov3RequestV4): Promise<unknown> }>;
export type Cov3EvaluationV4 = Omit<PersonalizationEvaluationV3, 'contractVersion' | 'difficulty' | 'links'> & {
  contractVersion: 'personalization-evaluation/4'; links: z.infer<typeof cov3AdjudicationV4>['links'];
};
const literal = z.object({ quote: z.string(), occurrence: z.number().nullable() }).strict();
const student = literal.extend({ source: z.literal('STUDENT_MESSAGE'), messageId: z.string() }).strict();
const patient = literal.extend({ source: z.literal('PATIENT_MESSAGE'), messageId: z.string() }).strict();
const publicSource = literal.extend({ source: z.literal('PUBLIC'), field: z.enum(['nombre', 'edad', 'sexo', 'tratamiento']) }).strict();
export const cov3ProviderV5 = cov3AdjudicationV4.extend({
  contractVersion: z.literal('personalization-canonical-sources-adjudication/5'),
  criteria: z.array(cov3AdjudicationV4.shape.criteria.element.extend({ studentEvidence: z.array(student) }).strict()),
  links: z.array(link.extend({
    circumstances: z.array(z.discriminatedUnion('source', [patient, publicSource])), proposal: student,
    patientProposal: patient.nullable(), withdrawal: student.nullable(), feasibilityCheck: student.nullable(),
    patientResponse: z.object({ kind: z.enum(['ACCEPTANCE', 'UNCERTAIN']), evidence: patient }).strict().nullable(),
    difficulty: z.object({ status: z.enum(['PRESENT', 'NOT_OBSERVED', 'UNCERTAIN']), evidence: z.array(patient) }).strict(),
    responseToDifficulty: z.object({ difficultyIndex: z.number().int().nonnegative(), response: student }).strict().nullable(),
  }).strict()),
}).strict();

export function cov3Issue(code: CovDiagnosticCode, field: CovIssue['field'], stage: CovIssue['stage'] = 'VALIDATION', requiredRole: CovIssue['requiredRole'] = 'NONE', referenceType: CovIssue['referenceType'] = 'STATE'): CovIssue {
  return { code, field, stage, requiredRole, referenceType };
}
export function throwCov3Issues(issues: CovIssue[]): void {
  if (issues.length) throw new CovDiagnosticError(issues[0].code, [...new Set(issues.map(i => i.code))], issues);
}
// Map a schema's internal paths into a fixed vocabulary, never expose paths or arbitrary keys.
function location(path: (string | number)[]): CovIssue['field'] {
  const p = path.filter(x => typeof x === 'string');
  if (p[0] === 'requestDigest') return 'REQUEST_DIGEST';
  if (p[0] === 'criteria') return p[1] === 'studentEvidence' ? 'STUDENT_EVIDENCE' : p[1] === 'linkRef' ? 'CRITERION_LINK' : p[1] === 'status' ? 'CRITERION_STATUS' : 'CRITERIA';
  if (p[0] === 'incompatibilities') return 'INCOMPATIBILITY';
  if (p[0] !== 'links') return 'OUTPUT';
  const fields: Record<string, CovIssue['field']> = { circumstances:'CIRCUMSTANCE', proposal:'PROPOSAL', attribution:'ATTRIBUTION', patientProposal:'PATIENT_PROPOSAL', standing:'STANDING', withdrawal:'WITHDRAWAL', feasibilityCheck:'FEASIBILITY_CHECK', patientResponse:'PATIENT_RESPONSE' };
  if (p[1] === 'difficulty') return p[2] === 'evidence' ? 'DIFFICULTY_EVIDENCE' : 'DIFFICULTY_STATE';
  if (p[1] === 'responseToDifficulty') return p[2] === 'response' ? 'RESPONSE_ACTION' : 'RESPONSE_DIFFICULTY_REF';
  return Object.hasOwn(fields, p[1]) ? fields[p[1]] : 'LINKS';
}
function roleFor(field: CovIssue['field']): CovIssue['requiredRole'] {
  if (field === 'CIRCUMSTANCE') return 'PATIENT_OR_PUBLIC';
  return ['PROPOSAL','WITHDRAWAL','FEASIBILITY_CHECK','RESPONSE_ACTION','STUDENT_EVIDENCE'].includes(field) ? 'STUDENT'
    : ['PATIENT_PROPOSAL','PATIENT_RESPONSE','DIFFICULTY_EVIDENCE'].includes(field) ? 'PATIENT' : 'NONE';
}
export function parseCov3<T>(schema: z.ZodType<T>, value: unknown, stage: CovIssue['stage']): T {
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  throwCov3Issues(r.error.issues.map(i => {
    const field = location(i.path), role = roleFor(field);
    // The domain span schema checks integer offsets (start >= 0, end > 0) before resolution.
    const invalidRange = stage === 'VALIDATION' && role !== 'NONE' &&
      (i.path.at(-1) === 'start' || i.path.at(-1) === 'end');
    return cov3Issue(invalidRange ? 'SOURCE_CITATION_RANGE_INVALID' : stage === 'ADAPTER' ? 'PROVIDER_SCHEMA_INVALID' : 'ADJUDICATION_SCHEMA_INVALID', field, stage, role, role === 'NONE' ? 'STRUCTURE' : role === 'PATIENT_OR_PUBLIC' ? 'SOURCE' : 'MESSAGE');
  }));
  throw new CovDiagnosticError('ADJUDICATION_SCHEMA_INVALID');
}
export function cov3EligibleSources(q: Cov3RequestV4) {
  return { STUDENT_MESSAGE: q.untrustedData.messages.filter(m => m.role === 'student').map(m => m.messageId),
    PATIENT_MESSAGE: q.untrustedData.messages.filter(m => m.role === 'patient').map(m => m.messageId),
    PUBLIC: ['nombre','edad','sexo','tratamiento'] };
}

/** Preflight all independent citations before any relationship/temporal validation. */
export function adaptCov3V5(value: unknown, q: Cov3RequestV4) {
  const r = parseCov3(cov3ProviderV5, value, 'ADAPTER'), issues: CovIssue[] = [];
  const msg = (c: z.infer<typeof student> | z.infer<typeof patient>, field: CovIssue['field'], role: 'student' | 'patient') => {
    try {
      const m = q.untrustedData.messages.find(m => m.messageId === c.messageId);
      if (!m) throw new CovDiagnosticError('SOURCE_REFERENCE_NOT_FOUND');
      if (m.role !== role) throw new CovDiagnosticError('SOURCE_ROLE_INVALID');
      return { messageId:c.messageId, ...resolveSourceLiteral(c, m.content) };
    } catch (e) { issues.push(cov3Issue(covDiagnostic(e,'SOURCE_CITATION_INVALID').code,field,'ADAPTER',role === 'student' ? 'STUDENT':'PATIENT','MESSAGE')); return undefined!; }
  };
  const result = { ...r, contractVersion:'personalization-adjudication/4' as const,
    criteria:r.criteria.map(c => ({...c,studentEvidence:c.studentEvidence.map(e=>msg(e,'STUDENT_EVIDENCE','student'))})),
    links:r.links.map(l=>({...l,
      circumstances:l.circumstances.map(c=>{
        if(c.source==='PATIENT_MESSAGE') return {source:'TRANSCRIPT' as const,...msg(c,'CIRCUMSTANCE','patient')};
        try {return {source:'PUBLIC' as const,field:c.field,...resolveSourceLiteral(c,String(q.untrustedData.context.publicProfile[c.field]))};}
        catch(e){issues.push(cov3Issue(covDiagnostic(e,'SOURCE_CITATION_INVALID').code,'CIRCUMSTANCE','ADAPTER','PUBLIC','PUBLIC_FIELD'));return undefined!;}
      }), proposal:msg(l.proposal,'PROPOSAL','student'),
      patientProposal:l.patientProposal===null?undefined:msg(l.patientProposal,'PATIENT_PROPOSAL','patient'),
      withdrawal:l.withdrawal===null?undefined:msg(l.withdrawal,'WITHDRAWAL','student'),
      feasibilityCheck:l.feasibilityCheck===null?undefined:msg(l.feasibilityCheck,'FEASIBILITY_CHECK','student'),
      patientResponse:l.patientResponse===null?undefined:{...l.patientResponse,evidence:msg(l.patientResponse.evidence,'PATIENT_RESPONSE','patient')},
      difficulty:{...l.difficulty,evidence:l.difficulty.evidence.map(e=>msg(e,'DIFFICULTY_EVIDENCE','patient'))},
      responseToDifficulty:l.responseToDifficulty===null?undefined:{...l.responseToDifficulty,response:msg(l.responseToDifficulty.response,'RESPONSE_ACTION','student')},
    })) };
  throwCov3Issues(issues); // No partially adapted result can reach the evaluator.
  return result;
}

export function validateCov3Citations(r: z.infer<typeof cov3AdjudicationV4>, q: Cov3RequestV4) {
  const issues: CovIssue[]=[];
  const check=(span:z.infer<typeof oldLink.shape.proposal>,field:CovIssue['field'],role:'student'|'patient')=>{
    try{const m=q.untrustedData.messages.find(m=>m.messageId===span.messageId);if(!m)throw new CovDiagnosticError('SOURCE_REFERENCE_NOT_FOUND');if(m.role!==role)throw new CovDiagnosticError('SOURCE_ROLE_INVALID');validateSourceSpan(span,m.content);}
    catch(e){issues.push(cov3Issue(covDiagnostic(e,'SOURCE_CITATION_INVALID').code,field,'VALIDATION',role==='student'?'STUDENT':'PATIENT','MESSAGE'));}
  };
  r.criteria.forEach(c=>c.studentEvidence.forEach(e=>check(e,'STUDENT_EVIDENCE','student')));
  r.links.forEach(l=>{
    check(l.proposal,'PROPOSAL','student');
    l.circumstances.forEach(c=>{if(c.source==='TRANSCRIPT')check(c,'CIRCUMSTANCE','patient');else try{validateSourceSpan(c,String(q.untrustedData.context.publicProfile[c.field]));}catch(e){issues.push(cov3Issue(covDiagnostic(e,'SOURCE_CITATION_INVALID').code,'CIRCUMSTANCE','VALIDATION','PUBLIC','PUBLIC_FIELD'));}});
    if(l.patientProposal)check(l.patientProposal,'PATIENT_PROPOSAL','patient');
    if(l.withdrawal)check(l.withdrawal,'WITHDRAWAL','student');
    if(l.feasibilityCheck)check(l.feasibilityCheck,'FEASIBILITY_CHECK','student');
    if(l.patientResponse)check(l.patientResponse.evidence,'PATIENT_RESPONSE','patient');
    l.difficulty.evidence.forEach(e=>check(e,'DIFFICULTY_EVIDENCE','patient'));
    if(l.responseToDifficulty)check(l.responseToDifficulty.response,'RESPONSE_ACTION','student');
  });
  throwCov3Issues(issues);
}
