import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
// npm adds ancestor node_modules/.bin directories to PATH. Prefer its own Node
// executable so a stray ancestor `node` package cannot silently change runtime.
const executable = process.env.npm_node_execpath || process.execPath;
const entry = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
const result = spawnSync(executable, [entry, 'run', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
  cwd: fileURLToPath(new URL('..', import.meta.url)),
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
