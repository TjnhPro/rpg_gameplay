#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspect} from './check-boundaries.mjs';

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rpg-gameplay-harness-'));
const write=(name,content)=>{
  const target=path.join(temp,name);fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,typeof content==='string'?content:JSON.stringify(content),'utf8');
};
function seed(deps=[]) {
  write('harness/modules.json',{schemaVersion:1,modules:[
    {id:'alpha',optional:true,dependencies:deps},
    {id:'beta',optional:true,dependencies:[]}
  ]});
  for (const f of ['AGENTS.md','ARCHITECTURE.md','docs/DECISIONS.md','docs/TASK_EXECUTION.md','docs/TESTING.md']) write(f,'test fixture');
  write('src/modules/alpha/index.ts',`import { calculateStats } from '@rpg/core/kernel';\nexport const a=1;`);
  write('src/modules/beta/index.ts',`export const b=1;`);
}
const assertHas=(code,message)=>{
  write('src/modules/alpha/feature.ts',code);
  const failures=inspect(temp).errors;
  assert.ok(failures.some(x=>x.includes(message)),`${message}\n${failures.join('\n')}`);
};
try {
  seed();
  let result=inspect(temp);
  assert.deepEqual(result.errors,[],`valid source rejected: ${result.errors.join('; ')}`);
  assertHas(`import {executeSkill} from '@rpg/core/skills';`,'Only public @rpg/core/kernel');
  assertHas(`import type {CombatEntity} from '@rpg/core/contracts';`,'Only public @rpg/core/kernel');
  assertHas(`export * from '@rpg/core/effects';`,'Only public @rpg/core/kernel');
  assertHas(`const run=()=>import(variable);`,'dynamic import/require');
  assertHas(`import {b} from '../beta/index.js';`,'undeclared module dependency');
  seed(['beta']);
  write('src/modules/alpha/feature.ts',`import {b} from '../beta/index.js';`);
  assert.deepEqual(inspect(temp).errors,[], 'declared public dependency should be accepted');
  assertHas(`import {b} from '../beta/private.js';`,'cross-module import must target');
  assertHas(`export const r=()=>Math.random();`,'hidden wall-clock/RNG');
  write('src/modules/alpha/feature.ts',`// import {executeSkill} from '@rpg/core/skills';\nexport const value=1;`);
  assert.deepEqual(inspect(temp).errors,[], 'comment-only forbidden import should not fail');
  write('src/shared/source.ts',`import {b} from '../modules/beta/index.js';`);
  assert.ok(inspect(temp).errors.some(x=>x.includes('low-level/shared src cannot depend')));
  console.log('HARNESS_SELFTEST_PASS 11 focused controls (positive and rejection)');
} finally {
  fs.rmSync(temp,{recursive:true,force:true});
}
