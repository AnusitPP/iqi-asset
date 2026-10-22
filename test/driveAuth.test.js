import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { driveOAuth } from '../src/driveAuth.js';
import { PhotoStore } from '../src/photos.js';

test('downloaded desktop client requires consent before upload; saved tokens authenticate', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-auth-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'oauth.json');
  const client = { client_id: 'test-client', client_secret: 'test-secret' };
  fs.writeFileSync(file, JSON.stringify({ installed: client }));
  assert.equal(driveOAuth(file).connected, false);
  const store = new PhotoStore({ driveOAuthFile: file });
  store.drive.files.get = () => assert.fail('Must not contact Google before consent');
  await assert.rejects(store.upload(Buffer.from('image'), 'test.jpg'), /npm run drive:connect/);
  fs.writeFileSync(file, JSON.stringify({ ...client, refresh_token: 'test-token' }));
  const connection = driveOAuth(file);
  assert.equal(connection.connected, true);
  assert.equal(connection.auth.credentials.refresh_token, 'test-token');
});

test('OAuth folder permission errors refer to the connected user', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-auth-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'oauth.json');
  fs.writeFileSync(
    file,
    JSON.stringify({ client_id: 'id', client_secret: 'secret', refresh_token: 'token' }),
  );
  const store = new PhotoStore({ driveOAuthFile: file });
  store.drive.files.get = async () => ({ data: { capabilities: { canAddChildren: false } } });
  await assert.rejects(store.upload(Buffer.from('image'), 'test.jpg'), /บัญชี Google/);
  store.drive.files.get = async () => {
    throw new Error('invalid_grant');
  };
  await assert.rejects(store.upload(Buffer.from('image'), 'test.jpg'), /หมดอายุหรือถูกยกเลิก/);
});
