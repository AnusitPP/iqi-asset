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
test('runtime and maintenance imports resolve after feature reorganization', async () => {
  const files = (
    await Promise.all(
      [
        'backend/src',
        'backend/scripts',
        'frontend/public/js',
        'shared',
        'scripts',
        'api',
        'test',
      ].map((dir) => javascriptFiles(path.join(root, dir))),
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
test('frontend entrypoint composes features instead of defining editors', async () => {
  const source = await readFile(path.join(root, 'frontend/public/js/app.js'), 'utf8');
  assert(source.split('\n').length < 100);
  assert(!source.includes('createElement('));
  assert(!source.includes('fetch('));
});
