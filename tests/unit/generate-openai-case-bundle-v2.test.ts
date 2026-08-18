import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GENERATION_ASSEMBLER_VERSION } from '@/lib/cases/v2/assemble-canonical-generated-case';
import type {
  AiDisclosureIntent,
  AiTaxonomyCatalog,
  AiTaxonomyConceptRef,
} from '@/lib/cases/v2/ai-generation-types';
import { AI_GENERATION_CONTRACT_VERSION } from '@/lib/cases/v2/ai-generation-types';
import { CASE_GENERATOR_PROMPT_VERSION } from '@/lib/cases/v2/build-case-generator-request';
import type { GeneratorTaxonomyCatalogsV2 } from '@/lib/cases/v2/case-generator-request-types';
import { generateOpenAiCaseBundleV2 } from '@/lib/cases/v2/generate-openai-case-bundle';
import { GeneratedCaseBundleBuildError } from '@/lib/cases/v2/generated-case-bundle-types';
import {
  GenerationAssemblyError,
  type VersionedGenerationAssemblyContextV2,
} from '@/lib/cases/v2/generation-assembly-types';
import type { TeachingCaseGenerationBriefV2 } from '@/lib/cases/v2/teaching-brief-types';
import type { DisclosureRule } from '@/lib/cases/v2/types';
import { validateAiGeneratedCaseDraftV2 } from '@/lib/cases/v2/validate-ai-generated-case-draft';
import { validateTeachingCaseGenerationBriefV2 } from '@/lib/cases/v2/validate-teaching-brief';

const mocks = vi.hoisted(() => ({
  generateWithReceipt: vi.fn(),
}));

vi.mock('@/lib/cases/v2/generate-openai-case-draft', () => ({
  generateOpenAiCaseDraftWithReceiptV2: mocks.generateWithReceipt,
}));

const spontaneous = { mode: 'spontaneous' } as const;
const caseVersionId = 'casever_90000000-0000-4000-8000-000000000077';

function known(localFactKey: string, value: unknown) {
  return {
    state: 'known',
    localFactKey,
    value,
    certainty: 'exact',
    disclosureIntent: spontaneous,
  };
}

function notApplicable() {
  return {
    state: 'not_applicable',
    reasonCode: 'not_applicable_to_patient',
  };
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

function evidenceRule(conclusionRef: string) {
  return {
    conclusionRef,
    requiredEvidence: { operator: 'fact', factRef: 'lf_1' },
    supportingEvidenceRefs: [],
    counterEvidenceRefs: [],
    teacherRationale: 'Evidencia clínica suficiente.',
  };
}

function createDraft() {
  return validateAiGeneratedCaseDraftV2({
    contractVersion: 'ai-generated-case-draft/1',
    patientFacts: {
      publicProfile: {
        nombre: 'María',
        edad: 68,
        sexo: 'mujer',
        tratamiento: 'Enalapril 20 mg',
      },
      initialDemand: known('lf_1', 'Vengo a por mi medicación'),
      encounter: {
        personPresent: known('lf_2', 'patient'),
        relationshipToPatient: notApplicable(),
      },
      clinicalContext: {
        healthProblems: [],
        clinicalHistory: [],
        physiologicalSituation: [],
        pregnancyAndLactation: notApplicable(),
        allergiesAndIntolerances: [],
        lifestyle: [],
        biomedicalData: [],
      },
      symptoms: [],
      pharmacotherapy: {
        prescribedMedications: [
          {
            localMedicationKey: 'lm_1',
            displayName: known('lf_10', 'Enalapril 20 mg'),
            origin: known('lf_11', 'prescribed'),
            purposeAsUnderstood: {
              state: 'patient_unknown',
              localFactKey: 'lf_12',
              topic: 'para qué sirve el medicamento',
              disclosureIntent: spontaneous,
            },
            regimenBasis: known('lf_13', 'prescription'),
            referenceDose: known('lf_14', '20 mg'),
            referenceSchedule: known('lf_15', 'una vez al día'),
            referenceDuration: notApplicable(),
            administrationMethod: known('lf_16', 'vía oral'),
            specialUseConditions: [],
          },
        ],
        otherMedicinesAndProducts: [],
        actualMedicationUse: [
          {
            localUseKey: 'lu_1',
            medicationRef: 'lm_1',
            action: 'takes',
            actualUse: known('lf_20', 'Lo toma cada día'),
            actualDose: known('lf_21', '20 mg'),
            actualSchedule: known('lf_22', 'por la mañana'),
            frequency: known('lf_23', 'diariamente'),
            timePeriod: known('lf_24', 'desde hace un año'),
            circumstanceFactRefs: ['lf_20'],
            statedReasonFactRefs: ['lf_20'],
            perceivedEffectFactRefs: ['lf_20'],
            practicalDifficultyFactRefs: ['lf_20'],
            strategyTriedFactRefs: ['lf_20'],
          },
        ],
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
      communicationProfile: communicationProfile(),
    },
    evaluator: {
      carePath: {
        initialSpfa: {
          localConclusionKey: 'lc_1',
          kind: 'spfa',
          value: { service: 'dispensing', subtype: 'continuation' },
        },
        additionalSpfas: [],
        transitions: [],
      },
      incidence: {
        assessment: {
          localConclusionKey: 'lc_2',
          kind: 'incidence_assessment',
          value: { status: 'none' },
        },
        findings: [],
        followUpEpisodes: [],
      },
      prm: {
        assessment: {
          localConclusionKey: 'lc_3',
          kind: 'prm_assessment',
          value: { status: 'none' },
        },
        findings: [],
      },
      rnmAssessments: [
        {
          localConclusionKey: 'lc_4',
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
        localConclusionKey: 'lc_5',
        kind: 'referral',
        value: { status: 'not_required' },
      },
      evidenceRules: [
        {
          ...evidenceRule('lc_2'),
          requiredEvidence: { operator: 'public_profile', field: 'age' },
        },
        evidenceRule('lc_3'),
        evidenceRule('lc_4'),
        evidenceRule('lc_5'),
      ],
    },
  });
}

function createBriefUnknown(): Record<string, any> {
  return {
    schemaVersion: '2.0',
    briefId: 'brief_90000000-0000-4000-8000-000000000077',
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

function createBrief(
  source = createBriefUnknown(),
): TeachingCaseGenerationBriefV2 {
  return validateTeachingCaseGenerationBriefV2(source);
}

function createCatalogs(): GeneratorTaxonomyCatalogsV2 {
  return {
    prm: [{ conceptId: 'prm-1', label: 'PRM de prueba' }],
    rnm: [{ conceptId: 'rnm-1', label: 'RNM de prueba' }],
    adherence_barrier: [
      { conceptId: 'barrier-1', label: 'Barrera de prueba' },
    ],
    professional_action: [
      { conceptId: 'action-1', label: 'Actuación de prueba' },
    ],
    pharmaceutical_intervention: [
      { conceptId: 'intervention-1', label: 'Intervención de prueba' },
    ],
    referral_destination: [
      { conceptId: 'destination-1', label: 'Destino de prueba' },
    ],
  };
}

const taxonomyVersions: Record<
  AiTaxonomyCatalog,
  Readonly<{ id: string; version: string }>
> = {
  prm: { id: 'prm-catalog', version: '2024' },
  rnm: { id: 'rnm-catalog', version: '2024' },
  adherence_barrier: { id: 'barrier-catalog', version: '1' },
  professional_action: { id: 'action-catalog', version: '1' },
  pharmaceutical_intervention: { id: 'intervention-catalog', version: '1' },
  referral_destination: { id: 'referral-catalog', version: '1' },
};

function ordinal(localKey: string): string {
  return localKey.split('_')[1].padStart(12, '0');
}

function createContext(
  overrides: Partial<VersionedGenerationAssemblyContextV2> = {},
): VersionedGenerationAssemblyContextV2 {
  return {
    caseVersionId: caseVersionId as any,
    disclosurePolicyVersion: 'disclosure-policy/test-1',
    evaluatorVersions: {
      evaluatorSchema: { id: 'evaluator-v2', version: '2.0' },
      protocol: { id: 'foro-af-fc', version: '2024' },
      prmTaxonomy: taxonomyVersions.prm,
      rnmTaxonomy: taxonomyVersions.rnm,
      adherenceFramework: { id: 'adherence-framework', version: '1' },
      barrierTaxonomy: taxonomyVersions.adherence_barrier,
      professionalActionTaxonomy: taxonomyVersions.professional_action,
      pharmaceuticalInterventionTaxonomy:
        taxonomyVersions.pharmaceutical_intervention,
      referralDestinationTaxonomy: taxonomyVersions.referral_destination,
    },
    allocateMedicationId: vi.fn(
      (key: string) =>
        `med_20000000-0000-4000-8000-${ordinal(key)}` as any,
    ),
    allocateMedicationUseId: vi.fn(
      (key: string) =>
        `use_30000000-0000-4000-8000-${ordinal(key)}` as any,
    ),
    allocateFactId: vi.fn(
      (key: string) =>
        `fact_10000000-0000-4000-8000-${ordinal(key)}` as any,
    ),
    allocateConclusionId: vi.fn(
      (key: string) =>
        `conclusion_40000000-0000-4000-8000-${ordinal(key)}` as any,
    ),
    resolveTaxonomy: vi.fn((ref: AiTaxonomyConceptRef) => ({
      taxonomyId: taxonomyVersions[ref.catalog].id,
      taxonomyVersion: taxonomyVersions[ref.catalog].version,
      conceptId: ref.conceptId,
    })),
    resolveDisclosure: vi.fn(
      (intent: AiDisclosureIntent): DisclosureRule => {
        if (!('domains' in intent)) return { mode: intent.mode };
        if (intent.mode === 'rapport_required') {
          return {
            mode: intent.mode,
            domains: [...intent.domains],
            minimumRapport: 60,
          };
        }
        return { mode: intent.mode, domains: [...intent.domains] };
      },
    ),
    ...overrides,
  };
}

function createReceipt() {
  return {
    draft: createDraft(),
    generation: {
      generatorContractVersion: AI_GENERATION_CONTRACT_VERSION,
      promptVersion: CASE_GENERATOR_PROMPT_VERSION,
      model: {
        provider: 'openai' as const,
        identifier: 'actual-provider-model',
      },
    },
  };
}

function expectSameError<T extends Error>(
  error: T,
  promise: Promise<unknown>,
): Promise<void> {
  return promise.then(
    () => {
      throw new Error('expected promise to reject');
    },
    (received) => {
      expect(received).toBe(error);
    },
  );
}

beforeEach(() => {
  mocks.generateWithReceipt.mockResolvedValue(createReceipt());
});

describe('generateOpenAiCaseBundleV2', () => {
  it('composes the real canonical assembly and bundle derivations', async () => {
    const briefSource = createBriefUnknown();
    briefSource.teacherInstruction =
      'model=attacker; assemblerVersion=evil; disclosurePolicyVersion=evil';
    const brief = createBrief(briefSource);
    const catalogs = createCatalogs();
    const context = {
      ...createContext(),
      assemblerVersion: 'attacker-controlled',
    } as VersionedGenerationAssemblyContextV2;

    const bundle = await generateOpenAiCaseBundleV2(
      brief,
      catalogs,
      context,
    );

    expect(mocks.generateWithReceipt).toHaveBeenCalledTimes(1);
    expect(mocks.generateWithReceipt).toHaveBeenCalledWith(brief, catalogs);
    expect(Object.keys(bundle).sort()).toEqual(
      ['schemaVersion', 'sourceBrief', 'sourceOfTruth', 'derived', 'provenance'].sort(),
    );
    expect(bundle.schemaVersion).toBe('2.0');
    expect(bundle.sourceBrief).toMatchObject({
      briefId: brief.briefId,
      revision: brief.revision.number,
      fingerprint: {
        algorithm: 'sha256',
        canonicalization: 'teaching-brief-v2/1',
      },
    });
    expect(bundle.sourceBrief.fingerprint.value).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(bundle.sourceOfTruth).sort()).toEqual(
      ['caseVersionId', 'patientFacts', 'evaluator'].sort(),
    );
    expect(Object.keys(bundle.derived).sort()).toEqual(
      ['patientRuntime', 'teachingSummary', 'complianceReport'].sort(),
    );
    expect(bundle.sourceOfTruth.caseVersionId).toBe(caseVersionId);
    expect(bundle.sourceOfTruth.patientFacts.caseVersionId).toBe(caseVersionId);
    expect(bundle.sourceOfTruth.evaluator.caseVersionId).toBe(caseVersionId);
    expect(bundle.derived.patientRuntime.caseVersionId).toBe(caseVersionId);
    expect(bundle.derived.teachingSummary.caseVersionId).toBe(caseVersionId);
    expect(bundle.derived.complianceReport.caseVersionId).toBe(caseVersionId);
    expect(bundle.provenance).toEqual({
      generatorContractVersion: 'ai-generated-case-draft/1',
      promptVersion: CASE_GENERATOR_PROMPT_VERSION,
      model: { provider: 'openai', identifier: 'actual-provider-model' },
      assemblerVersion: GENERATION_ASSEMBLER_VERSION,
      disclosurePolicyVersion: 'disclosure-policy/test-1',
    });

    const serialized = JSON.stringify(bundle);
    for (const forbidden of [
      'localFactKey',
      'localMedicationKey',
      'localUseKey',
      'localConclusionKey',
      '"lf_1"',
      '"lm_1"',
      '"lu_1"',
      '"lc_1"',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(serialized).not.toContain('attacker-controlled');
    expect(bundle.provenance.model.identifier).not.toContain('attacker');
    expect(bundle.provenance.assemblerVersion).not.toContain('evil');
    expect(bundle.provenance.disclosurePolicyVersion).not.toContain('evil');
  });

  it('propagates generation errors before using the assembly context', async () => {
    const generationError = new Error('synthetic generation failure');
    mocks.generateWithReceipt.mockRejectedValueOnce(generationError);
    const context = createContext();

    await expectSameError(
      generationError,
      generateOpenAiCaseBundleV2(createBrief(), createCatalogs(), context),
    );

    expect(context.allocateMedicationId).not.toHaveBeenCalled();
    expect(context.allocateMedicationUseId).not.toHaveBeenCalled();
    expect(context.allocateFactId).not.toHaveBeenCalled();
    expect(context.allocateConclusionId).not.toHaveBeenCalled();
    expect(context.resolveTaxonomy).not.toHaveBeenCalled();
    expect(context.resolveDisclosure).not.toHaveBeenCalled();
  });

  it('propagates real canonical assembly errors without wrapping', async () => {
    const duplicateFactId =
      'fact_10000000-0000-4000-8000-000000000999' as any;
    const context = createContext({
      allocateFactId: vi.fn(() => duplicateFactId),
    });

    try {
      await generateOpenAiCaseBundleV2(createBrief(), createCatalogs(), context);
      throw new Error('expected assembly error');
    } catch (error) {
      expect(error).toBeInstanceOf(GenerationAssemblyError);
      expect((error as GenerationAssemblyError).code).toBe(
        'duplicate_canonical_id',
      );
    }
    expect(mocks.generateWithReceipt).toHaveBeenCalledTimes(1);
  });

  it('propagates invalid provenance from the real bundle builder', async () => {
    const context = createContext({ disclosurePolicyVersion: '' });

    try {
      await generateOpenAiCaseBundleV2(createBrief(), createCatalogs(), context);
      throw new Error('expected provenance error');
    } catch (error) {
      expect(error).toBeInstanceOf(GeneratedCaseBundleBuildError);
      expect((error as GeneratedCaseBundleBuildError).code).toBe(
        'invalid_provenance',
      );
    }
  });

  it('returns a bundle normally when compliance requires review', async () => {
    const bundle = await generateOpenAiCaseBundleV2(
      createBrief(),
      createCatalogs(),
      createContext(),
    );

    expect(bundle.derived.complianceReport.overallStatus).toBe(
      'review_required',
    );
  });

  it('returns a bundle normally when compliance is non-compliant', async () => {
    const source = createBriefUnknown();
    source.carePath.initialSpfa.decision.value = {
      service: 'pharmaceutical_indication',
    };
    const bundle = await generateOpenAiCaseBundleV2(
      createBrief(source),
      createCatalogs(),
      createContext(),
    );

    expect(bundle.derived.complianceReport.overallStatus).toBe('non_compliant');
    expect(bundle.derived.complianceReport.hasHardFailures).toBe(true);
  });

  it('contains no direct OpenAI configuration, environment, or network access', () => {
    const source = readFileSync(
      new URL('../../lib/cases/v2/generate-openai-case-bundle.ts', import.meta.url),
      'utf8',
    );

    expect(source).not.toContain('process.env');
    expect(source).not.toContain('OPENAI_API_KEY');
    expect(source).not.toMatch(/from\s+['"]openai['"]/);
    expect(source).not.toContain('new OpenAI');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('apiKey');
    expect(source).not.toContain('maxOutputTokens');
    expect(source).not.toContain('timeout');
    expect(source).not.toContain('retries');
  });
});
