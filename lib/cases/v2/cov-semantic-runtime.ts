import type OpenAI from 'openai';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { reportAdjudicationSchema, type ReferralReportRequestV1, type ReferralReportRuntimeV1 } from './referral-report-contract';
import { followUpAdjudicationSchema, type FollowUpRequestV1, type FollowUpRuntimeV1 } from './follow-up-plan-contract';
import { personalizationAdjudicationSchemaV2, type PersonalizationRequestV2, type PersonalizationRuntimeV2 } from './personalization-contract';
import { PHARMACEUTICAL_SEMANTIC_MODELS_V1 } from './pharmaceutical-semantic-model-policy';

// Experimental eligibility only: no live authorization or production approval is implied.
const configSchema = z.object({
  model: z.enum(PHARMACEUTICAL_SEMANTIC_MODELS_V1),
  maxOutputTokens: z.number().int().min(1).max(10000),
  maxInputBytes: z.number().int().min(1).max(100000),
  timeoutMs: z.number().int().min(1).max(60000),
}).strict();
export type CovRuntimeConfig = z.infer<typeof configSchema>;
export type CovClient = { responses: Pick<OpenAI['responses'], 'parse'> };
export class CovTransportError extends Error {
  constructor() { super('COV_TRANSPORT_FAILURE'); this.name = 'CovTransportError'; }
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
export const covProviderSchemas = {
  COV1: reportAdjudicationSchema,
  COV2: followUpAdjudicationSchema,
  COV3: personalizationAdjudicationSchemaV2.extend({ links: z.array(wireLink) }).strict(),
};
export type CovCapability = keyof typeof covProviderSchemas;
type Request = ReferralReportRequestV1 | FollowUpRequestV1 | PersonalizationRequestV2;

/** No environment reads, implicit client, retries or network at import. Runner owns execution permission. */
export function createCovOpenAiRuntimes(configInput: CovRuntimeConfig, client: CovClient): {
  COV1: ReferralReportRuntimeV1; COV2: FollowUpRuntimeV1; COV3: PersonalizationRuntimeV2;
} {
  let config: CovRuntimeConfig;
  try { config = configSchema.parse(structuredClone(configInput)); } catch { throw new CovTransportError(); }
  const runtimeRef = `cov-openai/1:${config.model}:${config.maxOutputTokens}:${config.maxInputBytes}:${config.timeoutMs}`;
  async function adjudicate(capability: CovCapability, request: Request): Promise<unknown> {
    try {
      const q = structuredClone(request);
      const versions = { COV1: ['referral-report-request/1', 'referral-report-instructions/2'],
        COV2: ['follow-up-plan-request/1', 'follow-up-plan-instructions/3'],
        COV3: ['personalization-request/2', 'personalization-instructions/3'] };
      if (q.runtimeRef !== runtimeRef || q.contractVersion !== versions[capability][0] ||
        q.instructionsVersion !== versions[capability][1]) throw new CovTransportError();
      // Positive projection: the fixture, expected labels and teacher rationales never enter this object.
      const data = q.contractVersion === 'referral-report-request/1'
        ? { binding: q.binding, submissionId: q.submissionId, approvalRef: q.approvalRef,
          untrustedData: { reportText: q.untrustedData.reportText, requirements: q.untrustedData.requirements,
            publicProfile: q.untrustedData.publicProfile, messages: q.untrustedData.messages,
            transcriptCompleteness: q.untrustedData.transcriptCompleteness, opportunity: q.untrustedData.opportunity } }
        : { requirements: q.requirements, untrustedData: { context: q.untrustedData.context, messages: q.untrustedData.messages } };
      const input = JSON.stringify({ contractVersion: q.contractVersion, instructionsVersion: q.instructionsVersion,
        requestDigest: q.requestDigest, ...data });
      const instructions = `${q.instructions}\nOutput JSON matching the supplied schema. Optional chain fields are null when absent.`;
      const format = zodTextFormat(covProviderSchemas[capability], `cov_${capability.toLowerCase()}_result`);
      if (Buffer.byteLength(input + instructions + JSON.stringify(format), 'utf8') > config.maxInputBytes) throw new CovTransportError();
      const response = await client.responses.parse({ model: config.model, instructions, input,
        text: { format }, max_output_tokens: config.maxOutputTokens, store: false },
      { timeout: config.timeoutMs, maxRetries: 0 });
      if (response.status !== 'completed' || response.model !== config.model || response.error ||
        response.output.some(item => item.type === 'message' && item.content.some(c => c.type === 'refusal'))) throw new CovTransportError();
      const result = covProviderSchemas[capability].parse(response.output_parsed);
      if (result.requestDigest !== q.requestDigest) throw new CovTransportError();
      if (capability === 'COV3') {
        const parsed = covProviderSchemas.COV3.parse(result);
        return personalizationAdjudicationSchemaV2.parse({ ...parsed, links: parsed.links.map(item =>
          Object.fromEntries(Object.entries(item).filter(([, value]) => value !== null))) });
      }
      return result;
    } catch { throw new CovTransportError(); }
  }
  return {
    COV1: { runtimeRef, adjudicate: q => adjudicate('COV1', q) },
    COV2: { runtimeRef, adjudicate: q => adjudicate('COV2', q) },
    COV3: { runtimeRef, adjudicate: q => adjudicate('COV3', q) },
  };
}
