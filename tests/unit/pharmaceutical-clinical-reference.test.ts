import { describe, expect, expectTypeOf, it } from 'vitest';

import { buildPharmaceuticalClinicalReferenceV2 } from '@/lib/cases/v2/build-pharmaceutical-clinical-reference';
import type { PharmaceuticalClinicalReferenceV2 } from '@/lib/cases/v2/pharmaceutical-clinical-reference-types';
import type { PatientRuntimeViewV2 } from '@/lib/cases/v2/types';
import {
  PharmaceuticalClinicalReferenceValidationError,
  validatePharmaceuticalClinicalReferenceV2,
} from '@/lib/cases/v2/validate-pharmaceutical-clinical-reference';
import { validateCaseVersionId } from '@/lib/cases/v2/validate-patient-facts';

const caseVersionId = validateCaseVersionId(
  'casever_61000000-0000-4000-8000-000000000001',
);
const factId = 'fact_62000000-0000-4000-8000-000000000001';
const medicationIds = Array.from(
  { length: 5 },
  (_, index) => `med_63000000-0000-4000-8000-${(index + 1).toString().padStart(12, '0')}`,
);
let conclusionCounter = 0;

function nextConclusionId(): string {
  conclusionCounter += 1;
  return `conclusion_64000000-0000-4000-8000-${conclusionCounter.toString().padStart(12, '0')}`;
}

function runtime(): PatientRuntimeViewV2 {
  return {
    caseVersionId,
    facts: [{ factId, state: 'known' }],
    medications: medicationIds.map((medicationId) => ({ medicationId })),
  } as unknown as PatientRuntimeViewV2;
}

function collectConclusions(source: Record<string, any>): Record<string, any>[] {
  return [
    source.carePath.initialSpfa,
    ...source.carePath.additionalSpfas,
    ...source.carePath.transitions,
    source.incidence.assessment,
    ...source.incidence.findings,
    ...source.incidence.followUpEpisodes,
    source.prm.assessment,
    ...source.prm.findings,
    ...source.rnmAssessments,
    ...source.prmRnmRelations,
    ...source.adherence.assessments,
    ...source.adherence.typeConclusions,
    ...source.adherence.patientProfiles,
    ...source.adherence.barrierAssessments,
    ...source.adherence.barriers,
    ...source.adherence.strategies,
    ...source.professionalActions,
    ...source.pharmaceuticalInterventions,
    source.referral,
  ];
}

function synchronizeEvidenceRules(source: Record<string, any>): void {
  const eligibleKinds = new Set([
    'incidence_assessment',
    'incidence',
    'prm_assessment',
    'prm',
    'rnm_assessment',
    'adherence_assessment',
    'non_adherence_type',
    'adherence_patient_profile',
    'adherence_barrier_assessment',
    'adherence_barrier',
    'adherence_strategy',
    'professional_action',
    'pharmaceutical_intervention',
    'referral',
  ]);
  source.evidenceRules = collectConclusions(source)
    .filter((item) => eligibleKinds.has(item.kind))
    .map((item) => ({
      conclusionRef: item.conclusionId,
      requiredEvidence: { operator: 'fact', factRef: factId },
      supportingEvidenceRefs: [],
      counterEvidenceRefs: [],
      teacherRationale: 'Justificación factual docente.',
    }));
}

function evaluatorFixture(): Record<string, any> {
  conclusionCounter = 0;
  const ids = {
    dispensing: nextConclusionId(),
    indication: nextConclusionId(),
    transition: nextConclusionId(),
    incidenceAssessment: nextConclusionId(),
    incidence: nextConclusionId(),
    episode: nextConclusionId(),
    prmAssessment: nextConclusionId(),
    prmA: nextConclusionId(),
    prmB: nextConclusionId(),
    rnm: nextConclusionId(),
    risk: nextConclusionId(),
    relationA: nextConclusionId(),
    relationB: nextConclusionId(),
    referral: nextConclusionId(),
  };
  const source: Record<string, any> = {
    schemaVersion: '2.0',
    caseVersionId,
    versions: {
      evaluatorSchema: { id: 'evaluator-view', version: '2.0' },
      protocol: { id: 'foro-af-fc', version: '2024' },
      prmTaxonomy: { id: 'foro-prm', version: '2024' },
      rnmTaxonomy: { id: 'foro-rnm', version: '2024' },
      adherenceFramework: { id: 'foro-adherence', version: '2024' },
      barrierTaxonomy: { id: 'chatusal-barrier', version: '1' },
      professionalActionTaxonomy: { id: 'chatusal-action', version: '1' },
      pharmaceuticalInterventionTaxonomy: {
        id: 'chatusal-intervention',
        version: '1',
      },
      referralDestinationTaxonomy: { id: 'chatusal-referral', version: '1' },
    },
    carePath: {
      initialSpfa: {
        conclusionId: ids.dispensing,
        kind: 'spfa',
        value: { service: 'dispensing', subtype: 'initial_treatment' },
      },
      additionalSpfas: [
        {
          conclusionId: ids.indication,
          kind: 'spfa',
          value: { service: 'pharmaceutical_indication' },
        },
      ],
      transitions: [
        {
          conclusionId: ids.transition,
          kind: 'spfa_transition',
          value: { fromSpfaRef: ids.dispensing, toSpfaRef: ids.indication },
        },
      ],
    },
    incidence: {
      assessment: {
        conclusionId: ids.incidenceAssessment,
        kind: 'incidence_assessment',
        value: { status: 'present' },
      },
      findings: [
        {
          conclusionId: ids.incidence,
          kind: 'incidence',
          value: {
            spfaRef: ids.dispensing,
            medicationRefs: [medicationIds[0]],
            semanticMeaning: 'Incidencia farmacoterapéutica validada.',
          },
        },
      ],
      followUpEpisodes: [
        {
          conclusionId: ids.episode,
          kind: 'follow_up_episode',
          value: { incidenceRef: ids.incidence },
        },
      ],
    },
    prm: {
      assessment: {
        conclusionId: ids.prmAssessment,
        kind: 'prm_assessment',
        value: { status: 'present' },
      },
      findings: [
        {
          conclusionId: ids.prmA,
          kind: 'prm',
          value: {
            classification: {
              taxonomyId: 'foro-prm',
              taxonomyVersion: '2024',
              conceptId: 'PRM-CONCEPT-A',
            },
            medicationRefs: [medicationIds[0]],
            followUpEpisodeRef: ids.episode,
          },
        },
        {
          conclusionId: ids.prmB,
          kind: 'prm',
          value: {
            classification: {
              taxonomyId: 'foro-prm',
              taxonomyVersion: '2024',
              conceptId: 'PRM-CONCEPT-B',
            },
            medicationRefs: [medicationIds[1]],
          },
        },
      ],
    },
    rnmAssessments: [
      {
        conclusionId: ids.rnm,
        kind: 'rnm_assessment',
        value: {
          status: 'rnm',
          classification: {
            taxonomyId: 'foro-rnm',
            taxonomyVersion: '2024',
            conceptId: 'RNM-CONCEPT-A',
          },
          medicationRefs: [medicationIds[0]],
          followUpEpisodeRef: ids.episode,
        },
      },
      {
        conclusionId: ids.risk,
        kind: 'rnm_assessment',
        value: {
          status: 'risk_of_rnm',
          classification: {
            taxonomyId: 'foro-rnm',
            taxonomyVersion: '2024',
            conceptId: 'RNM-RISK-A',
          },
          medicationRefs: [medicationIds[1]],
        },
      },
    ],
    prmRnmRelations: [
      {
        conclusionId: ids.relationA,
        kind: 'prm_rnm_relation',
        value: {
          prmRef: ids.prmA,
          rnmAssessmentRef: ids.rnm,
          relation: 'contributes_to_rnm',
        },
      },
      {
        conclusionId: ids.relationB,
        kind: 'prm_rnm_relation',
        value: {
          prmRef: ids.prmB,
          rnmAssessmentRef: ids.risk,
          relation: 'creates_risk_of_rnm',
        },
      },
    ],
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
      conclusionId: ids.referral,
      kind: 'referral',
      value: {
        status: 'required',
        urgency: 'non_urgent',
        destination: {
          label: 'Medicina de familia',
          classification: {
            taxonomyId: 'chatusal-referral',
            taxonomyVersion: '1',
            conceptId: 'PRIMARY-CARE',
          },
        },
        reason: 'Revisión clínica necesaria.',
        report: {
          status: 'required',
          essentialContents: ['Motivo de derivación', 'Medicamentos implicados'],
        },
      },
    },
    evidenceRules: [],
  };

  const adherenceTypes = ['intentional', 'unintentional', 'erratic', 'combined'];
  adherenceTypes.forEach((type, index) => {
    const assessmentId = nextConclusionId();
    const typeId = nextConclusionId();
    const barrierAssessmentId = nextConclusionId();
    const primaryBarrierId = nextConclusionId();
    source.adherence.assessments.push({
      conclusionId: assessmentId,
      kind: 'adherence_assessment',
      value: { medicationRefs: [medicationIds[index]], status: 'non_adherent' },
    });
    source.adherence.typeConclusions.push({
      conclusionId: typeId,
      kind: 'non_adherence_type',
      value: { adherenceAssessmentRef: assessmentId, status: 'determined', type },
    });
    source.adherence.barrierAssessments.push({
      conclusionId: barrierAssessmentId,
      kind: 'adherence_barrier_assessment',
      value: { adherenceAssessmentRef: assessmentId, status: 'identified' },
    });
    source.adherence.barriers.push({
      conclusionId: primaryBarrierId,
      kind: 'adherence_barrier',
      value: {
        barrierAssessmentRef: barrierAssessmentId,
        role: 'primary',
        category: index % 2 === 0 ? 'practical' : 'perception',
        classification: {
          taxonomyId: 'chatusal-barrier',
          taxonomyVersion: '1',
          conceptId: `BARRIER-${index + 1}`,
        },
      },
    });
    if (index === 0) {
      const secondaryBarrierId = nextConclusionId();
      source.adherence.barriers.push({
        conclusionId: secondaryBarrierId,
        kind: 'adherence_barrier',
        value: {
          barrierAssessmentRef: barrierAssessmentId,
          role: 'secondary',
          category: 'perception',
        },
      });
      source.adherence.strategies.push({
        conclusionId: nextConclusionId(),
        kind: 'adherence_strategy',
        value: {
          adherenceAssessmentRef: assessmentId,
          addressedBarrierRefs: [primaryBarrierId, secondaryBarrierId],
          category: 'combined',
          componentCategories: ['technical', 'educational'],
        },
      });
    } else {
      source.adherence.strategies.push({
        conclusionId: nextConclusionId(),
        kind: 'adherence_strategy',
        value: {
          adherenceAssessmentRef: assessmentId,
          addressedBarrierRefs: [primaryBarrierId],
          category: 'educational',
        },
      });
    }
  });
  source.adherence.patientProfiles.push({
    conclusionId: nextConclusionId(),
    kind: 'adherence_patient_profile',
    value: {
      adherenceAssessmentRef: source.adherence.assessments[0].conclusionId,
      status: 'determined',
      profile: 'confused',
    },
  });

  const dispenseAction = nextConclusionId();
  const referralAction = nextConclusionId();
  const otherSpfaAction = nextConclusionId();
  source.professionalActions.push(
    {
      conclusionId: dispenseAction,
      kind: 'professional_action',
      value: {
        spfaRef: ids.dispensing,
        category: 'dispense',
        classification: {
          taxonomyId: 'chatusal-action',
          taxonomyVersion: '1',
          conceptId: 'DISPENSE',
        },
      },
    },
    {
      conclusionId: referralAction,
      kind: 'professional_action',
      value: { spfaRef: ids.dispensing, category: 'referral', referralRef: ids.referral },
    },
    {
      conclusionId: otherSpfaAction,
      kind: 'professional_action',
      value: {
        spfaRef: ids.dispensing,
        category: 'other_spfa',
        targetSpfaRef: ids.indication,
      },
    },
  );
  source.pharmaceuticalInterventions.push(
    {
      conclusionId: nextConclusionId(),
      kind: 'pharmaceutical_intervention',
      value: {
        spfaRef: ids.dispensing,
        professionalActionRef: dispenseAction,
        target: 'treatment',
        classification: {
          taxonomyId: 'chatusal-intervention',
          taxonomyVersion: '1',
          conceptId: 'INTERVENTION-A',
        },
        addressedConclusionRefs: [ids.prmA, ids.rnm],
      },
    },
    {
      conclusionId: nextConclusionId(),
      kind: 'pharmaceutical_intervention',
      value: {
        spfaRef: ids.dispensing,
        professionalActionRef: referralAction,
        target: 'patient_state_or_situation',
        addressedConclusionRefs: [ids.risk],
        referralRef: ids.referral,
      },
    },
  );
  synchronizeEvidenceRules(source);
  return source;
}

function minimalEvaluator(): Record<string, any> {
  const source = evaluatorFixture();
  source.incidence.assessment.value.status = 'none';
  source.incidence.findings = [];
  source.incidence.followUpEpisodes = [];
  source.prm.assessment.value.status = 'none';
  source.prm.findings = [];
  source.rnmAssessments = [
    { conclusionId: nextConclusionId(), kind: 'rnm_assessment', value: { status: 'no_rnm' } },
  ];
  source.prmRnmRelations = [];
  source.adherence = {
    assessments: [],
    typeConclusions: [],
    patientProfiles: [],
    barrierAssessments: [],
    barriers: [],
    strategies: [],
  };
  source.professionalActions = [];
  source.pharmaceuticalInterventions = [];
  source.referral = {
    conclusionId: nextConclusionId(),
    kind: 'referral',
    value: { status: 'not_required' },
  };
  synchronizeEvidenceRules(source);
  return source;
}

function build(source = evaluatorFixture()): PharmaceuticalClinicalReferenceV2 {
  return buildPharmaceuticalClinicalReferenceV2(source, runtime());
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function allKeys(value: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => allKeys(item, result));
  else if (typeof value === 'object' && value !== null) {
    Object.entries(value).forEach(([key, item]) => {
      result.add(key);
      allKeys(item, result);
    });
  }
  return result;
}

describe('PharmaceuticalClinicalReferenceV2', () => {
  it('projects a minimal valid evaluator and preserves global identity', () => {
    const result = build(minimalEvaluator());
    expect(result.schemaVersion).toBe('2.0');
    expect(result.caseVersionId).toBe(caseVersionId);
    expect(result.clinicalConclusions.rnmAssessments[0].value.status).toBe('no_rnm');
    expect(result.clinicalConclusions.referral.value.status).toBe('not_required');
  });

  it('preserves multiple PRM, RNM/risk and their exact relations in canonical order', () => {
    const source = evaluatorFixture();
    const result = build(source);
    expect(result.clinicalConclusions.prm.findings.map((item) => item.conclusionId)).toEqual(
      source.prm.findings.map((item: any) => item.conclusionId),
    );
    expect(result.clinicalConclusions.rnmAssessments.map((item) => item.value.status)).toEqual([
      'rnm',
      'risk_of_rnm',
    ]);
    expect(result.structuralContext.prmRnmRelations).toEqual(source.prmRnmRelations);
  });

  it('preserves incidence findings and structural follow-up episodes without reordering', () => {
    const source = evaluatorFixture();
    const result = build(source);
    expect(result.clinicalConclusions.incidence.findings).toEqual(source.incidence.findings);
    expect(result.structuralContext.followUpEpisodes).toEqual(source.incidence.followUpEpisodes);
  });

  it.each(['intentional', 'unintentional', 'erratic', 'combined'])(
    'preserves the %s non-adherence type',
    (type) => {
      const result = build();
      expect(
        result.clinicalConclusions.adherence.typeConclusions.some(
          (item) => item.value.status === 'determined' && item.value.type === type,
        ),
      ).toBe(true);
    },
  );

  it('preserves disjoint medication scopes, profiles, primary/secondary barriers and strategies', () => {
    const result = build();
    expect(result.clinicalConclusions.adherence.assessments.map((item) => item.value.medicationRefs)).toEqual(
      medicationIds.slice(0, 4).map((id) => [id]),
    );
    expect(result.clinicalConclusions.adherence.patientProfiles[0].value).toMatchObject({
      status: 'determined',
      profile: 'confused',
    });
    expect(result.clinicalConclusions.adherence.barriers.map((item) => item.value.role)).toEqual([
      'primary',
      'secondary',
      'primary',
      'primary',
      'primary',
    ]);
    expect(result.clinicalConclusions.adherence.strategies).toHaveLength(4);
  });

  it('preserves professional actions, multiple interventions and their clinical links', () => {
    const source = evaluatorFixture();
    const result = build(source);
    expect(result.clinicalConclusions.professionalActions).toEqual(source.professionalActions);
    expect(result.clinicalConclusions.pharmaceuticalInterventions).toEqual(
      source.pharmaceuticalInterventions,
    );
    expect(
      result.clinicalConclusions.pharmaceuticalInterventions[0].value.addressedConclusionRefs,
    ).toEqual([source.prm.findings[0].conclusionId, source.rnmAssessments[0].conclusionId]);
  });

  it.each(['non_urgent', 'urgent'] as const)(
    'preserves a required %s referral, destination and reason',
    (urgency) => {
      const source = evaluatorFixture();
      source.referral.value.urgency = urgency;
      synchronizeEvidenceRules(source);
      expect(build(source).clinicalConclusions.referral.value).toMatchObject({
        status: 'required',
        urgency,
        destination: { label: 'Medicina de familia' },
        reason: 'Revisión clínica necesaria.',
      });
    },
  );

  it.each(['appropriate', 'required'] as const)(
    'preserves a %s report and its essential contents',
    (status) => {
      const source = evaluatorFixture();
      source.referral.value.report.status = status;
      const report = (build(source).clinicalConclusions.referral.value as any).report;
      expect(report).toEqual({
        status,
        essentialContents: ['Motivo de derivación', 'Medicamentos implicados'],
      });
    },
  );

  it('preserves a not_required report with an empty contents tuple', () => {
    const source = evaluatorFixture();
    source.referral.value.report = { status: 'not_required', essentialContents: [] };
    const report = (build(source).clinicalConclusions.referral.value as any).report;
    expect(report).toEqual({ status: 'not_required', essentialContents: [] });
  });

  it('preserves identified report content IDs, multiplicity and order in a detached projection', () => {
    const source = evaluatorFixture();
    source.referral.value.report = {
      contractVersion: 'identified-report-requirement/1',
      status: 'required',
      essentialContents: [
        {
          contentId:
            'report_content_50000000-0000-4000-8000-000000000002',
          content: 'Medicamentos implicados',
        },
        {
          contentId:
            'report_content_50000000-0000-4000-8000-000000000001',
          content: 'Motivo de derivación',
        },
      ],
    };

    const result = build(source);
    const report = (result.clinicalConclusions.referral.value as any).report;
    expect(report).toEqual(source.referral.value.report);
    source.referral.value.report.essentialContents[0].content = 'MUTATED';
    expect(report.essentialContents[0].content).toBe('Medicamentos implicados');
  });

  it('preserves evaluator, protocol, taxonomy and adherence framework references exactly', () => {
    const source = evaluatorFixture();
    const result = build(source);
    expect(result.versions).toEqual(source.versions);
    expect(result.clinicalConclusions.prm.findings[0].value.classification).toEqual(
      source.prm.findings[0].value.classification,
    );
    expect(result.clinicalConclusions.adherence.barriers[0].value.classification).toEqual(
      source.adherence.barriers[0].value.classification,
    );
  });

  it('preserves conceptId as an opaque taxonomy value without enrichment', () => {
    const result = build();
    expect(result.clinicalConclusions.prm.findings[0].value.classification).toEqual({
      taxonomyId: 'foro-prm',
      taxonomyVersion: '2024',
      conceptId: 'PRM-CONCEPT-A',
    });
    expect(Object.keys(result.clinicalConclusions.prm.findings[0].value.classification)).toEqual([
      'taxonomyId',
      'taxonomyVersion',
      'conceptId',
    ]);
  });

  it('is deterministic, does not mutate input and exposes a deeply readonly contract', () => {
    const source = evaluatorFixture();
    const before = clone(source);
    const first = build(source);
    const second = build(source);
    expect(first).toEqual(second);
    expect(source).toEqual(before);
    expectTypeOf(first).toMatchTypeOf<PharmaceuticalClinicalReferenceV2>();
  });

  it('returns a detached allowlist projection rather than PostgreSQL/provider/source objects', () => {
    const source = evaluatorFixture();
    const result = build(source);
    source.prm.findings[0].value.classification.conceptId = 'MUTATED';
    expect(result.clinicalConclusions.prm.findings[0].value.classification.conceptId).toBe(
      'PRM-CONCEPT-A',
    );
    const keys = allKeys(result);
    [
      'evidenceRules',
      'teacherRationale',
      'transcript',
      'messages',
      'sessionId',
      'studentAnswers',
      'prompt',
      'model',
      'usage',
      'patientFacts',
      'publicProfile',
      'score',
      'feedback',
      'severity',
      'followUpPlan',
      'safetyRules',
    ].forEach((key) => expect(keys).not.toContain(key));
  });

  it('rejects an evaluator with an unexpected property instead of silently copying it', () => {
    const source = evaluatorFixture();
    source.futureSecret = { answer: 'protected' };
    expect(() => build(source)).toThrow(PharmaceuticalClinicalReferenceValidationError);
  });

  it('rejects a broken PRM/RNM reference', () => {
    const source = evaluatorFixture();
    source.prmRnmRelations[0].value.prmRef = nextConclusionId();
    expect(() => build(source)).toThrow(/unknown conclusion reference/);
  });

  it('rejects a broken intervention conclusion link', () => {
    const source = evaluatorFixture();
    source.pharmaceuticalInterventions[0].value.addressedConclusionRefs = [nextConclusionId()];
    expect(() => build(source)).toThrow(/unknown conclusion reference/);
  });

  it('rejects an intervention linked to an action from another SPFA', () => {
    const source = evaluatorFixture();
    source.professionalActions[0].value.spfaRef = source.carePath.additionalSpfas[0].conclusionId;
    expect(() => build(source)).toThrow(/different SPFA/);
  });

  it('rejects duplicate and overlapping adherence medication scopes', () => {
    const source = evaluatorFixture();
    source.adherence.assessments[1].value.medicationRefs = [medicationIds[0]];
    expect(() => build(source)).toThrow(/adherence medication scope/);
  });

  it('rejects a medication reference absent from the patient runtime', () => {
    const source = evaluatorFixture();
    source.adherence.assessments[0].value.medicationRefs = [medicationIds[4]];
    const limitedRuntime = runtime() as unknown as Record<string, any>;
    limitedRuntime.medications = limitedRuntime.medications.slice(0, 4);
    expect(() => buildPharmaceuticalClinicalReferenceV2(source, limitedRuntime as PatientRuntimeViewV2)).toThrow(
      /unknown medication reference/,
    );
  });

  it('rejects an invalid barrier reference', () => {
    const source = evaluatorFixture();
    source.adherence.strategies[0].value.addressedBarrierRefs = [nextConclusionId()];
    expect(() => build(source)).toThrow(/unknown conclusion reference/);
  });

  it('rejects invalid referral and report structures', () => {
    const invalidReferral = evaluatorFixture();
    delete invalidReferral.referral.value.destination;
    expect(() => build(invalidReferral)).toThrow(/destination/);

    const invalidReport = evaluatorFixture();
    invalidReport.referral.value.report = { status: 'required', essentialContents: [] };
    expect(() => build(invalidReport)).toThrow(/essentialContents/);
  });

  it('rejects duplicate conclusion IDs', () => {
    const source = evaluatorFixture();
    source.prm.findings[1].conclusionId = source.prm.findings[0].conclusionId;
    synchronizeEvidenceRules(source);
    expect(() => build(source)).toThrow(/duplicate conclusion ID/);
  });

  it('rejects taxonomy mismatches and invalid adherence framework identity', () => {
    const taxonomyMismatch = evaluatorFixture();
    taxonomyMismatch.prm.findings[0].value.classification.taxonomyVersion = 'other';
    expect(() => build(taxonomyMismatch)).toThrow(/configured PRM taxonomy/);

    const invalidFramework = evaluatorFixture();
    invalidFramework.versions.adherenceFramework.version = '';
    expect(() => build(invalidFramework)).toThrow(/non-empty string/);
  });

  it('strictly rejects additional properties in a projected reference', () => {
    const source = clone(build()) as unknown as Record<string, any>;
    source.clinicalConclusions.prm.findings[0].futureSecret = 'must fail';
    expect(() => validatePharmaceuticalClinicalReferenceV2(source)).toThrow(
      PharmaceuticalClinicalReferenceValidationError,
    );
  });

  it('strictly rejects a malformed projected cross-reference', () => {
    const source = clone(build()) as unknown as Record<string, any>;
    source.structuralContext.prmRnmRelations[0].value.rnmAssessmentRef = nextConclusionId();
    expect(() => validatePharmaceuticalClinicalReferenceV2(source)).toThrow(
      /violates evaluator invariants/,
    );
  });
});
