import { COV_FIRST_CONFIG, COV_WIRE_POLICY } from './cov-experiment-policy';
// Nominal receipt for a parse error after a compatible response. No raw response survives here.
const compatibleParseFailures=new WeakSet<object>();
export function markCompatibleCovParseFailure(error:object,response:unknown):void {
  const r=response as {status?:unknown;model?:unknown;service_tier?:unknown;error?:unknown;output?:{type?:string;content?:{type?:string}[]}[]};
  if(r?.status==='completed'&&r.model===COV_FIRST_CONFIG.model&&r.service_tier===COV_WIRE_POLICY.serviceTier&&!r.error&&
    Array.isArray(r.output)&&!r.output.some(o=>o.type==='message'&&o.content?.some(c=>c.type==='refusal')))compatibleParseFailures.add(error);
}
export function isCompatibleCovParseFailure(error:unknown):boolean {
  return !!error&&typeof error==='object'&&compatibleParseFailures.has(error);
}
