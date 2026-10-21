import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspect} from '../scripts/check-boundaries.mjs';
import {copyRequiredConsumer,assertTapEvidence,assertBuildVersions,assertCoreIntegrity} from './consumer-evidence.mjs';

const markers=Array.from({length:24},(_,i)=>'ITEM_S'+String(i+1).padStart(2,'0')+'_PASS').filter(x=>!['ITEM_S22_PASS','ITEM_S23_PASS'].includes(x));
export function assertItemStackRegistration(receipt){
  assert.ok(receipt,'mandatory installed Item stack registration');
  assertTapEvidence(receipt.runtime,8,markers);
  assert.equal(receipt.typechecked,true,'mandatory Item stack strict NodeNext');
}
export function runItemStack({root,temp,installed,exec,rootPackage,lock,packed}){
  const name='item-stack';
  for(const ext of ['mjs','ts'])copyRequiredConsumer(path.join(root,'tests/consumers/'+name+'.'+ext),path.join(temp,name+'.'+ext));
  assert.equal(fs.lstatSync(installed).isSymbolicLink(),false);assert.ok(temp.includes(' '));
  assert.ok(packed.files.some(f=>f.path==='dist/modules/item/index.d.ts'));
  const file=path.join(temp,name+'.mjs'),runtimeBytes=fs.readFileSync(file);
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const raw=title=>spawnSync(process.execPath,['--test','--test-reporter=tap',...(title?['--test-name-pattern=^Item stack '+title+'$']:[]),name+'.mjs'],{cwd:temp,env,shell:false,encoding:'utf8'});
  const clean=()=>{const r=raw();assert.ifError(r.error);assert.equal(r.status,0,r.stdout+r.stderr);assertTapEvidence(r.stdout,8,markers);return r.stdout;};
  const config=path.join(temp,'item-stack-tsconfig.json');
  fs.writeFileSync(config,JSON.stringify({compilerOptions:{module:'NodeNext',moduleResolution:'NodeNext',target:'ES2022',strict:true,skipLibCheck:false,noEmit:true,types:[]},files:[name+'.ts']}));
  const compile=()=>exec([path.join(root,'node_modules/typescript/bin/tsc'),'-p',config],temp);
  const runtime=clean();compile();assertItemStackRegistration({runtime,typechecked:true});
  for(const line of runtime.split(/\r?\n/))if(/ITEM_S\d+_PASS/.test(line))console.log(line);
  console.log('ITEM_STACK_RUNTIME_PASS tests=8 pass=8 fail=0 skipped=0');
  console.log('ITEM_S22_PASS installed_strict_NodeNext skipLibCheck=false readonly_discriminants');
  let controls=0;
  const done=id=>{controls++;console.log('ITEM_STACK_NEGATIVE_PASS '+id+' restored_exact_bytes clean8/8');};
  function mutate(id,target,transform,title,diagnostic){
    const bytes=fs.readFileSync(target),changed=transform(bytes.toString());assert.notEqual(changed,bytes.toString(),id+' mutation anchor');
    try{
      fs.writeFileSync(target,changed);const r=raw(title);assert.ifError(r.error);assert.equal(r.status,1,r.stdout+r.stderr);
      assert.match(r.stdout+r.stderr,diagnostic,id+' intended detector');assert.doesNotMatch(r.stdout+r.stderr,/SyntaxError|ReferenceError|ERR_MODULE_NOT_FOUND/);
      console.log('ITEM_STACK_NEGATIVE_RED '+id+' exit=1 intended='+diagnostic.source);
    }finally{fs.writeFileSync(target,bytes);}
    assert.deepEqual(fs.readFileSync(target),bytes);clean();done(id);
  }
  for(const ext of ['mjs','ts']){
    const target=path.join(temp,name+'.'+ext),bytes=fs.readFileSync(target);
    try{fs.renameSync(target,target+'.saved');assert.throws(()=>copyRequiredConsumer(target,target+'.copy'),{code:'ENOENT'});}
    finally{fs.renameSync(target+'.saved',target);}
    assert.deepEqual(fs.readFileSync(target),bytes);clean();done('missing_'+ext);
  }
  assert.throws(()=>assertItemStackRegistration(undefined),/mandatory installed Item stack registration/);clean();done('disabled_registration');
  assert.throws(()=>assertItemStackRegistration({runtime:runtime.replace('ITEM_S01_PASS','removed'),typechecked:true}),/required evidence ITEM_S01_PASS/);clean();done('missing_marker');
  try{
    fs.writeFileSync(file,runtimeBytes.toString().replace("test('Item stack '","test.skip('Item stack '"));
    const r=raw();assert.equal(r.status,0);assert.throws(()=>assertTapEvidence(r.stdout,8,markers),/strictEqual|Expected|TAP/);
    console.log('ITEM_STACK_NEGATIVE_RED skipped_consumer exit=0 rejected_by_required_TAP_evidence');
  }finally{fs.writeFileSync(file,runtimeBytes);}assert.deepEqual(fs.readFileSync(file),runtimeBytes);clean();done('skipped_consumer');
  mutate('zero_assertions',file,s=>s.replace('assertions++;',''),'policy',/Item stack contract requires actual assertions/);
  const owner=path.join(installed,'dist/modules/item/index.js');
  mutate('definition_content',owner,s=>s.replace("if (left.categoryId !== right.categoryId || left.rarityId !== right.rarityId", "if (false && (left.categoryId !== right.categoryId || left.rarityId !== right.rarityId").replace("!equalItemValue(left.properties, right.properties)) {", "!equalItemValue(left.properties, right.properties))) {"),'definition content',/full definition content/);
  mutate('JSON_equality',owner,s=>s.replace('if (Object.is(left, right))','return JSON.stringify(left) === JSON.stringify(right);\n    if (Object.is(left, right))'),'nested equality',/record insertion order irrelevant/);
  mutate('unordered_arrays',owner,s=>s.replace('left.every((value, index) => equalItemValue(value, right[index]))','left.every(value => right.some(other => equalItemValue(value, other)))'),'nested equality',/array order meaningful/);
  mutate('same_instance',owner,s=>s.replace('if (a.instanceId === b.instanceId)','if (false)'),'priority',/reason priority same_instance/);
  mutate('stackable_false',owner,s=>s.replace('if (!validatedPolicy.stackable)','if (false)'),'priority',/reason priority not_stackable/);
  mutate('early_refusal',owner,s=>s.replace('const left = validateItemDefinition(leftDefinition);',"if (leftInstance.instanceId === rightInstance.instanceId) return Object.freeze({compatible:false,reason:'same_instance'});\n        const left = validateItemDefinition(leftDefinition);"),'full validation',/all operands before refusal/);
  mutate('negative_zero',owner,s=>s.replace('Object.is(left, right)','left === right'),'nested equality',/Object.is negative zero/);
  mutate('root_export',path.join(installed,'dist/index.js'),s=>s.replace('assessItemStackCompatibility }','assessItemStackCompatibility as removedStackAssessment }'),'composition and profiles',/deepStrictEqual|Expected/);
  const manifest=path.join(installed,'package.json'),manifestBytes=fs.readFileSync(manifest);
  try{const m=JSON.parse(manifestBytes);m.version='0.9.1';fs.writeFileSync(manifest,JSON.stringify(m));assert.throws(()=>assertBuildVersions(rootPackage,lock,JSON.parse(fs.readFileSync(manifest))),/installed package version/);}
  finally{fs.writeFileSync(manifest,manifestBytes);}assert.deepEqual(fs.readFileSync(manifest),manifestBytes);assertBuildVersions(rootPackage,lock,JSON.parse(manifestBytes));clean();done('version');
  const pin=JSON.parse(fs.readFileSync(path.join(root,'harness/core-pin.json'))),core=fs.readFileSync(path.join(root,'.artifacts',pin.artifact));
  const corrupt=Buffer.from(core);corrupt[0]^=1;assert.throws(()=>assertCoreIntegrity(corrupt,lock.packages['node_modules/@rpg/core'].integrity),/Core artifact integrity/);assertCoreIntegrity(core,lock.packages['node_modules/@rpg/core'].integrity);clean();done('Core_integrity');
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
  const boundary=path.join(temp,'item-stack-boundary');
  fs.cpSync(path.join(root,'src'),path.join(boundary,'src'),{recursive:true});
  for(const name of ['package.json','harness/modules.json','AGENTS.md','ARCHITECTURE.md','docs/DECISIONS.md','docs/TASK_EXECUTION.md','docs/TESTING.md']){
    fs.mkdirSync(path.dirname(path.join(boundary,name)),{recursive:true});fs.copyFileSync(path.join(root,name),path.join(boundary,name));
  }
  assert.deepEqual(inspect(boundary).errors,[]);const target=path.join(boundary,'src/modules/item/index.ts'),bytes=fs.readFileSync(target);
  try{fs.appendFileSync(target,"\nimport {} from '../inventory/index.js';\n");assert.ok(inspect(boundary).errors.some(e=>e.includes('undeclared module dependency item -> inventory')));}
  finally{fs.writeFileSync(target,bytes);}assert.deepEqual(fs.readFileSync(target),bytes);assert.deepEqual(inspect(boundary).errors,[]);clean();done('sibling_dependency');
  assert.deepEqual(fs.readFileSync(file),runtimeBytes);compile();clean();
  console.log('ITEM_STACK_NEGATIVE_COMPLETE controls='+controls+'; actual_installed_mutations byte_exact_restore');
  return {runtime,typechecked:true};
}
