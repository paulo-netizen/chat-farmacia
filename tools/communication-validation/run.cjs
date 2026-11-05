// Closed local experiment. Dry mode never reads credentials or constructs a transport.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');
const root=path.resolve(__dirname,'../..'),load=Module._load,resolve=Module._resolveFilename;
Module._load=function(id,...rest){if(id==='server-only')return {};return load.call(this,id,...rest);};
Module._resolveFilename=function(id,...rest){return resolve.call(this,id.startsWith('@/')?path.join(root,id.slice(2)):id,...rest);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {communicationValidationInputs}=require('./inputs.ts');
const {communicationProviderRequest,runCommunicationExperiment}=require('../../lib/cases/v2/communication-adapter.ts');
const {resultFingerprint}=require('../../lib/cases/v2/session-results.ts');
async function main(){
 const [mode='dry',directory,id]=process.argv.slice(2),cases=communicationValidationInputs();
 if(mode==='dry'){console.log(JSON.stringify(cases.map(c=>({id:c.id,requestHash:resultFingerprint(communicationProviderRequest(c.input)),bytes:Buffer.byteLength(JSON.stringify(communicationProviderRequest(c.input)))}))));return;}
 if(mode!=='live'||!directory||!cases.some(c=>c.id===id))throw Error('M7_ARGUMENTS');
 // Credentials are local only. Do not print environment or provider raw responses.
 require('@next/env').loadEnvConfig(root,false,{info(){},error(){}});
 const row=cases.find(c=>c.id===id),result=await runCommunicationExperiment(id,row.input,{directory:path.resolve(directory),authorizationFile:path.resolve(directory,'authorization.json'),apiKey:process.env.OPENAI_API_KEY});
 console.log(JSON.stringify({id,state:result.state,code:result.code,usage:result.usage,calculatedMicroUsd:result.calculatedMicroUsd,reservation:result.reservation,score:result.result?.score,
  judgments:result.result?.judgments.map(j=>({criterion:j.criterion,state:j.state,level:j.level})),requestId:result.requestId}));
}
main().catch(()=>{console.error('M7_RUN_BLOCKED_SAFE');process.exitCode=1;});
