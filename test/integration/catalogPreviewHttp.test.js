import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createApp } from '../../backend/src/http/app.js';
import { PhotoStore } from '../../backend/src/integrations/google/photoStorage.js';
import { testSession } from '../helpers/session.js';

test('catalog preview validates and converts photos before save without writing Sheets or Drive', async (t) => {
  t.mock.method(PhotoStore.prototype, 'upload', () => {
    assert.fail('preview must not upload to Drive');
  });
  const adapter = {
    readReadyToBorrow: () => {
      assert.fail('preview must not access Sheets');
    },
  };
  const fixture = await testSession({ host: '127.0.0.1' });
  const server = createApp({ adapter }, fixture.config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const { csrf } = await fetch(base + '/api/auth/session').then((response) => response.json());
  const headers = {
    Cookie: fixture.cookie,
    'Content-Type': 'application/octet-stream',
    'X-IQI-Request': csrf,
  };
  const image = await sharp({ create: { width: 4, height: 3, channels: 3, background: 'red' } })
    .png()
    .toBuffer();
  const response = await fetch(base + '/api/loan-catalog/preview', {
    method: 'POST',
    headers,
    body: image,
  });
  assert.equal(response.status, 200);
  const { preview } = await response.json();
  assert.ok(preview.startsWith('data:image/jpeg;base64,'));
  const metadata = await sharp(Buffer.from(preview.split(',')[1], 'base64')).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.width, 4);
  assert.equal(
    (
      await fetch(base + '/api/loan-catalog/preview', {
        method: 'POST',
        headers,
        body: 'bad image',
      })
    ).status,
    400,
  );
});
