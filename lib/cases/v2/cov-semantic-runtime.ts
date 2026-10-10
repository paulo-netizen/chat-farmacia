import type OpenAI from 'openai';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { reportAdjudicationSchema, type ReferralReportRequestV1, type ReferralReportRuntimeV1 } from './referral-report-contract';
import { followUpAdjudicationSchema, type FollowUpRequestV1, type FollowUpRuntimeV1 } from './follow-up-plan-contract';
import { personalizationAdjudicationSchemaV2, type PersonalizationRequestV2, type PersonalizationRuntimeV2 } from './personalization-contract';
import { PHARMACEUTICAL_SEMANTIC_MODELS_V1 } from './pharmaceutical-semantic-model-policy';
import { CovExecutionSession, covSafeMetadata } from './cov-execution-session';
import { covHash, COV_WIRE_POLICY } from './cov-experiment-policy';
import { CovDiagnosticError, covDiagnostic, type CovDiagnosticCode } from './cov-diagnostics';
import { reportLiteralAdjudicationSchema } from './report-citations';
import { covSourceSchemas, adaptCovSources } from './cov-source-citations';

// Experimental eligibility only: no live authorization or production approval is implied.
const configSchema = z.object({
  model: z.enum(PHARMACEUTICAL_SEMANTIC_MODELS_V1),
  maxOutputTokens: z.number().int().min(1).max(10000),
  maxInputBytes: z.number().int().min(1).max(100000),
  timeoutMs: z.number().int().min(1).max(60000),
}).strict();
export type CovRuntimeConfig = z.infer<typeof configSchema>;
export type CovClient = { baseURL?: string; responses: Pick<OpenAI['responses'], 'parse'> };
export class CovTransportError extends CovDiagnosticError {
  constructor(code: CovDiagnosticCode = 'RUNTIME_FAILURE') {
    super(code); this.message = 'COV_TRANSPORT_FAILURE'; this.name = 'CovTransportError';
  }
}
const link = personalizationAdjudicationSchemaV2.shape.links.element;
// Required nullable wire fields satisfy Structured Outputs; domain contract keeps optional fields.
const wireLink = link.extend({
  patientProposal: link.shape.patientProposal.unwrap().nullable(),
  withdrawal: link.shape.withdrawal.unwrap().nullable(),
  feasibilityCheck: link.shape.feasibilityCheck.unwrap().nullable(),
  patientResponse: link.shape.patientResponse.unwrap().nullable(),
  responseToDifficulty: link.shape.responseToDifficulty.unwrap().nullable(),
}).strict();
const previousProviderSchemas = {
  COV1: reportLiteralAdjudicationSchema,
  COV2: followUpAdjudicationSchema,
  COV3: personalizationAdjudicationSchemaV2.extend({ links: z.array(wireLink) }).strict(),
};
export const covProviderSchemas = covSourceSchemas;
export type CovProjection = false | true | 'report/2';
export type CovCapability = keyof typeof covProviderSchemas;
export type CovRequest = ReferralReportRequestV1 | FollowUpRequestV1 | PersonalizationRequestV2;

export function covRuntimeRef(config: CovRuntimeConfig, capability?: CovCapability, projection: CovProjection = false) {
  return `cov-openai/2:${config.model}:${config.maxOutputTokens}:${config.maxInputBytes}:${config.timeoutMs}:medium:default${capability && projection === false ? ':source-literal/3' : capability === 'COV1' && projection === 'report/2' ? ':report-literal/2' : ''}`;
}
export function projectCovRequest(capability: CovCapability, q: CovRequest, config: CovRuntimeConfig, legacyReportProjection: CovProjection = false) {
  const data = q.contractVersion === 'referral-report-request/1'
    ? { binding: q.binding, submissionId: q.submissionId, approvalRef: q.approvalRef,
      untrustedData: { reportText: q.untrustedData.reportText, requirements: q.untrustedData.requirements,
        publicProfile: q.untrustedData.publicProfile, messages: q.untrustedData.messages,
        transcriptCompleteness: q.untrustedData.transcriptCompleteness, opportunity: q.untrustedData.opportunity } }
    : { requirements: q.requirements, untrustedData: { context: q.untrustedData.context, messages: q.untrustedData.messages } };
  const literalReport = capability === 'COV1' && legacyReportProjection === 'report/2';
  const allSources = legacyReportProjection === false;
  const providerVersion = { COV1: 'referral-report-sources-adjudication/3', COV2: 'follow-up-plan-sources-adjudication/2', COV3: 'personalization-sources-adjudication/3' }[capability];
  const input = JSON.stringify({ contractVersion: q.contractVersion, instructionsVersion: q.instructionsVersion,
    ...(literalReport ? { providerRepresentation: 'referral-report-literal-adjudication/2', providerInstructionsVersion: 'report-literal-instructions/1' } : {}),
    ...(allSources ? { providerRepresentation: providerVersion, providerInstructionsVersion: 'cov-source-literal-instructions/1' } : {}),
    requestDigest: q.requestDigest, ...data });
  let domainInstructions = literalReport ? q.instructions
    .replace('Cite exact UTF-16 [start,end) spans and source references.', 'For SOURCE evidence cite exact UTF-16 [start,end) spans and source references. For REPORT evidence return exact literal quote and occurrence only, never offsets. occurrence is null for a unique match; repeated quotes require an explicit one-based occurrence in original text order (including overlapping matches). Never normalize Unicode, spaces or line breaks; paraphrases are not literal citations. The server derives report offsets. Citation validity does not establish semantic support.')
    .replace('Return only referral-report-adjudication/1', 'Return only referral-report-literal-adjudication/2') : q.instructions;
  if (allSources) {
    domainInstructions = q.instructions.replace(/Cite exact UTF-16 \[start,end\) spans(?: and source references| and message\/field references)?\./g, 'For EVERY citation return exact literal quote and occurrence, never start/end offsets. Identify the exact messageId or PUBLIC field in its permitted evidence slot; report evidence refers only to this report. occurrence is null for a unique literal match within that source, otherwise provide the one-based occurrence counting overlapping matches. Never search another source, normalize Unicode/whitespace or cite a paraphrase. Server-derived positions do not establish semantic support.')
      .replace(/Return only (referral-report-adjudication\/1|follow-up-plan-adjudication\/1|personalization-adjudication\/2)/, `Return only ${providerVersion}`);
  }
  const instructions = `${domainInstructions}\nOutput JSON matching the supplied schema. Optional chain fields are null when absent.`;
  const format = zodTextFormat(legacyReportProjection === true && capability === 'COV1' ? reportAdjudicationSchema : legacyReportProjection !== false ? previousProviderSchemas[capability] : covProviderSchemas[capability], `cov_${capability.toLowerCase()}_result`);
  if (Buffer.byteLength(input + instructions + JSON.stringify(format), 'utf8') > config.maxInputBytes) throw new CovTransportError('REQUEST_TOO_LARGE');
  const body = { model: config.model, instructions, input, text: { format }, max_output_tokens: config.maxOutputTokens, store: false, service_tier: 'default' as const, reasoning: { effort: 'medium' as const } };
  return { body, inputBytes: Buffer.byteLength(input + instructions + JSON.stringify(format), 'utf8'), requestHash: covHash(body) };
}
/** Real path: nominal durable authorization is required outside the CLI too. */
export function createCovOpenAiRuntimes(config: CovRuntimeConfig, client: CovClient, session?: CovExecutionSession) {
  if (!CovExecutionSession.isAuthorized(session) || client.baseURL !== COV_WIRE_POLICY.endpoint) throw new CovTransportError();
  return buildRuntimes(config, client, session);
}
/** Explicit test seam: injected transport must be offline. Never selected by the live CLI. */
export function createCovSimulatedRuntimes(config: CovRuntimeConfig, client: CovClient) {
  // Reject an accidentally injected SDK/live wrapper. Arbitrary injected JS remains trusted test code.
  if (client.baseURL !== undefined) throw new CovTransportError();
  return buildRuntimes(config, client);
}
function buildRuntimes(configInput: CovRuntimeConfig, client: CovClient, session?: CovExecutionSession): {
  COV1: ReferralReportRuntimeV1; COV2: FollowUpRuntimeV1; COV3: PersonalizationRuntimeV2;
} {
  let config: CovRuntimeConfig;
  try { config = configSchema.parse(structuredClone(configInput)); } catch { throw new CovTransportError(); }
  async function adjudicate(capability: CovCapability, request: CovRequest): Promise<unknown> {
    let reserved = false;
    let failure: CovDiagnosticCode = 'REQUEST_INVALID';
    try {
      const q = structuredClone(request);
      const versions = { COV1: ['referral-report-request/1', 'referral-report-instructions/2'],
        COV2: ['follow-up-plan-request/1', 'follow-up-plan-instructions/3'],
        COV3: ['personalization-request/2', 'personalization-instructions/3'] };
      if (q.runtimeRef !== covRuntimeRef(config, capability) || q.contractVersion !== versions[capability][0] ||
        q.instructionsVersion !== versions[capability][1]) throw new CovTransportError('REQUEST_INVALID');
      const projected = projectCovRequest(capability, q, config);
      if (session && client.baseURL !== COV_WIRE_POLICY.endpoint) throw new CovTransportError();
      failure = 'RESERVATION_FAILED';
      if (session) { session.reserve(projected.requestHash, config); reserved = true; }
      failure = 'RUNTIME_FAILURE';
      const response = await client.responses.parse(projected.body, { timeout: config.timeoutMs, maxRetries: 0 });
      failure = 'METADATA_FAILED';
      if (session) session.metadata(response);
      failure = 'RESPONSE_ENVELOPE_INVALID';
      const usage = covSafeMetadata(response);
      if ((session && (response.service_tier !== 'default' || usage.inputTokens === undefined || usage.outputTokens === undefined)) || response.status !== 'completed' || response.model !== config.model || response.error ||
        response.output.some(item => item.type === 'message' && item.content.some(c => c.type === 'refusal'))) throw new CovTransportError('RESPONSE_ENVELOPE_INVALID');
      failure = 'PROVIDER_SCHEMA_INVALID';
      const result = covProviderSchemas[capability].parse(response.output_parsed);
      if (result.requestDigest !== q.requestDigest) throw new CovTransportError('REQUEST_DIGEST_MISMATCH');
      return adaptCovSources(capability, result, q);
    } catch (error) {
      if (session) {
        try { if (reserved) session.metadata(error); session.stop(); } catch { throw new CovTransportError('STOP_RECORD_FAILED'); }
      }
      throw new CovTransportError(covDiagnostic(error, failure).code);
    }
  }
  return {
    COV1: { runtimeRef: covRuntimeRef(config, 'COV1'), adjudicate: q => adjudicate('COV1', q) },
    COV2: { runtimeRef: covRuntimeRef(config, 'COV2'), adjudicate: q => adjudicate('COV2', q) },
    COV3: { runtimeRef: covRuntimeRef(config, 'COV3'), adjudicate: q => adjudicate('COV3', q) },
  };
}
