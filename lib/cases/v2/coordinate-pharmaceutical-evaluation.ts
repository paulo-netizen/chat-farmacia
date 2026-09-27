import 'server-only';
import { z } from 'zod';
import { capturePharmaceuticalEvaluationSourcesV2 } from './capture-pharmaceutical-evaluation-sources';
import { createPharmaceuticalEvaluationPostgresV2, type PharmaceuticalPgDatabase, type PharmaceuticalPersistenceAccess } from './pharmaceutical-evaluation-postgres';
import { evaluatePharmaceuticalSessionV2, type EvaluatePharmaceuticalSessionDependenciesV2 } from './evaluate-pharmaceutical-session';
import { executionPlanSchema, evaluationIdSchema, type PharmaceuticalEvaluationIntentV2, type PharmaceuticalEvaluationResultV2 } from './pharmaceutical-evaluation-record-types';
import { pharmaceuticalEvaluationSourceRefV2, validatePharmaceuticalEvaluationSourcesV2, resolvePharmaceuticalEvaluationArtifactV2 } from './pharmaceutical-evaluation-artifacts';
import { pharmaceuticalScoringConfigBinding } from './build-pharmaceutical-scoring-policy';
import { recordEqual } from './pharmaceutical-evaluation-record-utils';
import { buildPharmaceuticalD1BatchPlanV1 } from './build-pharmaceutical-d1-batch-plan';
import { freezeScoring } from './pharmaceutical-scoring-contract-utils';
import type { PharmaceuticalEvaluationWorkerV2 } from './pharmaceutical-evaluation-lifecycle';

type D1Plan = Extract<PharmaceuticalEvaluationIntentV2['executionPlan']['d1'], { mode: 'SEMANTIC' }>;
type D2Plan = Extract<PharmaceuticalEvaluationIntentV2['executionPlan']['d2'], { mode: 'SEMANTIC' }>;
type RuntimeConfig = Readonly<{ model: D1Plan['requestedModel']; maxOutputTokens: number; timeoutMs: number }>;
type E3Deps = EvaluatePharmaceuticalSessionDependenciesV2;

/** Explicit server adapters must honor config. No client construction, environment defaults or IO here.
 * The same frozen settings drive invocation and manifest; a separate declared manifest is not accepted.
 * Runtime/SDK/application version provenance remains the trusted composition root's responsibility.
 */
export function bindPharmaceuticalEvaluationExecutionV2(
  plans: Readonly<{ applicationVersion: string; scorerVersion: string; d1: D1Plan; d2: D2Plan }>,
  adapters: Readonly<{
    d1: (request: Parameters<E3Deps['d1']['adjudicateBatch']>[0], config: RuntimeConfig) => ReturnType<E3Deps['d1']['adjudicateBatch']>;
    d2: (request: Parameters<E3Deps['d2']['detectClaims']>[0], config: RuntimeConfig) => ReturnType<E3Deps['d2']['detectClaims']>;
    allocateD1ExecutionId: E3Deps['allocateD1ExecutionId']; allocateD2ExecutionId: E3Deps['allocateD2ExecutionId'];
  }>,
) {
  const fixed = safeConfiguration(() => freezeScoring(executionPlanSchema.parse({ ...structuredClone(plans), rulesVersion: 'pharmaceutical-scoring-rules/1' })));
  if (fixed.d1.mode !== 'SEMANTIC' || fixed.d2.mode !== 'SEMANTIC') throw new PharmaceuticalCoordinationError('INVALID_CONFIGURATION');
  const config = (v: D1Plan | D2Plan): RuntimeConfig => Object.freeze({ model: v.requestedModel, maxOutputTokens: v.maxOutputTokens, timeoutMs: v.timeoutMs });
  const d1Config = config(fixed.d1), d2Config = config(fixed.d2), executeD1 = adapters.d1, executeD2 = adapters.d2;
  const binding = Object.freeze({});
  bindings.set(binding, { plan: fixed, dependencies: {
    d1: { adjudicateBatch: async r => { const receipt = await executeD1(r, d1Config); recordEqual(receipt.responseModel, d1Config.model); return receipt; } },
    d2: { detectClaims: async r => { const receipt = await executeD2(r, d2Config); recordEqual(receipt.responseModel, d2Config.model); return receipt; } },
    allocateD1ExecutionId: adapters.allocateD1ExecutionId, allocateD2ExecutionId: adapters.allocateD2ExecutionId,
  } });
  return binding;
}
const bindings = new WeakMap<object, { plan: PharmaceuticalEvaluationIntentV2['executionPlan']; dependencies: E3Deps }>();
export class PharmaceuticalCoordinationError extends Error {
  constructor(readonly code: 'INVALID_CONFIGURATION' | 'CLAIM_OUTCOME_UNKNOWN' | 'EVALUATION_FAILED' | 'FAILURE_WRITE_UNCONFIRMED' | 'COMPLETION_UNCONFIRMED' | 'PERSISTENCE_UNCONFIRMED') {
    super(code); this.name = 'PharmaceuticalCoordinationError';
  }
}
function safeConfiguration<T>(read: () => T): T {
  try { return read(); }
  catch { throw new PharmaceuticalCoordinationError('INVALID_CONFIGURATION'); }
}
type Store = ReturnType<typeof createPharmaceuticalEvaluationPostgresV2>;
type Read = Awaited<ReturnType<Store['read']>>;
const commandSchema = z.object({ evaluationId: evaluationIdSchema, idempotencyKey: evaluationIdSchema,
  attemptId: evaluationIdSchema, workerId: evaluationIdSchema,
  leaseDurationMs: z.number().int().positive().max(86400000) }).strict();
type Command = z.infer<typeof commandSchema>;
type Settings = Readonly<{ expectationSet: unknown; configuration: unknown;
  d1SemanticAcceptance: PharmaceuticalEvaluationIntentV2['d1SemanticAcceptance']; d2: PharmaceuticalEvaluationIntentV2['d2'] }>;

/** Server-only coordinator. No semantic recovery API: FAILED/expired attempts require a separate
 * authorization, not another call here. Uncertain claims are never retried or executed speculatively.
 */
export function createPharmaceuticalEvaluationCoordinatorV2(deps: Readonly<{
  database: PharmaceuticalPgDatabase; execution: object; settings: Settings;
}>) {
  const bound = bindings.get(deps.execution);
  if (!bound) throw new PharmaceuticalCoordinationError('INVALID_CONFIGURATION');
  const settings = safeConfiguration(() => structuredClone(deps.settings)), database = deps.database;
  const store = createPharmaceuticalEvaluationPostgresV2(database);
  // Private in-memory write recovery only, no witnesses or provider output archive.
  // Losing this process loses this capability; it never authorizes another semantic execution.
  const pendingWrites = new WeakMap<object, { access: PharmaceuticalPersistenceAccess; id: string; worker: PharmaceuticalEvaluationWorkerV2; result: PharmaceuticalEvaluationResultV2 }>();
  async function verifiedRead(access: PharmaceuticalPersistenceAccess, id: string): Promise<Read> { return store.read(access, id); }
  async function persist(access: PharmaceuticalPersistenceAccess, id: string, worker: PharmaceuticalEvaluationWorkerV2, result: PharmaceuticalEvaluationResultV2) {
    try {
      await store.complete(access, id, worker, result);
      return { outcome: 'COMPLETED' as const, stored: await verifiedRead(access, id) };
    } catch {
      // Do not call fail(): the completion might already have committed.
      try {
        const recovered = await verifiedRead(access, id);
        if (recovered.record.status === 'COMPLETED') {
          // P2 idempotent complete checks exact payload and original worker; no replacement.
          await store.complete(access, id, worker, result);
          return { outcome: 'COMPLETED' as const, stored: recovered };
        }
      } catch { /* return safe uncertainty with a write-only recovery capability */ }
      const recovery = Object.freeze({});
      pendingWrites.set(recovery, { access, id, worker, result });
      return { outcome: 'COMPLETION_UNCONFIRMED' as const, recovery };
    }
  }
  return {
    read: verifiedRead,
    async recoverCompletion(recovery: object) {
      const p = pendingWrites.get(recovery);
      if (!p) throw new PharmaceuticalCoordinationError('INVALID_CONFIGURATION');
      const result = await persist(p.access, p.id, p.worker, p.result);
      if (result.outcome === 'COMPLETED') pendingWrites.delete(recovery);
      return result;
    },
    async run(accessInput: PharmaceuticalPersistenceAccess, commandInput: Command) {
      const { access, command } = safeConfiguration(() => ({ access: structuredClone(accessInput), command: commandSchema.parse(commandInput) }));
      const sources = await capturePharmaceuticalEvaluationSourcesV2(database, access, settings);
      const c = sources.configuration;
      const intent: PharmaceuticalEvaluationIntentV2 = {
        schemaVersion: '2.0', contractVersion: 'pharmaceutical-evaluation-intent/1', ...access,
        caseVersionId: sources.context.caseVersionId, idempotencyKey: command.idempotencyKey, supersedesEvaluationId: null,
        transcriptFingerprint: sources.context.transcriptFingerprint, sources: pharmaceuticalEvaluationSourceRefV2(sources),
        configuration: { policy: pharmaceuticalScoringConfigBinding(c.policy), plan: pharmaceuticalScoringConfigBinding(c.plan),
          weights: pharmaceuticalScoringConfigBinding(c.weights), thresholds: pharmaceuticalScoringConfigBinding(c.thresholds), rounding: pharmaceuticalScoringConfigBinding(c.rounding) },
        d1SemanticAcceptance: settings.d1SemanticAcceptance, d2: settings.d2,
        executionPlan: { ...bound.plan,
          d1: buildPharmaceuticalD1BatchPlanV1(sources.context).semanticBatches.length ? bound.plan.d1 : { mode: 'NO_CALL', reason: 'NO_SEMANTIC_BATCHES' },
          d2: settings.d2.status === 'NOT_PROVIDED' ? { mode: 'NO_CALL', reason: 'NOT_REQUESTED' }
            : sources.contextSource.transcript.messages.some(m => m.role === 'student') ? bound.plan.d2 : { mode: 'NO_CALL', reason: 'EMPTY_STUDENT_MESSAGES' },
        },
      };
      const created = await store.create(access, { evaluationId: command.evaluationId, intent, sources });
      const id = created.evaluationId;
      if (created.status === 'COMPLETED') return { outcome: 'COMPLETED' as const, stored: await verifiedRead(access, id) };
      // Even an expired lease must not authorize another execution. No expire/claim loop.
      if (created.status !== 'PENDING') return { outcome: 'NOT_EXECUTED' as const, stored: await verifiedRead(access, id) };
      let claimed;
      try { claimed = await store.claim(access, id, { attemptId: command.attemptId, workerId: command.workerId,
        expectedRevision: created.revision, leaseDurationMs: command.leaseDurationMs }); }
      catch { throw new PharmaceuticalCoordinationError('CLAIM_OUTCOME_UNKNOWN'); }
      const a = claimed.attempts.at(-1)!;
      const worker = { attemptId: a.attemptId, workerId: a.workerId, fencingToken: a.fencingToken, expectedRevision: claimed.revision };
      // All P2 transactions have ended. Load and verify precisely the persisted representation.
      const loaded = await verifiedRead(access, id);
      recordEqual(loaded.record, claimed);
      const persisted = validatePharmaceuticalEvaluationSourcesV2(resolvePharmaceuticalEvaluationArtifactV2(claimed.intent.sources,
        ref => loaded.artifacts.find(e => e.reference.fingerprint.value === ref.fingerprint.value)?.payload));
      recordEqual(pharmaceuticalEvaluationSourceRefV2(persisted), claimed.intent.sources);
      let result: PharmaceuticalEvaluationResultV2;
      try {
        result = await evaluatePharmaceuticalSessionV2({ ...persisted,
          d1SemanticAcceptance: claimed.intent.d1SemanticAcceptance, d2: claimed.intent.d2 }, bound.dependencies);
      } catch {
        try { await store.fail(access, id, worker, { lane: 'OPERATIONAL', code: 'EVALUATION_FAILURE' }); }
        catch { throw new PharmaceuticalCoordinationError('FAILURE_WRITE_UNCONFIRMED'); }
        throw new PharmaceuticalCoordinationError('EVALUATION_FAILED');
      }
      return persist(access, id, worker, result);
    },
  };
}
