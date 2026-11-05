import {it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
vi.mock('server-only',()=>({}));
import {communicationProviderRequest,communicationProviderRequestV2} from '@/lib/cases/v2/communication-adapter';
import {communicationCriteria} from '@/lib/cases/v2/communication-evaluation';
import {validateCommunicationV2} from '@/lib/cases/v2/communication-evaluation-v2';
import {communicationValidationInputs} from '../../tools/communication-validation/inputs';
const Ajv=createRequire(import.meta.url)('ajv');
it.each(['OBSERVED','ABSENT_PERFORMANCE','NO_OPPORTUNITY','UNCERTAIN','INCOMPLETE_CAPTURE'])('provider schema and final validator agree for %s',kind=>{
 const input=communicationValidationInputs()[0].input;
 if(kind==='INCOMPLETE_CAPTURE')input.capture='INCOMPLETE';
 const observed=['OBSERVED','ABSENT_PERFORMANCE'].includes(kind),absent=kind==='ABSENT_PERFORMANCE';
 const raw={version:'communication-adjudication/1',judgments:communicationCriteria.map(([criterion])=>({criterion,state:observed?'OBSERVED':kind,level:observed?(absent?0:2):null,opportunity:kind==='NO_OPPORTUNITY'?'ABSENT':observed?'PRESENT':'UNKNOWN',absence:absent,
  evidence:observed&&!absent?[{messageId:'5',excerpt:input.transcript.messages[4].content,occurrenceIndex:0}]:[],context:observed&&!absent?[{messageId:'2',excerpt:input.transcript.messages[1].content,occurrenceIndex:0}]:[],justification:'Synthetic contract compatibility, not semantic evidence.',improvement:observed&&!absent?'':'Revisar el criterio contextual.',certainty:!observed&&kind!=='NO_OPPORTUNITY'?'REVIEW_REQUIRED':'HIGH'}))};
 const validator=new Ajv({strict:false}).compile(communicationProviderRequest(input).text.format.schema);
 expect(validator(raw),JSON.stringify(validator.errors)).toBe(true);expect(()=>validateCommunicationV2(input,raw)).not.toThrow();
 const bad=structuredClone(raw);if(observed)bad.judgments[0].opportunity='ABSENT';else bad.judgments[0].level=0;
 expect(validator(bad)).toBe(false);expect(()=>validateCommunicationV2(input,bad)).toThrow('STATE_INVALID');
});
it('preserves the /2 projection and binds /3 to a different provider schema',()=>{const input=communicationValidationInputs()[0].input;expect(communicationProviderRequestV2(input).text.format.name).toBe('communication_adjudication_v2');expect(communicationProviderRequest(input).text.format.name).toBe('communication_adjudication_v3');});
