import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createApp } from '../../backend/src/http/app.js';
import { PhotoStore } from '../../backend/src/integrations/google/photoStorage.js';
import { testSession } from '../helpers/session.js';

test('Chat images are anonymous JPEGs only for publicly shared catalog files', async (t) => {
  const fixture = await testSession({ host: '127.0.0.1' });
  const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'blue' } })
    .png()
    .toBuffer();
  let isPublic = true;
  let reads = 0;
  t.mock.method(PhotoStore.prototype, 'isPublic', async () => isPublic);
  t.mock.method(PhotoStore.prototype, 'read', async () => {
    reads++;
    return bytes;
  });
  const adapter = {
    readReadyToBorrow: async () => [
      ['เลขครุภัณฑ์', 'S/N', 'ชื่ออุปกรณ์', 'รูป (ลิงก์)'],
      ['A1', 'S1', 'Laptop', 'https://drive.google.com/file/d/catalog-photo/view'],
    ],
  };
  const server = createApp({ adapter }, fixture.config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const r = await fetch(base + '/api/chat-photos/catalog-photo');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /image\/jpeg/);
  assert.equal((await sharp(Buffer.from(await r.arrayBuffer())).metadata()).format, 'jpeg');
  assert.equal(reads, 1);
  isPublic = false;
  assert.equal((await fetch(base + '/api/chat-photos/catalog-photo')).status, 404);
  assert.equal(reads, 1);
  isPublic = true;
  assert.equal((await fetch(base + '/api/chat-photos/not-in-catalog')).status, 404);
  assert.equal(reads, 1);
  assert.equal((await fetch(base + '/api/catalog-photos/catalog-photo')).status, 401);
});
