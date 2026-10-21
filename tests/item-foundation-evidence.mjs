import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {inspect} from '../scripts/check-boundaries.mjs';
import {copyRequiredConsumer,assertTapEvidence,assertBuildVersions,assertCoreIntegrity} from './consumer-evidence.mjs';

// Developer-authorized exception: strip only these exact additive Item bytes.
// Original historical digests and every other protected byte remain authoritative.
const additions = new Map([
  ['src/index.ts',"\nexport {createItemDefinitionReference, createItemInstanceReference, validateItemInstanceReference,\n  createItemDefinition, validateItemDefinition, createItemInstance, validateItemInstance} from './modules/item/index.js';\nexport type {ItemDefinitionReference, ItemInstanceInitialIdentity, ItemInstanceReference, ItemPropertyValue,\n  ItemDefinitionContent, ItemDefinition, ItemInstanceInitialState, ItemInstanceState} from './modules/item/index.js';\n"],
  ['harness/modules.json',',\n    {"id": "item", "optional": true, "dependencies": []}'],
]);
export function historicalBeforeItem(name,text) {
  const addition=additions.get(name);
  if(addition===undefined)return text;
  assert.equal(text.split(addition).length,2,'exact approved Item addition '+name);
  return text.replace(addition,'');
}
const markers=Array.from({length:19},(_,i)=>'ITEM_F'+String(i+1).padStart(2,'0')+'_PASS');
export function assertItemRegistration(receipt) {
  assert.ok(receipt,'mandatory installed Item registration');
  assertTapEvidence(receipt.runtime,8,markers);
  assert.equal(receipt.typechecked,true,'mandatory Item strict external NodeNext');
}

export function runItemFoundation({root,temp,installed,exec,rootPackage,lock,packed}) {
  const name='item-foundation';
  for(const ext of ['mjs','ts'])copyRequiredConsumer(path.join(root,'tests/consumers/'+name+'.'+ext),path.join(temp,name+'.'+ext));
  const file=path.join(temp,name+'.mjs'),runtimeBytes=fs.readFileSync(file);
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const raw=title=>spawnSync(process.execPath,['--test','--test-reporter=tap',...(title?['--test-name-pattern=^Item foundation '+title+'$']:[]),name+'.mjs'],{cwd:temp,shell:false,encoding:'utf8',env});
  const clean=()=>{const r=raw();assert.ifError(r.error);assert.equal(r.status,0,r.stdout+r.stderr);assertTapEvidence(r.stdout,8,markers);return r.stdout;};
  const config=path.join(temp,'item-tsconfig.json');
  fs.writeFileSync(config,JSON.stringify({compilerOptions:{module:'NodeNext',moduleResolution:'NodeNext',target:'ES2022',strict:true,skipLibCheck:false,noEmit:true,types:[]},files:[name+'.ts']}));
  const compile=()=>exec([path.join(root,'node_modules/typescript/bin/tsc'),'-p',config],temp);
  const runtime=clean();compile();
  for(const line of runtime.split(/\r?\n/))if(/ITEM_F\d+_PASS/.test(line))console.log(line);
  console.log('ITEM_RUNTIME_PASS tests=8 pass=8 fail=0 skipped=0; F01-F19');
  console.log('ITEM_DECLARATION_PASS strict_NodeNext skipLibCheck=false; eight_types; readonly; closed_shapes');
  assert.equal(fs.lstatSync(installed).isSymbolicLink(),false);
  assert.ok(temp.includes(' '),'installed Item path contains spaces');
  const declaration=path.join(installed,'dist/modules/item/index.d.ts');
  const declarations=fs.readFileSync(declaration,'utf8');
  assert.deepEqual([...declarations.matchAll(/export (?:interface|type) (\w+)/g)].map(m=>m[1]).sort(),[
    'ItemDefinitionReference','ItemInstanceInitialIdentity','ItemInstanceReference','ItemPropertyValue',
    'ItemDefinitionContent','ItemDefinition','ItemInstanceInitialState','ItemInstanceState'].sort());
  assert.equal([...declarations.matchAll(/export declare function /g)].length,7);
  assert.ok(packed.files.some(f=>f.path==='dist/modules/item/index.d.ts'));
  const done=id=>console.log('ITEM_NEGATIVE_PASS '+id+' restored_exact_bytes clean8/8');
  const red=(id,title,diagnostic)=>{
    const r=raw(title);assert.ifError(r.error);assert.equal(r.status,1,r.stdout+r.stderr);
    assert.match(r.stdout+r.stderr,diagnostic,id+' intended detector');
    assert.doesNotMatch(r.stdout+r.stderr,/SyntaxError|ReferenceError|ERR_MODULE_NOT_FOUND/);
    console.log('ITEM_NEGATIVE_RED '+id+' exit=1 intended='+diagnostic.source);
  };
  function mutate(id,target,anchor,replacement,title,diagnostic) {
    const bytes=fs.readFileSync(target),text=bytes.toString();assert.ok(text.includes(anchor),id+' mutation anchor');
    try{fs.writeFileSync(target,text.replace(anchor,replacement));red(id,title,diagnostic);}
    finally{fs.writeFileSync(target,bytes);}
    assert.deepEqual(fs.readFileSync(target),bytes);clean();done(id);
  }
  for(const ext of ['mjs','ts']) {
    const target=path.join(temp,name+'.'+ext),bytes=fs.readFileSync(target);
    try{fs.renameSync(target,target+'.saved');assert.throws(()=>copyRequiredConsumer(target,target+'.copy'),{code:'ENOENT'});}
    finally{fs.renameSync(target+'.saved',target);}
    assert.deepEqual(fs.readFileSync(target),bytes);clean();done('missing_'+ext);
  }
  assert.throws(()=>assertItemRegistration(undefined),/mandatory installed Item registration/);done('disabled_registration');
  assert.throws(()=>assertItemRegistration({runtime:runtime.replace('ITEM_F01_PASS','removed'),typechecked:true}),/required evidence ITEM_F01_PASS/);done('missing_marker');
  try {
    fs.writeFileSync(file,runtimeBytes.toString().replace("test('Item foundation '","test.skip('Item foundation '"));
    const r=raw();assert.equal(r.status,0);assert.throws(()=>assertTapEvidence(r.stdout,8,markers),/strictEqual|Expected|TAP/);
    console.log('ITEM_NEGATIVE_RED skipped_consumer exit=0 rejected_by_required_TAP_evidence');
  }finally{fs.writeFileSync(file,runtimeBytes);}clean();done('skipped_consumer');
  mutate('zero_assertions',file,'assertions++;','', 'identity',/Item contract requires actual assertions/);
  const owner=path.join(installed,'dist/modules/item/index.js');
  mutate('deep_freeze',owner,'return Object.freeze(result);','return result;','isolation',/deep freeze/);
  // Both reference and full state use the same invariant; select the full-state detector.
  mutate('binding',owner,"if (definitionId !== reference.definitionId)","if (false)",'identity',/exact reference binding/);
  const bytes=fs.readFileSync(owner),text=bytes.toString(),binding="if (definitionId !== reference.definitionId)";
  assert.equal(text.split(binding).length,3);
  try{const at=text.lastIndexOf(binding);fs.writeFileSync(owner,text.slice(0,at)+text.slice(at).replace(binding,'if (false)'));red('instance_binding','instance binding',/exact instance binding/);}
  finally{fs.writeFileSync(owner,bytes);}assert.deepEqual(fs.readFileSync(owner),bytes);clean();done('instance_binding');
  mutate('hostile_key',owner,'Object.defineProperty(result, key,','if (key === "__proto__") continue; Object.defineProperty(result, key,','definition and keys',/dangerous own keys preserved/);
  const rootFile=path.join(installed,'dist/index.js');
  mutate('root_export',rootFile,'createItemDefinitionReference,','createItemDefinitionReference as deliberatelyMissingItemReference,','module and root',/deepStrictEqual|Expected/);
  const manifest=path.join(installed,'package.json'),manifestBytes=fs.readFileSync(manifest);
  try{const m=JSON.parse(manifestBytes);m.version='0.8.7';fs.writeFileSync(manifest,JSON.stringify(m));assert.throws(()=>assertBuildVersions(rootPackage,lock,JSON.parse(fs.readFileSync(manifest))),/installed package version/);}
  finally{fs.writeFileSync(manifest,manifestBytes);}assert.deepEqual(fs.readFileSync(manifest),manifestBytes);assertBuildVersions(rootPackage,lock,JSON.parse(manifestBytes));clean();done('version');
  const pin=JSON.parse(fs.readFileSync(path.join(root,'harness/core-pin.json'))),core=fs.readFileSync(path.join(root,'.artifacts',pin.artifact));
  const corrupted=Buffer.from(core);corrupted[0]^=1;assert.throws(()=>assertCoreIntegrity(corrupted,lock.packages['node_modules/@rpg/core'].integrity),/Core artifact integrity/);
  assertCoreIntegrity(core,lock.packages['node_modules/@rpg/core'].integrity);clean();done('Core_integrity');
  const declarationBytes=fs.readFileSync(declaration);
  try{fs.writeFileSync(declaration,declarations.replace('export interface ItemDefinition extends ItemDefinitionContent {\n    readonly definitionId: string;','export interface ItemDefinition extends ItemDefinitionContent {\n    definitionId: string;'));assert.notDeepEqual(fs.readFileSync(declaration),declarationBytes);assert.throws(compile,/TS2578/);}
  finally{fs.writeFileSync(declaration,declarationBytes);}assert.deepEqual(fs.readFileSync(declaration),declarationBytes);compile();clean();done('readonly_declaration');
  try{fs.writeFileSync(declaration,declarations.replace('export interface ItemDefinitionContent {','export interface ItemDefinitionContent ??? {'));assert.throws(compile,/TS\d+/);}
  finally{fs.writeFileSync(declaration,declarationBytes);}compile();clean();done('invalid_declaration');
  const boundary=path.join(temp,'item-boundary-copy');
  fs.cpSync(path.join(root,'src'),path.join(boundary,'src'),{recursive:true});
  for(const f of ['package.json','harness/modules.json','AGENTS.md','ARCHITECTURE.md','docs/DECISIONS.md','docs/TASK_EXECUTION.md','docs/TESTING.md']) {
    fs.mkdirSync(path.dirname(path.join(boundary,f)),{recursive:true});fs.copyFileSync(path.join(root,f),path.join(boundary,f));
  }
  assert.deepEqual(inspect(boundary).errors,[]);
  const target=path.join(boundary,'src/modules/item/index.ts'),source=fs.readFileSync(target);
  try{fs.appendFileSync(target,"\nimport {createEntity} from '../entity/index.js';\n");assert.ok(inspect(boundary).errors.some(e=>e.includes('undeclared module dependency item -> entity')));}
  finally{fs.writeFileSync(target,source);}assert.deepEqual(fs.readFileSync(target),source);assert.deepEqual(inspect(boundary).errors,[]);clean();done('sibling_dependency');
  // Verify the exception is exact and retains every historical byte outside it.
  for(const [name,addition]of additions) {
    const s=fs.readFileSync(path.join(root,name),'utf8').replaceAll('\r\n','\n');
    const baseline=historicalBeforeItem(name,s);
    assert.throws(()=>historicalBeforeItem(name,s+addition),/exact approved Item addition/);
    assert.throws(()=>historicalBeforeItem(name,s.replace(addition,'')),/exact approved Item addition/);
    assert.notEqual(createHash('sha256').update(historicalBeforeItem(name,s+'\nunauthorized')).digest('hex'),createHash('sha256').update(baseline).digest('hex'));
  }
  done('exact_historical_exception');
  assert.deepEqual(fs.readFileSync(file),runtimeBytes);compile();clean();
  console.log('ITEM_NEGATIVE_COMPLETE controls=17; required_runner; actual_installed_mutations; byte_exact_restore');
  return {runtime,typechecked:true};
}
