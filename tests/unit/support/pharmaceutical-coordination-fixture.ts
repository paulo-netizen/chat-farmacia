import { recordFixture, uuid } from './pharmaceutical-evaluation-record-fixture';
import { createPatientRuntimeViewV2 } from '../../../lib/cases/v2/patient-runtime';
import { bindPharmaceuticalEvaluationExecutionV2 } from '../../../lib/cases/v2/coordinate-pharmaceutical-evaluation';

export async function coordinationFixture(options?: Parameters<typeof recordFixture>[0]) {
  const f = await recordFixture(options), base = await recordFixture();
  const plan = base.intent.executionPlan;
  if (plan.d1.mode !== 'SEMANTIC' || plan.d2.mode !== 'SEMANTIC') throw new Error('synthetic semantic plans required');
  let i = 100;
  const execution = bindPharmaceuticalEvaluationExecutionV2({ ...plan, d1: plan.d1, d2: plan.d2 }, {
    d1: request => f.d1.adjudicateBatch(request), d2: () => f.d2.detectClaims(),
    allocateD1ExecutionId: () => `pharm_sem_exec_${uuid(++i)}`, allocateD2ExecutionId: () => `pharm_sem_exec_${uuid(++i)}`,
  });
  f.d1.adjudicateBatch.mockClear(); f.d2.detectClaims.mockClear();
  const settings = { expectationSet: f.sources.contextSource.expectationSet, configuration: f.sources.configuration,
    d1SemanticAcceptance: f.intent.d1SemanticAcceptance, d2: f.intent.d2 };
  const access = { ownerId: '1', sessionId: f.intent.sessionId };
  const command = { evaluationId: uuid(101), idempotencyKey: uuid(102), attemptId: uuid(103), workerId: uuid(104), leaseDurationMs: 60000 };
  return { ...f, execution, settings, access, command };
}

/** Complete synthetic patient/evaluator envelope, not an approved product case. Resolved without mocks. */
export function syntheticCaseContent(f: Awaited<ReturnType<typeof coordinationFixture>>) {
  const ref = f.sources.contextSource.clinicalReference;
  const factId = 'fact_10000000-0000-4000-8000-000000000001';
  const known = (value: string, id: string) => ({ state: 'known', factId: id, value, certainty: 'exact', disclosure: { mode: 'spontaneous' } });
  const na = { state: 'not_applicable', reasonCode: 'not_applicable_to_patient' };
  const patientFacts = { schemaVersion: '2.0', caseVersionId: ref.caseVersionId,
    publicProfile: { nombre: 'Paciente P3 sintético', edad: 68, sexo: 'mujer', tratamiento: 'Sin medicación' },
    initialDemand: known('Solicita consejo', factId),
    encounter: { personPresent: known('patient', 'fact_10000000-0000-4000-8000-000000000002'), relationshipToPatient: na },
    clinicalContext: { healthProblems: [], clinicalHistory: [], physiologicalSituation: [], pregnancyAndLactation: na,
      allergiesAndIntolerances: [], lifestyle: [], biomedicalData: [] }, symptoms: [],
    pharmacotherapy: { prescribedMedications: [], otherMedicinesAndProducts: [], actualMedicationUse: [], recentChanges: [], perceivedEffectiveness: [], perceivedSafety: [] },
    actionsAlreadyTaken: [], practicalDifficulties: [], beliefsAndConcerns: [], strategiesAlreadyTried: [], dailyAndSocialContext: [],
    familyAndSocialSupport: [], relationshipWithProfessionals: [], communicationProfile: f.sources.contextSource.patientRuntime.communicationProfile };
  const cc = ref.clinicalConclusions;
  const evaluator = { schemaVersion: '2.0', caseVersionId: ref.caseVersionId, versions: ref.versions,
    carePath: ref.structuralContext.carePath, ...cc,
    incidence: { ...cc.incidence, followUpEpisodes: ref.structuralContext.followUpEpisodes },
    prmRnmRelations: ref.structuralContext.prmRnmRelations,
    evidenceRules: [cc.incidence.assessment, cc.prm.assessment, ...cc.rnmAssessments, cc.referral].map(c => ({
      conclusionRef: c.conclusionId, requiredEvidence: { operator: 'fact', factRef: factId }, supportingEvidenceRefs: [], counterEvidenceRefs: [], teacherRationale: 'P3 synthetic only',
    })) };
  return { schemaVersion: '2.0', sourceOfTruth: { caseVersionId: ref.caseVersionId, patientFacts, evaluator, spfaProtocolSet: {} },
    derived: { patientRuntime: createPatientRuntimeViewV2(patientFacts), teachingSummary: { caseVersionId: ref.caseVersionId }, complianceReport: { caseVersionId: ref.caseVersionId } } };
}
