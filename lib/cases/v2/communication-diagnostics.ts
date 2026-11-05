import {communicationOutputSchema,type CommunicationInput} from './communication-evaluation';
/** Closed diagnostics only. Never includes received values, free text or provider keys. */
export function communicationStateDiagnostics(input:CommunicationInput,raw:unknown){
 const parsed=communicationOutputSchema.safeParse(raw);
 if(!parsed.success)return {version:'communication-diagnostic/1' as const,stage:'SCHEMA' as const,issues:[{code:'SCHEMA_INVALID' as const,field:'judgments' as const}]};
 type Code='OBSERVED_LEVEL_MISSING'|'OBSERVED_OPPORTUNITY_INVALID'|'OBSERVED_CAPTURE_INVALID'|'ABSENCE_LEVEL_INVALID'|'ABSENCE_EVIDENCE_INVALID'|'NON_OBSERVED_LEVEL_INVALID'|'NON_OBSERVED_ABSENCE_INVALID'|'NO_OPPORTUNITY_CONTEXT_INVALID'|'INCOMPLETE_CAPTURE_STATE_INVALID'|'INCOMPLETE_CAPTURE_SOURCE_INVALID'|'REVIEW_CERTAINTY_INVALID';
 const issues:{criterion:typeof parsed.data.judgments[number]['criterion'];code:Code;field:'level'|'opportunity'|'state'|'absence'|'evidence'|'certainty'}[]=[];
 for(const j of parsed.data.judgments){
  const add=(code:Code,field:typeof issues[number]['field'])=>issues.push({criterion:j.criterion,code,field});
  if(j.state==='OBSERVED'){
   if(j.level===null)add('OBSERVED_LEVEL_MISSING','level');
   if(j.opportunity!=='PRESENT')add('OBSERVED_OPPORTUNITY_INVALID','opportunity');
   if(input.capture!=='COMPLETE')add('OBSERVED_CAPTURE_INVALID','state');
   if(j.absence&&j.level!==0)add('ABSENCE_LEVEL_INVALID','level');
   if(j.absence&&j.evidence.length)add('ABSENCE_EVIDENCE_INVALID','evidence');
  }else{
   if(j.level!==null)add('NON_OBSERVED_LEVEL_INVALID','level');
   if(j.absence)add('NON_OBSERVED_ABSENCE_INVALID','absence');
  }
  if(j.state==='NO_OPPORTUNITY'&&j.opportunity!=='ABSENT')add('NO_OPPORTUNITY_CONTEXT_INVALID','opportunity');
  if(input.capture==='INCOMPLETE'&&j.state!=='INCOMPLETE_CAPTURE')add('INCOMPLETE_CAPTURE_STATE_INVALID','state');
  if(j.state==='INCOMPLETE_CAPTURE'&&input.capture!=='INCOMPLETE')add('INCOMPLETE_CAPTURE_SOURCE_INVALID','state');
  if(['UNCERTAIN','INCOMPLETE_CAPTURE'].includes(j.state)&&j.certainty!=='REVIEW_REQUIRED')add('REVIEW_CERTAINTY_INVALID','certainty');
 }
 return {version:'communication-diagnostic/1' as const,stage:'VALIDATION' as const,issues};
}
