import { z } from 'zod';
import type { PatientRuntimeViewV2 } from './types';
import { buildPharmaceuticalD1BatchPlanV1 } from './build-pharmaceutical-d1-batch-plan';
import { buildPharmaceuticalD1SemanticBatchRequestV2 } from './build-pharmaceutical-d1-semantic-request';
import { validatePharmaceuticalD1SemanticExecutionMetadataV2, calculatePharmaceuticalTargetSemanticAdjudicationSetFingerprintV1 } from './validate-pharmaceutical-d1-adjudication';
import { buildPharmaceuticalD2RelationalSemanticRequestV2, pharmaceuticalD2ClinicalRefKey } from './build-pharmaceutical-d2-semantic-request';
import { calculatePharmaceuticalD2ClaimIdV2, calculatePharmaceuticalClinicalClaimFindingSetFingerprintV1 } from './build-pharmaceutical-d2-claim-findings';
import { validatePharmaceuticalAdjudicationContextSetV2 } from './validate-pharmaceutical-adjudication-context';
import { validatePharmaceuticalScoringConfigurationV2, pharmaceuticalScoringConfigBinding } from './build-pharmaceutical-scoring-policy';
import { pharmaceuticalScoringExpectationBinding } from './build-pharmaceutical-scoring-plan';
import { canonicalPharmaceuticalReviewFlags } from './build-pharmaceutical-score-input';
import { freezeScoring, scoringFingerprint } from './pharmaceutical-scoring-contract-utils';
import { pharmaceuticalSessionScoreSchema, type PharmaceuticalReviewFlagV2 } from './pharmaceutical-scoring-types';
import { recordEqual, recordFail, recordGuard, recordKeys, recordParse, operationalFingerprint } from './pharmaceutical-evaluation-record-utils';
import {
  PHARMACEUTICAL_SOURCE_CANONICALIZATION, PHARMACEUTICAL_RESULT_CANONICALIZATION,
  sourceArtifactRefSchema, resultArtifactRefSchema, type PharmaceuticalEvaluationSourcesV2,
  type PharmaceuticalEvaluationResultV2, type PharmaceuticalEvaluationIntentV2,
  type PharmaceuticalEvaluationArtifactResolverV2, type PharmaceuticalEvaluationArtifactRefV2,
} from './pharmaceutical-evaluation-record-types';

/** Reuses source reconstruction/validation; no provider witness archive or numeric calculation. */
export function validatePharmaceuticalEvaluationSourcesV2(value: unknown): PharmaceuticalEvaluationSourcesV2 {
  return recordGuard('INVALID_ARTIFACT', () => {
    const raw = recordKeys(value, ['contextSource', 'context', 'configuration']);
    recordKeys(raw.contextSource, ['patientRuntime', 'clinicalReference', 'targetSet', 'expectationSet', 'transcript', 'candidateSet']);
    // Pin the runtime envelope; existing context reconstruction validates its medication
    // projection and the other source contracts. This is not a new patient validator.
    const contextSource = raw.contextSource as Record<string, unknown>;
    recordKeys(contextSource.patientRuntime, [
      'schemaVersion', 'caseVersionId', 'publicProfile', 'initialDemand', 'encounter', 'clinicalContext',
      'symptoms', 'pharmacotherapy', 'actionsAlreadyTaken', 'practicalDifficulties', 'beliefsAndConcerns',
      'strategiesAlreadyTried', 'dailyAndSocialContext', 'familyAndSocialSupport',
      'relationshipWithProfessionals', 'communicationProfile',
    ] satisfies (keyof PatientRuntimeViewV2)[]);
    const source = raw.contextSource as PharmaceuticalEvaluationSourcesV2['contextSource'];
    const context = validatePharmaceuticalAdjudicationContextSetV2(raw.context, source);
    const configuration = validatePharmaceuticalScoringConfigurationV2(raw.configuration, source);
    recordEqual(raw.context, context); recordEqual(raw.configuration, configuration);
    // Private detached source retains legacy mutable-array types; never mutate the caller's source.
    return { contextSource: structuredClone(source), context, configuration };
  });
}
export function pharmaceuticalEvaluationSourceRefV2(value: PharmaceuticalEvaluationSourcesV2) {
  const source = validatePharmaceuticalEvaluationSourcesV2(value);
  return freezeScoring({ kind: 'SOURCES' as const, contractVersion: 'pharmaceutical-evaluation-sources/1' as const,
    fingerprint: { ...operationalFingerprint(PHARMACEUTICAL_SOURCE_CANONICALIZATION, source), canonicalization: PHARMACEUTICAL_SOURCE_CANONICALIZATION } });
}
export function pharmaceuticalEvaluationResultRefV2(value: PharmaceuticalEvaluationResultV2) {
  return freezeScoring({ kind: 'RESULT' as const, contractVersion: 'pharmaceutical-evaluation-result/1' as const,
    fingerprint: { ...operationalFingerprint(PHARMACEUTICAL_RESULT_CANONICALIZATION, value), canonicalization: PHARMACEUTICAL_RESULT_CANONICALIZATION } });
}
export function resolvePharmaceuticalEvaluationArtifactV2(ref: PharmaceuticalEvaluationArtifactRefV2, resolve: PharmaceuticalEvaluationArtifactResolverV2): unknown {
  return recordGuard('INVALID_ARTIFACT', () => {
    const parsed = ref.kind === 'SOURCES' ? recordParse(sourceArtifactRefSchema, ref) : recordParse(resultArtifactRefSchema, ref);
    const artifact = resolve(freezeScoring(parsed));
    if (artifact === undefined || artifact === null) recordFail('MISSING_ARTIFACT');
    const copy: unknown = structuredClone(artifact);
    recordEqual(parsed.fingerprint, operationalFingerprint(parsed.fingerprint.canonicalization, copy), 'INTEGRITY_MISMATCH');
    return copy;
  });
}
export function validatePharmaceuticalEvaluationSourceBindingsV2(intent: PharmaceuticalEvaluationIntentV2, sources: PharmaceuticalEvaluationSourcesV2) {
  const { context, configuration: c } = sources;
  recordEqual([intent.sessionId, intent.caseVersionId, intent.transcriptFingerprint], [context.sessionId, context.caseVersionId, context.transcriptFingerprint]);
  recordEqual(intent.configuration, { policy: pharmaceuticalScoringConfigBinding(c.policy), plan: pharmaceuticalScoringConfigBinding(c.plan),
    weights: pharmaceuticalScoringConfigBinding(c.weights), thresholds: pharmaceuticalScoringConfigBinding(c.thresholds), rounding: pharmaceuticalScoringConfigBinding(c.rounding) });
  const d1Calls = buildPharmaceuticalD1BatchPlanV1(context).semanticBatches.length > 0;
  if ((intent.executionPlan.d1.mode === 'SEMANTIC') !== d1Calls) recordFail('BINDING_MISMATCH');
  const hasStudent = sources.contextSource.transcript.messages.some(m => m.role === 'student');
  const plan = intent.executionPlan.d2;
  if (intent.d2.status === 'NOT_PROVIDED') recordEqual(plan, { mode: 'NO_CALL', reason: 'NOT_REQUESTED' });
  else if (!hasStudent) recordEqual(plan, { mode: 'NO_CALL', reason: 'EMPTY_STUDENT_MESSAGES' });
  else if (plan.mode !== 'SEMANTIC') recordFail('BINDING_MISMATCH');
}

/** Read-side structure/integrity only. Does NOT reconstruct provider responses or call E1/E2.
 * Canonical D1/D2 shapes are checked in place against their existing types and sources,
 * without defining a second clinical schema or representing reconstructed witnesses as evidence.
 */
export function validatePharmaceuticalEvaluationResultV2(value: unknown, sources: PharmaceuticalEvaluationSourcesV2, intent: PharmaceuticalEvaluationIntentV2): PharmaceuticalEvaluationResultV2 {
  return recordGuard('INVALID_ARTIFACT', () => {
    const root = recordKeys(value, ['d1', 'd2', 'score']);
    const { context, configuration: config } = sources;
    const d1Keys = ['schemaVersion', 'contractVersion', 'sessionId', 'caseVersionId', 'transcriptFingerprint', 'targetSetFingerprint', 'contextFingerprint', 'batchPlanVersion', 'executions', 'adjudications'];
    recordKeys(root.d1, [...d1Keys, 'fingerprint']);
    // These casts are local views of unknown data, not a substitute for validation below.
    const d1 = root.d1 as PharmaceuticalEvaluationResultV2['d1'];
    recordEqual([d1.schemaVersion, d1.contractVersion, d1.sessionId, d1.caseVersionId, d1.transcriptFingerprint, d1.targetSetFingerprint, d1.contextFingerprint, d1.batchPlanVersion],
      ['2.0', 'pharmaceutical-target-semantic-adjudication-set/1', context.sessionId, context.caseVersionId, context.transcriptFingerprint, context.targetSetFingerprint, context.fingerprint, 'pharmaceutical-d1-batch-plan/1']);
    const batches = buildPharmaceuticalD1BatchPlanV1(context);
    if (!Array.isArray(d1.executions) || d1.executions.length !== batches.semanticBatches.length) recordFail('INVALID_ARTIFACT');
    const executionIds = new Set<string>();
    d1.executions.forEach((execution, i) => {
      const request = buildPharmaceuticalD1SemanticBatchRequestV2(context, batches.semanticBatches[i].batchDomain, 'pharmaceutical-d1-adjudication-prompt/3');
      recordEqual(execution, validatePharmaceuticalD1SemanticExecutionMetadataV2(execution, request));
      const plan = intent.executionPlan.d1;
      if (plan.mode !== 'SEMANTIC' || execution.provider !== plan.provider || execution.responseModel !== plan.requestedModel || executionIds.has(execution.semanticExecutionRef)) recordFail('BINDING_MISMATCH');
      executionIds.add(execution.semanticExecutionRef);
    });
    if (!Array.isArray(d1.adjudications) || d1.adjudications.length !== context.targets.length) recordFail('INVALID_ARTIFACT');
    const outcomes = d1.adjudications.map((a, i) => {
      const target = context.targets[i];
      recordEqual(a.targetRef, target.targetRef);
      if (target.structuralState.status === 'NO_STUDENT_CANDIDATES') {
        recordEqual(a, { targetRef: target.targetRef, resolution: 'STRUCTURAL_NO_STUDENT_CANDIDATES' });
        return { targetRef: target.targetRef, resolution: 'STRUCTURAL_NO_STUDENT_CANDIDATES' as const };
      }
      if (a.resolution !== 'SEMANTIC') recordFail('INVALID_ARTIFACT');
      const execution = d1.executions.find(e => e.includedTargetRefs.includes(a.targetRef));
      if (!execution || execution.semanticExecutionRef !== a.semanticExecutionRef) recordFail('BINDING_MISMATCH');
      const evidence = a.verdict === 'CORRECTLY_DEMONSTRATED' ? a.supportingEvidenceRefs : a.verdict === 'INCORRECT_OR_CONTRADICTED' ? a.contradictionEvidenceRefs
        : a.verdict === 'UNCERTAIN' ? a.relatedEvidenceRefs : a.verdict === 'NOT_DEMONSTRATED' ? a.evidenceRefs : recordFail('INVALID_ARTIFACT');
      const key = a.verdict === 'CORRECTLY_DEMONSTRATED' ? 'supportingEvidenceRefs' : a.verdict === 'INCORRECT_OR_CONTRADICTED' ? 'contradictionEvidenceRefs' : a.verdict === 'UNCERTAIN' ? 'relatedEvidenceRefs' : 'evidenceRefs';
      recordKeys(a, ['targetRef', 'resolution', 'verdict', key, 'semanticExecutionRef']);
      if (!Array.isArray(evidence) || (a.verdict === 'NOT_DEMONSTRATED' ? evidence.length !== 0 : evidence.length === 0)) recordFail('INVALID_ARTIFACT');
      const seen = new Set<string>();
      evidence.forEach(e => {
        recordKeys(e, ['targetRef', 'messageRef', 'speaker', 'evidenceRole', 'evidenceKind', 'excerpt']);
        const candidate = target.studentCandidates.find(c => c.messageRef === e.messageRef);
        if (!candidate || e.targetRef !== target.targetRef || e.speaker !== 'student' || e.evidenceRole !== 'STUDENT_DEMONSTRATION' ||
          !candidate.candidateEvidenceKinds.includes(e.evidenceKind) || typeof e.excerpt !== 'string' || !e.excerpt.trim() || !candidate.untrustedContent.includes(e.excerpt)) recordFail('INVALID_ARTIFACT');
        const key = JSON.stringify(e);
        if (seen.has(key)) recordFail('INVALID_ARTIFACT'); seen.add(key);
      });
      return { targetRef: a.targetRef, resolution: a.resolution, verdict: a.verdict, semanticExecutionRef: a.semanticExecutionRef };
    });
    recordEqual(d1.fingerprint, calculatePharmaceuticalTargetSemanticAdjudicationSetFingerprintV1({
      schemaVersion: d1.schemaVersion, contractVersion: d1.contractVersion, sessionId: d1.sessionId, caseVersionId: d1.caseVersionId,
      transcriptFingerprint: d1.transcriptFingerprint, targetSetFingerprint: d1.targetSetFingerprint, contextFingerprint: d1.contextFingerprint,
      batchPlanVersion: d1.batchPlanVersion, executions: d1.executions, adjudications: d1.adjudications,
    }), 'INTEGRITY_MISMATCH');
    const d2 = root.d2 as PharmaceuticalEvaluationResultV2['d2'];
    const flags: PharmaceuticalReviewFlagV2[] = [];
    if (intent.d1SemanticAcceptance === 'VALIDATION_DEBT') flags.push({ code: 'UPSTREAM_VALIDATION_DEBT', lane: 'D1' });
    for (const a of outcomes) if (a.resolution === 'SEMANTIC') {
      if (a.verdict === 'UNCERTAIN') flags.push({ code: 'UNCERTAIN_D1', targetRef: a.targetRef });
      if (a.verdict === 'INCORRECT_OR_CONTRADICTED' && config.policy.reviewPreferences.reviewIncorrectD1) flags.push({ code: 'INCORRECT_D1', targetRef: a.targetRef });
    }
    const request = buildPharmaceuticalD2RelationalSemanticRequestV2(context, 'pharmaceutical-d2-claim-prompt/5');
    if (intent.d2.status === 'NOT_PROVIDED') recordEqual(d2, intent.d2);
    else {
      recordKeys(d2, ['status', 'findingSet', 'executions']);
      if (d2.status !== 'PROVIDED') recordFail('BINDING_MISMATCH');
      if (intent.d2.semanticAcceptance === 'VALIDATION_DEBT') flags.push({ code: 'UPSTREAM_VALIDATION_DEBT', lane: 'D2' });
      const set = d2.findingSet;
      recordKeys(set, ['schemaVersion', 'contractVersion', 'sessionId', 'caseVersionId', 'contextFingerprint', 'policyVersion', 'requestFingerprint', 'findings', 'fingerprint']);
      recordEqual([set.schemaVersion, set.contractVersion, set.sessionId, set.caseVersionId, set.contextFingerprint, set.policyVersion, set.requestFingerprint],
        ['2.0', 'pharmaceutical-clinical-claim-finding-set/1', context.sessionId, context.caseVersionId, context.fingerprint, request.policyVersion, request.requestFingerprint]);
      const hasCalls = intent.executionPlan.d2.mode === 'SEMANTIC';
      if (!Array.isArray(d2.executions) || d2.executions.length !== (hasCalls ? 1 : 0) || !Array.isArray(set.findings) || (!hasCalls && set.findings.length)) recordFail('INVALID_ARTIFACT');
      for (const e of d2.executions) {
        recordKeys(e, ['semanticExecutionRef', 'lane', 'provider', 'responseModel', 'promptVersion', 'policyVersion', 'requestFingerprint']);
        const plan = intent.executionPlan.d2;
        recordParse(z.string().regex(/^pharm_sem_exec_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/), e.semanticExecutionRef);
        if (plan.mode !== 'SEMANTIC' || e.responseModel !== plan.requestedModel || executionIds.has(e.semanticExecutionRef)) recordFail('BINDING_MISMATCH');
        recordEqual([e.lane, e.provider, e.promptVersion, e.policyVersion, e.requestFingerprint], ['D2', 'openai', request.promptVersion, request.policyVersion, request.requestFingerprint]);
      }
      const ids = new Set<string>();
      const allowedRefs = new Set(request.authorityProjection.allowedClinicalRefs.map(pharmaceuticalD2ClinicalRefKey));
      for (const f of set.findings) {
        recordKeys(f, ['claimId', 'messageRef', 'excerpt', 'excerptStart', 'excerptEnd', 'domain', 'findingType', 'claimForm', 'relatedClinicalRefs']);
        recordParse(z.enum(['PRM', 'RNM_RELATION', 'ADHERENCE', 'PROFESSIONAL_RESPONSE', 'REFERRAL_REPORT']), f.domain);
        recordParse(z.enum(['CONTRADICTORY', 'UNSUPPORTED']), f.findingType);
        recordParse(z.enum(['ASSERTION', 'CONCLUSION', 'RECOMMENDATION']), f.claimForm);
        const m = request.studentMessages.messages.find(m => m.messageRef === f.messageRef);
        if (!m || typeof f.excerpt !== 'string' || !f.excerpt.trim() || !Number.isSafeInteger(f.excerptStart) || !Number.isSafeInteger(f.excerptEnd) || f.excerptStart < 0 ||
          f.excerptEnd !== f.excerptStart + f.excerpt.length || m.untrustedContent.slice(f.excerptStart, f.excerptEnd) !== f.excerpt || !Array.isArray(f.relatedClinicalRefs)) recordFail('INVALID_ARTIFACT');
        const refs = new Set<string>();
        for (const ref of f.relatedClinicalRefs) {
          recordKeys(ref, ['kind', ref.kind === 'CONCLUSION' ? 'conclusionRef' : ref.kind === 'RELATION' ? 'relationRef' : ref.kind === 'MEDICATION' ? 'medicationRef' : 'reportContentRef']);
          const key = pharmaceuticalD2ClinicalRefKey(ref);
          if (!allowedRefs.has(key) || refs.has(key)) recordFail('BINDING_MISMATCH'); refs.add(key);
        }
        recordEqual(f.claimId, calculatePharmaceuticalD2ClaimIdV2(request, f), 'INTEGRITY_MISMATCH');
        if (ids.has(f.claimId)) recordFail('INVALID_ARTIFACT'); ids.add(f.claimId);
        flags.push({ code: f.findingType === 'UNSUPPORTED' ? 'UNSUPPORTED_D2' : 'CONTRADICTORY_D2', claimId: f.claimId });
      }
      recordEqual(set.fingerprint, calculatePharmaceuticalClinicalClaimFindingSetFingerprintV1({ schemaVersion: set.schemaVersion, contractVersion: set.contractVersion,
        sessionId: set.sessionId, caseVersionId: set.caseVersionId, contextFingerprint: set.contextFingerprint, policyVersion: set.policyVersion,
        requestFingerprint: set.requestFingerprint, findings: set.findings }), 'INTEGRITY_MISMATCH');
    }
    const score = recordParse(pharmaceuticalSessionScoreSchema, root.score), result = score.result;
    const d2Binding = d2.status === 'NOT_PROVIDED' ? d2 : { status: 'PROVIDED', findingSet: { contractVersion: d2.findingSet.contractVersion, fingerprint: d2.findingSet.fingerprint },
      request: { contractVersion: request.contractVersion, fingerprint: request.requestFingerprint }, policyVersion: request.policyVersion, promptVersion: request.promptVersion,
      providerContractVersion: 'pharmaceutical-d2-provider-result/2', numericEffect: 'NONE', semanticAcceptance: intent.d2.status === 'REQUESTED' ? intent.d2.semanticAcceptance : recordFail('BINDING_MISMATCH') };
    const debt = intent.d1SemanticAcceptance === 'VALIDATION_DEBT' || (intent.d2.status === 'REQUESTED' && intent.d2.semanticAcceptance === 'VALIDATION_DEBT');
    const live = intent.d1SemanticAcceptance === 'LIVE_ACCEPTED' && (intent.d2.status === 'NOT_PROVIDED' || intent.d2.semanticAcceptance === 'LIVE_ACCEPTED');
    recordEqual(result.sourceBindings, { sessionId: intent.sessionId, caseVersionId: intent.caseVersionId, ...intent.configuration,
      targetSet: { contractVersion: sources.contextSource.targetSet.contractVersion, fingerprint: context.targetSetFingerprint },
      expectationSet: pharmaceuticalScoringExpectationBinding(sources.contextSource), adjudicationContext: { contractVersion: context.contractVersion, fingerprint: context.fingerprint },
      d1Set: { contractVersion: d1.contractVersion, fingerprint: d1.fingerprint }, d2: d2Binding,
      transcript: { schemaVersion: '2.0', fingerprint: intent.transcriptFingerprint }, d1SemanticAcceptance: intent.d1SemanticAcceptance,
      upstreamSemanticAcceptanceStatus: debt ? 'VALIDATION_DEBT' : live ? 'LIVE_ACCEPTED' : 'VALIDATED_OFFLINE' });
    recordEqual(result.reviewFlags, canonicalPharmaceuticalReviewFlags(flags));
    recordEqual(score.receipt.sources, result.sourceBindings);
    recordEqual(score.fingerprint, scoringFingerprint('pharmaceutical-session-score-v2/1', result), 'INTEGRITY_MISMATCH');
    recordEqual(score.receipt.resultFingerprint, score.fingerprint);
    // Hash of the canonical input projection, not score arithmetic or witness reconstruction.
    const inputCore = { schemaVersion: '2.0', contractVersion: 'pharmaceutical-score-input/1', bindings: result.sourceBindings,
      d1Outcomes: [...outcomes].sort((a, b) => a.targetRef < b.targetRef ? -1 : a.targetRef > b.targetRef ? 1 : 0), reviewFlags: result.reviewFlags };
    recordEqual(score.receipt.inputFingerprint, scoringFingerprint('pharmaceutical-score-input-v2/1', inputCore));
    if (result.status !== 'INVALID') {
      recordEqual(result.unitContributions.map(u => u.scoringUnitId), config.plan.units.map(u => u.scoringUnitId));
      result.unitContributions.forEach((u, i) => {
        const p = config.plan.units[i];
        recordEqual([u.domain, u.applicability, u.operator, u.memberOutcomes], [p.domain, p.applicability, p.operator, p.memberTargetRefs.map(ref => outcomes.find(o => o.targetRef === ref))]);
        structuralBounds(u.earned, u.possible);
        if (BigInt(u.earned.numerator) > 0n) {
          const correct = u.memberOutcomes.map(o => o.resolution === 'SEMANTIC' && o.verdict === 'CORRECTLY_DEMONSTRATED');
          if (!(u.operator === 'ONE_OF' ? correct.some(Boolean) : correct.every(Boolean))) recordFail('INVALID_ARTIFACT');
        }
      });
      const domains = [...new Set(config.plan.units.map(u => u.domain))].sort();
      recordEqual(result.domainBreakdown.map(d => d.domain), domains);
      result.domainBreakdown.forEach(d => {
        recordEqual(d.scoringUnitRefs, config.plan.units.filter(u => u.domain === d.domain).map(u => u.scoringUnitId));
        structuralBounds(d.earned, d.possible);
      });
      structuralBounds(result.earned, result.possible);
      const hasPossible = result.unitContributions.some(u => BigInt(u.possible.numerator) > 0n);
      if (result.status === 'NOT_SCORABLE') {
        if (hasPossible || BigInt(result.possible.numerator) !== 0n || BigInt(result.earned.numerator) !== 0n) recordFail('INVALID_ARTIFACT');
      } else if (!hasPossible || BigInt(result.possible.numerator) === 0n) recordFail('INVALID_ARTIFACT');
      if (result.status === 'SCORED' && flags.length || result.status === 'PROVISIONAL_REVIEW_REQUIRED' && !flags.length) recordFail('BINDING_MISMATCH');
    } else if (result.unitContributions.length || result.domainBreakdown.length) recordFail('INVALID_ARTIFACT');
    return freezeScoring({ d1, d2, score });
  });
}

/** Same structural range bound as E1, not reconstruction of any earned/possible value. */
function structuralBounds(earned: { numerator: string; denominator: string }, possible: { numerator: string; denominator: string }) {
  if (BigInt(earned.numerator) * BigInt(possible.denominator) > BigInt(possible.numerator) * BigInt(earned.denominator)) recordFail('INVALID_ARTIFACT');
}
