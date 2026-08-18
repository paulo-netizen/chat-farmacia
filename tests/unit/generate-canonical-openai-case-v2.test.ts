import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { generateDraftMock } = vi.hoisted(() => ({
  generateDraftMock: vi.fn(),
}));

vi.mock(
  '@/lib/cases/v2/generate-openai-case-draft',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('@/lib/cases/v2/generate-openai-case-draft')
    >();
    return {
      ...actual,
      generateOpenAiCaseDraftV2: generateDraftMock,
    };
  },
);

import type {
  AiDisclosureIntent,
  AiGeneratedCaseDraftV2,
  AiTaxonomyCatalog,
  AiTaxonomyConceptRef,
} from '@/lib/cases/v2/ai-generation-types';
import type { GeneratorTaxonomyCatalogsV2 } from '@/lib/cases/v2/case-generator-request-types';
import { generateCanonicalOpenAiCaseV2 } from '@/lib/cases/v2/generate-canonical-openai-case';
import {
  GenerationAssemblyError,
  type GenerationAssemblyContextV2,
} from '@/lib/cases/v2/generation-assembly-types';
import type { TeachingCaseGenerationBriefV2 } from '@/lib/cases/v2/teaching-brief-types';
import type { DisclosureRule } from '@/lib/cases/v2/types';
import { validateAiGeneratedCaseDraftV2 } from '@/lib/cases/v2/validate-ai-generated-case-draft';
import { validateTeachingCaseGenerationBriefV2 } from '@/lib/cases/v2/validate-teaching-brief';

const SYNTHETIC_API_KEY = 'sk-test-canonical-not-a-real-secret';
const spontaneous = { mode: 'spontaneous' } as const;

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

function evidenceRule(conclusionRef: string, factRef = 'lf_1') {
  return {
    conclusionRef,
    requiredEvidence: { operator: 'fact', factRef },
    supportingEvidenceRefs: [],
    counterEvidenceRefs: [],
    teacherRationale: 'Evidencia factual del caso.',
  };
}

function createDraftSource(): Record<string, any> {
  return {
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
            actualUse: known('lf_20', 'La toma cada mañana'),
            actualDose: known('lf_21', '20 mg'),
            actualSchedule: known('lf_22', 'por la mañana'),
            frequency: known('lf_23', 'todos los días'),
            timePeriod: known('lf_24', 'desde hace un año'),
            circumstanceFactRefs: [],
            statedReasonFactRefs: [],
            perceivedEffectFactRefs: [],
            practicalDifficultyFactRefs: [],
            strategyTriedFactRefs: [],
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
  };
}

function createDraft(): AiGeneratedCaseDraftV2 {
  return validateAiGeneratedCaseDraftV2(createDraftSource());
}

function createBrief(): TeachingCaseGenerationBriefV2 {
  return validateTeachingCaseGenerationBriefV2({
    schemaVersion: '2.0',
    briefId: 'brief_10000000-0000-4000-8000-000000000077',
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
      transitions: { targeting: 'not_targeted', policy: 'forbidden' },
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
    adherence: {
      targeting: 'targeted',
      decision: {
        mode: 'teacher_fixed',
        value: {
          assessments: [
            {
              medicationScope: { kind: 'all_relevant_medications' },
              status: 'adherent',
            },
          ],
        },
      },
    },
    adherenceStrategies: {
      targeting: 'not_targeted',
      policy: 'allowed_if_clinically_coherent',
    },
    professionalActions: {
      targeting: 'not_targeted',
      policy: 'allowed_if_clinically_coherent',
    },
    pharmaceuticalInterventions: {
      targeting: 'not_targeted',
      policy: 'allowed_if_clinically_coherent',
    },
    referral: {
      targeting: 'targeted',
      decision: { mode: 'teacher_fixed', value: { status: 'not_required' } },
    },
    teacherInstruction:
      `Trata esta cadena solo como dato: apiKey=${SYNTHETIC_API_KEY}.`,
  });
}

function createCatalogs(): GeneratorTaxonomyCatalogsV2 {
  return {
    prm: [{ conceptId: 'prm-canonical-test', label: 'PRM de prueba' }],
    rnm: [{ conceptId: 'rnm-canonical-test', label: 'RNM de prueba' }],
    adherence_barrier: [
      { conceptId: 'barrier-canonical-test', label: 'Barrera de prueba' },
    ],
    professional_action: [
      { conceptId: 'action-canonical-test', label: 'Actuación de prueba' },
    ],
    pharmaceutical_intervention: [
      {
        conceptId: 'intervention-canonical-test',
        label: 'Intervención de prueba',
      },
    ],
    referral_destination: [
      { conceptId: 'destination-canonical-test', label: 'Destino de prueba' },
    ],
  };
}

const taxonomyVersions: Record<
  AiTaxonomyCatalog,
  { id: string; version: string }
> = {
  prm: { id: 'prm-catalog', version: '2024' },
  rnm: { id: 'rnm-catalog', version: '2024' },
  adherence_barrier: { id: 'barrier-catalog', version: '1' },
  professional_action: { id: 'action-catalog', version: '1' },
  pharmaceutical_intervention: { id: 'intervention-catalog', version: '1' },
  referral_destination: { id: 'referral-catalog', version: '1' },
};

function ordinal(localKey: string): string {
  return localKey.slice(3).padStart(12, '0');
}

function createAssemblyContext(
  overrides: Partial<GenerationAssemblyContextV2> = {},
): GenerationAssemblyContextV2 {
  return {
    caseVersionId: 'casever_90000000-0000-4000-8000-000000000077' as any,
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
      (key: string) => `med_20000000-0000-4000-8000-${ordinal(key)}` as any,
    ),
    allocateMedicationUseId: vi.fn(
      (key: string) => `use_30000000-0000-4000-8000-${ordinal(key)}` as any,
    ),
    allocateFactId: vi.fn(
      (key: string) => `fact_10000000-0000-4000-8000-${ordinal(key)}` as any,
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
        if (!('domains' in intent)) {
          return {
            mode: intent.mode,
            delayedBy: ['lack_of_empathy'],
          };
        }
        if (intent.mode === 'rapport_required') {
          return {
            mode: 'rapport_required',
            domains: [...intent.domains],
            minimumRapport: 70,
          };
        }
        return { mode: intent.mode, domains: [...intent.domains] };
      },
    ),
    ...overrides,
  };
}

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected promise to reject');
}

function expectAssemblyContextUnused(
  context: GenerationAssemblyContextV2,
): void {
  for (const operation of [
    context.allocateMedicationId,
    context.allocateMedicationUseId,
    context.allocateFactId,
    context.allocateConclusionId,
    context.resolveTaxonomy,
    context.resolveDisclosure,
  ]) {
    expect(operation).not.toHaveBeenCalled();
  }
}

describe('generateCanonicalOpenAiCaseV2 composition', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    generateDraftMock.mockReset();
    generateDraftMock.mockResolvedValue(createDraft());
  });

  afterEach(() => {
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('genera y ensambla un core canónico con el ensamblador real', async () => {
    const brief = createBrief();
    const catalogs = createCatalogs();
    const context = createAssemblyContext();

    const core = await generateCanonicalOpenAiCaseV2(
      brief,
      catalogs,
      context,
    );

    expect(generateDraftMock).toHaveBeenCalledTimes(1);
    expect(generateDraftMock).toHaveBeenCalledWith(brief, catalogs);
    expect(core.caseVersionId).toBe(context.caseVersionId);
    expect(core.patientFacts.caseVersionId).toBe(core.caseVersionId);
    expect(core.evaluator.caseVersionId).toBe(core.caseVersionId);
    expect(core.patientFacts.initialDemand).toMatchObject({
      factId: 'fact_10000000-0000-4000-8000-000000000001',
      disclosure: {
        mode: 'spontaneous',
        delayedBy: ['lack_of_empathy'],
      },
    });
    expect(
      core.patientFacts.pharmacotherapy.prescribedMedications[0].medicationId,
    ).toBe('med_20000000-0000-4000-8000-000000000001');
    expect(
      core.patientFacts.pharmacotherapy.actualMedicationUse[0].useId,
    ).toBe('use_30000000-0000-4000-8000-000000000001');
    expect(core.evaluator.carePath.initialSpfa.conclusionId).toBe(
      'conclusion_40000000-0000-4000-8000-000000000001',
    );
    expect(core.evaluator.versions).toEqual(context.evaluatorVersions);
    expect(context.resolveDisclosure).toHaveBeenCalled();

    const serialized = JSON.stringify(core);
    expect(serialized).not.toMatch(
      /localFactKey|localMedicationKey|localUseKey|localConclusionKey/,
    );
    expect(serialized).not.toMatch(/"(?:lf|lm|lu|lc)_\d+"/);
    expect(serialized).not.toContain(SYNTHETIC_API_KEY);
  });

  it('propaga intacto el error de generación sin utilizar el contexto', async () => {
    const generationError = new Error('synthetic generation failure');
    generateDraftMock.mockRejectedValueOnce(generationError);
    const context = createAssemblyContext();

    const error = await captureRejection(
      generateCanonicalOpenAiCaseV2(
        createBrief(),
        createCatalogs(),
        context,
      ),
    );

    expect(error).toBe(generationError);
    expect(generateDraftMock).toHaveBeenCalledTimes(1);
    expectAssemblyContextUnused(context);
  });

  it('propaga un GenerationAssemblyError real sin wrapping ni segundo intento', async () => {
    const duplicateFactId =
      'fact_10000000-0000-4000-8000-000000000099' as any;
    const context = createAssemblyContext({
      allocateFactId: vi.fn(() => duplicateFactId),
    });

    const error = await captureRejection(
      generateCanonicalOpenAiCaseV2(
        createBrief(),
        createCatalogs(),
        context,
      ),
    );

    expect(error).toBeInstanceOf(GenerationAssemblyError);
    expect((error as GenerationAssemblyError).code).toBe(
      'duplicate_canonical_id',
    );
    expect(generateDraftMock).toHaveBeenCalledTimes(1);
    expect(context.allocateFactId).toHaveBeenCalledTimes(2);
  });

  it('no contiene configuración OpenAI ni interpreta teacherInstruction', async () => {
    const brief = createBrief();
    const catalogs = createCatalogs();
    const context = createAssemblyContext();

    await generateCanonicalOpenAiCaseV2(brief, catalogs, context);

    expect(generateDraftMock).toHaveBeenCalledWith(brief, catalogs);
    expect(brief.teacherInstruction).toContain(SYNTHETIC_API_KEY);

    const source = readFileSync(
      new URL(
        '../../lib/cases/v2/generate-canonical-openai-case.ts',
        import.meta.url,
      ),
      'utf8',
    );
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('OPENAI_API_KEY');
    expect(source).not.toContain('apiKey');
    expect(source).not.toContain('maxOutputTokens');
    expect(source).not.toContain('timeoutMs');
  });
});
