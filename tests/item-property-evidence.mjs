import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspect} from '../scripts/check-boundaries.mjs';
import {copyRequiredConsumer,assertTapEvidence,assertBuildVersions,assertCoreIntegrity} from './consumer-evidence.mjs';

const markers=Array.from({length:23},(_,i)=>'ITEM_P'+String(i+1).padStart(2,'0')+'_PASS').filter(x=>x!=='ITEM_P21_PASS');
export function assertItemPropertiesRegistration(receipt){
  assert.ok(receipt,'mandatory installed Item properties registration');
  assertTapEvidence(receipt.runtime,8,markers);
  assert.equal(receipt.typechecked,true,'mandatory Item properties strict NodeNext');
}
export function runItemProperties({root,temp,installed,exec,rootPackage,lock,packed}){
  const name='item-properties';
  for(const ext of ['mjs','ts'])copyRequiredConsumer(path.join(root,'tests/consumers/'+name+'.'+ext),path.join(temp,name+'.'+ext));
  assert.equal(fs.lstatSync(installed).isSymbolicLink(),false);assert.ok(temp.includes(' '));
  assert.ok(packed.files.some(f=>f.path==='dist/modules/item/index.d.ts'));
  const file=path.join(temp,name+'.mjs'),runtimeBytes=fs.readFileSync(file);
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const raw=title=>spawnSync(process.execPath,['--test','--test-reporter=tap',...(title?['--test-name-pattern=^Item properties '+title+'$']:[]),name+'.mjs'],{cwd:temp,env,shell:false,encoding:'utf8'});
  const clean=()=>{const r=raw();assert.ifError(r.error);assert.equal(r.status,0,r.stdout+r.stderr);assertTapEvidence(r.stdout,8,markers);return r.stdout;};
  const config=path.join(temp,'item-properties-tsconfig.json');
  fs.writeFileSync(config,JSON.stringify({compilerOptions:{module:'NodeNext',moduleResolution:'NodeNext',target:'ES2022',strict:true,skipLibCheck:false,noEmit:true,types:[]},files:[name+'.ts']}));
  const compile=()=>exec([path.join(root,'node_modules/typescript/bin/tsc'),'-p',config],temp);
  const runtime=clean();compile();assertItemPropertiesRegistration({runtime,typechecked:true});
  for(const line of runtime.split(/\r?\n/))if(/ITEM_P\d+_PASS/.test(line))console.log(line);
  console.log('ITEM_PROPERTY_RUNTIME_PASS tests=8 pass=8 fail=0 skipped=0');
  console.log('ITEM_P21_PASS installed_strict_NodeNext skipLibCheck=false readonly_discriminants');
  let controls=0;
  const done=id=>{controls++;console.log('ITEM_PROPERTY_NEGATIVE_PASS '+id+' restored_exact_bytes clean8/8');};
  function mutate(id,target,transform,title,diagnostic){
    const bytes=fs.readFileSync(target),changed=transform(bytes.toString());assert.notEqual(changed,bytes.toString(),id+' mutation anchor');
    try{
      fs.writeFileSync(target,changed);const r=raw(title);assert.ifError(r.error);assert.equal(r.status,1,r.stdout+r.stderr);
      assert.match(r.stdout+r.stderr,diagnostic,id+' intended detector');assert.doesNotMatch(r.stdout+r.stderr,/SyntaxError|ReferenceError|ERR_MODULE_NOT_FOUND/);
      console.log('ITEM_PROPERTY_NEGATIVE_RED '+id+' exit=1 intended='+diagnostic.source);
    }finally{fs.writeFileSync(target,bytes);}
    assert.deepEqual(fs.readFileSync(target),bytes);clean();done(id);
  }
  for(const ext of ['mjs','ts']){
    const target=path.join(temp,name+'.'+ext),bytes=fs.readFileSync(target);
    try{fs.renameSync(target,target+'.saved');assert.throws(()=>copyRequiredConsumer(target,target+'.copy'),{code:'ENOENT'});}
    finally{fs.renameSync(target+'.saved',target);}
    assert.deepEqual(fs.readFileSync(target),bytes);clean();done('missing_'+ext);
  }
  assert.throws(()=>assertItemPropertiesRegistration(undefined),/mandatory installed Item properties registration/);clean();done('disabled_registration');
  assert.throws(()=>assertItemPropertiesRegistration({runtime:runtime.replace('ITEM_P01_PASS','removed'),typechecked:true}),/required evidence ITEM_P01_PASS/);clean();done('missing_marker');
  try{
    fs.writeFileSync(file,runtimeBytes.toString().replace("test('Item properties '","test.skip('Item properties '"));
    const r=raw();assert.equal(r.status,0);assert.throws(()=>assertTapEvidence(r.stdout,8,markers),/strictEqual|Expected|TAP/);
    console.log('ITEM_PROPERTY_NEGATIVE_RED skipped_consumer exit=0 rejected_by_required_TAP_evidence');
  }finally{fs.writeFileSync(file,runtimeBytes);}assert.deepEqual(fs.readFileSync(file),runtimeBytes);clean();done('skipped_consumer');
  mutate('zero_assertions',file,s=>s.replace('assertions++;',''),'read',/Item property contract requires actual assertions/);
  const owner=path.join(installed,'dist/modules/item/index.js');
  mutate('read_truthiness',owner,s=>s.replace('Object.hasOwn(current.properties, name)','Boolean(current.properties[name])'),'read',/present null/);
  mutate('read_definition_fallback',owner,s=>s.replace('Object.hasOwn(current.properties, name)','(Object.hasOwn(current.properties, name) || Object.hasOwn(definition.properties, name))').replace('value: current.properties[name]','value: current.properties[name] ?? definition.properties[name]'),'read',/definition fallback forbidden/);
  mutate('set_source_mutation',owner,s=>s.replace('const next = { ...current.properties };','const next = instance.properties;'),'set',/source untouched/);
  mutate('replace_alias',owner,s=>s.replace('const candidate = validateItemInstance(definition, { ...current, properties: captured });','const candidate = {...current, properties: replacement};'),'replace',/replacement detached/);
  mutate('deep_freeze',owner,s=>s.replace('return Object.freeze(result);','return result;'),'set',/property deep freeze/);
  mutate('binding',owner,s=>{const anchor='if (definitionId !== reference.definitionId)',at=s.lastIndexOf(anchor);assert.ok(at>=0);return s.slice(0,at)+s.slice(at).replace(anchor,'if (false)');},'binding and admission',/canonical instance binding/);
  mutate('recursive_before_admission',owner,s=>s.replace('const captured = copyValue(value, new Set());','const captured = value;'),'admission',/invalid before rejection/);
  mutate('rejection_candidate',owner,s=>s.replaceAll("if (!allowed)","if (false)"),'admission',/rejection has no candidate/);
  mutate('root_export',path.join(installed,'dist/index.js'),s=>s.replace('getItemInstanceProperty,','getItemInstanceProperty as removedPropertyRead,'),'replay and composition',/deepStrictEqual|Expected/);
  const manifest=path.join(installed,'package.json'),manifestBytes=fs.readFileSync(manifest);
  try{const m=JSON.parse(manifestBytes);m.version='0.9.0';fs.writeFileSync(manifest,JSON.stringify(m));assert.throws(()=>assertBuildVersions(rootPackage,lock,JSON.parse(fs.readFileSync(manifest))),/installed package version/);}
  finally{fs.writeFileSync(manifest,manifestBytes);}assert.deepEqual(fs.readFileSync(manifest),manifestBytes);assertBuildVersions(rootPackage,lock,JSON.parse(manifestBytes));clean();done('version');
  const pin=JSON.parse(fs.readFileSync(path.join(root,'harness/core-pin.json'))),core=fs.readFileSync(path.join(root,'.artifacts',pin.artifact));
  const corrupt=Buffer.from(core);corrupt[0]^=1;assert.throws(()=>assertCoreIntegrity(corrupt,lock.packages['node_modules/@rpg/core'].integrity),/Core artifact integrity/);assertCoreIntegrity(core,lock.packages['node_modules/@rpg/core'].integrity);clean();done('Core_integrity');
  const declaration=path.join(installed,'dist/modules/item/index.d.ts'),declarationBytes=fs.readFileSync(declaration);
  for(const [id,anchor,replacement]of [
    ['readonly','readonly value: ItemPropertyValue;','value: ItemPropertyValue;'],
    ['discriminant',"readonly status: 'accepted';","readonly status: 'accepted' | 'rejected';"],
  ]){
    const original=declarationBytes.toString();assert.ok(original.includes(anchor));
    try{fs.writeFileSync(declaration,original.replace(anchor,replacement));assert.throws(compile,/TS\d+/);}
    finally{fs.writeFileSync(declaration,declarationBytes);}
    assert.deepEqual(fs.readFileSync(declaration),declarationBytes);compile();clean();done(id+'_declaration');
  }
  const boundary=path.join(temp,'item-properties-boundary');
  fs.cpSync(path.join(root,'src'),path.join(boundary,'src'),{recursive:true});
  for(const name of ['package.json','harness/modules.json','AGENTS.md','ARCHITECTURE.md','docs/DECISIONS.md','docs/TASK_EXECUTION.md','docs/TESTING.md']){
    fs.mkdirSync(path.dirname(path.join(boundary,name)),{recursive:true});fs.copyFileSync(path.join(root,name),path.join(boundary,name));
  }
  assert.deepEqual(inspect(boundary).errors,[]);const target=path.join(boundary,'src/modules/item/index.ts'),bytes=fs.readFileSync(target);
  try{fs.appendFileSync(target,"\nimport {createEntity} from '../entity/index.js';\n");assert.ok(inspect(boundary).errors.some(e=>e.includes('undeclared module dependency item -> entity')));}
  finally{fs.writeFileSync(target,bytes);}assert.deepEqual(fs.readFileSync(target),bytes);assert.deepEqual(inspect(boundary).errors,[]);clean();done('sibling_dependency');
  assert.deepEqual(fs.readFileSync(file),runtimeBytes);compile();clean();
  console.log('ITEM_PROPERTY_NEGATIVE_COMPLETE controls='+controls+'; actual_installed_mutations byte_exact_restore');
  return {runtime,typechecked:true};
}
