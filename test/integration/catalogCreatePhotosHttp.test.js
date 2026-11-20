import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createApp } from '../../backend/src/http/app.js';
import { CATALOG_HEADERS } from '../../backend/src/features/catalog/service.js';
import { PhotoStore } from '../../backend/src/integrations/google/photoStorage.js';
import { testSession } from '../helpers/session.js';

test('HTTP creation accepts a complete photo batch above 2 MB and publishes no row on upload failure', async (t) => {
  const fixture = await testSession({ host: '127.0.0.1' });
  const grid = [[...CATALOG_HEADERS, 'หมวดหมู่']];
  let uploads = 0;
  let failAt = 0;
  const trashed = [];
  t.mock.method(PhotoStore.prototype, 'upload', async () => {
    uploads++;
    if (uploads === failAt)
      throw Object.assign(new Error('อัปโหลดเข้า Drive ไม่สำเร็จ'), { status: 422 });
    assert.equal(grid.length, 1);
    return { id: `p-${uploads}`, url: `https://drive.google.com/file/d/p-${uploads}/view` };
  });
  t.mock.method(PhotoStore.prototype, 'trash', async (id) => {
    trashed.push(id);
    return true;
  });
  const adapter = {
    readReadyToBorrow: async () => structuredClone(grid),
    appendReadyToBorrow: async (row) => {
      assert.equal(uploads, 3);
      grid.push(row);
    },
  };
  const server = createApp({ adapter }, fixture.config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const { csrf } = await fetch(base + '/api/auth/session').then((res) => res.json());
  const jpeg = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'red' } })
    .jpeg()
    .toBuffer();
  // JPEG decoders ignore trailing bytes; padding exercises the transport limit.
  const large = Buffer.concat([jpeg, Buffer.alloc(650 * 1024)]);
  const photo = `data:image/jpeg;base64,${large.toString('base64')}`;
  const body = JSON.stringify({ asset: 'A1', name: 'Laptop', photos: [photo, photo, photo] });
  assert.ok(Buffer.byteLength(body) > 2 * 1024 * 1024);
  const post = () =>
    fetch(base + '/api/loan-catalog', {
      method: 'POST',
      headers: {
        Cookie: fixture.cookie,
        'X-IQI-Request': csrf,
        'Content-Type': 'application/json',
      },
      body,
    });
  failAt = 2;
  assert.equal((await post()).status, 422);
  assert.equal(grid.length, 1);
  assert.deepEqual(trashed, ['p-1']);
  failAt = 0;
  uploads = 0;
  const response = await post();
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.equal(saved.photo.split('\n').length, 3);
  assert.equal(grid[1][4], saved.photo);
});
