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
if (!fs.existsSync(path.join(root,'src/index.ts')) || !fs.statSync(path.join(root,'src/index.ts')).isFile()) {
  console.error('VERIFY_FAIL: required production entrypoint src/index.ts is missing. Build, typecheck and functional verification cannot be skipped.');
  process.exit(1);
}
function listFiles(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?listFiles(path.join(dir,x.name)):x.isFile()?[path.join(dir,x.name)]:[]);
}
const source=listFiles(path.join(root,'src')).filter(x=>/\.(?:[cm]?[jt]s|tsx|jsx)$/.test(x)&&!x.endsWith('.d.ts'));
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
for (const name of ['build','typecheck','test:functional']) {
  if (typeof pkg.scripts?.[name]!=='string' || pkg.scripts[name].trim()==='') {
    console.error(`VERIFY_FAIL: production src exists but package.json is missing '${name}' script. Add real build, TS and functional contract tooling in approved task.`);
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
run(process.execPath,[npmCli,'run','build']);
run(process.execPath,[npmCli,'run','typecheck']);
run(process.execPath,[npmCli,'run','test:functional']);
console.log(`VERIFY_PASS harness + build + typecheck + functional package contracts; source_files=${source.length}. GF01–GF16, EC01–EC18, PG01–PG19, CB01–CB30, SK01–SK35, EF01–EF40 + FIX01 and Actor AI AI01–AI40 and Encounter EN01–EN10 foundation/activation contracts verified; Text/2D/2.5D Foundation/Entity data compatibility only. Gameplay profile behavior is NOT_EVALUATED; Effect is the merged baseline; Encounter phase IN_PROGRESS, Developer acceptance PENDING.`);
