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
    clearReadyToBorrow: async (row) => {
      grid[row - 1] = [];
    },
    readPhotoReferences: async () => grid.flat(),
  };
  const ledger = new LendingLedger(adapter);
  const store = {
    upload: async () => ({ url: 'https://drive.google.com/file/d/photo-1/view' }),
    read: async (id) => id,
    trash: async () => true,
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

test('catalog creation saves all photo links with the row only after every upload succeeds', async () => {
  const { editor, grid, store } = fixture();
  const image = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'red' } })
    .jpeg()
    .toBuffer();
  const photo = `data:image/jpeg;base64,${image.toString('base64')}`;
  let uploads = 0;
  store.upload = async () => {
    assert.equal(grid.length, 1, 'No catalog entry may appear before all uploads succeed');
    const id = `photo-${++uploads}`;
    return { id, url: `https://drive.google.com/file/d/${id}/view` };
  };
  const saved = await editor.create({
    asset: 'ATOMIC',
    name: 'Laptop',
    photos: [photo, photo, photo],
  });
  assert.equal(uploads, 3);
  assert.equal(saved.photo.split('\n').length, 3);
  assert.equal(grid[1][4], saved.photo);
});

test('failed photo upload leaves no row and cleans earlier uploaded photos', async () => {
  const { editor, grid, store } = fixture();
  const image = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'red' } })
    .jpeg()
    .toBuffer();
  const photo = `data:image/jpeg;base64,${image.toString('base64')}`;
  let uploads = 0;
  const trashed = [];
  store.upload = async () => {
    if (++uploads === 2) throw new Error('Drive offline');
    return { id: 'photo-1', url: 'https://drive.google.com/file/d/photo-1/view' };
  };
  store.trash = async (id) => {
    trashed.push(id);
    return true;
  };
  await assert.rejects(
    editor.create({ asset: 'ATOMIC', name: 'Laptop', photos: [photo, photo] }),
    /Drive offline/,
  );
  assert.equal(grid.length, 1);
  assert.deepEqual(trashed, ['photo-1']);
});

test('failed Sheets save cleans photos, while a lost successful response preserves a complete entry', async () => {
  const { editor, grid, store } = fixture();
  const image = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'red' } })
    .jpeg()
    .toBuffer();
  const photo = `data:image/jpeg;base64,${image.toString('base64')}`;
  const trashed = [];
  store.upload = async () => ({
    id: 'new-photo',
    url: 'https://drive.google.com/file/d/new-photo/view',
  });
  store.trash = async (id) => {
    trashed.push(id);
    return true;
  };
  editor.adapter.appendReadyToBorrow = async () => {
    throw new Error('Sheets offline');
  };
  await assert.rejects(
    editor.create({ asset: 'ATOMIC', name: 'Laptop', photos: [photo] }),
    /Sheets offline/,
  );
  assert.equal(grid.length, 1);
  assert.deepEqual(trashed, ['new-photo']);
  trashed.length = 0;
  editor.adapter.appendReadyToBorrow = async (row) => {
    grid.push(row);
    throw new Error('Response lost');
  };
  const saved = await editor.create({ asset: 'ATOMIC', name: 'Laptop', photos: [photo] });
  assert.equal(saved.photo, 'https://drive.google.com/file/d/new-photo/view');
  assert.equal(grid.length, 2);
  assert.deepEqual(trashed, []);
});

test('failed cleanup is reported and uncertain Sheets writes never delete possibly referenced photos', async () => {
  const { editor, grid, store } = fixture();
  const image = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'red' } })
    .jpeg()
    .toBuffer();
  const photo = `data:image/jpeg;base64,${image.toString('base64')}`;
  store.upload = async () => ({
    id: 'new-photo',
    url: 'https://drive.google.com/file/d/new-photo/view',
  });
  const append = editor.adapter.appendReadyToBorrow;
  editor.adapter.appendReadyToBorrow = async () => {
    throw new Error('Sheets offline');
  };
  store.trash = async () => false;
  await assert.rejects(
    editor.create({ asset: 'A', name: 'Laptop', photos: [photo] }),
    /ล้างรูปใน Drive ไม่สำเร็จ/,
  );
  assert.equal(grid.length, 1);
  editor.adapter.appendReadyToBorrow = append;
  const read = editor.adapter.readReadyToBorrow;
  let reads = 0;
  editor.adapter.readReadyToBorrow = async () => {
    if (++reads > 1) throw new Error('Read unavailable');
    return read();
  };
  store.trash = () => assert.fail('Must preserve photos for an uncertain committed row');
  await assert.rejects(
    editor.create({ asset: 'A', name: 'Laptop', photos: [photo] }),
    /ยังยืนยันการบันทึกไม่ได้/,
  );
  assert.equal(grid.length, 2);
  assert.equal(grid[1][4], 'https://drive.google.com/file/d/new-photo/view');
});

test('creation validates every selected photo before uploading or appending', async () => {
  const { editor, grid, store } = fixture();
  store.upload = () => assert.fail('Must not upload invalid photos');
  for (const photos of [null, {}, ['bad'], Array(4).fill('bad')])
    assert.throws(() => editor.create({ asset: 'A', name: 'Laptop', photos }), { status: 400 });
  await assert.rejects(
    editor.create({ asset: 'A', name: 'Laptop', photos: ['data:image/jpeg;base64,YmFk'] }),
    { status: 400 },
  );
  assert.equal(grid.length, 1);
});

test('catalog deletion clears only the selected item, preserves shared photos and loan history', async () => {
  const { editor, grid, ledger, store } = fixture();
  const record = await editor.create({ asset: 'DELETE', serial: 'SN', name: 'Mouse' });
  await editor.create({ asset: 'KEEP', name: 'Keyboard' });
  record.photo = ['unique', 'shared']
    .map((id) => `https://drive.google.com/file/d/${id}/view`)
    .join('\n');
  grid[1][4] = record.photo;
  grid[2][4] = 'https://drive.google.com/file/d/shared/view';
  const trashed = [];
  store.trash = async (id) => {
    trashed.push(id);
    return true;
  };
  const result = await editor.remove(2, record);
  assert.equal(result.deleted, true);
  assert.equal(result.photosTrashed, 1);
  assert.equal(result.photosKept, 1);
  assert.deepEqual(trashed, ['unique']);
  assert.deepEqual(
    (await ledger.readAvailableAssets()).records.map((entry) => entry.asset),
    ['KEEP'],
  );
  assert.equal(grid.length, 3);
});

test('catalog deletion rejects stale, invalid, duplicate and borrowed items before touching Sheet or Drive', async () => {
  const { editor, grid, ledger, store } = fixture();
  const record = await editor.create({ asset: 'A', serial: 'SN', name: 'Mouse' });
  editor.adapter.clearReadyToBorrow = () => assert.fail('Must not clear Sheets');
  store.trash = () => assert.fail('Must not trash Drive');
  await assert.rejects(editor.remove(1, record), { status: 400 });
  await assert.rejects(editor.remove(2, { ...record, asset: 'wrong' }), { status: 409 });
  await assert.rejects(editor.remove(2, { ...record, name: 'stale' }), { status: 409 });
  grid.push([...grid[1]]);
  await assert.rejects(editor.remove(2, record), { status: 409 });
  grid.pop();
  const active = Array(20).fill('');
  active[7] = 'A';
  active[8] = 'SN';
  ledger.readLedger = async () => ({ active: [active] });
  await assert.rejects(editor.remove(2, record), /คำขอยืม|กำลังยืม/);
});

test('catalog deletion leaves Drive intact on Sheet failure and reports pending Drive cleanup after successful deletion', async () => {
  const { editor, grid, store } = fixture();
  const record = await editor.create({ asset: 'A', name: 'Mouse' });
  record.photo = 'https://drive.google.com/file/d/photo/view';
  grid[1][4] = record.photo;
  const clear = editor.adapter.clearReadyToBorrow;
  editor.adapter.clearReadyToBorrow = async () => {
    throw new Error('Sheets offline');
  };
  store.trash = () => assert.fail('Sheet failure must preserve photos');
  await assert.rejects(editor.remove(2, record), /Sheets offline/);
  editor.adapter.clearReadyToBorrow = clear;
  store.trash = async () => {
    throw new Error('Drive offline');
  };
  const result = await editor.remove(2, record);
  assert.equal(result.deleted, true);
  assert.equal(result.photosPending, 1);
  assert.equal(grid[1].length, 0);
});

test('catalog deletion never trashes a photo when Sheet deletion or reference checks cannot be confirmed', async () => {
  const { editor, grid, store } = fixture();
  const record = await editor.create({ asset: 'A', name: 'Mouse' });
  record.photo = 'https://drive.google.com/file/d/photo/view';
  grid[1][4] = record.photo;
  store.trash = () => assert.fail('Keep photos when checks are incomplete');
  const clear = editor.adapter.clearReadyToBorrow;
  editor.adapter.clearReadyToBorrow = async () => {};
  await assert.rejects(editor.remove(2, record), /ยืนยันการลบ/);
  editor.adapter.clearReadyToBorrow = clear;
  editor.adapter.readPhotoReferences = async () => {
    throw new Error('Cannot read all tabs');
  };
  const result = await editor.remove(2, record);
  assert.equal(result.deleted, true);
  assert.equal(result.photosPending, 1);
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
