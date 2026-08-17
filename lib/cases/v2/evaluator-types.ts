import type {
  CaseVersionId,
  FactId,
  MedicationId,
} from './types';

declare const conclusionIdBrand: unique symbol;

export type ConclusionId = string & {
  readonly [conclusionIdBrand]: true;
};

export type VersionRef = {
  id: string;
  version: string;
};

export type TaxonomyTermRef = {
  taxonomyId: string;
  taxonomyVersion: string;
  conceptId: string;
};

export type EvaluatorConclusion<K extends string, V> = {
  conclusionId: ConclusionId;
  kind: K;
  value: V;
};

export type SpfaService =
  | 'dispensing'
  | 'pharmaceutical_indication'
  | 'medication_adherence';

export type DispensingSubtype = 'initial_treatment' | 'continuation';

export type SpfaConclusion = EvaluatorConclusion<
  'spfa',
  {
    service: SpfaService;
    subtype?: DispensingSubtype;
  }
>;

export type SpfaTransition = EvaluatorConclusion<
  'spfa_transition',
  {
    fromSpfaRef: ConclusionId;
    toSpfaRef: ConclusionId;
  }
>;

export type CarePathV2 = {
  initialSpfa: SpfaConclusion;
  additionalSpfas: SpfaConclusion[];
  transitions: SpfaTransition[];
};

export type AssessmentStatus = 'none' | 'present' | 'not_determinable';

export type IncidenceAssessment = EvaluatorConclusion<
  'incidence_assessment',
  { status: AssessmentStatus }
>;

export type IncidenceFinding = EvaluatorConclusion<
  'incidence',
  {
    spfaRef: ConclusionId;
    medicationRefs: MedicationId[];
    semanticMeaning: string;
  }
>;

export type FollowUpEpisode = EvaluatorConclusion<
  'follow_up_episode',
  {
    incidenceRef: ConclusionId;
  }
>;

export type PrmAssessment = EvaluatorConclusion<
  'prm_assessment',
  { status: AssessmentStatus }
>;

export type PrmFinding = EvaluatorConclusion<
  'prm',
  {
    classification: TaxonomyTermRef;
    medicationRefs: MedicationId[];
    followUpEpisodeRef?: ConclusionId;
  }
>;

type RnmAssessmentLinks = {
  medicationRefs: MedicationId[];
  followUpEpisodeRef?: ConclusionId;
};

export type RnmAssessment = EvaluatorConclusion<
  'rnm_assessment',
  | ({
      status: 'rnm';
      classification: TaxonomyTermRef;
    } & RnmAssessmentLinks)
  | ({
      status: 'risk_of_rnm';
      classification?: TaxonomyTermRef;
    } & RnmAssessmentLinks)
  | {
      status: 'no_rnm';
    }
>;

export type PrmRnmRelation = EvaluatorConclusion<
  'prm_rnm_relation',
  {
    prmRef: ConclusionId;
    rnmAssessmentRef: ConclusionId;
    relation: 'creates_risk_of_rnm' | 'contributes_to_rnm';
  }
>;

export type NonEmptyArray<T> = readonly [T, ...T[]];

export type EvidenceLeafRef =
  | {
      operator: 'fact';
      factRef: FactId;
    }
  | {
      operator: 'public_profile';
      field: 'age' | 'sex';
    };

export type EvidenceExpression =
  | EvidenceLeafRef
  | {
      operator: 'all';
      operands: NonEmptyArray<EvidenceExpression>;
    }
  | {
      operator: 'any';
      operands: NonEmptyArray<EvidenceExpression>;
    };

export type EvidenceRule = {
  conclusionRef: ConclusionId;
  requiredEvidence: EvidenceExpression;
  supportingEvidenceRefs: readonly EvidenceLeafRef[];
  counterEvidenceRefs: readonly EvidenceLeafRef[];
  teacherRationale: string;
};

export type EvaluatorVersionsV2 = {
  evaluatorSchema: VersionRef;
  protocol: VersionRef;
  prmTaxonomy: VersionRef;
  rnmTaxonomy: VersionRef;
};

export type EvaluatorViewV2 = {
  schemaVersion: '2.0';
  caseVersionId: CaseVersionId;
  versions: EvaluatorVersionsV2;
  carePath: CarePathV2;
  incidence: {
    assessment: IncidenceAssessment;
    findings: IncidenceFinding[];
    followUpEpisodes: FollowUpEpisode[];
  };
  prm: {
    assessment: PrmAssessment;
    findings: PrmFinding[];
  };
  rnmAssessments: RnmAssessment[];
  prmRnmRelations: PrmRnmRelation[];
  evidenceRules: EvidenceRule[];
};
