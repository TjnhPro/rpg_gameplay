import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {run} from './subprocess.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
// Fixed generated target inside this repository; no caller-supplied delete path.
if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) {
  throw new Error('Refusing to clean a linked dist directory');
}
fs.rmSync(output, {recursive: true, force: true});
run(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], root);
