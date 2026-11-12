import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { CATALOG_HEADERS } from '../../backend/src/features/catalog/service.js';
import { LOAN_HEADERS, RETURN_HEADERS } from '../../backend/src/core/lending/schema.js';
import { PhotoStore } from '../../backend/src/integrations/google/photoStorage.js';
import { testSession } from '../helpers/session.js';

test('catalog deletion requires admin and CSRF, clears Sheet before trashing only unshared photos', async (t) => {
  const photo = (id) => `https://drive.google.com/file/d/${id}/view`;
  const grid = [
    [...CATALOG_HEADERS],
    ['A', 'SN', 'Mouse', 'today', `${photo('unique')}\n${photo('shared')}`],
  ];
  let clears = 0;
  const trashed = [];
  const adapter = {
    readReadyToBorrow: async () => structuredClone(grid),
    readLoanSheets: async () => ({ loans: [LOAN_HEADERS], returns: [RETURN_HEADERS] }),
    clearReadyToBorrow: async (row) => {
      clears++;
      grid[row - 1] = [];
    },
    readPhotoReferences: async () => [`=IMAGE("${photo('shared')}")`],
  };
  t.mock.method(PhotoStore.prototype, 'trash', async (id) => {
    assert.equal(clears, 1);
    trashed.push(id);
    return true;
  });
  const auth = await testSession({ host: '127.0.0.1' });
  const staff = await auth.sessions.login({
    sub: 'staff',
    email: 'staff@example.invalid',
    name: 'Staff',
  });
  const admin = await auth.sessions.login({
    sub: 'admin',
    email: 'admin@example.invalid',
    name: 'Admin',
  });
  const adminUser = auth.storage.tables.Users.find((user) => user.google_sub === 'admin');
  await auth.storage.write([
    {
      table: 'Admins',
      values: {
        id: 'admin-grant',
        user_id: adminUser.id,
        email: adminUser.email,
        role: 'ADMIN',
        status: 'ACTIVE',
        assigned_by: 'TEST',
      },
    },
  ]);
  const server = createApp({ adapter }, auth.config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const { csrf } = await fetch(base + '/api/auth/session').then((res) => res.json());
  const body = { asset: 'A', serial: 'SN', name: 'Mouse', photo: grid[1][4] };
  const remove = (cookie, token, value = body) =>
    fetch(base + '/api/loan-catalog/2', {
      method: 'DELETE',
      headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-IQI-Request': token },
      body: JSON.stringify(value),
    });
  assert.equal((await remove(auth.cookie, '')).status, 403);
  assert.equal((await remove('', csrf)).status, 401);
  assert.equal((await remove(`iqi_session=${staff}`, csrf)).status, 403);
  assert.equal((await remove(auth.cookie, csrf, { ...body, serial: 'wrong' })).status, 409);
  assert.equal(clears, 0);
  assert.deepEqual(trashed, []);
  const result = await remove(`iqi_session=${admin}`, csrf);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), {
    deleted: true,
    photosTrashed: 1,
    photosKept: 1,
    photosPending: 0,
  });
  assert.deepEqual(trashed, ['unique']);
  assert.equal((await remove(auth.cookie, csrf)).status, 409);
  assert.equal(clears, 1);
});
