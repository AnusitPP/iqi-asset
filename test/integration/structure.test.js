import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
async function javascriptFiles(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? javascriptFiles(path.join(folder, entry.name))
          : /\.[mc]?js$/.test(entry.name)
            ? [path.join(folder, entry.name)]
            : [],
      ),
    )
  ).flat();
}
test('maintained backend, shared and test imports resolve after feature reorganization', async () => {
  // Root scripts/ is gitignored personal tooling; maintained scripts live in backend/scripts.
  // Next.js TypeScript imports are checked by typecheck:web and the production build.
  const files = (
    await Promise.all(
      ['backend/src', 'backend/scripts', 'shared', 'api', 'test'].map((dir) =>
        javascriptFiles(path.join(root, dir)),
      ),
    )
  ).flat();
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(
      /\b(?:from\s*|import\s*\(\s*|import\s*)(['"])([^'"\n]+)\1/g,
    )) {
      const specifier = match[2];
      let target;
      if (specifier.startsWith('.')) target = path.resolve(path.dirname(file), specifier);
      else if (specifier.startsWith('/shared/')) target = path.join(root, specifier.slice(1));
      if (target)
        await assert.doesNotReject(access(target), `${path.relative(root, file)}: ${specifier}`);
    }
  }
});
