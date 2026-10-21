import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspect} from '../scripts/check-boundaries.mjs';
import {copyRequiredConsumer,assertTapEvidence,assertBuildVersions,assertCoreIntegrity} from './consumer-evidence.mjs';

const markers=Array.from({length:25},(_,i)=>'ITEM_C'+String(i+1).padStart(2,'0')+'_PASS').filter(x=>!['ITEM_C22_PASS','ITEM_C23_PASS','ITEM_C25_PASS'].includes(x));
export function assertItemClosureRegistration(receipt){
  assert.ok(receipt,'mandatory installed Item closure registration');
  assertTapEvidence(receipt.runtime,10,markers);
  assert.equal(receipt.typechecked,true,'mandatory Item closure strict NodeNext');
}
export function runItemClosure({root,temp,installed,exec,rootPackage,lock,packed}){
  const name='item-integration-closure';
  for(const ext of ['mjs','ts'])copyRequiredConsumer(path.join(root,'tests/consumers/'+name+'.'+ext),path.join(temp,name+'.'+ext));
  assert.equal(fs.lstatSync(installed).isSymbolicLink(),false);assert.ok(temp.includes(' '));
  assert.ok(packed.files.some(f=>f.path==='dist/modules/item/index.d.ts'));
  const file=path.join(temp,name+'.mjs'),runtimeBytes=fs.readFileSync(file);
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const raw=title=>spawnSync(process.execPath,['--test','--test-reporter=tap',...(title?['--test-name-pattern=^Item closure '+title+'$']:[]),name+'.mjs'],{cwd:temp,env,shell:false,encoding:'utf8'});
  const clean=()=>{const r=raw();assert.ifError(r.error);assert.equal(r.status,0,r.stdout+r.stderr);assertTapEvidence(r.stdout,10,markers);return r.stdout;};
  const config=path.join(temp,'item-integration-closure-tsconfig.json');
  fs.writeFileSync(config,JSON.stringify({compilerOptions:{module:'NodeNext',moduleResolution:'NodeNext',target:'ES2022',strict:true,skipLibCheck:false,noEmit:true,types:[]},files:[name+'.ts']}));
  const compile=()=>exec([path.join(root,'node_modules/typescript/bin/tsc'),'-p',config],temp);
  assertBuildVersions(rootPackage,lock,JSON.parse(fs.readFileSync(path.join(installed,'package.json'))));
  const runtime=clean();compile();assertItemClosureRegistration({runtime,typechecked:true});
  for(const line of runtime.split(/\r?\n/))if(/ITEM_C\d+_PASS|ITEM_CLOSURE_REPLAY_SHA256/.test(line))console.log(line);
  console.log('ITEM_CLOSURE_RUNTIME_PASS tests=10 pass=10 fail=0 skipped=0');
  console.log('ITEM_C25_PASS installed_strict_NodeNext skipLibCheck=false readonly_discriminants');
  let controls=0;
  const done=id=>{controls++;console.log('ITEM_CLOSURE_NEGATIVE_PASS '+id+' restored_exact_bytes clean10/10');};
  function mutate(id,target,transform,title,diagnostic){
    const bytes=fs.readFileSync(target),changed=transform(bytes.toString());assert.notEqual(changed,bytes.toString(),id+' mutation anchor');
    try{
      fs.writeFileSync(target,changed);const r=raw(title);assert.ifError(r.error);assert.equal(r.status,1,r.stdout+r.stderr);
      assert.match(r.stdout+r.stderr,diagnostic,id+' intended detector');assert.doesNotMatch(r.stdout+r.stderr,/SyntaxError|ReferenceError|ERR_MODULE_NOT_FOUND/);
      console.log('ITEM_CLOSURE_NEGATIVE_RED '+id+' exit=1 intended='+diagnostic.source);
    }finally{fs.writeFileSync(target,bytes);}
    assert.deepEqual(fs.readFileSync(target),bytes);clean();done(id);
  }
  for(const ext of ['mjs','ts']){
    const target=path.join(temp,name+'.'+ext),bytes=fs.readFileSync(target);
    try{fs.renameSync(target,target+'.saved');assert.throws(()=>copyRequiredConsumer(target,target+'.copy'),{code:'ENOENT'});}
    finally{fs.renameSync(target+'.saved',target);}
    assert.deepEqual(fs.readFileSync(target),bytes);clean();done('missing_'+ext);
  }
  assert.throws(()=>assertItemClosureRegistration(undefined),/mandatory installed Item closure registration/);clean();done('disabled_registration');
  assert.throws(()=>assertItemClosureRegistration({runtime:runtime.replace('ITEM_C01_PASS','removed'),typechecked:true}),/required evidence ITEM_C01_PASS/);clean();done('missing_marker');
  try{
    fs.writeFileSync(file,runtimeBytes.toString().replace("test('Item closure '","test.skip('Item closure '"));
    const r=raw();assert.equal(r.status,0);assert.throws(()=>assertTapEvidence(r.stdout,10,markers),/strictEqual|Expected|TAP/);
    console.log('ITEM_CLOSURE_NEGATIVE_RED skipped_consumer exit=0 rejected_by_required_TAP_evidence');
  }finally{fs.writeFileSync(file,runtimeBytes);}assert.deepEqual(fs.readFileSync(file),runtimeBytes);clean();done('skipped_consumer');
  mutate('zero_assertions',file,s=>s.replace('run(a);',''),'compatibility',/Item closure contract requires actual assertions/);
  const owner=path.join(installed,'dist/modules/item/index.js');
  mutate('nested_alias',owner,s=>s.replace('function copyValue(input, ancestors) {','function copyValue(input, ancestors) {\n    if (input && typeof input === "object") return input;'),'isolation',/detached/);
  mutate('deep_freeze',owner,s=>s.replace('return Object.freeze(denseValues(input).map(value => copyValue(value, ancestors)));','return denseValues(input).map(value => copyValue(value, ancestors));'),'isolation',/deep frozen snapshot/);
  mutate('missing_null',owner,s=>s.replace(': { found: false }',': { found: true, value: null }'),'end to end',/complete literal Item flow/);
  mutate('definition_default',owner,s=>s.replace('Object.hasOwn(current.properties, name)','Object.hasOwn(current.properties, name) || Object.hasOwn(definition.properties, name)').replace('value: current.properties[name]','value: current.properties[name] ?? definition.properties[name]'),'end to end',/complete literal Item flow/);
  mutate('false_candidate',owner,s=>s.replaceAll("reason: 'ineligible', candidate: null", "reason: 'ineligible', candidate: current"),'malformed and admission',/false admission has no candidate/);
  mutate('invalid_early_refusal',owner,s=>s.replace('const captured = copyValue(value, new Set());',"if (!admission.eligible) return Object.freeze({status:'rejected',reason:'ineligible',candidate:null});\n        const captured = copyValue(value, new Set());"),'malformed and admission',/invalid despite false admission/);
  mutate('same_instance',owner,s=>s.replace('if (a.instanceId === b.instanceId)','if (false)'),'compatibility',/compatibility reason same_instance/);
  mutate('differing_payload',owner,s=>s.replace('if (!equalItemValue(a.properties, b.properties))','if (false)'),'compatibility',/compatibility reason different_properties/);
  mutate('JSON_equality',owner,s=>s.replace('if (Object.is(left, right))','return JSON.stringify(left) === JSON.stringify(right);\n    if (Object.is(left, right))'),'compatibility',/record insertion order irrelevant/);
  const rootEntry=path.join(installed,'dist/index.js');
  mutate('root_removed',rootEntry,s=>s.replace('assessItemStackCompatibility }','assessItemStackCompatibility as removedStackAssessment }'),'composition and inventory',/exact Item runtime names/);
  mutate('root_unexpected',rootEntry,s=>s+'\nexport function unexpectedItemExport() {}\n','composition and inventory',/exact Item runtime names/);
  const manifest=path.join(installed,'package.json'),manifestBytes=fs.readFileSync(manifest);
  try{const m=JSON.parse(manifestBytes);m.version='0.9.2';fs.writeFileSync(manifest,JSON.stringify(m));assert.throws(()=>assertBuildVersions(rootPackage,lock,JSON.parse(fs.readFileSync(manifest))),/installed package version/);}
  finally{fs.writeFileSync(manifest,manifestBytes);}assert.deepEqual(fs.readFileSync(manifest),manifestBytes);assertBuildVersions(rootPackage,lock,JSON.parse(manifestBytes));clean();done('version');
  const pin=JSON.parse(fs.readFileSync(path.join(root,'harness/core-pin.json'))),core=fs.readFileSync(path.join(root,'.artifacts',pin.artifact));
  const corrupt=Buffer.from(core);corrupt[0]^=1;assert.throws(()=>assertCoreIntegrity(corrupt,lock.packages['node_modules/@rpg/core'].integrity),/Core artifact integrity/);assertCoreIntegrity(core,lock.packages['node_modules/@rpg/core'].integrity);clean();done('Core_integrity');
  const coreManifest=path.join(temp,'node_modules/@rpg/core/package.json'),coreBytes=fs.readFileSync(coreManifest);
  const checkCore=()=>assert.equal(JSON.parse(fs.readFileSync(coreManifest)).version,pin.version,'installed Core version');
  checkCore();try{const m=JSON.parse(coreBytes);m.version='0.0.0';fs.writeFileSync(coreManifest,JSON.stringify(m));assert.throws(checkCore,/installed Core version/);}
  finally{fs.writeFileSync(coreManifest,coreBytes);}assert.deepEqual(fs.readFileSync(coreManifest),coreBytes);checkCore();clean();done('Core_version');
  const declaration=path.join(installed,'dist/modules/item/index.d.ts'),declarationBytes=fs.readFileSync(declaration);
  for(const [id,anchor,replacement]of [
    ['readonly','readonly stackable: boolean;','stackable: boolean;'],
    ['discriminant',"readonly compatible: true;","readonly compatible: boolean;"],
  ]){
    const original=declarationBytes.toString();assert.ok(original.includes(anchor));
    try{fs.writeFileSync(declaration,original.replace(anchor,replacement));assert.throws(compile,/TS\d+/);}
    finally{fs.writeFileSync(declaration,declarationBytes);}
    assert.deepEqual(fs.readFileSync(declaration),declarationBytes);compile();clean();done(id+'_declaration');
  }
  const boundary=path.join(temp,'item-integration-closure-boundary');
  fs.cpSync(path.join(root,'src'),path.join(boundary,'src'),{recursive:true});
  for(const name of ['package.json','harness/modules.json','AGENTS.md','ARCHITECTURE.md','docs/DECISIONS.md','docs/TASK_EXECUTION.md','docs/TESTING.md']){
    fs.mkdirSync(path.dirname(path.join(boundary,name)),{recursive:true});fs.copyFileSync(path.join(root,name),path.join(boundary,name));
  }
  assert.deepEqual(inspect(boundary).errors,[]);const target=path.join(boundary,'src/modules/item/index.ts'),bytes=fs.readFileSync(target);
  try{fs.appendFileSync(target,"\nimport {} from '../inventory/index.js';\n");assert.ok(inspect(boundary).errors.some(e=>e.includes('undeclared module dependency item -> inventory')));}
  finally{fs.writeFileSync(target,bytes);}assert.deepEqual(fs.readFileSync(target),bytes);assert.deepEqual(inspect(boundary).errors,[]);clean();done('sibling_dependency');
  assert.deepEqual(fs.readFileSync(file),runtimeBytes);compile();clean();
  console.log('ITEM_C26_PASS targeted_faults_and_restoration');
  console.log('ITEM_CLOSURE_NEGATIVE_COMPLETE controls='+controls+'; actual_installed_mutations byte_exact_restore');
  return {runtime,typechecked:true};
}
