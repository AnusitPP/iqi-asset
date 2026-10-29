import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { driveOAuth } from '../../backend/src/integrations/google/driveAuth.js';
import { PhotoStore } from '../../backend/src/integrations/google/photoStorage.js';

test('asset folders reuse exact names within the configured root and share concurrent creation', async () => {
  const store = new PhotoStore({ photoFolderId: 'root' });
  let created = 0;
  store.drive.files.list = async (request) => {
    assert.match(request.q, /'root' in parents/);
    assert.match(request.q, /trashed = false/);
    return { data: { files: [] } };
  };
  store.drive.files.create = async (request) => {
    created++;
    assert.deepEqual(request.requestBody, {
      name: 'IQ67-01-125',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
    });
    return { data: { id: 'asset-folder' } };
  };
  assert.deepEqual(
    await Promise.all([store.assetFolder('IQ67-01-125'), store.assetFolder('IQ67-01-125')]),
    ['asset-folder', 'asset-folder'],
  );
  assert.equal(created, 1);
  store.drive.files.list = async () => ({ data: { files: [{ id: 'existing' }] } });
  assert.equal(await store.assetFolder('IQ67-01-125'), 'existing');
  assert.equal(created, 1);
  store.drive.files.list = async () => ({ data: { files: [{ id: 'a' }, { id: 'b' }] } });
  await assert.rejects(store.assetFolder('IQ67-01-125'), /ซ้ำ/);
});

test('upload places image inside the asset folder without changing default sharing', async () => {
  const store = new PhotoStore({ photoFolderId: 'root' });
  store.userAuth = true;
  store.drive.files.get = async () => ({ data: { capabilities: { canAddChildren: true } } });
  store.assetFolder = async (asset) => {
    assert.equal(asset, 'IQ67-01-125');
    return 'asset-folder';
  };
  store.drive.files.create = async (request) => {
    assert.deepEqual(request.requestBody.parents, ['asset-folder']);
    return { data: { id: 'image' } };
  };
  store.drive.permissions.create = () => assert.fail('No new public permission');
  const photo = await store.upload(Buffer.from('image'), 'test.jpg', 'IQ67-01-125');
  assert.equal(photo.url, 'https://drive.google.com/file/d/image/view');
});

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
