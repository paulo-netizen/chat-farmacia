import type {
  EvaluatorViewV2,
  NonEmptyArray,
  VersionRef,
} from './evaluator-types';
import { createPatientRuntimeViewV2 } from './patient-runtime';
import type { CaseSpfaProtocolApplicationV2 } from './spfa-protocol-application-types';
import type { CaseSpfaProtocolSetV2 } from './spfa-protocol-set-types';
import type { SpfaProtocolDefinitionV2 } from './spfa-protocol-types';
import type { CasePatientFactsDraftV2, CaseVersionId } from './types';
import { validateEvaluatorViewV2 } from './validate-evaluator-view';
import {
  validateCasePatientFactsDraftV2,
  validateCaseVersionId,
} from './validate-patient-facts';
import { validateCaseSpfaProtocolApplicationV2 } from './validate-spfa-protocol-application';
import {
  validateSpfaProtocolDefinitionV2,
  validateSpfaProtocolRefV2,
} from './validate-spfa-protocol-definition';

export type CaseSpfaProtocolSetValidationContextV2 = Readonly<{
  caseVersionId: CaseVersionId;
  patientFacts: CasePatientFactsDraftV2;
  evaluator: EvaluatorViewV2;
}>;

export class SpfaProtocolSetValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'SpfaProtocolSetValidationError';
  }
}

type CanonicalClinicalContextV2 = Readonly<{
  caseVersionId: CaseVersionId;
  patientFacts: CasePatientFactsDraftV2;
  evaluator: EvaluatorViewV2;
}>;

function fail(path: string, message: string): never {
  throw new SpfaProtocolSetValidationError(path, message);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array');
  return value;
}

function assertExactKeys(
  source: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(source)) {
    if (!allowedKeys.has(key)) fail(`${path}.${key}`, 'unexpected property');
  }
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(path, 'must be a non-empty string');
  }
  return value;
}

function nestedPath(cause: unknown): string | undefined {
  return typeof cause === 'object' && cause !== null && 'path' in cause
    ? String((cause as { path: unknown }).path)
    : undefined;
}

function appendNestedPath(
  prefix: string,
  cause: unknown,
  knownRoot?: string,
): string {
  const path = nestedPath(cause);
  if (path === undefined) return prefix;
  if (knownRoot !== undefined && path === knownRoot) return prefix;
  if (knownRoot !== undefined && path.startsWith(`${knownRoot}.`)) {
    return `${prefix}.${path.slice(knownRoot.length + 1)}`;
  }
  return `${prefix}.${path}`;
}

function parseCaseVersionId(value: unknown, path: string): CaseVersionId {
  try {
    return validateCaseVersionId(value, path);
  } catch (cause) {
    fail(nestedPath(cause) ?? path, 'invalid case version ID');
  }
}

function parseVersionRef(value: unknown, path: string): VersionRef {
  const source = asRecord(value, path);
  assertExactKeys(source, ['id', 'version'], path);
  return {
    id: nonEmptyString(source.id, `${path}.id`),
    version: nonEmptyString(source.version, `${path}.version`),
  };
}

function ordinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function protocolKey(definition: {
  protocolId: string;
  version: string;
}): string {
  return `${definition.protocolId}\u0000${definition.version}`;
}

export function validateSpfaProtocolSetClinicalContextV2(
  context: CaseSpfaProtocolSetValidationContextV2,
  path = 'context',
): CanonicalClinicalContextV2 {
  const source = asRecord(context, path);
  assertExactKeys(
    source,
    ['caseVersionId', 'patientFacts', 'evaluator'],
    path,
  );
  const caseVersionId = parseCaseVersionId(
    source.caseVersionId,
    `${path}.caseVersionId`,
  );

  let patientFacts: CasePatientFactsDraftV2;
  try {
    patientFacts = validateCasePatientFactsDraftV2(source.patientFacts);
  } catch (cause) {
    fail(
      appendNestedPath(`${path}.patientFacts`, cause, 'casePatientFactsDraft'),
      'invalid patient facts',
    );
  }
  if (patientFacts.caseVersionId !== caseVersionId) {
    fail(
      `${path}.patientFacts.caseVersionId`,
      'must match context caseVersionId',
    );
  }

  let runtime;
  try {
    runtime = createPatientRuntimeViewV2(patientFacts);
  } catch (cause) {
    fail(
      appendNestedPath(`${path}.patientFacts`, cause, 'casePatientFactsDraft'),
      'patient facts cannot produce a runtime',
    );
  }

  let evaluator: EvaluatorViewV2;
  try {
    evaluator = validateEvaluatorViewV2(source.evaluator, runtime);
  } catch (cause) {
    fail(
      appendNestedPath(`${path}.evaluator`, cause, 'evaluatorView'),
      'invalid evaluator',
    );
  }
  if (evaluator.caseVersionId !== caseVersionId) {
    fail(
      `${path}.evaluator.caseVersionId`,
      'must match context caseVersionId',
    );
  }

  return { caseVersionId, patientFacts, evaluator };
}

function validateDefinition(
  input: unknown,
  path: string,
): SpfaProtocolDefinitionV2 {
  try {
    return validateSpfaProtocolDefinitionV2(input);
  } catch (cause) {
    fail(
      appendNestedPath(path, cause, 'spfaProtocolDefinition'),
      'invalid protocol definition',
    );
  }
}

function resolveApplicationProtocolKey(input: unknown, path: string): string {
  const source = asRecord(input, path);
  try {
    return protocolKey(
      validateSpfaProtocolRefV2(source.protocolRef, `${path}.protocolRef`),
    );
  } catch (cause) {
    fail(
      appendNestedPath(`${path}.protocolRef`, cause, `${path}.protocolRef`),
      'invalid protocol reference',
    );
  }
}

function validateApplication(
  input: unknown,
  path: string,
  protocolDefinition: SpfaProtocolDefinitionV2,
  context: CanonicalClinicalContextV2,
): CaseSpfaProtocolApplicationV2 {
  try {
    return validateCaseSpfaProtocolApplicationV2(input, {
      protocolDefinition,
      patientFacts: context.patientFacts,
      evaluator: context.evaluator,
    });
  } catch (cause) {
    fail(
      appendNestedPath(path, cause, 'caseSpfaProtocolApplication'),
      'invalid protocol application',
    );
  }
}

export function validateCaseSpfaProtocolSetAgainstCanonicalContextV2(
  input: unknown,
  context: CanonicalClinicalContextV2,
): CaseSpfaProtocolSetV2 {
  const rootPath = 'caseSpfaProtocolSet';
  const source = asRecord(input, rootPath);
  assertExactKeys(
    source,
    ['schemaVersion', 'catalogRef', 'definitions', 'applications'],
    rootPath,
  );
  if (source.schemaVersion !== '2.0') {
    fail(`${rootPath}.schemaVersion`, 'must be 2.0');
  }

  const catalogRef = parseVersionRef(
    source.catalogRef,
    `${rootPath}.catalogRef`,
  );
  if (catalogRef.id !== context.evaluator.versions.protocol.id) {
    fail(
      `${rootPath}.catalogRef.id`,
      'must match evaluator.versions.protocol.id',
    );
  }
  if (catalogRef.version !== context.evaluator.versions.protocol.version) {
    fail(
      `${rootPath}.catalogRef.version`,
      'must match evaluator.versions.protocol.version',
    );
  }

  const rawDefinitions = asArray(
    source.definitions,
    `${rootPath}.definitions`,
  );
  if (rawDefinitions.length === 0) {
    fail(`${rootPath}.definitions`, 'must not be empty');
  }
  const definitions = rawDefinitions.map((definition, index) => ({
    definition: validateDefinition(
      definition,
      `${rootPath}.definitions[${index}]`,
    ),
    originalIndex: index,
  }));
  const definitionsByRef = new Map<string, SpfaProtocolDefinitionV2>();
  definitions.forEach(({ definition, originalIndex }) => {
    const key = protocolKey(definition);
    if (definitionsByRef.has(key)) {
      fail(
        `${rootPath}.definitions[${originalIndex}]`,
        'duplicate exact protocol reference',
      );
    }
    definitionsByRef.set(key, definition);
  });

  const rawApplications = asArray(
    source.applications,
    `${rootPath}.applications`,
  );
  if (rawApplications.length === 0) {
    fail(`${rootPath}.applications`, 'must not be empty');
  }
  const usedDefinitions = new Set<string>();
  const applicationsBySpfa = new Map<string, CaseSpfaProtocolApplicationV2>();
  rawApplications.forEach((applicationInput, index) => {
    const path = `${rootPath}.applications[${index}]`;
    const key = resolveApplicationProtocolKey(applicationInput, path);
    const definition = definitionsByRef.get(key);
    if (definition === undefined) {
      fail(`${path}.protocolRef`, 'does not resolve to a pinned definition');
    }
    const application = validateApplication(
      applicationInput,
      path,
      definition,
      context,
    );
    if (application.caseVersionId !== context.caseVersionId) {
      fail(`${path}.caseVersionId`, 'must match context caseVersionId');
    }
    if (applicationsBySpfa.has(application.carePathSpfaRef)) {
      fail(
        `${path}.carePathSpfaRef`,
        'duplicate application for care path SPFA',
      );
    }
    applicationsBySpfa.set(application.carePathSpfaRef, application);
    usedDefinitions.add(key);
  });

  const carePathSpfas = [
    context.evaluator.carePath.initialSpfa,
    ...context.evaluator.carePath.additionalSpfas,
  ];
  const orderedApplications = carePathSpfas.map((spfa, index) => {
    const application = applicationsBySpfa.get(spfa.conclusionId);
    if (application === undefined) {
      fail(
        `${rootPath}.applications`,
        `missing application for ${
          index === 0 ? 'initialSpfa' : `additionalSpfas[${index - 1}]`
        }`,
      );
    }
    return application;
  });
  if (applicationsBySpfa.size !== carePathSpfas.length) {
    fail(`${rootPath}.applications`, 'contains an orphan application');
  }

  definitions.forEach(({ definition, originalIndex }) => {
    if (!usedDefinitions.has(protocolKey(definition))) {
      fail(
        `${rootPath}.definitions[${originalIndex}]`,
        'definition is not used by any application',
      );
    }
  });

  const orderedDefinitions = definitions
    .map(({ definition }) => definition)
    .sort(
      (left, right) =>
        ordinalCompare(left.protocolId, right.protocolId) ||
        ordinalCompare(left.version, right.version),
    );

  return {
    schemaVersion: '2.0',
    catalogRef,
    definitions:
      orderedDefinitions as unknown as NonEmptyArray<SpfaProtocolDefinitionV2>,
    applications:
      orderedApplications as unknown as NonEmptyArray<CaseSpfaProtocolApplicationV2>,
  };
}

export function validateCaseSpfaProtocolSetV2(
  input: unknown,
  context: CaseSpfaProtocolSetValidationContextV2,
): CaseSpfaProtocolSetV2 {
  const canonicalContext = validateSpfaProtocolSetClinicalContextV2(context);
  return validateCaseSpfaProtocolSetAgainstCanonicalContextV2(
    input,
    canonicalContext,
  );
}
