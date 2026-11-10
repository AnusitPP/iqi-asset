import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { CatalogEditor, CATALOG_HEADERS } from '../../backend/src/features/catalog/service.js';
import { LendingLedger } from '../../backend/src/core/lending/ledger.js';
import { LOAN_HEADERS, RETURN_HEADERS } from '../../backend/src/core/lending/schema.js';
import { protectApi } from '../../backend/src/features/auth/middleware/protect-api.js';
import { permissionsForRole } from '../../shared/features/auth/permissions.js';

function fixture(headers = CATALOG_HEADERS) {
  const grid = [[...headers]];
  const adapter = {
    readReadyToBorrow: async () => structuredClone(grid),
    appendReadyToBorrow: async (row) => grid.push(row),
    addReadyToBorrowCategory: async (index) => {
      grid[0][index] = 'หมวดหมู่';
    },
    writeReadyToBorrowPhoto: async (row, names, url, at) => {
      grid[row - 1][names.indexOf('รูป (ลิงก์)')] = url;
      grid[row - 1][names.indexOf('วันที่อัปเดตล่าสุด')] = at;
    },
    readLoanSheets: async () => ({ loans: [LOAN_HEADERS], returns: [RETURN_HEADERS] }),
  };
  const ledger = new LendingLedger(adapter);
  const store = {
    upload: async () => ({ url: 'https://drive.google.com/file/d/photo-1/view' }),
    read: async (id) => id,
  };
  return { grid, ledger, store, editor: new CatalogEditor(ledger, store) };
}
test('catalog creation maps reordered sheet headers, preserves literal input and is ready to borrow', async () => {
  const { editor, grid, ledger } = fixture([...CATALOG_HEADERS].reverse());
  const record = await editor.create({ asset: ' A-1 ', serial: 'SN1', name: '=Mouse' });
  assert.equal(record.asset, 'A-1');
  assert.equal(grid[1][2], '=Mouse');
  assert.ok(grid[1][1]);
  assert.deepEqual((await ledger.readAvailableAssets()).records, [record]);
  await assert.rejects(editor.create({ asset: 'A-1', serial: 'SN1', name: 'Other' }), {
    status: 409,
  });
});
test('catalog rejects missing fields and unexpected sheet schema before writing', async () => {
  const { editor, grid } = fixture();
  assert.throws(() => editor.create({ asset: '', name: 'Mouse' }), { status: 400 });
  grid[0][4] = 'bad';
  await assert.rejects(editor.create({ asset: 'A', name: 'Mouse' }), { status: 422 });
  assert.equal(grid.length, 1);
});

test('chosen category is persisted and used for borrowing even when the equipment name suggests another category', async () => {
  const { editor, ledger, grid } = fixture();
  const category = 'USB WI-FI';
  const record = await editor.create({ asset: 'CATEGORY', name: 'Mouse', category });
  assert.equal(grid[0][5], 'หมวดหมู่');
  assert.equal(grid[1][5], category);
  assert.equal(record.category, category);
  assert.equal((await ledger.readAvailableAssets()).records[0].category, category);
  const request = {};
  await ledger.resolveCatalogSelection(
    { selectedAsset: { asset: 'CATEGORY', serial: '' } },
    request,
  );
  assert.equal(request.category, category);
  assert.throws(() => editor.create({ asset: 'BAD', name: 'Mouse', category: 'invalid' }), {
    status: 400,
  });
  assert.equal(grid.length, 2);
});
test('catalog photo validates identity, writes link, reads only registered photos and preserves recovery link', async () => {
  const { editor, store } = fixture();
  await editor.create({ asset: 'A', serial: '', name: 'Mouse' });
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } })
    .png()
    .toBuffer();
  await assert.rejects(editor.upload(2, '["wrong",""]', bytes), { status: 409 });
  await assert.rejects(editor.upload(2, '["A",""]', Buffer.from('bad')), { status: 400 });
  await editor.upload(2, '["A",""]', bytes);
  assert.equal(await editor.readPhoto('photo-1'), 'photo-1');
  await assert.rejects(editor.readPhoto('secret-file'), { status: 404 });
  const fresh = fixture();
  await fresh.editor.create({ asset: 'B', name: 'Mouse' });
  fresh.editor.adapter.writeReadyToBorrowPhoto = async () => {
    throw new Error('offline');
  };
  await assert.rejects(
    fresh.editor.upload(2, '["B",""]', bytes),
    /https:\/\/drive.google.com\/file\/d\/photo-1/,
  );
  store.read = async () => {
    throw new Error('unused');
  };
});
test('catalog writes require ADMIN or SUPER_ADMIN while STAFF can read catalog photos', () => {
  for (const role of ['STAFF', 'ADMIN', 'SUPER_ADMIN']) {
    for (const path of [
      '/api/loan-catalog',
      '/api/loan-catalog/2/photos',
      '/api/loan-catalog/preview',
    ]) {
      let allowed = false,
        status;
      const res = {
        status(value) {
          status = value;
          return this;
        },
        json() {},
      };
      protectApi(
        { user: { permissions: permissionsForRole(role) }, method: 'POST', originalUrl: path },
        res,
        () => {
          allowed = true;
        },
      );
      assert.equal(allowed, role !== 'STAFF');
      if (!allowed) assert.equal(status, 403);
    }
    let allowed = false;
    protectApi(
      {
        user: { permissions: permissionsForRole(role) },
        method: 'GET',
        originalUrl: '/api/catalog-photos/photo-1',
      },
      {},
      () => {
        allowed = true;
      },
    );
    assert.equal(allowed, true);
  }
});

test('catalog appends three image links in the existing sheet cell, authorizes every image and rejects a fourth', async () => {
  const { editor, grid, store } = fixture();
  let uploaded = 0;
  store.upload = async () => ({ url: `https://drive.google.com/file/d/image-${++uploaded}/view` });
  await editor.create({ asset: 'ครุภัณฑ์-1', name: 'Mouse' });
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } })
    .png()
    .toBuffer();
  const identity = encodeURIComponent(JSON.stringify(['ครุภัณฑ์-1', '']));
  for (let n = 1; n <= 3; n++) {
    await editor.upload(2, identity, bytes);
    assert.equal(await editor.readPhoto(`image-${n}`), `image-${n}`);
  }
  assert.equal(grid[1][4].split('\n').length, 3);
  await assert.rejects(editor.upload(2, identity, bytes), { status: 409 });
  assert.equal(uploaded, 3);
});
