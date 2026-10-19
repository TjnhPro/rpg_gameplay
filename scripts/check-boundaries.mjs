#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {builtinModules} from 'node:module';

const JS_SOURCE = /\.(?:[cm]?[jt]s|tsx|jsx)$/;
const BANNED_TOP_LEVEL = ['app', 'apps', 'game', 'games', 'client', 'server', 'ui', 'renderer', 'renderers'];
const ENGINE_IMPORTS = new Set(['phaser', 'pixi.js', 'three', 'react', 'react-dom', 'godot', 'vitest']);
const BUILTINS = new Set(builtinModules.map(x => x.replace(/^node:/, '')));
const isInside = (base, p) => p === base || p.startsWith(base + path.sep);

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') return [];
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : entry.isFile() ? [absolute] : [];
  });
}

// A small dependency-free lexical guard. It intentionally does not claim a complete TS AST analysis.
function withoutComments(code) {
  let output = '';
  let quote = null;
  for (let i=0;i<code.length;i++) {
    const c=code[i], next=code[i+1];
    if (quote) {
      output+=c;
      if (c==='\\' && i+1<code.length) { output+=code[++i]; continue; }
      if (c===quote) quote=null;
      continue;
    }
    if (c==='"' || c==="'" || c==='`') { quote=c; output+=c; continue; }
    if (c==='/' && next==='/') {
      while (i<code.length && code[i]!=='\n') {output+=' '; i++;}
      if (i<code.length) output+='\n';
      continue;
    }
    if (c==='/' && next==='*') {
      output+='  '; i+=2;
      while (i<code.length && !(code[i]==='*'&&code[i+1]==='/')) {output+=code[i]==='\n'?'\n':' '; i++;}
      if (i<code.length) {output+='  ';i++;}
      continue;
    }
    output+=c;
  }
  return output;
}

function importsOf(source, errors, label) {
  const code=withoutComments(source);
  const specs=[];
  const staticRE=/\b(?:import|export)\s+(?:type\s+)?(?:[\w$*{},\s]+?\s+from\s+)?(['"])([^'"\\\r\n]+)\1/g;
  for (const match of code.matchAll(staticRE)) specs.push(match[2]);
  const callRE=/\b(?:import|require(?:\.resolve)?)\s*\(\s*([^)]*)\)/g;
  for (const match of code.matchAll(callRE)) {
    const arg=match[1].trim();
    const literal=/^(['"`])([^'"`]*)\1$/s.exec(arg);
    if (!literal || (literal[1]==='`' && literal[2].includes('${'))) {
      errors.push(`${label}: dynamic import/require must have a literal string. Inject data/dependencies instead.`);
    } else specs.push(literal[2]);
  }
  return [...new Set(specs)];
}

function readRegistry(root, errors) {
  let json;
  const target=path.join(root,'harness/modules.json');
  try {json=JSON.parse(fs.readFileSync(target,'utf8'));}
  catch(e) {errors.push(`harness/modules.json missing/invalid: ${e.message}`);return new Map();}
  if (json.schemaVersion!==1 || !Array.isArray(json.modules)) {
    errors.push('harness/modules.json: expected {schemaVersion:1, modules:[]}');return new Map();
  }
  const modules=new Map();
  for (const entry of json.modules) {
    if (typeof entry!=='object' || entry===null || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(entry.id ?? '')) {
      errors.push('harness/modules.json: invalid module id');continue;
    }
    if (modules.has(entry.id)) errors.push(`harness/modules.json: duplicate module ${entry.id}`);
    if (entry.optional!==true && entry.optional!==false) errors.push(`harness/modules.json: ${entry.id} must declare optional: boolean`);
    if (!Array.isArray(entry.dependencies) || !entry.dependencies.every(x=>typeof x==='string')) {
      errors.push(`harness/modules.json: ${entry.id} dependencies must be array of module IDs`);
    }
    modules.set(entry.id, entry);
  }
  for (const [id, entry] of modules) {
    for (const dep of entry.dependencies ?? []) {
      if (!modules.has(dep)) errors.push(`Module ${id} depends on unknown module ${dep}`);
      if (dep===id) errors.push(`Module ${id} cannot depend on itself`);
    }
  }
  const visited=new Set(), active=new Set();
  function visit(id) {
    if (active.has(id)) {errors.push(`Module dependency cycle involving ${id}`);return;}
    if (visited.has(id)) return;
    active.add(id);
    for (const dep of modules.get(id)?.dependencies ?? []) if(modules.has(dep)) visit(dep);
    active.delete(id);visited.add(id);
  }
  for (const id of modules.keys()) visit(id);
  return modules;
}

function moduleFor(file, modulesRoot) {
  if (!isInside(modulesRoot,file) || file===modulesRoot) return null;
  const relative=path.relative(modulesRoot,file).split(path.sep);
  return relative.length>=1 && relative[0] ? relative[0] : null;
}

export function inspect(rootDirectory) {
  const root=path.resolve(rootDirectory), errors=[];
  const modules=readRegistry(root,errors);
  // v0.1.0 approves only Core as a runtime package. A future approved task may
  // extend this policy; arbitrary external packages cannot bypass L2 boundaries.
  const packagePath=path.join(root,'package.json');
  if (fs.existsSync(packagePath)) {
    const pkg=JSON.parse(fs.readFileSync(packagePath,'utf8'));
    for(const group of ['dependencies','optionalDependencies','peerDependencies']) {
      for(const name of Object.keys(pkg[group]??{})) {
        if(name!=='@rpg/core') errors.push(`package.json: unapproved production dependency '${name}'`);
      }
    }
  }
  const src=path.join(root,'src'), modulesRoot=path.join(src,'modules');
  for (const name of BANNED_TOP_LEVEL) {
    const folder=path.join(root,name);
    for(const file of walk(folder)) if(JS_SOURCE.test(file)) errors.push(`${path.relative(root,file)}: application/game source belongs in L4, not L2`);
  }
  for (const file of walk(src).filter(x=>JS_SOURCE.test(x) && !x.endsWith('.d.ts'))) {
    const label=path.relative(root,file).replaceAll(path.sep,'/');
    const owner=moduleFor(file,modulesRoot);
    if (owner && !modules.has(owner)) errors.push(`${label}: missing module owner in harness/modules.json`);
    const source=fs.readFileSync(file,'utf8');
    const uncommented=withoutComments(source);
    if (/\bMath\s*\.\s*random\s*\(/.test(source) || /\bDate\s*\.\s*now\s*\(/.test(source) || /\bperformance\s*\.\s*now\s*\(/.test(source)) {
      errors.push(`${label}: hidden wall-clock/RNG detected. Pass clock and RNG explicitly.`);
    }
    const imports=importsOf(source,errors,label);
    for (const spec of imports) {
      if (spec==='@rpg/core/kernel') continue;
      if (spec==='@rpg/core' || spec.startsWith('@rpg/core/')) {
        errors.push(`${label}: forbidden '${spec}'. Only public @rpg/core/kernel is allowed.`);continue;
      }
      const pkg=spec.startsWith('@') ? spec.split('/').slice(0,2).join('/') : spec.split('/')[0];
      if (spec.startsWith('node:') || BUILTINS.has(spec) || ENGINE_IMPORTS.has(pkg) || pkg.startsWith('@babylonjs/')) {
        errors.push(`${label}: '${spec}' is application/Node/test runtime, not a pure gameplay dependency.`);continue;
      }
      if (spec==='@rpg/gameplay' || spec.startsWith('@rpg/gameplay/')) {
        errors.push(`${label}: self-package source import '${spec}' bypasses module registry. Use relative imports.`);continue;
      }
      if (spec.startsWith('@/') || spec.startsWith('~/')) {
        errors.push(`${label}: path aliases require explicit boundary-checker support. Use relative imports for now.`);continue;
      }
      if (!spec.startsWith('.')) {
        errors.push(`${label}: unapproved external import '${spec}'; only @rpg/core/kernel is approved`);
        continue;
      }
      const target=path.resolve(path.dirname(file),spec);
      if (!isInside(src,target)) {
        errors.push(`${label}: relative import '${spec}' escapes L2 production src/`);continue;
      }
      const targetOwner=moduleFor(target,modulesRoot);
      if (targetOwner && targetOwner!==owner) {
        if (!owner && path.resolve(file)!==path.join(src,'index.ts') && path.resolve(file)!==path.join(src,'index.js')) {
          errors.push(`${label}: low-level/shared src cannot depend on gameplay module '${targetOwner}'`);continue;
        }
        if (owner && !modules.get(owner)?.dependencies?.includes(targetOwner)) {
          errors.push(`${label}: undeclared module dependency ${owner} -> ${targetOwner}`);continue;
        }
        const relativeToTarget=path.relative(path.join(modulesRoot,targetOwner),target).replaceAll(path.sep,'/');
        if (!/^(?:index(?:\.(?:[cm]?[jt]s|tsx))?)$/.test(relativeToTarget)) {
          errors.push(`${label}: cross-module import must target ${targetOwner}/index public entry, not '${spec}'`);
        }
      }
    }
  }
  const required=['AGENTS.md','ARCHITECTURE.md','docs/DECISIONS.md','docs/TASK_EXECUTION.md','docs/TESTING.md'];
  for(const rel of required) if(!fs.existsSync(path.join(root,rel))) errors.push(`Missing repo knowledge document: ${rel}`);
  return {errors, moduleCount:modules.size, sourceFileCount:walk(src).filter(x=>JS_SOURCE.test(x)&&!x.endsWith('.d.ts')).length};
}

const current=fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1])===current) {
  const result=inspect(path.resolve(path.dirname(current),'..'));
  for (const error of result.errors) console.error('BOUNDARY_FAIL:',error);
  if (result.errors.length) process.exitCode=1;
  else console.log(`HARNESS_BOUNDARIES_PASS modules=${result.moduleCount} source_files=${result.sourceFileCount} (static checks only)`);
}
