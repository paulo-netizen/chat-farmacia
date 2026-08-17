import { describe, expect, it } from 'vitest';
import {
  BriefComplianceBuildError,
  buildBriefComplianceReportV2,
} from '@/lib/cases/v2/build-brief-compliance-report';
import type {
  ComplianceCheckCode,
  ComplianceDimension,
} from '@/lib/cases/v2/brief-compliance-types';
import type {
  TeachingBriefId,
  TeachingCaseGenerationBriefV2,
} from '@/lib/cases/v2/teaching-brief-types';
import type { TeachingCaseSummaryV2 } from '@/lib/cases/v2/teaching-case-summary-types';
import type { CaseVersionId, MedicationId } from '@/lib/cases/v2/types';

const caseVersionId =
  'casever_90000000-0000-4000-8000-000000000001' as CaseVersionId;
const briefId =
  'brief_90000000-0000-4000-8000-000000000001' as TeachingBriefId;
const medA = 'med_10000000-0000-4000-8000-000000000001' as MedicationId;
const medB = 'med_10000000-0000-4000-8000-000000000002' as MedicationId;

const prmA = {
  taxonomyId: 'prm',
  taxonomyVersion: '2024',
  conceptId: 'prm-a',
};
const prmB = {
  taxonomyId: 'prm',
  taxonomyVersion: '2024',
  conceptId: 'prm-b',
};
const rnmA = {
  taxonomyId: 'rnm',
  taxonomyVersion: '2024',
  conceptId: 'rnm-a',
};
const classificationA = {
  taxonomyId: 'local',
  taxonomyVersion: '1',
  conceptId: 'a',
};
const classificationB = {
  taxonomyId: 'local',
  taxonomyVersion: '1',
  conceptId: 'b',
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fixedNonAdherence(barriers: unknown = {
  targeting: 'not_targeted',
  policy: 'forbidden',
}) {
  return {
    type: {
      targeting: 'targeted',
      decision: {
        mode: 'teacher_fixed',
        value: { status: 'determined', type: 'unintentional' },
      },
    },
    patientProfile: {
      targeting: 'not_targeted',
      policy: 'forbidden',
    },
    barriers,
  };
}

function createBrief(): TeachingCaseGenerationBriefV2 {
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
              value: 'initial_treatment',
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
      policy: 'forbidden',
    },
    professionalActions: {
      targeting: 'not_targeted',
      policy: 'forbidden',
    },
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

function medication(medicationId: MedicationId, label: string) {
  return {
    medicationId,
    displayLabel: {
      state: 'known' as const,
      value: label,
      certainty: 'exact' as const,
    },
  };
}

function createSummary(): TeachingCaseSummaryV2 {
  return {
    schemaVersion: '2.0',
    caseVersionId,
    medications: [medication(medA, 'Enalapril')],
    carePath: {
      initialSpfa: { service: 'dispensing', subtype: 'initial_treatment' },
      additionalSpfas: [],
      transitions: [],
    },
    incidence: { status: 'none', count: 0, findings: [] },
    prm: { status: 'none', count: 0, findings: [] },
    rnm: {
      status: 'no_rnm',
      rnmCount: 0,
      riskOfRnmCount: 0,
      findings: [],
    },
    adherence: {
      assessments: [
        {
          medicationScope: { medications: [medication(medA, 'Enalapril')] },
          status: 'adherent',
        },
      ],
      strategies: [],
    },
    professionalActions: [],
    pharmaceuticalInterventions: [],
    referral: { status: 'not_required' },
    objectiveMetrics: {
      numberOfMedications: 1,
      numberOfSpfas: 1,
      numberOfIncidences: 0,
      numberOfPrms: 0,
      numberOfRnms: 0,
      numberOfRnmRisks: 0,
      numberOfAdherenceScopes: 1,
      numberOfBarriers: 0,
    },
  };
}

function refreshMetrics(summary: any): void {
  summary.incidence.count = summary.incidence.findings.length;
  summary.prm.count = summary.prm.findings.length;
  summary.rnm.rnmCount = summary.rnm.findings.filter(
    (finding: any) => finding.outcome === 'rnm',
  ).length;
  summary.rnm.riskOfRnmCount = summary.rnm.findings.filter(
    (finding: any) => finding.outcome === 'risk_of_rnm',
  ).length;
  summary.objectiveMetrics = {
    numberOfMedications: summary.medications.length,
    numberOfSpfas: 1 + summary.carePath.additionalSpfas.length,
    numberOfIncidences: summary.incidence.findings.length,
    numberOfPrms: summary.prm.findings.length,
    numberOfRnms: summary.rnm.rnmCount,
    numberOfRnmRisks: summary.rnm.riskOfRnmCount,
    numberOfAdherenceScopes: summary.adherence.assessments.length,
    numberOfBarriers: summary.adherence.assessments.reduce(
      (count: number, assessment: any) =>
        assessment.status === 'non_adherent' &&
        assessment.nonAdherence.barriers.status === 'identified'
          ? count + 1 + assessment.nonAdherence.barriers.secondary.length
          : count,
      0,
    ),
  };
}

function scope(summary: any, ...ids: MedicationId[]) {
  return {
    medications: ids.map((id) => {
      const found = summary.medications.find(
        (item: any) => item.medicationId === id,
      );
      if (found === undefined) throw new Error('Missing fixture medication');
      return clone(found);
    }),
  };
}

function nonAdherentAssessment(summary: any, medicationId: MedicationId) {
  return {
    medicationScope: scope(summary, medicationId),
    status: 'non_adherent',
    nonAdherence: {
      type: { status: 'determined', type: 'unintentional' },
      patientProfile: { status: 'absent' },
      barriers: { status: 'not_determinable' },
    },
  };
}

function configureSingleNonAdherentCase(brief: any, summary: any): void {
  brief.adherence.decision.value.assessments = [
    {
      medicationScope: { kind: 'all_relevant_medications' },
      status: 'non_adherent',
      nonAdherence: fixedNonAdherence({
        targeting: 'targeted',
        decision: {
          mode: 'teacher_fixed',
          value: {
            barriers: [{ role: 'primary', category: 'practical' }],
            additionalBarriers: 'forbidden',
          },
        },
      }),
    },
  ];
  summary.adherence.assessments = [
    {
      ...nonAdherentAssessment(summary, medA),
      nonAdherence: {
        type: { status: 'determined', type: 'unintentional' },
        patientProfile: { status: 'absent' },
        barriers: {
          status: 'identified',
          primary: { role: 'primary', category: 'practical' },
          secondary: [],
        },
      },
    },
  ];
  refreshMetrics(summary);
}

function dimension(report: any, name: ComplianceDimension) {
  return report.dimensions.find((item: any) => item.dimension === name)!;
}

function check(report: any, code: ComplianceCheckCode) {
  return report.dimensions
    .flatMap((item: any) => item.checks)
    .find((item: any) => item.code === code)!;
}

describe('BriefComplianceReportV2 scenarios A-L', () => {
  it('A: fixed adherent passes adherence while complexity keeps global review_required', () => {
    const report = buildBriefComplianceReportV2(createBrief(), createSummary());
    expect(report).toMatchObject({
      schemaVersion: '2.0',
      caseVersionId,
      briefId,
      briefRevision: 1,
      generationMode: 'strict',
    });
    expect(dimension(report, 'adherence').status).toBe('pass');
    expect(report.overallStatus).toBe('review_required');
  });

  it('B: fixed non_adherent versus adherent fails', () => {
    const brief: any = clone(createBrief());
    brief.adherence.decision.value.assessments[0] = {
      medicationScope: { kind: 'all_relevant_medications' },
      status: 'non_adherent',
      nonAdherence: fixedNonAdherence(),
    };
    const report = buildBriefComplianceReportV2(brief, createSummary());
    expect(check(report, 'adherence_status_by_scope').status).toBe('fail');
    expect(report.overallStatus).toBe('non_compliant');
  });

  it('C: semantic scope Enalapril versus Enalapril 20 mg is unresolved', () => {
    const brief: any = clone(createBrief());
    brief.adherence.decision.value.assessments[0].medicationScope = {
      kind: 'semantic_targets',
      descriptions: ['Enalapril'],
    };
    const summary: any = clone(createSummary());
    summary.medications[0].displayLabel.value = 'Enalapril 20 mg';
    summary.adherence.assessments[0].medicationScope.medications[0].displayLabel.value =
      'Enalapril 20 mg';
    const report = buildBriefComplianceReportV2(brief, summary);
    expect(check(report, 'adherence_fixed_scope_set').status).toBe('unresolved');
  });

  it('D: all_relevant_medications matches the complete MedicationId set', () => {
    const report = buildBriefComplianceReportV2(createBrief(), createSummary());
    expect(check(report, 'adherence_fixed_scope_set').status).toBe('pass');
  });

  it('E: PRM exactly 2 versus one finding fails', () => {
    const brief: any = clone(createBrief());
    brief.prm = {
      targeting: 'targeted',
      decision: {
        mode: 'teacher_fixed',
        value: {
          status: 'present',
          quantity: { kind: 'exactly', count: 2 },
          fixedFindings: [{ classification: prmA }, { classification: prmB }],
          additionalFindings: 'forbidden',
        },
      },
    };
    const summary: any = clone(createSummary());
    summary.prm = {
      status: 'present',
      count: 1,
      findings: [{ classification: prmA, medicationScope: scope(summary, medA) }],
    };
    refreshMetrics(summary);
    expect(check(buildBriefComplianceReportV2(brief, summary), 'prm_cardinality').status).toBe('fail');
  });

  it('F: PRM semanticIntent remains unresolved despite structural compatibility', () => {
    const brief: any = clone(createBrief());
    brief.prm = {
      targeting: 'targeted',
      decision: {
        mode: 'teacher_fixed',
        value: {
          status: 'present',
          quantity: { kind: 'exactly', count: 1 },
          fixedFindings: [{ semanticIntent: 'Problema clínico específico' }],
          additionalFindings: 'forbidden',
        },
      },
    };
    const summary: any = clone(createSummary());
    summary.prm = {
      status: 'present',
      count: 1,
      findings: [{ classification: prmA, medicationScope: scope(summary, medA) }],
    };
    refreshMetrics(summary);
    expect(check(buildBriefComplianceReportV2(brief, summary), 'prm_semantic_intent_requires_review').status).toBe('unresolved');
  });

  it('G: RNM AI allows simultaneous rnm and risk_of_rnm', () => {
    const brief: any = clone(createBrief());
    brief.rnm = {
      targeting: 'targeted',
      decision: {
        mode: 'ai_proposes',
        constraints: { allowedStatuses: ['rnm', 'risk_of_rnm'] },
      },
    };
    const summary: any = clone(createSummary());
    summary.rnm = {
      status: 'rnm_and_risk_of_rnm',
      rnmCount: 1,
      riskOfRnmCount: 1,
      findings: [
        { outcome: 'rnm', classification: rnmA, medicationScope: scope(summary, medA) },
        { outcome: 'risk_of_rnm', medicationScope: scope(summary, medA) },
      ],
    };
    refreshMetrics(summary);
    expect(check(buildBriefComplianceReportV2(brief, summary), 'rnm_allowed_outcomes').status).toBe('pass');
  });

  it('H: all_non_adherent_scopes expands to every generated non-adherent scope', () => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    summary.medications.push(medication(medB, 'Amlodipino'));
    brief.adherence.decision.value.assessments = [
      {
        medicationScope: { kind: 'semantic_targets', descriptions: ['Enalapril'] },
        status: 'non_adherent',
        nonAdherence: fixedNonAdherence({
          targeting: 'targeted',
          decision: {
            mode: 'teacher_fixed',
            value: {
              barriers: [{ role: 'primary', category: 'practical' }],
              additionalBarriers: 'forbidden',
            },
          },
        }),
      },
      {
        medicationScope: { kind: 'semantic_targets', descriptions: ['Amlodipino'] },
        status: 'non_adherent',
        nonAdherence: fixedNonAdherence({
          targeting: 'targeted',
          decision: {
            mode: 'teacher_fixed',
            value: {
              barriers: [{ role: 'primary', category: 'practical' }],
              additionalBarriers: 'forbidden',
            },
          },
        }),
      },
    ];
    summary.adherence.assessments = [medA, medB].map((id) => ({
      ...nonAdherentAssessment(summary, id),
      nonAdherence: {
        type: { status: 'determined', type: 'unintentional' },
        patientProfile: { status: 'absent' },
        barriers: {
          status: 'identified',
          primary: { role: 'primary', category: 'practical' },
          secondary: [],
        },
      },
    }));
    brief.adherenceStrategies = {
      targeting: 'targeted',
      decision: {
        mode: 'teacher_fixed',
        value: [
          {
            category: 'educational',
            appliesTo: 'all_non_adherent_scopes',
            addresses: 'primary_barrier',
          },
        ],
      },
    };
    summary.adherence.strategies = summary.adherence.assessments.map(
      (assessment: any) => ({
        medicationScope: clone(assessment.medicationScope),
        category: 'educational',
        addressedBarriers: [{ role: 'primary', category: 'practical' }],
      }),
    );
    refreshMetrics(summary);
    expect(check(buildBriefComplianceReportV2(brief, summary), 'strategies_exact_multiset').status).toBe('pass');
  });

  it('I: forbidden professional actions fail when one action exists', () => {
    const summary: any = clone(createSummary());
    summary.professionalActions = [{
      spfa: { service: 'dispensing', subtype: 'initial_treatment' },
      category: 'dispense',
      referralInvolvement: false,
    }];
    expect(check(buildBriefComplianceReportV2(createBrief(), summary), 'actions_presence').status).toBe('fail');
  });

  it('J: fixed intervention can pass structurally while addressedProblems stays unresolved', () => {
    const brief: any = clone(createBrief());
    brief.pharmaceuticalInterventions = {
      targeting: 'targeted',
      decision: {
        mode: 'teacher_fixed',
        value: [{
          spfa: 'dispensing',
          target: 'treatment',
          addressedProblems: ['Problema docente'],
        }],
      },
    };
    const summary: any = clone(createSummary());
    summary.pharmaceuticalInterventions = [{
      spfa: { service: 'dispensing', subtype: 'initial_treatment' },
      target: 'treatment',
      addressedConclusions: [{
        kind: 'adherence_assessment',
        status: 'adherent',
        medicationScope: scope(summary, medA),
      }],
      directReferralInvolvement: false,
    }];
    const report = buildBriefComplianceReportV2(brief, summary);
    expect(check(report, 'interventions_exact_multiset').status).toBe('pass');
    expect(check(report, 'intervention_addressed_problems_require_review').status).toBe('unresolved');
  });

  it('K: a paraphrased referral reason is unresolved, not fail', () => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    brief.referral = {
      targeting: 'targeted',
      decision: {
        mode: 'teacher_fixed',
        value: {
          status: 'required',
          urgency: 'urgent',
          destination: { label: 'Médico' },
          reason: 'Valoración inmediata',
          report: { status: 'required', essentialContents: ['Tratamiento'] },
        },
      },
    };
    summary.referral = {
      status: 'required',
      urgency: 'urgent',
      destination: { label: 'Médico' },
      reason: 'Debe ser valorado sin demora',
      report: { status: 'required', essentialContents: ['Tratamiento'] },
    };
    const report = buildBriefComplianceReportV2(brief, summary);
    expect(check(report, 'referral_reason').status).toBe('unresolved');
    expect(dimension(report, 'referral').status).toBe('unresolved');
  });

  it('L: complexity plus teacherInstruction require review without hard failures', () => {
    const brief: any = clone(createBrief());
    brief.teacherInstruction = 'Mantener el caso realista.';
    const report = buildBriefComplianceReportV2(brief, createSummary());
    expect(report).toMatchObject({
      overallStatus: 'review_required',
      hasHardFailures: false,
      requiresReview: true,
    });
  });
});

describe('BriefComplianceReportV2 deterministic boundaries', () => {
  it('keeps a fixed strategy multiset unresolved when its semantic scope cannot resolve but cardinality matches', () => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    configureSingleNonAdherentCase(brief, summary);
    summary.medications[0].displayLabel.value = 'Enalapril 20 mg';
    brief.adherenceStrategies = {
      targeting: 'targeted',
      decision: {
        mode: 'teacher_fixed',
        value: [
          {
            category: 'educational',
            appliesTo: {
              medicationScope: {
                kind: 'semantic_targets',
                descriptions: ['Enalapril'],
              },
            },
            addresses: 'primary_barrier',
          },
        ],
      },
    };
    summary.adherence.strategies = [
      {
        medicationScope: scope(summary, medA),
        category: 'educational',
        addressedBarriers: [{ role: 'primary', category: 'practical' }],
      },
    ];

    const report = buildBriefComplianceReportV2(brief, summary);
    expect(check(report, 'strategy_scope_resolution').status).toBe('unresolved');
    expect(check(report, 'strategies_exact_multiset').status).toBe('unresolved');
    expect(
      dimension(report, 'adherenceStrategies').checks.some(
        (item: any) => item.status === 'fail',
      ),
    ).toBe(false);
  });

  it('fails a fixed strategy multiset when unresolved scope cardinality is still demonstrably wrong', () => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    configureSingleNonAdherentCase(brief, summary);
    summary.medications[0].displayLabel.value = 'Enalapril 20 mg';
    brief.adherenceStrategies = {
      targeting: 'targeted',
      decision: {
        mode: 'teacher_fixed',
        value: [
          {
            category: 'educational',
            appliesTo: {
              medicationScope: {
                kind: 'semantic_targets',
                descriptions: ['Enalapril'],
              },
            },
            addresses: 'primary_barrier',
          },
        ],
      },
    };
    summary.adherence.strategies = [];

    const report = buildBriefComplianceReportV2(brief, summary);
    expect(check(report, 'strategy_scope_resolution').status).toBe('unresolved');
    expect(check(report, 'strategies_exact_multiset').status).toBe('fail');
  });

  it('keeps a mixed fixed strategy collection unresolved without a false cardinality failure', () => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    configureSingleNonAdherentCase(brief, summary);
    summary.medications[0].displayLabel.value = 'Enalapril 20 mg';
    brief.adherenceStrategies = {
      targeting: 'targeted',
      decision: {
        mode: 'teacher_fixed',
        value: [
          {
            category: 'educational',
            appliesTo: {
              medicationScope: {
                kind: 'semantic_targets',
                descriptions: ['Enalapril'],
              },
            },
            addresses: 'primary_barrier',
          },
          {
            category: 'behavioral',
            appliesTo: 'all_non_adherent_scopes',
            addresses: 'primary_barrier',
          },
        ],
      },
    };
    summary.adherence.strategies = [
      {
        medicationScope: scope(summary, medA),
        category: 'educational',
        addressedBarriers: [{ role: 'primary', category: 'practical' }],
      },
      {
        medicationScope: scope(summary, medA),
        category: 'behavioral',
        addressedBarriers: [{ role: 'primary', category: 'practical' }],
      },
    ];

    const report = buildBriefComplianceReportV2(brief, summary);
    expect(check(report, 'strategy_scope_resolution').status).toBe('unresolved');
    expect(check(report, 'strategies_exact_multiset').status).toBe('unresolved');
    expect(
      dimension(report, 'adherenceStrategies').checks.some(
        (item: any) => item.status === 'fail',
      ),
    ).toBe(false);
  });

  it.each([
    ['incidence', 'incidence_allowed_status'],
    ['prm', 'prm_status'],
  ] as const)('targeted AI %s rejects summary not_determinable', (kind, code) => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    brief[kind] = { targeting: 'targeted', decision: { mode: 'ai_proposes' } };
    summary[kind] = { status: 'not_determinable', count: 0, findings: [] };
    refreshMetrics(summary);
    expect(check(buildBriefComplianceReportV2(brief, summary), code).status).toBe('fail');
  });

  it('semantic scope with an unknown medication label is unresolved', () => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    brief.adherence.decision.value.assessments[0].medicationScope = {
      kind: 'semantic_targets',
      descriptions: ['Enalapril'],
    };
    summary.medications[0].displayLabel = {
      state: 'patient_unknown',
      topic: 'nombre del medicamento',
    };
    expect(check(buildBriefComplianceReportV2(brief, summary), 'adherence_fixed_scope_set').status).toBe('unresolved');
  });

  it('semantic scope with duplicate exact labels is unresolved', () => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    summary.medications.push(medication(medB, 'ENALAPRIL'));
    brief.adherence.decision.value.assessments[0].medicationScope = {
      kind: 'semantic_targets',
      descriptions: ['enalapril'],
    };
    refreshMetrics(summary);
    expect(check(buildBriefComplianceReportV2(brief, summary), 'adherence_fixed_scope_set').status).toBe('unresolved');
  });

  it('unique exact semantic label resolves case-insensitively', () => {
    const brief: any = clone(createBrief());
    brief.adherence.decision.value.assessments[0].medicationScope = {
      kind: 'semantic_targets',
      descriptions: ['  ENALAPRIL  '],
    };
    expect(check(buildBriefComplianceReportV2(brief, createSummary()), 'adherence_fixed_scope_set').status).toBe('pass');
  });

  it('an additional SPFA omitted from the brief creates no additional-SPFA check', () => {
    const summary: any = clone(createSummary());
    summary.carePath.additionalSpfas = [{ service: 'pharmaceutical_indication' }];
    refreshMetrics(summary);
    const report = buildBriefComplianceReportV2(createBrief(), summary);
    expect(dimension(report, 'carePath').checks.some((item: any) => item.code.startsWith('additional_spfa'))).toBe(false);
    expect(dimension(report, 'carePath').status).toBe('pass');
  });

  it('an explicitly forbidden additional SPFA fails when present', () => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    brief.carePath.additionalSpfas = [{
      service: 'pharmaceutical_indication',
      inclusion: { targeting: 'not_targeted', policy: 'forbidden' },
    }];
    summary.carePath.additionalSpfas = [{ service: 'pharmaceutical_indication' }];
    refreshMetrics(summary);
    expect(check(buildBriefComplianceReportV2(brief, summary), 'additional_spfa_presence').status).toBe('fail');
  });

  it('RNM allowedClassifications is N/A when no finding has classification', () => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    brief.rnm = {
      targeting: 'targeted',
      decision: {
        mode: 'ai_proposes',
        constraints: {
          allowedStatuses: ['risk_of_rnm'],
          allowedClassifications: [rnmA],
        },
      },
    };
    summary.rnm = {
      status: 'risk_of_rnm',
      rnmCount: 0,
      riskOfRnmCount: 1,
      findings: [{ outcome: 'risk_of_rnm', medicationScope: scope(summary, medA) }],
    };
    refreshMetrics(summary);
    const report = buildBriefComplianceReportV2(brief, summary);
    expect(check(report, 'rnm_allowed_classifications').status).toBe('not_applicable');
    expect(dimension(report, 'rnm').status).not.toBe('fail');
  });

  it.each([
    [undefined, 'missing'],
    [classificationB, 'different'],
  ])('fixed RNM classification fails when summary classification is %s', (classification, _label) => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    brief.rnm = {
      targeting: 'targeted',
      decision: {
        mode: 'teacher_fixed',
        value: {
          status: 'findings',
          quantity: { kind: 'exactly', count: 1 },
          fixedFindings: [{ outcome: 'risk_of_rnm', classification: classificationA }],
          additionalFindings: 'forbidden',
        },
      },
    };
    summary.rnm = {
      status: 'risk_of_rnm',
      rnmCount: 0,
      riskOfRnmCount: 1,
      findings: [{
        outcome: 'risk_of_rnm',
        ...(classification === undefined ? {} : { classification }),
        medicationScope: scope(summary, medA),
      }],
    };
    refreshMetrics(summary);
    expect(check(buildBriefComplianceReportV2(brief, summary), 'rnm_fixed_classifications').status).toBe('fail');
  });

  it('fixed RNM without classification accepts an actual classification', () => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    brief.rnm = {
      targeting: 'targeted',
      decision: {
        mode: 'teacher_fixed',
        value: {
          status: 'findings',
          quantity: { kind: 'exactly', count: 1 },
          fixedFindings: [{ outcome: 'risk_of_rnm', semanticIntent: 'Riesgo esperado' }],
          additionalFindings: 'forbidden',
        },
      },
    };
    summary.rnm = {
      status: 'risk_of_rnm',
      rnmCount: 0,
      riskOfRnmCount: 1,
      findings: [{
        outcome: 'risk_of_rnm',
        classification: classificationA,
        medicationScope: scope(summary, medA),
      }],
    };
    refreshMetrics(summary);
    const report = buildBriefComplianceReportV2(brief, summary);
    expect(check(report, 'rnm_fixed_classifications').status).toBe('pass');
    expect(check(report, 'rnm_semantic_intent_requires_review').status).toBe('unresolved');
  });

  it('fixed action without classification accepts a summary classification', () => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    brief.professionalActions = {
      targeting: 'targeted',
      decision: { mode: 'teacher_fixed', value: [{ spfa: 'dispensing', category: 'dispense' }] },
    };
    summary.professionalActions = [{
      spfa: { service: 'dispensing', subtype: 'initial_treatment' },
      category: 'dispense',
      classification: classificationA,
      referralInvolvement: false,
    }];
    expect(check(buildBriefComplianceReportV2(brief, summary), 'actions_exact_multiset').status).toBe('pass');
  });

  it('fixed action with a different classification fails', () => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    brief.professionalActions = {
      targeting: 'targeted',
      decision: { mode: 'teacher_fixed', value: [{ spfa: 'dispensing', category: 'dispense', classification: classificationA }] },
    };
    summary.professionalActions = [{
      spfa: { service: 'dispensing', subtype: 'initial_treatment' },
      category: 'dispense',
      classification: classificationB,
      referralInvolvement: false,
    }];
    expect(check(buildBriefComplianceReportV2(brief, summary), 'actions_exact_multiset').status).toBe('fail');
  });

  it('fixed intervention leaves absent classification and related action unconstrained', () => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    brief.pharmaceuticalInterventions = {
      targeting: 'targeted',
      decision: { mode: 'teacher_fixed', value: [{ spfa: 'dispensing', target: 'treatment', addressedProblems: ['PRM'] }] },
    };
    summary.pharmaceuticalInterventions = [{
      spfa: { service: 'dispensing', subtype: 'initial_treatment' },
      target: 'treatment',
      classification: classificationA,
      relatedProfessionalActionCategory: 'dispense',
      addressedConclusions: [{ kind: 'adherence_assessment', status: 'adherent', medicationScope: scope(summary, medA) }],
      directReferralInvolvement: false,
    }];
    expect(check(buildBriefComplianceReportV2(brief, summary), 'interventions_exact_multiset').status).toBe('pass');
  });

  it('fixed barrier without classification accepts a summary classification', () => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    brief.adherence.decision.value.assessments[0] = {
      medicationScope: { kind: 'all_relevant_medications' },
      status: 'non_adherent',
      nonAdherence: fixedNonAdherence({
        targeting: 'targeted',
        decision: {
          mode: 'teacher_fixed',
          value: {
            barriers: [{ role: 'primary', category: 'practical' }],
            additionalBarriers: 'forbidden',
          },
        },
      }),
    };
    summary.adherence.assessments = [{
      ...nonAdherentAssessment(summary, medA),
      nonAdherence: {
        type: { status: 'determined', type: 'unintentional' },
        patientProfile: { status: 'absent' },
        barriers: {
          status: 'identified',
          primary: { role: 'primary', category: 'practical', classification: classificationA },
          secondary: [],
        },
      },
    }];
    refreshMetrics(summary);
    expect(check(buildBriefComplianceReportV2(brief, summary), 'adherence_primary_barrier').status).toBe('pass');
  });

  it('fixed destination without classification does not reject a summary classification', () => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    brief.referral = {
      targeting: 'targeted',
      decision: {
        mode: 'teacher_fixed',
        value: {
          status: 'required',
          urgency: 'urgent',
          destination: { label: 'Médico' },
          reason: 'Valorar',
          report: { status: 'not_required', essentialContents: [] },
        },
      },
    };
    summary.referral = {
      status: 'required',
      urgency: 'urgent',
      destination: { label: 'Médico', classification: classificationA },
      reason: 'Valorar',
      report: { status: 'not_required', essentialContents: [] },
    };
    const report = buildBriefComplianceReportV2(brief, summary);
    expect(dimension(report, 'referral').checks.some((item: any) => item.code === 'referral_destination_classification')).toBe(false);
    expect(dimension(report, 'referral').status).toBe('pass');
  });

  it('fixed report essential contents are minimum requirements, not a closed list', () => {
    const brief: any = clone(createBrief());
    const summary: any = clone(createSummary());
    brief.referral = {
      targeting: 'targeted',
      decision: {
        mode: 'teacher_fixed',
        value: {
          status: 'required', urgency: 'urgent', destination: { label: 'Médico' }, reason: 'Valorar',
          report: { status: 'required', essentialContents: ['Tratamiento'] },
        },
      },
    };
    summary.referral = {
      status: 'required', urgency: 'urgent', destination: { label: 'Médico' }, reason: 'Valorar',
      report: { status: 'required', essentialContents: ['Motivo', 'Tratamiento'] },
    };
    expect(check(buildBriefComplianceReportV2(brief, summary), 'referral_report_contents').status).toBe('pass');
  });

  it('optional allowed empty is N/A and positive content is unresolved', () => {
    const emptyBrief: any = clone(createBrief());
    emptyBrief.professionalActions = {
      targeting: 'not_targeted',
      policy: 'allowed_if_clinically_coherent',
    };
    const emptyReport = buildBriefComplianceReportV2(emptyBrief, createSummary());
    expect(check(emptyReport, 'actions_optional_content_requires_review').status).toBe('not_applicable');

    const summary: any = clone(createSummary());
    summary.professionalActions = [{
      spfa: { service: 'dispensing', subtype: 'initial_treatment' },
      category: 'dispense',
      referralInvolvement: false,
    }];
    const contentReport = buildBriefComplianceReportV2(emptyBrief, summary);
    expect(check(contentReport, 'actions_optional_content_requires_review').status).toBe('unresolved');
  });

  it('FAIL and UNRESOLVED coexist with non_compliant overall status', () => {
    const brief: any = clone(createBrief());
    brief.professionalActions = {
      targeting: 'targeted',
      decision: { mode: 'teacher_fixed', value: [{ spfa: 'dispensing', category: 'dispense' }] },
    };
    const report = buildBriefComplianceReportV2(brief, createSummary());
    expect(report).toMatchObject({
      overallStatus: 'non_compliant',
      hasHardFailures: true,
      requiresReview: true,
    });
  });

  it('derives exact counts exclusively from final checks', () => {
    const report = buildBriefComplianceReportV2(createBrief(), createSummary());
    const statuses = report.dimensions.flatMap((item) => item.checks.map((entry) => entry.status));
    expect(report.counts).toEqual({
      passed: statuses.filter((status) => status === 'pass').length,
      failed: statuses.filter((status) => status === 'fail').length,
      unresolved: statuses.filter((status) => status === 'unresolved').length,
      notApplicable: statuses.filter((status) => status === 'not_applicable').length,
    });
  });

  it('does not mutate either input', () => {
    const brief = createBrief();
    const summary = createSummary();
    const briefBefore = JSON.stringify(brief);
    const summaryBefore = JSON.stringify(summary);
    buildBriefComplianceReportV2(brief, summary);
    expect(JSON.stringify(brief)).toBe(briefBefore);
    expect(JSON.stringify(summary)).toBe(summaryBefore);
  });

  it('keeps check ordering stable across semantically irrelevant collection order', () => {
    const briefA: any = clone(createBrief());
    const briefB: any = clone(createBrief());
    const summaryA: any = clone(createSummary());
    const summaryB: any = clone(createSummary());
    const actions = [
      { spfa: 'dispensing', category: 'dispense' },
      { spfa: 'dispensing', category: 'hygienic_dietary_measures' },
    ];
    const actualActions = [
      { spfa: { service: 'dispensing', subtype: 'initial_treatment' }, category: 'dispense', referralInvolvement: false },
      { spfa: { service: 'dispensing', subtype: 'initial_treatment' }, category: 'hygienic_dietary_measures', referralInvolvement: false },
    ];
    briefA.professionalActions = { targeting: 'targeted', decision: { mode: 'teacher_fixed', value: actions } };
    briefB.professionalActions = { targeting: 'targeted', decision: { mode: 'teacher_fixed', value: [...actions].reverse() } };
    summaryA.professionalActions = actualActions;
    summaryB.professionalActions = [...actualActions].reverse();
    expect(buildBriefComplianceReportV2(briefA, summaryA)).toEqual(
      buildBriefComplianceReportV2(briefB, summaryB),
    );
  });

  it('throws BriefComplianceBuildError for an unknown MedicationId in a summary scope', () => {
    const summary: any = clone(createSummary());
    summary.adherence.assessments[0].medicationScope.medications[0].medicationId = medB;
    expect(() => buildBriefComplianceReportV2(createBrief(), summary)).toThrowError(
      BriefComplianceBuildError,
    );
  });

  it('throws BriefComplianceBuildError for metrics inconsistent with summary collections', () => {
    const summary: any = clone(createSummary());
    summary.objectiveMetrics.numberOfMedications = 99;
    expect(() => buildBriefComplianceReportV2(createBrief(), summary)).toThrowError(
      BriefComplianceBuildError,
    );
  });
});
