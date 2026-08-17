import { describe, expect, it } from 'vitest';
import { validateTeachingCaseGenerationBriefV2 } from '@/lib/cases/v2/validate-teaching-brief';

const briefId = 'brief_10000000-0000-4000-8000-000000000001';
const previousBriefId = 'brief_10000000-0000-4000-8000-000000000002';

const fixed = (value: unknown) => ({
  targeting: 'targeted',
  decision: { mode: 'teacher_fixed', value },
});
const propose = (constraints?: unknown) => ({
  targeting: 'targeted',
  decision: {
    mode: 'ai_proposes',
    ...(constraints === undefined ? {} : { constraints }),
  },
});
const allow = {
  targeting: 'not_targeted',
  policy: 'allowed_if_clinically_coherent',
};
const forbid = { targeting: 'not_targeted', policy: 'forbidden' };

const semanticScope = (...descriptions: string[]) => ({
  kind: 'semantic_targets',
  descriptions,
});
const allMedications = { kind: 'all_relevant_medications' };

function nonAdherence(overrides: Record<string, unknown> = {}) {
  return {
    type: fixed({ status: 'determined', type: 'unintentional' }),
    patientProfile: allow,
    barriers: fixed({
      barriers: [
        {
          role: 'primary',
          category: 'practical',
          semanticIntent: 'Olvidos asociados a cambios de turno.',
        },
      ],
      additionalBarriers: 'forbidden',
    }),
    ...overrides,
  };
}

function createBrief(): Record<string, any> {
  return {
    schemaVersion: '2.0',
    briefId,
    revision: { number: 1 },
    generationMode: 'strict',
    complexity: 'low',
    carePath: {
      initialSpfa: fixed({
        service: 'dispensing',
        dispensingSubtype: {
          mode: 'teacher_fixed',
          value: 'initial_treatment',
        },
      }),
      additionalSpfas: [],
      transitions: forbid,
    },
    incidence: fixed({ status: 'none' }),
    prm: fixed({ status: 'none' }),
    rnm: fixed({ status: 'no_rnm' }),
    adherence: fixed({
      assessments: [
        {
          medicationScope: allMedications,
          status: 'adherent',
        },
      ],
    }),
    adherenceStrategies: allow,
    professionalActions: allow,
    pharmaceuticalInterventions: allow,
    referral: fixed({ status: 'not_required' }),
    teacherInstruction: 'Mantener un caso ficticio y coherente.',
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function validate(source = createBrief()) {
  return validateTeachingCaseGenerationBriefV2(source);
}

function fixedNonAdherentAssessment(scope = semanticScope('Enalapril')) {
  return {
    medicationScope: scope,
    status: 'non_adherent',
    nonAdherence: nonAdherence(),
  };
}

function requiredReferral() {
  return {
    status: 'required',
    destination: { label: 'Médico de atención primaria' },
    urgency: 'urgent',
    reason: 'Necesita valoración clínica prioritaria.',
    patientInstruction: 'Acuda hoy a su médico con este informe.',
    report: {
      status: 'required',
      essentialContents: ['Motivo de derivación', 'Tratamiento actual'],
    },
  };
}

describe('TeachingCaseGenerationBriefV2 scenarios A-J', () => {
  it('A: representa una Dispensación inicial limpia', () => {
    const result = validate();
    expect(result.carePath.initialSpfa).toEqual(createBrief().carePath.initialSpfa);
    expect(result.prm).toEqual(fixed({ status: 'none' }));
    expect(result.rnm).toEqual(fixed({ status: 'no_rnm' }));
  });

  it('B: representa continuación con no adherencia no intencional práctica', () => {
    const source = createBrief();
    source.carePath.initialSpfa.decision.value.dispensingSubtype.value =
      'continuation';
    source.adherence = fixed({ assessments: [fixedNonAdherentAssessment()] });
    expect(
      validate(source).adherence.targeting,
    ).toBe('targeted');
  });

  it('C: admite Adherencia inicial con tipo y barreras propuestos por IA', () => {
    const source = createBrief();
    source.carePath.initialSpfa = fixed({ service: 'medication_adherence' });
    source.adherence = fixed({
      assessments: [
        {
          medicationScope: semanticScope('Inhalador de mantenimiento'),
          status: 'non_adherent',
          nonAdherence: nonAdherence({
            type: propose({
              allowedTypes: ['intentional', 'unintentional'],
            }),
            barriers: propose({ allowedCategories: ['practical', 'perception'] }),
          }),
        },
      ],
    });
    expect(validate(source).carePath.initialSpfa.targeting).toBe('targeted');
  });

  it('D: representa Indicación con Incidencia sin exponer el Episodio', () => {
    const source = createBrief();
    source.carePath.initialSpfa = fixed({ service: 'pharmaceutical_indication' });
    source.incidence = fixed({
      status: 'present',
      semanticMeaning: 'Persistencia de síntomas pese a medidas previas.',
    });
    expect(validate(source).incidence).not.toHaveProperty(
      'decision.value.followUpEpisode',
    );
  });

  it('E: representa múltiples PRM y RNM/riesgo sin relaciones ni IDs', () => {
    const source = createBrief();
    source.prm = fixed({
      status: 'present',
      quantity: { kind: 'exactly', count: 2 },
      fixedFindings: [
        { semanticIntent: 'PRM relacionado con necesidad.' },
        { semanticIntent: 'PRM relacionado con seguridad.' },
      ],
      additionalFindings: 'forbidden',
    });
    source.rnm = fixed({
      status: 'findings',
      quantity: { kind: 'exactly', count: 2 },
      fixedFindings: [
        { outcome: 'rnm', semanticIntent: 'RNM manifestado.' },
        { outcome: 'risk_of_rnm', semanticIntent: 'Riesgo aún no manifestado.' },
      ],
      additionalFindings: 'forbidden',
    });
    const result = validate(source);
    expect(result.rnm).not.toHaveProperty('relationIntent');
  });

  it('F: fija un PRM y permite otros clínicamente coherentes', () => {
    const source = createBrief();
    source.prm = fixed({
      status: 'present',
      quantity: { kind: 'at_least', min: 1, max: 3 },
      fixedFindings: [{ semanticIntent: 'Duplicidad terapéutica.' }],
      additionalFindings: 'allowed_if_clinically_coherent',
    });
    expect(validate(source).prm).toEqual(source.prm);
  });

  it('G: permite prohibir derivación', () => {
    const source = createBrief();
    source.referral = forbid;
    expect(validate(source).referral).toEqual(forbid);
  });

  it('H: exige derivación urgente e informe', () => {
    const source = createBrief();
    source.referral = fixed(requiredReferral());
    expect(validate(source).referral).toEqual(source.referral);
  });

  it('I: fija estrategia educativa por scope y propone Intervención', () => {
    const source = createBrief();
    source.adherence = fixed({ assessments: [fixedNonAdherentAssessment()] });
    source.adherenceStrategies = fixed([
      {
        category: 'educational',
        appliesTo: { medicationScope: semanticScope('Enalapril') },
        addresses: 'primary_barrier',
      },
    ]);
    source.pharmaceuticalInterventions = propose({ maximumInterventions: 2 });
    expect(validate(source).adherenceStrategies).toEqual(
      source.adherenceStrategies,
    );
  });

  it('J: fija únicamente SPFA y complejidad y deja el resto a propuesta IA', () => {
    const source = createBrief();
    source.complexity = 'medium';
    source.incidence = propose();
    source.prm = propose();
    source.rnm = propose();
    source.adherence = propose({
      maximumAssessments: 2,
      whenNonAdherent: nonAdherence(),
    });
    source.adherenceStrategies = propose({ maximumStrategies: 2 });
    source.professionalActions = propose({ maximumActions: 2 });
    source.pharmaceuticalInterventions = propose({ maximumInterventions: 2 });
    source.referral = propose();
    expect(validate(source).complexity).toBe('medium');
  });
});

describe('TeachingCaseGenerationBriefV2 positive adherence contracts', () => {
  it('acepta varios scopes teacher-fixed disjuntos', () => {
    const source = createBrief();
    source.adherence = fixed({
      assessments: [
        fixedNonAdherentAssessment(semanticScope('Enalapril')),
        {
          medicationScope: semanticScope('Amlodipino'),
          status: 'adherent',
        },
      ],
    });
    expect(validate(source).adherence).toEqual(source.adherence);
  });

  it('acepta barriers forbidden como futura evaluación not_determinable', () => {
    const source = createBrief();
    source.adherence = fixed({
      assessments: [
        fixedNonAdherentAssessment(semanticScope('Enalapril')),
      ],
    });
    source.adherence.decision.value.assessments[0].nonAdherence.barriers = forbid;
    expect(validate(source).adherence).toEqual(source.adherence);
  });

  it('acepta adherence ai_proposes con whenNonAdherent', () => {
    const source = createBrief();
    source.adherence = propose({
      allowedStatuses: ['adherent', 'non_adherent'],
      maximumAssessments: 2,
      allowedMedicationScopes: [semanticScope('Enalapril'), semanticScope('Amlodipino')],
      whenNonAdherent: nonAdherence(),
    });
    expect(validate(source).adherence).toEqual(source.adherence);
  });

  it('acepta estrategia all_non_adherent_scopes', () => {
    const source = createBrief();
    source.adherence = fixed({ assessments: [fixedNonAdherentAssessment()] });
    source.adherenceStrategies = fixed([
      {
        category: 'behavioral',
        appliesTo: 'all_non_adherent_scopes',
        addresses: 'all_identified_barriers',
      },
    ]);
    expect(validate(source).adherenceStrategies.targeting).toBe('targeted');
  });

  it('strict y flexible conservan el mismo contrato estructural', () => {
    const strict = validate();
    const flexibleSource = createBrief();
    flexibleSource.generationMode = 'flexible';
    const flexible = validate(flexibleSource);
    expect({ ...strict, generationMode: 'same' }).toEqual({
      ...flexible,
      generationMode: 'same',
    });
  });

  it('representa tipo de no adherencia explícitamente not_determinable', () => {
    const source = createBrief();
    const assessment = fixedNonAdherentAssessment() as Record<string, any>;
    assessment.nonAdherence.type = fixed({ status: 'not_determinable' });
    source.adherence = fixed({ assessments: [assessment] });
    expect(validate(source).adherence).toEqual(source.adherence);
  });

  it('distingue perfil not_determinable de perfil forbidden', () => {
    const source = createBrief();
    const assessment = fixedNonAdherentAssessment() as Record<string, any>;
    assessment.nonAdherence.patientProfile = fixed({
      status: 'not_determinable',
    });
    source.adherence = fixed({ assessments: [assessment] });
    expect(validate(source).adherence).toEqual(source.adherence);

    assessment.nonAdherence.patientProfile = clone(forbid);
    expect(validate(source).adherence).toEqual(source.adherence);
  });
});

describe('TeachingCaseGenerationBriefV2 feasible care paths', () => {
  it('rechaza initial AI de Adherencia duplicado como additional targeted', () => {
    const source = createBrief();
    source.carePath.initialSpfa = propose({
      allowedServices: ['medication_adherence'],
    });
    source.carePath.additionalSpfas = [
      {
        service: 'medication_adherence',
        inclusion: fixed({ include: true }),
      },
    ];
    expect(() => validate(source)).toThrow(/no feasible SPFA/);
  });

  it('rechaza acciones fijas que requieren alternativas iniciales incompatibles', () => {
    const source = createBrief();
    source.carePath.initialSpfa = propose({
      allowedServices: ['dispensing', 'pharmaceutical_indication'],
    });
    source.professionalActions = fixed([
      { spfa: 'dispensing', category: 'dispense' },
      {
        spfa: 'pharmaceutical_indication',
        category: 'pharmacological_treatment',
      },
    ]);
    expect(() => validate(source)).toThrow(/no feasible service configuration/);
  });

  it('acepta acciones en dos SPFA cuando existe una configuración simultánea', () => {
    const source = createBrief();
    source.carePath.initialSpfa = propose({
      allowedServices: ['dispensing', 'pharmaceutical_indication'],
    });
    source.carePath.additionalSpfas = [
      {
        service: 'pharmaceutical_indication',
        inclusion: fixed({ include: true }),
      },
    ];
    source.professionalActions = fixed([
      { spfa: 'dispensing', category: 'dispense' },
      {
        spfa: 'pharmaceutical_indication',
        category: 'pharmacological_treatment',
      },
    ]);
    expect(validate(source).professionalActions).toEqual(
      source.professionalActions,
    );
  });
});

describe('TeachingCaseGenerationBriefV2 strategy barrier feasibility', () => {
  function briefWithForbiddenBarriers() {
    const source = createBrief();
    const assessment = fixedNonAdherentAssessment() as Record<string, any>;
    assessment.nonAdherence.barriers = clone(forbid);
    source.adherence = fixed({ assessments: [assessment] });
    return source;
  }

  it('rechaza estrategia fija basada en primary_barrier si barriers es forbidden', () => {
    const source = briefWithForbiddenBarriers();
    source.adherenceStrategies = fixed([
      {
        category: 'educational',
        appliesTo: 'all_non_adherent_scopes',
        addresses: 'primary_barrier',
      },
    ]);
    expect(() => validate(source)).toThrow(/barriers to be identifiable/);
  });

  it('acepta estrategia semántica aunque barriers sea forbidden', () => {
    const source = briefWithForbiddenBarriers();
    source.adherenceStrategies = fixed([
      {
        category: 'educational',
        appliesTo: 'all_non_adherent_scopes',
        addresses: { semanticProblems: ['Dificultad factual de comprensión.'] },
      },
    ]);
    expect(validate(source).adherenceStrategies).toEqual(
      source.adherenceStrategies,
    );
  });

  it('aplica la incompatibilidad a whenNonAdherent.barriers forbidden', () => {
    const source = createBrief();
    source.adherence = propose({
      allowedStatuses: ['non_adherent'],
      whenNonAdherent: nonAdherence({ barriers: forbid }),
    });
    source.adherenceStrategies = fixed([
      {
        category: 'behavioral',
        appliesTo: 'all_non_adherent_scopes',
        addresses: 'all_identified_barriers',
      },
    ]);
    expect(() => validate(source)).toThrow(/barriers to be identifiable/);
  });
});

describe('TeachingCaseGenerationBriefV2 proposed referral actions', () => {
  it.each([forbid, fixed({ status: 'not_required' })])(
    'rechaza propuesta exclusivamente referral cuando derivación no puede requerirse',
    (referral) => {
      const source = createBrief();
      source.referral = referral;
      source.professionalActions = propose({
        allowedCategories: ['referral'],
      });
      expect(() => validate(source)).toThrow(/referral-only actions/);
    },
  );

  it('acepta propuesta exclusivamente referral cuando derivación puede requerirse', () => {
    const source = createBrief();
    source.referral = propose({ allowedStatuses: ['required'] });
    source.professionalActions = propose({
      allowedCategories: ['referral'],
    });
    expect(validate(source).professionalActions).toEqual(
      source.professionalActions,
    );
  });

  it('acepta referral o dispense aunque derivación esté prohibida', () => {
    const source = createBrief();
    source.referral = forbid;
    source.professionalActions = propose({
      allowedCategories: ['referral', 'dispense'],
    });
    expect(validate(source).professionalActions).toEqual(
      source.professionalActions,
    );
  });
});

describe('TeachingCaseGenerationBriefV2 deterministic rejection', () => {
  it('rechaza briefId inválido', () => {
    const source = createBrief();
    source.briefId = 'brief-semantic-case';
    expect(() => validate(source)).toThrow(/brief_<uuid>/);
  });

  it('rechaza revisión no entera o menor que uno', () => {
    for (const number of [0, 1.5]) {
      const source = createBrief();
      source.revision.number = number;
      expect(() => validate(source)).toThrow(/positive integer/);
    }
  });

  it('rechaza previousBriefId contrario a las reglas de revisión', () => {
    const first = createBrief();
    first.revision.previousBriefId = previousBriefId;
    expect(() => validate(first)).toThrow(/absent for revision 1/);

    const later = createBrief();
    later.revision = { number: 2 };
    expect(() => validate(later)).toThrow(/required after revision 1/);

    later.revision.previousBriefId = briefId;
    expect(() => validate(later)).toThrow(/differ from briefId/);
  });

  it('acepta una revisión posterior con predecessor opaco distinto', () => {
    const source = createBrief();
    source.revision = { number: 2, previousBriefId };
    expect(validate(source).revision).toEqual(source.revision);
  });

  it('rechaza initialSpfa no targeted', () => {
    const source = createBrief();
    source.carePath.initialSpfa = forbid;
    expect(() => validate(source)).toThrow(/initial SPFA must be targeted/);
  });

  it('rechaza SPFA adicional duplicado o igual al inicial', () => {
    const source = createBrief();
    source.carePath.additionalSpfas = [
      {
        service: 'dispensing',
        inclusion: fixed({
          dispensingSubtype: {
            mode: 'teacher_fixed',
            value: 'continuation',
          },
        }),
      },
    ];
    expect(() => validate(source)).toThrow(/cannot reappear/);

    const duplicate = createBrief();
    duplicate.carePath.additionalSpfas = [
      { service: 'medication_adherence', inclusion: fixed({ include: true }) },
      { service: 'medication_adherence', inclusion: allow },
    ];
    expect(() => validate(duplicate)).toThrow(/duplicate additional/);
  });

  it('rechaza ciclos SPFA', () => {
    const source = createBrief();
    source.carePath.additionalSpfas = [
      {
        service: 'pharmaceutical_indication',
        inclusion: fixed({ include: true }),
      },
    ];
    source.carePath.transitions = fixed([
      { from: 'dispensing', to: 'pharmaceutical_indication' },
      { from: 'pharmaceutical_indication', to: 'dispensing' },
    ]);
    expect(() => validate(source)).toThrow(/cycles/);
  });

  it('rechaza dispensing subtype inválido y subtype en otro SPFA', () => {
    const source = createBrief();
    source.carePath.initialSpfa.decision.value.dispensingSubtype.value = 'new';
    expect(() => validate(source)).toThrow(/initial_treatment/);

    const nonDispensing = createBrief();
    nonDispensing.carePath.initialSpfa = fixed({
      service: 'pharmaceutical_indication',
      dispensingSubtype: { mode: 'teacher_fixed', value: 'continuation' },
    });
    expect(() => validate(nonDispensing)).toThrow(/unexpected property/);
  });

  it('rechaza incidencia present sin semanticMeaning', () => {
    const source = createBrief();
    source.incidence = fixed({ status: 'present' });
    expect(() => validate(source)).toThrow(/semanticMeaning/);
  });

  it('rechaza cardinalidad inválida', () => {
    const source = createBrief();
    source.prm = propose({ quantity: { kind: 'between', min: 3, max: 2 } });
    expect(() => validate(source)).toThrow(/min must be <= max/);

    const zero = createBrief();
    zero.rnm = propose({ quantity: { kind: 'exactly', count: 0 } });
    expect(() => validate(zero)).toThrow(/positive integer/);
  });

  it('rechaza fixedFindings incompatibles con quantity', () => {
    const source = createBrief();
    source.prm = fixed({
      status: 'present',
      quantity: { kind: 'exactly', count: 2 },
      fixedFindings: [{ semanticIntent: 'Un único PRM.' }],
      additionalFindings: 'forbidden',
    });
    expect(() => validate(source)).toThrow(/cardinality requires findings/);
  });

  it('rechaza finding PRM o RNM sin clasificación ni intención', () => {
    const prm = createBrief();
    prm.prm = fixed({
      status: 'present',
      quantity: { kind: 'exactly', count: 1 },
      fixedFindings: [{}],
      additionalFindings: 'forbidden',
    });
    expect(() => validate(prm)).toThrow(/classification or semanticIntent/);

    const rnm = createBrief();
    rnm.rnm = fixed({
      status: 'findings',
      quantity: { kind: 'exactly', count: 1 },
      fixedFindings: [{ outcome: 'rnm' }],
      additionalFindings: 'forbidden',
    });
    expect(() => validate(rnm)).toThrow(/classification or semanticIntent/);
  });

  it('rechaza risk_of_rnm cuando PRM es imposible', () => {
    const source = createBrief();
    source.rnm = fixed({
      status: 'findings',
      quantity: { kind: 'exactly', count: 1 },
      fixedFindings: [
        { outcome: 'risk_of_rnm', semanticIntent: 'Riesgo potencial.' },
      ],
      additionalFindings: 'forbidden',
    });
    expect(() => validate(source)).toThrow(/PRM cannot be generated/);
  });

  it('rechaza scope semántico vacío', () => {
    const source = createBrief();
    source.adherence.decision.value.assessments[0].medicationScope =
      semanticScope();
    expect(() => validate(source)).toThrow(/at least one description/);
  });

  it('rechaza descripción duplicada tras trim, NFKC y case folding', () => {
    const source = createBrief();
    source.adherence.decision.value.assessments[0].medicationScope =
      semanticScope('  INHALADOR Á ', 'inhalador Á');
    expect(() => validate(source)).toThrow(/duplicate normalized/);
  });

  it('rechaza scopes teacher-fixed solapados', () => {
    const source = createBrief();
    source.adherence = fixed({
      assessments: [
        fixedNonAdherentAssessment(semanticScope('Enalapril', 'Amlodipino')),
        {
          medicationScope: semanticScope(' amlodipino '),
          status: 'adherent',
        },
      ],
    });
    expect(() => validate(source)).toThrow(/must be disjoint/);
  });

  it('rechaza all_relevant_medications combinado con otro scope', () => {
    const source = createBrief();
    source.adherence = fixed({
      assessments: [
        { medicationScope: allMedications, status: 'adherent' },
        { medicationScope: semanticScope('Enalapril'), status: 'adherent' },
      ],
    });
    expect(() => validate(source)).toThrow(/must be the only scope/);
  });

  it('rechaza non_adherent sin nonAdherence', () => {
    const source = createBrief();
    source.adherence = fixed({
      assessments: [
        { medicationScope: semanticScope('Enalapril'), status: 'non_adherent' },
      ],
    });
    expect(() => validate(source)).toThrow(/required for non_adherent/);
  });

  it('rechaza adherent con nonAdherence', () => {
    const source = createBrief();
    source.adherence.decision.value.assessments[0].nonAdherence = nonAdherence();
    expect(() => validate(source)).toThrow(/forbidden for adherent/);
  });

  it('rechaza type forbidden', () => {
    const source = createBrief();
    const assessment = fixedNonAdherentAssessment() as Record<string, any>;
    assessment.nonAdherence.type = clone(forbid);
    source.adherence = fixed({ assessments: [assessment] });
    expect(() => validate(source)).toThrow(/forbidden is not allowed/);
  });

  it('rechaza allowedTypes cuando determined no es posible', () => {
    const source = createBrief();
    const assessment = fixedNonAdherentAssessment() as Record<string, any>;
    assessment.nonAdherence.type = propose({
      allowedStatuses: ['not_determinable'],
      allowedTypes: ['unintentional'],
    });
    source.adherence = fixed({ assessments: [assessment] });
    expect(() => validate(source)).toThrow(/requires determined/);
  });

  it('rechaza allowedProfiles cuando determined no es posible', () => {
    const source = createBrief();
    const assessment = fixedNonAdherentAssessment() as Record<string, any>;
    assessment.nonAdherence.patientProfile = propose({
      allowedStatuses: ['not_determinable'],
      allowedProfiles: ['confused'],
    });
    source.adherence = fixed({ assessments: [assessment] });
    expect(() => validate(source)).toThrow(/requires determined/);
  });

  it('rechaza barreras fijas sin exactamente una primary', () => {
    const source = createBrief();
    const assessment = fixedNonAdherentAssessment() as Record<string, any>;
    assessment.nonAdherence.barriers = fixed({
      barriers: [
        {
          role: 'secondary',
          category: 'practical',
          semanticIntent: 'Dificultad secundaria.',
        },
      ],
      additionalBarriers: 'forbidden',
    });
    source.adherence = fixed({ assessments: [assessment] });
    expect(() => validate(source)).toThrow(/exactly one primary/);
  });

  it('rechaza la categoría de barrera combined', () => {
    const source = createBrief();
    const assessment = fixedNonAdherentAssessment() as Record<string, any>;
    assessment.nonAdherence.barriers.decision.value.barriers[0].category =
      'combined';
    source.adherence = fixed({ assessments: [assessment] });
    expect(() => validate(source)).toThrow(/practical, perception/);
  });

  it('rechaza whenNonAdherent si allowedStatuses excluye non_adherent', () => {
    const source = createBrief();
    source.adherence = propose({
      allowedStatuses: ['adherent'],
      whenNonAdherent: nonAdherence(),
    });
    expect(() => validate(source)).toThrow(/requires non_adherent/);
  });

  it('rechaza medication_adherence en carePath con adherence forbidden', () => {
    const source = createBrief();
    source.carePath.initialSpfa = fixed({ service: 'medication_adherence' });
    source.adherence = forbid;
    expect(() => validate(source)).toThrow(/cannot be forbidden/);
  });

  it('rechaza estrategia targeted cuando no puede existir non_adherent', () => {
    const source = createBrief();
    source.adherenceStrategies = propose({ maximumStrategies: 1 });
    expect(() => validate(source)).toThrow(/require at least one possible/);
  });

  it('rechaza combined strategy con un solo componente', () => {
    const source = createBrief();
    source.adherence = fixed({ assessments: [fixedNonAdherentAssessment()] });
    source.adherenceStrategies = fixed([
      {
        category: 'combined',
        componentCategories: ['educational'],
        appliesTo: 'all_non_adherent_scopes',
        addresses: 'primary_barrier',
      },
    ]);
    expect(() => validate(source)).toThrow(/at least two categories/);
  });

  it.each([
    ['adherenceStrategies', 'maximumStrategies'],
    ['professionalActions', 'maximumActions'],
    ['pharmaceuticalInterventions', 'maximumInterventions'],
  ])('rechaza %s targeted con %s = 0', (dimension, maximumField) => {
    const source = createBrief();
    if (dimension === 'adherenceStrategies') {
      source.adherence = fixed({ assessments: [fixedNonAdherentAssessment()] });
    }
    source[dimension] = propose({ [maximumField]: 0 });
    expect(() => validate(source)).toThrow(/positive integer/);
  });

  it('rechaza other_spfa incompatible con carePath', () => {
    const source = createBrief();
    source.professionalActions = fixed([
      {
        spfa: 'dispensing',
        category: 'other_spfa',
        targetSpfa: 'medication_adherence',
      },
    ]);
    expect(() => validate(source)).toThrow(/target SPFA is not present/);
  });

  it.each([forbid, fixed({ status: 'not_required' })])(
    'rechaza actuación referral cuando referral no puede ser required',
    (referral) => {
      const source = createBrief();
      source.referral = referral;
      source.professionalActions = fixed([
        { spfa: 'dispensing', category: 'referral' },
      ]);
      expect(() => validate(source)).toThrow(/requires referral/);
    },
  );

  it.each(['label', 'reason', 'patientInstruction'])(
    'rechaza referral required con %s vacío',
    (field) => {
      const source = createBrief();
      const referral = requiredReferral() as Record<string, any>;
      if (field === 'label') referral.destination.label = '   ';
      else referral[field] = '';
      source.referral = fixed(referral);
      expect(() => validate(source)).toThrow(/non-empty string/);
    },
  );

  it('rechaza versiones distintas para el mismo taxonomyId', () => {
    const source = createBrief();
    source.prm = fixed({
      status: 'present',
      quantity: { kind: 'exactly', count: 1 },
      fixedFindings: [
        {
          classification: {
            taxonomyId: 'foro-prm',
            taxonomyVersion: '2024',
            conceptId: 'prm-a',
          },
        },
      ],
      additionalFindings: 'forbidden',
    });
    source.rnm = fixed({
      status: 'findings',
      quantity: { kind: 'exactly', count: 1 },
      fixedFindings: [
        {
          outcome: 'rnm',
          classification: {
            taxonomyId: 'foro-prm',
            taxonomyVersion: '2025',
            conceptId: 'rnm-a',
          },
        },
      ],
      additionalFindings: 'forbidden',
    });
    expect(() => validate(source)).toThrow(/inconsistent versions/);
  });

  it('rechaza propiedades inesperadas', () => {
    const source = createBrief();
    source.futureSecret = true;
    expect(() => validate(source)).toThrow(/unexpected property/);

    const nested = createBrief();
    nested.incidence.decision.value.futureField = 'x';
    expect(() => validate(nested)).toThrow(/unexpected property/);
  });
});
