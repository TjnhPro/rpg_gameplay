import {spawnSync} from 'node:child_process';

export function run(command, args, cwd, capture = false) {
  const result = spawnSync(command, args, {
    cwd, shell: false, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8'
  });
  if (result.error || result.status !== 0) {
    if (capture) {
      if (result.stdout) process.stderr.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    console.error(`COMMAND_FAIL: ${command} ${args.join(' ')}`);
    if (result.error) console.error(result.error.message);
    if (result.signal) console.error(`Terminated by signal: ${result.signal}`);
    // Throw so callers' finally blocks clean temporary workspaces on failure.
    throw new Error(`Command failed (exit ${result.status ?? 'unavailable'})`);
  }
  return result.stdout;
}

export function npmCli() {
  if (!process.env.npm_execpath) throw new Error('Run this command through npm run.');
  return process.env.npm_execpath;
}
