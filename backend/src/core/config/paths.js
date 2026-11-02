import fs from 'node:fs';
import path from 'node:path';

// Express starts at the repository root; Next starts in the frontend workspace.
// Walk from cwd instead of import.meta.url, which points at a chunk when bundled.
export function resolveProjectFile(file, cwd = process.cwd()) {
  if (!file) return '';
  if (path.isAbsolute(file)) return file;
  let directory = cwd;
  while (true) {
    if (
      fs.existsSync(path.join(directory, 'backend', 'src')) &&
      fs.existsSync(path.join(directory, 'shared'))
    )
      return path.resolve(directory, file);
    const parent = path.dirname(directory);
    if (parent === directory) return path.resolve(cwd, file);
    directory = parent;
  }
}
