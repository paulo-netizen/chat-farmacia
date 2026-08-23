import { describe, expect, it } from 'vitest';

import {
  attachSpfaProtocolSetToGeneratedCaseCoreV2,
  SPFA_PROTOCOL_SET_INTEGRATION_VERSION,
} from '../../lib/cases/v2/attach-spfa-protocol-set';
import { buildGeneratedCaseBundleV2 } from '../../lib/cases/v2/build-generated-case-bundle';
import {
  GeneratedCaseBundleBuildError,
  type GenerationProvenanceV2,
} from '../../lib/cases/v2/generated-case-bundle-types';
import type { CanonicalGeneratedCaseCoreV2 } from '../../lib/cases/v2/generation-assembly-types';
import type { SpfaIntegratedGeneratedCaseCoreV2 } from '../../lib/cases/v2/spfa-protocol-set-types';
import type { TeachingCaseGenerationBriefV2 } from '../../lib/cases/v2/teaching-brief-types';
import { validateTeachingCaseGenerationBriefV2 } from '../../lib/cases/v2/validate-teaching-brief';

const caseVersionId = 'casever_90000000-0000-4000-8000-000000000001';
const factId = 'fact_10000000-0000-4000-8000-000000000001';
const personFactId = 'fact_10000000-0000-4000-8000-000000000002';
const briefId = 'brief_90000000-0000-4000-8000-000000000001';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function communicationProfile() {
  return {
    sociability: 3,
    cooperation: 3,
    organization: 3,
    emotionalReactivity: 3,
    opennessToChange: 3,
    healthLiteracy: 'medium',
    professionalTrust: 3,
    medicationAttitude: 'neutral',
    decisionStyle: 'shared',
    readinessToChange: 3,
    socialDesirability: 3,
    judgmentSensitivity: 3,
    disclosureThreshold: 3,
    answerLength: 'medium',
    assertiveness: 3,
    emotionalExpression: 3,
  };
}

function knownFact(id: string, value: string) {
  return {
    state: 'known',
    factId: id,
    value,
    certainty: 'exact',
    disclosure: { mode: 'spontaneous' },
  };
}

function evidenceRule(conclusionRef: string) {
  return {
    conclusionRef,
    requiredEvidence: { operator: 'fact', factRef: factId },
    supportingEvidenceRefs: [],
    counterEvidenceRefs: [],
    teacherRationale: `Evidencia para ${conclusionRef}`,
  };
}

function createCore(): CanonicalGeneratedCaseCoreV2 {
  const conclusions = {
    spfa: 'conclusion_40000000-0000-4000-8000-000000000001',
    incidenceAssessment:
      'conclusion_40000000-0000-4000-8000-000000000002',
    prmAssessment: 'conclusion_40000000-0000-4000-8000-000000000003',
    rnmAssessment: 'conclusion_40000000-0000-4000-8000-000000000004',
    referral: 'conclusion_40000000-0000-4000-8000-000000000005',
  };
  return {
    caseVersionId: caseVersionId as any,
    patientFacts: {
      schemaVersion: '2.0',
      caseVersionId: caseVersionId as any,
      publicProfile: {
        nombre: 'María',
        edad: 68,
        sexo: 'mujer',
        tratamiento: 'Sin medicación estructurada',
      },
      initialDemand: knownFact(factId, 'Solicita consejo') as any,
      encounter: {
        personPresent: knownFact(personFactId, 'patient') as any,
        relationshipToPatient: {
          state: 'not_applicable',
          reasonCode: 'not_applicable_to_patient',
        },
      },
      clinicalContext: {
        healthProblems: [],
        clinicalHistory: [],
        physiologicalSituation: [],
        pregnancyAndLactation: {
          state: 'not_applicable',
          reasonCode: 'not_applicable_to_patient',
        },
        allergiesAndIntolerances: [],
        lifestyle: [],
        biomedicalData: [],
      },
      symptoms: [],
      pharmacotherapy: {
        prescribedMedications: [],
        otherMedicinesAndProducts: [],
        actualMedicationUse: [],
        recentChanges: [],
        perceivedEffectiveness: [],
        perceivedSafety: [],
      },
      actionsAlreadyTaken: [],
      practicalDifficulties: [],
      beliefsAndConcerns: [],
      strategiesAlreadyTried: [],
      dailyAndSocialContext: [],
      familyAndSocialSupport: [],
      relationshipWithProfessionals: [],
      communicationProfile: communicationProfile() as any,
    },
    evaluator: {
      schemaVersion: '2.0',
      caseVersionId: caseVersionId as any,
      versions: {
        evaluatorSchema: { id: 'evaluator-v2', version: '2.0' },
        protocol: { id: 'foro-af-fc', version: '2024' },
        prmTaxonomy: { id: 'prm', version: '2024' },
        rnmTaxonomy: { id: 'rnm', version: '2024' },
        adherenceFramework: { id: 'adherence', version: '1' },
      },
      carePath: {
        initialSpfa: {
          conclusionId: conclusions.spfa as any,
          kind: 'spfa',
          value: { service: 'dispensing', subtype: 'continuation' },
        },
        additionalSpfas: [],
        transitions: [],
      },
      incidence: {
        assessment: {
          conclusionId: conclusions.incidenceAssessment as any,
          kind: 'incidence_assessment',
          value: { status: 'none' },
        },
        findings: [],
        followUpEpisodes: [],
      },
      prm: {
        assessment: {
          conclusionId: conclusions.prmAssessment as any,
          kind: 'prm_assessment',
          value: { status: 'none' },
        },
        findings: [],
      },
      rnmAssessments: [
        {
          conclusionId: conclusions.rnmAssessment as any,
          kind: 'rnm_assessment',
          value: { status: 'no_rnm' },
        },
      ],
      prmRnmRelations: [],
      adherence: {
        assessments: [],
        typeConclusions: [],
        patientProfiles: [],
        barrierAssessments: [],
        barriers: [],
        strategies: [],
      },
      professionalActions: [],
      pharmaceuticalInterventions: [],
      referral: {
        conclusionId: conclusions.referral as any,
        kind: 'referral',
        value: { status: 'not_required' },
      },
      evidenceRules: [
        evidenceRule(conclusions.incidenceAssessment),
        evidenceRule(conclusions.prmAssessment),
        evidenceRule(conclusions.rnmAssessment),
        evidenceRule(conclusions.referral),
      ] as any,
    },
  };
}

function createBriefUnknown(): Record<string, any> {
  return {
    schemaVersion: '2.0',
    briefId,
    revision: { number: 1 },
    generationMode: 'strict',
    complexity: 'low',
    carePath: {
      initialSpfa: {
        targeting: 'targeted',
        decision: {
          mode: 'teacher_fixed',
          value: {
            service: 'dispensing',
            dispensingSubtype: {
              mode: 'teacher_fixed',
              value: 'continuation',
            },
          },
        },
      },
      additionalSpfas: [],
      transitions: {
        targeting: 'targeted',
        decision: { mode: 'teacher_fixed', value: [] },
      },
    },
    incidence: {
      targeting: 'targeted',
      decision: { mode: 'teacher_fixed', value: { status: 'none' } },
    },
    prm: {
      targeting: 'targeted',
      decision: { mode: 'teacher_fixed', value: { status: 'none' } },
    },
    rnm: {
      targeting: 'targeted',
      decision: { mode: 'teacher_fixed', value: { status: 'no_rnm' } },
    },
    adherence: { targeting: 'not_targeted', policy: 'forbidden' },
    adherenceStrategies: { targeting: 'not_targeted', policy: 'forbidden' },
    professionalActions: { targeting: 'not_targeted', policy: 'forbidden' },
    pharmaceuticalInterventions: {
      targeting: 'not_targeted',
      policy: 'forbidden',
    },
    referral: {
      targeting: 'targeted',
      decision: { mode: 'teacher_fixed', value: { status: 'not_required' } },
    },
  };
}

function createBrief(source = createBriefUnknown()): TeachingCaseGenerationBriefV2 {
  return validateTeachingCaseGenerationBriefV2(source);
}

function createProtocolSet(
  core: CanonicalGeneratedCaseCoreV2,
  variant: 'primary' | 'alternate' = 'primary',
): Record<string, unknown> {
  const suffix = variant === 'primary' ? '1' : '2';
  const spfa = core.evaluator.carePath.initialSpfa;
  const protocolId = `spfa_protocol_50000000-0000-4000-8000-00000000000${suffix}`;
  const requirementId = `spfa_requirement_60000000-0000-4000-8000-00000000000${suffix}`;
  const definition = {
    schemaVersion: '2.0',
    protocolId,
    version: `test-${suffix}`,
    service: spfa.value.service,
    ...(spfa.value.service === 'dispensing'
      ? { subtype: spfa.value.subtype }
      : {}),
    requirements: [
      {
        kind: 'INFORMATION_REQUIREMENT',
        requirementId,
        semanticDomain: {
          kind: 'patient_information',
          disclosureDomain: 'initial_demand',
        },
        teacherLabel: `Demanda inicial ${suffix}`,
        description: `Comprueba la demanda inicial ${suffix}`,
        defaultImportance: 'RELEVANT',
        informationGoal: `Conocer la demanda ${suffix}`,
        safetyCriticality: { safetyCritical: false },
        applicability: { kind: 'ALWAYS' },
      },
    ],
  };
  return {
    schemaVersion: '2.0',
    catalogRef: { ...core.evaluator.versions.protocol },
    definitions: [definition],
    applications: [
      {
        schemaVersion: '2.0',
        caseVersionId: core.caseVersionId,
        carePathSpfaRef: spfa.conclusionId,
        protocolRef: { protocolId, version: definition.version },
        requirements: [
          {
            kind: 'INFORMATION_REQUIREMENT',
            requirementRef: requirementId,
            applicability: {
              status: 'APPLICABLE',
              effectiveImportance: 'RELEVANT',
            },
            informationTargets: [
              {
                targetId: `spfa_target_70000000-0000-4000-8000-00000000000${suffix}`,
                target: {
                  kind: 'FACT',
                  factRef: core.patientFacts.initialDemand.factId,
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

function createIntegratedCore(
  core = createCore(),
  variant: 'primary' | 'alternate' = 'primary',
): SpfaIntegratedGeneratedCaseCoreV2 {
  return attachSpfaProtocolSetToGeneratedCaseCoreV2(
    core,
    createProtocolSet(core, variant),
  );
}

function createProvenance(): GenerationProvenanceV2 {
  return {
    generatorContractVersion: 'ai-generated-case-draft/1',
    promptVersion: 'case-generator/1',
    model: { provider: 'openai', identifier: 'model-version' },
    assemblerVersion: 'generation-assembly/1',
    disclosurePolicyVersion: 'disclosure-policy/1',
    spfaIntegrationVersion: SPFA_PROTOCOL_SET_INTEGRATION_VERSION,
  };
}

function expectBuildError(
  action: () => unknown,
  code: GeneratedCaseBundleBuildError['code'],
) {
  try {
    action();
    throw new Error('expected bundle build to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(GeneratedCaseBundleBuildError);
    const buildError = error as GeneratedCaseBundleBuildError;
    expect(buildError.code).toBe(code);
    return buildError;
  }
}

function reverseObjectKeyOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeyOrder);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .reverse()
      .map(([key, item]) => [key, reverseObjectKeyOrder(item)]),
  );
}

function fingerprint(brief: TeachingCaseGenerationBriefV2): string {
  return buildGeneratedCaseBundleV2(
    brief,
    createIntegratedCore(),
    createProvenance(),
  )
    .sourceBrief.fingerprint.value;
}

describe('GeneratedCaseBundleV2', () => {
  it('builds a minimal bundle with explicit source-of-truth and derived sections', () => {
    const bundle = buildGeneratedCaseBundleV2(
      createBrief(),
      createIntegratedCore(),
      createProvenance(),
    );

    expect(Object.keys(bundle.sourceOfTruth).sort()).toEqual(
      ['caseVersionId', 'patientFacts', 'evaluator', 'spfaProtocolSet'].sort(),
    );
    expect(Object.keys(bundle.derived).sort()).toEqual(
      ['patientRuntime', 'teachingSummary', 'complianceReport'].sort(),
    );
    expect(bundle).not.toHaveProperty('disposition');
    expect(bundle).not.toHaveProperty('reviewFlags');
  });

  it('keeps the same caseVersionId throughout canonical and derived data', () => {
    const bundle = buildGeneratedCaseBundleV2(
      createBrief(),
      createIntegratedCore(),
      createProvenance(),
    );

    expect(bundle.sourceOfTruth.caseVersionId).toBe(caseVersionId);
    expect(bundle.sourceOfTruth.patientFacts.caseVersionId).toBe(caseVersionId);
    expect(bundle.sourceOfTruth.evaluator.caseVersionId).toBe(caseVersionId);
    expect(bundle.derived.patientRuntime.caseVersionId).toBe(caseVersionId);
    expect(bundle.derived.teachingSummary.caseVersionId).toBe(caseVersionId);
    expect(bundle.derived.complianceReport.caseVersionId).toBe(caseVersionId);
  });

  it('returns a valid bundle when compliance is non_compliant', () => {
    const source = createBriefUnknown();
    source.carePath.initialSpfa.decision.value = {
      service: 'pharmaceutical_indication',
    };
    const bundle = buildGeneratedCaseBundleV2(
      createBrief(source),
      createIntegratedCore(),
      createProvenance(),
    );

    expect(bundle.derived.complianceReport.overallStatus).toBe('non_compliant');
    expect(bundle.derived.complianceReport.hasHardFailures).toBe(true);
  });

  it('returns a valid bundle when compliance requires review', () => {
    const bundle = buildGeneratedCaseBundleV2(
      createBrief(),
      createIntegratedCore(),
      createProvenance(),
    );

    expect(bundle.derived.complianceReport.overallStatus).toBe('review_required');
    expect(bundle.derived.complianceReport.requiresReview).toBe(true);
  });

  it('produces the same fingerprint for the same validated brief', () => {
    const brief = createBrief();
    expect(fingerprint(brief)).toBe(fingerprint(brief));
  });

  it('ignores object key insertion order in the fingerprint', () => {
    const source = createBriefUnknown();
    const reordered = reverseObjectKeyOrder(source) as Record<string, any>;

    expect(fingerprint(createBrief(source))).toBe(
      fingerprint(createBrief(reordered)),
    );
  });

  it('changes the fingerprint for a semantic brief change', () => {
    const changed = createBriefUnknown();
    changed.complexity = 'high';

    expect(fingerprint(createBrief())).not.toBe(fingerprint(createBrief(changed)));
  });

  it('changes the fingerprint when revision changes', () => {
    const changed = createBriefUnknown();
    changed.revision = {
      number: 2,
      previousBriefId: 'brief_90000000-0000-4000-8000-000000000002',
    };

    expect(fingerprint(createBrief())).not.toBe(fingerprint(createBrief(changed)));
  });

  it('changes the fingerprint when teacherInstruction changes', () => {
    const changed = createBriefUnknown();
    changed.teacherInstruction = 'Priorizar comunicación empática';

    expect(fingerprint(createBrief())).not.toBe(fingerprint(createBrief(changed)));
  });

  it('keeps the source brief fingerprint independent from the pinned SPFA set', () => {
    const brief = createBrief();
    const primary = buildGeneratedCaseBundleV2(
      brief,
      createIntegratedCore(createCore(), 'primary'),
      createProvenance(),
    );
    const alternate = buildGeneratedCaseBundleV2(
      brief,
      createIntegratedCore(createCore(), 'alternate'),
      createProvenance(),
    );

    expect(primary.sourceBrief.fingerprint).toEqual(
      alternate.sourceBrief.fingerprint,
    );
    expect(primary.sourceBrief.fingerprint.canonicalization).toBe(
      'teaching-brief-v2/1',
    );
    expect(primary.sourceOfTruth.spfaProtocolSet).not.toEqual(
      alternate.sourceOfTruth.spfaProtocolSet,
    );
  });

  it('preserves array order in the fingerprint', () => {
    const first = createBriefUnknown();
    first.carePath.initialSpfa.decision = {
      mode: 'ai_proposes',
      constraints: {
        allowedServices: ['dispensing', 'pharmaceutical_indication'],
        allowedDispensingSubtypes: ['continuation'],
      },
    };
    const second = clone(first);
    second.carePath.initialSpfa.decision.constraints.allowedServices.reverse();

    expect(fingerprint(createBrief(first))).not.toBe(fingerprint(createBrief(second)));
  });

  it('copies provenance and is isolated from later input mutation', () => {
    const provenance = createProvenance() as any;
    const before = clone(provenance);
    const bundle = buildGeneratedCaseBundleV2(
      createBrief(),
      createIntegratedCore(),
      provenance,
    );

    expect(provenance).toEqual(before);
    provenance.model.identifier = 'changed-after-build';
    provenance.promptVersion = 'changed-after-build';
    expect(bundle.provenance.model.identifier).toBe('model-version');
    expect(bundle.provenance.promptVersion).toBe('case-generator/1');
  });

  it('does not mutate brief or core and does not retain their mutable references', () => {
    const brief = createBrief();
    const core = createIntegratedCore();
    const briefBefore = clone(brief);
    const coreBefore = clone(core);
    const bundle = buildGeneratedCaseBundleV2(brief, core, createProvenance());

    expect(brief).toEqual(briefBefore);
    expect(core).toEqual(coreBefore);
    (core.patientFacts.publicProfile as any).nombre = 'Changed';
    expect(bundle.sourceOfTruth.patientFacts.publicProfile.nombre).toBe('María');
  });

  it('stores the canonical SPFA set without retaining caller references', () => {
    const core = createIntegratedCore();
    const bundle = buildGeneratedCaseBundleV2(
      createBrief(),
      core,
      createProvenance(),
    );

    expect(bundle.sourceOfTruth.spfaProtocolSet).not.toBe(core.spfaProtocolSet);
    expect(bundle.sourceOfTruth.spfaProtocolSet.definitions).not.toBe(
      core.spfaProtocolSet.definitions,
    );
    expect(bundle.sourceOfTruth.spfaProtocolSet.definitions[0]).not.toBe(
      core.spfaProtocolSet.definitions[0],
    );
    expect(bundle.sourceOfTruth.spfaProtocolSet.applications).not.toBe(
      core.spfaProtocolSet.applications,
    );
    expect(bundle.sourceOfTruth.spfaProtocolSet).toEqual(core.spfaProtocolSet);
  });

  it('rejects invalid patient facts in the integrated core', () => {
    const core = createIntegratedCore();
    (core.patientFacts as any).initialDemand = { state: 'not_defined' };

    const error = expectBuildError(
      () => buildGeneratedCaseBundleV2(createBrief(), core, createProvenance()),
      'invalid_core',
    );
    expect(error.cause).toBeDefined();
  });

  it('rejects invalid evaluator data in the integrated core', () => {
    const core = createIntegratedCore();
    delete (core.evaluator.carePath.initialSpfa.value as any).subtype;

    const error = expectBuildError(
      () => buildGeneratedCaseBundleV2(createBrief(), core, createProvenance()),
      'invalid_core',
    );
    expect(error.cause).toBeDefined();
  });

  it('rejects an incomplete SPFA set without its care path application', () => {
    const core: any = clone(createIntegratedCore());
    core.spfaProtocolSet.applications = [];

    const error = expectBuildError(
      () => buildGeneratedCaseBundleV2(createBrief(), core, createProvenance()),
      'spfa_protocol_set_validation_failed',
    );
    expect(error.cause).toBeDefined();
  });

  it('rejects invalid or telemetry-contaminated provenance', () => {
    const provenance = { ...createProvenance(), requestId: 'technical-id' } as any;
    expectBuildError(
      () => buildGeneratedCaseBundleV2(createBrief(), createIntegratedCore(), provenance),
      'invalid_provenance',
    );
  });

  it.each([
    ['missing', (core: any) => { delete core.spfaProtocolSet; }],
    ['malformed', (core: any) => { core.spfaProtocolSet = []; }],
    ['catalog mismatch', (core: any) => {
      core.spfaProtocolSet.catalogRef.id = 'different-catalog';
    }],
  ])('rejects a %s SPFA protocol set', (_label, mutate) => {
    const core: any = clone(createIntegratedCore());
    mutate(core);
    expectBuildError(
      () => buildGeneratedCaseBundleV2(createBrief(), core, createProvenance()),
      'spfa_protocol_set_validation_failed',
    );
  });

  it('rejects extra integrated-core properties', () => {
    const core: any = { ...createIntegratedCore(), future_secret: true };
    expectBuildError(
      () => buildGeneratedCaseBundleV2(createBrief(), core, createProvenance()),
      'invalid_core',
    );
  });

  it.each([
    ['patientFacts', (core: any) => {
      core.patientFacts.caseVersionId =
        'casever_90000000-0000-4000-8000-000000000099';
    }],
    ['evaluator', (core: any) => {
      core.evaluator.caseVersionId =
        'casever_90000000-0000-4000-8000-000000000099';
    }],
  ])('rejects %s case identity mismatch', (_label, mutate) => {
    const core: any = clone(createIntegratedCore());
    mutate(core);
    expectBuildError(
      () => buildGeneratedCaseBundleV2(createBrief(), core, createProvenance()),
      'invalid_core',
    );
  });

  it.each([
    ['missing', (provenance: any) => { delete provenance.spfaIntegrationVersion; }],
    ['empty', (provenance: any) => { provenance.spfaIntegrationVersion = ''; }],
  ])('rejects %s SPFA integration provenance', (_label, mutate) => {
    const provenance: any = createProvenance();
    mutate(provenance);
    expectBuildError(
      () => buildGeneratedCaseBundleV2(createBrief(), createIntegratedCore(), provenance),
      'invalid_provenance',
    );
  });
});
