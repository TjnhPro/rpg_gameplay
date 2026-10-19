#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function run(command,args){
  const result=spawnSync(command,args,{cwd:root,stdio:'inherit',shell:false});
  if(result.error || result.status!==0){
    console.error(`VERIFY_FAIL: ${command} ${args.join(' ')}`);
    if(result.error) console.error(result.error.message);
    if(result.signal) console.error(`Terminated by signal: ${result.signal}`);
    process.exit(result.status||1);
  }
}
run(process.execPath,['scripts/check-boundaries.mjs']);
run(process.execPath,['scripts/harness-selftest.mjs']);
function listFiles(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?listFiles(path.join(dir,x.name)):x.isFile()?[path.join(dir,x.name)]:[]);
}
const source=listFiles(path.join(root,'src')).filter(x=>/\.(?:[cm]?[jt]s|tsx|jsx)$/.test(x)&&!x.endsWith('.d.ts'));
if (source.length===0) {
  console.log('HARNESS_VERIFIED; GAMEPLAY_NOT_EVALUATED (no production src; no functional tests to run)');
  process.exit(0);
}
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
for (const name of ['typecheck','test:functional']) {
  if (typeof pkg.scripts?.[name]!=='string' || pkg.scripts[name].trim()==='') {
    console.error(`VERIFY_FAIL: production src exists but package.json is missing '${name}' script. Add real TS & gameplay function test tooling in approved task.`);
    process.exit(1);
  }
}
// npm supplies its CLI path to lifecycle scripts. Invoke it through Node so
// Windows never needs to execute npm.cmd or parse an executable path in a shell.
const npmCli=process.env.npm_execpath;
if (!npmCli || !fs.existsSync(npmCli)) {
  console.error('VERIFY_FAIL: npm CLI unavailable. Run verification with npm run verify.');
  process.exit(1);
}
run(process.execPath,[npmCli,'run','typecheck']);
run(process.execPath,[npmCli,'run','test:functional']);
console.log(`VERIFY_PASS harness + declared production gates; source_files=${source.length}. Review test evidence for actual requirements/profile coverage.`);
