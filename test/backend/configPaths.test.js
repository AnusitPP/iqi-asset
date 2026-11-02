import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { resolveProjectFile } from '../../backend/src/core/config/paths.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
test('credential paths resolve from the same root for Express and Next workspaces', () => {
  for (const cwd of [root, path.join(root, 'frontend'), path.join(root, 'frontend', '.next')]) {
    assert.equal(
      resolveProjectFile('./credentials/oauth.json', cwd),
      path.join(root, 'credentials', 'oauth.json'),
    );
    assert.equal(resolveProjectFile('', cwd), '');
    const absolute = path.join(root, 'fixture-absolute.json');
    assert.equal(resolveProjectFile(absolute, cwd), absolute);
  }
});
test('loadConfig in the frontend process resolves both credential files from the repository root', () => {
  const moduleUrl = new URL('../../backend/src/core/config/loadConfig.js', import.meta.url).href;
  const script = `
    import { loadConfig } from ${JSON.stringify(moduleUrl)};
    const config = loadConfig({ GOOGLE_DRIVE_OAUTH_FILE: './credentials/fixture-oauth.json', GOOGLE_SERVICE_ACCOUNT_FILE: './credentials/fixture-account.json' });
    console.log(JSON.stringify({ drive: config.driveOAuthFile, account: config.keyFile }));
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: path.join(root, 'frontend'),
    encoding: 'utf8',
  });
  assert.deepEqual(JSON.parse(output), {
    drive: path.join(root, 'credentials', 'fixture-oauth.json'),
    account: path.join(root, 'credentials', 'fixture-account.json'),
  });
});
