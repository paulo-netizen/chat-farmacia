import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import {
  AI_GENERATION_CONTRACT_VERSION,
  AI_GENERATION_LIMITS,
  type AiGeneratedCaseDraftV2,
} from './ai-generation-types';
import { validateAiGeneratedCaseDraftV2 } from './validate-ai-generated-case-draft';

const collection = <T extends z.ZodTypeAny>(schema: T) =>
  z.array(schema).max(AI_GENERATION_LIMITS.maxCollectionItems);
const nonEmptyCollection = <T extends z.ZodTypeAny>(schema: T) =>
  collection(schema).min(1);
const text = z
  .string()
  .min(1)
  .max(AI_GENERATION_LIMITS.maxTextLength)
  .regex(/\S/u);
const conceptId = z
  .string()
  .min(1)
  .max(AI_GENERATION_LIMITS.maxConceptIdLength)
  .regex(/\S/u);

function localKey(prefix: 'lf' | 'lm' | 'lu' | 'lc'): z.ZodString {
  const maximumDigits = String(AI_GENERATION_LIMITS.maxLocalKeyOrdinal).length;
  return z
    .string()
    .max(AI_GENERATION_LIMITS.maxLocalKeyLength)
    .regex(new RegExp(`^${prefix}_[1-9][0-9]{0,${maximumDigits - 1}}$`));
}

const factKey = localKey('lf');
const medicationKey = localKey('lm');
const medicationUseKey = localKey('lu');
const conclusionKey = localKey('lc');

/** The provider's 10-level schema budget leaves 6 levels below EvidenceRule; 3D-A remains at 12. */
export const OPENAI_MAX_EVIDENCE_DEPTH = 6;

const disclosureDomains = z.enum([
  'initial_demand',
  'patient_identity',
  'caregiver_context',
  'health_problems',
  'clinical_history',
  'physiological_status',
  'pregnancy_lactation',
  'allergies_intolerances',
  'symptoms',
  'symptom_timing_and_evolution',
  'prior_actions',
  'medication_identity',
  'medication_purpose',
  'prescribed_medication_use',
  'actual_medication_use',
  'administration_technique',
  'special_use_conditions',
  'medication_changes',
  'perceived_effectiveness',
  'perceived_safety',
  'practical_difficulties',
  'beliefs_and_concerns',
  'strategies_already_tried',
  'lifestyle',
  'daily_context',
  'social_support',
  'professional_relationship',
  'biomedical_data',
]);

const disclosureIntent = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('spontaneous') }).strict(),
  z.object({ mode: z.literal('open_question') }).strict(),
  z
    .object({
      mode: z.literal('domain_exploration'),
      domains: nonEmptyCollection(disclosureDomains),
    })
    .strict(),
  z
    .object({
      mode: z.literal('specific_question'),
      domains: nonEmptyCollection(disclosureDomains),
    })
    .strict(),
  z
    .object({
      mode: z.literal('rapport_required'),
      domains: nonEmptyCollection(disclosureDomains),
    })
    .strict(),
]);

function patientDatum(valueSchema: z.ZodTypeAny) {
  return z.discriminatedUnion('state', [
    z
      .object({
        state: z.literal('known'),
        localFactKey: factKey,
        value: valueSchema,
        certainty: z.enum(['exact', 'approximate', 'uncertain']),
        disclosureIntent,
      })
      .strict(),
    z
      .object({
        state: z.literal('explicit_absence'),
        localFactKey: factKey,
        topic: text,
        disclosureIntent,
      })
      .strict(),
    z
      .object({
        state: z.literal('patient_unknown'),
        localFactKey: factKey,
        topic: text,
        disclosureIntent,
      })
      .strict(),
    z.object({ state: z.literal('not_defined') }).strict(),
    z
      .object({
        state: z.literal('not_applicable'),
        reasonCode: z.enum([
          'outside_case_scope',
          'clinically_irrelevant',
          'not_applicable_to_patient',
        ]),
      })
      .strict(),
  ]);
}

const stringDatum = patientDatum(text);
const biomedicalValue = z
  .object({
    type: text,
    value: z.union([text, z.number().finite()]),
    unit: text.nullable(),
    timingOrContext: text.nullable(),
  })
  .strict();

const publicProfile = z
  .object({
    nombre: text,
    edad: z.number().finite().int().nonnegative(),
    sexo: text,
    tratamiento: text,
  })
  .strict();

const communicationProfile = z
  .object({
    sociability: z.number().int().min(1).max(5),
    cooperation: z.number().int().min(1).max(5),
    organization: z.number().int().min(1).max(5),
    emotionalReactivity: z.number().int().min(1).max(5),
    opennessToChange: z.number().int().min(1).max(5),
    healthLiteracy: z.enum(['low', 'medium', 'high']),
    professionalTrust: z.number().int().min(1).max(5),
    medicationAttitude: z.enum([
      'trusting',
      'neutral',
      'cautious',
      'skeptical',
      'ambivalent',
    ]),
    decisionStyle: z.enum([
      'autonomous',
      'shared',
      'professional_led',
      'family_influenced',
      'indecisive',
    ]),
    readinessToChange: z.number().int().min(1).max(5),
    socialDesirability: z.number().int().min(1).max(5),
    judgmentSensitivity: z.number().int().min(1).max(5),
    disclosureThreshold: z.number().int().min(1).max(5),
    answerLength: z.enum(['brief', 'medium', 'long']),
    assertiveness: z.number().int().min(1).max(5),
    emotionalExpression: z.number().int().min(1).max(5),
  })
  .strict();

const symptom = z
  .object({
    description: stringDatum,
    onset: stringDatum,
    duration: stringDatum,
    evolution: stringDatum,
    relevantCircumstances: collection(stringDatum),
  })
  .strict();

const medication = z
  .object({
    localMedicationKey: medicationKey,
    displayName: stringDatum,
    origin: patientDatum(
      z.enum(['prescribed', 'patient_selected', 'pharmacist_recommended', 'other']),
    ),
    purposeAsUnderstood: stringDatum,
    regimenBasis: patientDatum(
      z.enum([
        'prescription',
        'label_or_leaflet',
        'pharmacist_advice',
        'patient_plan',
        'other',
      ]),
    ),
    referenceDose: stringDatum,
    referenceSchedule: stringDatum,
    referenceDuration: stringDatum,
    administrationMethod: stringDatum,
    specialUseConditions: collection(stringDatum),
  })
  .strict();

const medicationUse = z
  .object({
    localUseKey: medicationUseKey,
    medicationRef: medicationKey,
    action: z.enum([
      'takes',
      'omits',
      'delays',
      'changes_dose',
      'interrupts',
      'uses_extra',
      'uses_only_when_symptomatic',
      'uses_with_incorrect_technique',
    ]),
    actualUse: stringDatum,
    actualDose: stringDatum,
    actualSchedule: stringDatum,
    frequency: stringDatum,
    timePeriod: stringDatum,
    circumstanceFactRefs: collection(factKey),
    statedReasonFactRefs: collection(factKey),
    perceivedEffectFactRefs: collection(factKey),
    practicalDifficultyFactRefs: collection(factKey),
    strategyTriedFactRefs: collection(factKey),
  })
  .strict();

const medicationLinkedFact = z
  .object({ medicationRef: medicationKey, detail: stringDatum })
  .strict();

const patientFacts = z
  .object({
    publicProfile,
    initialDemand: stringDatum,
    encounter: z
      .object({
        personPresent: patientDatum(z.enum(['patient', 'caregiver', 'other'])),
        relationshipToPatient: stringDatum,
      })
      .strict(),
    clinicalContext: z
      .object({
        healthProblems: collection(stringDatum),
        clinicalHistory: collection(stringDatum),
        physiologicalSituation: collection(stringDatum),
        pregnancyAndLactation: stringDatum,
        allergiesAndIntolerances: collection(stringDatum),
        lifestyle: collection(stringDatum),
        biomedicalData: collection(patientDatum(biomedicalValue)),
      })
      .strict(),
    symptoms: collection(symptom),
    pharmacotherapy: z
      .object({
        prescribedMedications: collection(medication),
        otherMedicinesAndProducts: collection(medication),
        actualMedicationUse: collection(medicationUse),
        recentChanges: collection(medicationLinkedFact),
        perceivedEffectiveness: collection(medicationLinkedFact),
        perceivedSafety: collection(medicationLinkedFact),
      })
      .strict(),
    actionsAlreadyTaken: collection(stringDatum),
    practicalDifficulties: collection(stringDatum),
    beliefsAndConcerns: collection(stringDatum),
    strategiesAlreadyTried: collection(stringDatum),
    dailyAndSocialContext: collection(stringDatum),
    familyAndSocialSupport: collection(stringDatum),
    relationshipWithProfessionals: collection(stringDatum),
    communicationProfile,
  })
  .strict();

const taxonomy = (catalog: z.infer<typeof taxonomyCatalog>) =>
  z.object({ catalog: z.literal(catalog), conceptId }).strict();
const taxonomyCatalog = z.enum([
  'prm',
  'rnm',
  'adherence_barrier',
  'professional_action',
  'pharmaceutical_intervention',
  'referral_destination',
]);

const conclusion = <T extends string, V extends z.ZodTypeAny>(
  kind: T,
  value: V,
) =>
  z
    .object({
      localConclusionKey: conclusionKey,
      kind: z.literal(kind),
      value,
    })
    .strict();

const spfaValue = z.discriminatedUnion('service', [
  z
    .object({
      service: z.literal('dispensing'),
      subtype: z.enum(['initial_treatment', 'continuation']),
    })
    .strict(),
  z
    .object({
      service: z.literal('pharmaceutical_indication'),
      subtype: z.null(),
    })
    .strict(),
  z
    .object({
      service: z.literal('medication_adherence'),
      subtype: z.null(),
    })
    .strict(),
]);
const spfa = conclusion('spfa', spfaValue);
const spfaTransition = conclusion(
  'spfa_transition',
  z.object({ fromSpfaRef: conclusionKey, toSpfaRef: conclusionKey }).strict(),
);
const assessmentValue = z
  .object({ status: z.enum(['none', 'present', 'not_determinable']) })
  .strict();
const incidenceAssessment = conclusion('incidence_assessment', assessmentValue);
const incidence = conclusion(
  'incidence',
  z
    .object({
      spfaRef: conclusionKey,
      medicationRefs: collection(medicationKey),
      semanticMeaning: text,
    })
    .strict(),
);
const followUpEpisode = conclusion(
  'follow_up_episode',
  z.object({ incidenceRef: conclusionKey }).strict(),
);
const prmAssessment = conclusion('prm_assessment', assessmentValue);
const prm = conclusion(
  'prm',
  z
    .object({
      classification: taxonomy('prm'),
      medicationRefs: collection(medicationKey),
      followUpEpisodeRef: conclusionKey.nullable(),
    })
    .strict(),
);

const rnmAssessment = conclusion(
  'rnm_assessment',
  z.discriminatedUnion('status', [
    z
      .object({
        status: z.literal('rnm'),
        classification: taxonomy('rnm'),
        medicationRefs: collection(medicationKey),
        followUpEpisodeRef: conclusionKey.nullable(),
      })
      .strict(),
    z
      .object({
        status: z.literal('risk_of_rnm'),
        classification: taxonomy('rnm').nullable(),
        medicationRefs: collection(medicationKey),
        followUpEpisodeRef: conclusionKey.nullable(),
      })
      .strict(),
    z.object({ status: z.literal('no_rnm') }).strict(),
  ]),
);
const prmRnmRelation = conclusion(
  'prm_rnm_relation',
  z
    .object({
      prmRef: conclusionKey,
      rnmAssessmentRef: conclusionKey,
      relation: z.enum(['creates_risk_of_rnm', 'contributes_to_rnm']),
    })
    .strict(),
);
const adherenceAssessment = conclusion(
  'adherence_assessment',
  z
    .object({
      medicationRefs: nonEmptyCollection(medicationKey),
      status: z.enum(['adherent', 'non_adherent', 'not_determinable']),
    })
    .strict(),
);
const nonAdherenceType = conclusion(
  'non_adherence_type',
  z.discriminatedUnion('status', [
    z
      .object({
        adherenceAssessmentRef: conclusionKey,
        status: z.literal('determined'),
        type: z.enum(['intentional', 'unintentional', 'erratic', 'combined']),
      })
      .strict(),
    z
      .object({
        adherenceAssessmentRef: conclusionKey,
        status: z.literal('not_determinable'),
      })
      .strict(),
  ]),
);
const adherenceProfile = conclusion(
  'adherence_patient_profile',
  z.discriminatedUnion('status', [
    z
      .object({
        adherenceAssessmentRef: conclusionKey,
        status: z.literal('determined'),
        profile: z.enum(['distrustful', 'trivializing', 'confused']),
      })
      .strict(),
    z
      .object({
        adherenceAssessmentRef: conclusionKey,
        status: z.literal('not_determinable'),
      })
      .strict(),
  ]),
);
const barrierAssessment = conclusion(
  'adherence_barrier_assessment',
  z
    .object({
      adherenceAssessmentRef: conclusionKey,
      status: z.enum(['identified', 'not_determinable']),
    })
    .strict(),
);
const barrier = conclusion(
  'adherence_barrier',
  z
    .object({
      barrierAssessmentRef: conclusionKey,
      role: z.enum(['primary', 'secondary']),
      category: z.enum(['practical', 'perception']),
      classification: taxonomy('adherence_barrier').nullable(),
    })
    .strict(),
);
const baseStrategyCategories = z.enum([
  'technical',
  'behavioral',
  'educational',
  'social_family_support',
]);
const adherenceStrategy = conclusion(
  'adherence_strategy',
  z.discriminatedUnion('category', [
    z
      .object({
        adherenceAssessmentRef: conclusionKey,
        addressedBarrierRefs: collection(conclusionKey),
        category: z.literal('technical'),
      })
      .strict(),
    z
      .object({
        adherenceAssessmentRef: conclusionKey,
        addressedBarrierRefs: collection(conclusionKey),
        category: z.literal('behavioral'),
      })
      .strict(),
    z
      .object({
        adherenceAssessmentRef: conclusionKey,
        addressedBarrierRefs: collection(conclusionKey),
        category: z.literal('educational'),
      })
      .strict(),
    z
      .object({
        adherenceAssessmentRef: conclusionKey,
        addressedBarrierRefs: collection(conclusionKey),
        category: z.literal('social_family_support'),
      })
      .strict(),
    z
      .object({
        adherenceAssessmentRef: conclusionKey,
        addressedBarrierRefs: collection(conclusionKey),
        category: z.literal('combined'),
        componentCategories: nonEmptyCollection(baseStrategyCategories),
      })
      .strict(),
  ]),
);
const simpleProfessionalAction = (
  category:
    | 'dispense'
    | 'do_not_dispense'
    | 'pharmacological_treatment'
    | 'non_pharmacological_treatment'
    | 'hygienic_dietary_measures',
) =>
  z
    .object({
      spfaRef: conclusionKey,
      category: z.literal(category),
      classification: taxonomy('professional_action').nullable(),
      targetSpfaRef: z.null(),
      referralRef: z.null(),
    })
    .strict();
const professionalAction = conclusion(
  'professional_action',
  z.discriminatedUnion('category', [
    simpleProfessionalAction('dispense'),
    simpleProfessionalAction('do_not_dispense'),
    simpleProfessionalAction('pharmacological_treatment'),
    simpleProfessionalAction('non_pharmacological_treatment'),
    simpleProfessionalAction('hygienic_dietary_measures'),
    z
      .object({
        spfaRef: conclusionKey,
        category: z.literal('referral'),
        classification: taxonomy('professional_action').nullable(),
        targetSpfaRef: z.null(),
        referralRef: conclusionKey,
      })
      .strict(),
    z
      .object({
        spfaRef: conclusionKey,
        category: z.literal('other_spfa'),
        classification: taxonomy('professional_action').nullable(),
        targetSpfaRef: conclusionKey,
        referralRef: z.null(),
      })
      .strict(),
  ]),
);
const intervention = conclusion(
  'pharmaceutical_intervention',
  z
    .object({
      spfaRef: conclusionKey,
      professionalActionRef: conclusionKey.nullable(),
      target: z.enum([
        'treatment',
        'patient_state_or_situation',
        'conditions_of_use',
      ]),
      classification: taxonomy('pharmaceutical_intervention').nullable(),
      addressedConclusionRefs: nonEmptyCollection(conclusionKey),
      referralRef: conclusionKey.nullable(),
    })
    .strict(),
);
const report = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('not_required'),
      essentialContents: z.tuple([]),
    })
    .strict(),
  z
    .object({
      status: z.literal('appropriate'),
      essentialContents: nonEmptyCollection(text),
    })
    .strict(),
  z
    .object({
      status: z.literal('required'),
      essentialContents: nonEmptyCollection(text),
    })
    .strict(),
]);
const referral = conclusion(
  'referral',
  z.discriminatedUnion('status', [
    z.object({ status: z.literal('not_required') }).strict(),
    z
      .object({
        status: z.literal('required'),
        urgency: z.enum(['non_urgent', 'urgent']),
        destination: z
          .object({
            label: text,
            classification: taxonomy('referral_destination').nullable(),
          })
          .strict(),
        reason: text,
        report,
      })
      .strict(),
  ]),
);

const evidenceLeaf = z.discriminatedUnion('operator', [
  z.object({ operator: z.literal('fact'), factRef: factKey }).strict(),
  z
    .object({
      operator: z.literal('public_profile'),
      field: z.enum(['age', 'sex']),
    })
    .strict(),
]);

function evidenceExpression(depth = 0): z.ZodTypeAny {
  if (depth >= OPENAI_MAX_EVIDENCE_DEPTH) return evidenceLeaf;
  const child = evidenceExpression(depth + 1);
  return z.union([
    evidenceLeaf,
    z
      .object({
        operator: z.literal('all'),
        operands: nonEmptyCollection(child),
      })
      .strict(),
    z
      .object({
        operator: z.literal('any'),
        operands: nonEmptyCollection(child),
      })
      .strict(),
  ]);
}

const evidenceRule = z
  .object({
    conclusionRef: conclusionKey,
    requiredEvidence: evidenceExpression(),
    supportingEvidenceRefs: collection(evidenceLeaf),
    counterEvidenceRefs: collection(evidenceLeaf),
    teacherRationale: text,
  })
  .strict();

const evaluator = z
  .object({
    carePath: z
      .object({
        initialSpfa: spfa,
        additionalSpfas: collection(spfa),
        transitions: collection(spfaTransition),
      })
      .strict(),
    incidence: z
      .object({
        assessment: incidenceAssessment,
        findings: collection(incidence),
        followUpEpisodes: collection(followUpEpisode),
      })
      .strict(),
    prm: z
      .object({ assessment: prmAssessment, findings: collection(prm) })
      .strict(),
    rnmAssessments: collection(rnmAssessment),
    prmRnmRelations: collection(prmRnmRelation),
    adherence: z
      .object({
        assessments: collection(adherenceAssessment),
        typeConclusions: collection(nonAdherenceType),
        patientProfiles: collection(adherenceProfile),
        barrierAssessments: collection(barrierAssessment),
        barriers: collection(barrier),
        strategies: collection(adherenceStrategy),
      })
      .strict(),
    professionalActions: collection(professionalAction),
    pharmaceuticalInterventions: collection(intervention),
    referral,
    evidenceRules: collection(evidenceRule),
  })
  .strict();

export const OpenAiGeneratedCaseDraftTransportSchemaV1 = z
  .object({
    contractVersion: z.literal(AI_GENERATION_CONTRACT_VERSION),
    patientFacts,
    evaluator,
  })
  .strict();

export type OpenAiGeneratedCaseDraftTransportV1 = z.infer<
  typeof OpenAiGeneratedCaseDraftTransportSchemaV1
>;

export const OPENAI_CASE_GENERATOR_TEXT_FORMAT_V1 = zodTextFormat(
  OpenAiGeneratedCaseDraftTransportSchemaV1,
  'chatusal_case_draft_v1',
);

export type OpenAiCaseGeneratorBoundaryErrorCode =
  | 'invalid_openai_transport'
  | 'openai_transport_normalization_failed'
  | 'invalid_generated_case_after_transport'
  | 'openai_params_build_failed';

export class OpenAiCaseGeneratorBoundaryError extends Error {
  constructor(
    public readonly code: OpenAiCaseGeneratorBoundaryErrorCode,
    public readonly path: string,
    message: string,
    public readonly cause: unknown,
  ) {
    super(`${code} at ${path}: ${message}`);
    this.name = 'OpenAiCaseGeneratorBoundaryError';
  }
}

function cloneTransportValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneTransportValue(item)) as T;
  }
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, cloneTransportValue(child)]),
  ) as T;
}

function omitNull(source: Record<string, unknown>, property: string): void {
  if (source[property] === null) delete source[property];
}

export function normalizeOpenAiGeneratedCaseDraftTransportV1(
  transport: OpenAiGeneratedCaseDraftTransportV1,
): unknown {
  try {
    const normalized = cloneTransportValue(transport) as Record<string, any>;

    normalized.patientFacts.clinicalContext.biomedicalData.forEach(
      (datum: Record<string, any>) => {
        if (datum.state === 'known') {
          omitNull(datum.value, 'unit');
          omitNull(datum.value, 'timingOrContext');
        }
      },
    );

    const spfas = [
      normalized.evaluator.carePath.initialSpfa,
      ...normalized.evaluator.carePath.additionalSpfas,
    ];
    spfas.forEach((item: Record<string, any>) => omitNull(item.value, 'subtype'));
    normalized.evaluator.prm.findings.forEach((item: Record<string, any>) =>
      omitNull(item.value, 'followUpEpisodeRef'),
    );
    normalized.evaluator.rnmAssessments.forEach((item: Record<string, any>) => {
      if (item.value.status !== 'no_rnm') {
        omitNull(item.value, 'classification');
        omitNull(item.value, 'followUpEpisodeRef');
      }
    });
    normalized.evaluator.adherence.barriers.forEach(
      (item: Record<string, any>) => omitNull(item.value, 'classification'),
    );
    normalized.evaluator.professionalActions.forEach(
      (item: Record<string, any>) => {
        omitNull(item.value, 'classification');
        omitNull(item.value, 'targetSpfaRef');
        omitNull(item.value, 'referralRef');
      },
    );
    normalized.evaluator.pharmaceuticalInterventions.forEach(
      (item: Record<string, any>) => {
        omitNull(item.value, 'professionalActionRef');
        omitNull(item.value, 'classification');
        omitNull(item.value, 'referralRef');
      },
    );
    if (normalized.evaluator.referral.value.status === 'required') {
      omitNull(normalized.evaluator.referral.value.destination, 'classification');
    }

    return normalized;
  } catch (cause) {
    throw new OpenAiCaseGeneratorBoundaryError(
      'openai_transport_normalization_failed',
      'openAiTransport',
      'could not normalize the Structured Outputs transport',
      cause,
    );
  }
}

function zodPath(error: z.ZodError): string {
  const firstIssue = error.issues[0];
  return firstIssue === undefined || firstIssue.path.length === 0
    ? 'openAiTransport'
    : `openAiTransport.${firstIssue.path.join('.')}`;
}

export function validateOpenAiGeneratedCaseDraftTransportV1(
  input: unknown,
): AiGeneratedCaseDraftV2 {
  const parsed = OpenAiGeneratedCaseDraftTransportSchemaV1.safeParse(input);
  if (!parsed.success) {
    throw new OpenAiCaseGeneratorBoundaryError(
      'invalid_openai_transport',
      zodPath(parsed.error),
      'the Structured Outputs transport is invalid',
      parsed.error,
    );
  }

  const normalized = normalizeOpenAiGeneratedCaseDraftTransportV1(parsed.data);
  try {
    return validateAiGeneratedCaseDraftV2(normalized);
  } catch (cause) {
    const path =
      typeof cause === 'object' &&
      cause !== null &&
      'path' in cause &&
      typeof cause.path === 'string'
        ? cause.path
        : 'aiGeneratedCaseDraft';
    throw new OpenAiCaseGeneratorBoundaryError(
      'invalid_generated_case_after_transport',
      path,
      'the normalized transport does not satisfy the 3D-A domain contract',
      cause,
    );
  }
}
