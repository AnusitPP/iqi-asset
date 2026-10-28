import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { preparePhoto, DashboardPhotos } from '../../backend/src/services/photos.js';
import { dashboardData, DashboardEditor } from '../../backend/src/services/dashboard.js';
import { GoogleSheets } from '../../backend/src/integrations/google/googleSheets.js';
test('photos are resized, oriented, converted to JPEG and stripped of location metadata', async () => {
  const input = await sharp({
    create: { width: 2400, height: 1200, channels: 3, background: 'red' },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const out = await preparePhoto(input),
    m = await sharp(out).metadata();
  assert.equal(m.format, 'jpeg');
  assert.equal(m.width, 800);
  assert.equal(m.height, 1600);
  assert.equal(m.exif, undefined);
  assert.ok(out.length < input.length);
  await assert.rejects(preparePhoto(Buffer.from('not an image')), /อ่านรูป/);
  await assert.rejects(preparePhoto(Buffer.alloc(26 * 1024 * 1024)), /25 MB/);
});

test('combined photo slots preserve legacy photos, deduplicate and reject a fourth before Drive upload', async () => {
  const url = (id) => 'https://drive.google.com/file/d/' + id + '/view';
  const grid = [
    [
      'ผลตรวจ Apps Script',
      'สถานะการเทียบ',
      'เลขครุภัณฑ์ Apps Script',
      'ลิงก์รูปครุภัณฑ์',
      'รูป1',
      'รูป2',
      'รูป3',
    ],
    ['ดี', 'ตรงกัน', '001', url('old'), url('old'), '', ''],
  ];
  const adapter = {
    readDashboard: async () => structuredClone(grid),
    writeDashboardPhotoSlots: async (row, urls) => {
      grid[row - 1].splice(4, 3, ...urls);
    },
  };
  let count = 0;
  const store = {
    upload: async () => {
      const id = 'new-' + ++count;
      return { id, url: url(id) };
    },
    read: async (id) => id,
  };
  const service = new DashboardPhotos(adapter, store, new DashboardEditor(adapter));
  const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } })
    .png()
    .toBuffer();
  const rev = () => dashboardData(grid).records[0].revision;
  await assert.rejects(service.upload(2, 'stale', image), /เปลี่ยน/);
  const stale = rev();
  const first = await service.upload(2, rev(), image);
  assert.ok(first.revision);
  await assert.rejects(service.upload(2, stale, image), /เปลี่ยน/);
  await service.upload(2, first.revision, image);
  assert.deepEqual(grid[1].slice(4), [url('old'), url('new-1'), url('new-2')]);
  assert.equal(grid[1][3], url('old'));
  assert.equal(grid[1][0], 'ดี');
  await assert.rejects(service.upload(2, rev(), image), /3 รูป/);
  assert.equal(count, 2);
  assert.equal(await service.read(2, 'new-1'), 'new-1');
  assert.equal(await service.read(2, 'old'), 'old');
  await assert.rejects(service.read(2, 'unrelated'), /ไม่พบ/);
});
test('Sheets slots write URLs into exactly รูป1 รูป2 รูป3 without modifying archives', async () => {
  const adapter = new GoogleSheets({ spreadsheetId: 'test' });
  adapter.readDashboard = async () => [
    ['ลิงก์รูปครุภัณฑ์', 'วันที่อัปโหลดรูป', 'รูปครุภัณฑ์', 'รูป1', 'รูป2', 'รูป3'],
  ];
  let requests;
  adapter.api = {
    spreadsheets: {
      get: async () => ({
        data: {
          sheets: [
            {
              properties: {
                title: 'Appscriptdata',
                sheetId: 1,
                gridProperties: { columnCount: 6 },
              },
            },
          ],
        },
      }),
      batchUpdate: async (body) => {
        requests = body.requestBody.requests;
      },
    },
  };
  await adapter.writeDashboardPhotoSlots(2, ['a', 'b', 'c'], 'today');
  const writes = requests.filter((r) => r.updateCells).map((r) => r.updateCells);
  assert.deepEqual(
    writes.map((w) => w.range.startColumnIndex),
    [3, 4, 5, 1],
  );
  assert.deepEqual(
    writes.map((w) => w.rows[0].values[0].userEnteredValue.stringValue),
    ['a', 'b', 'c', 'today'],
  );
  assert.ok(writes.every((w) => w.range.startRowIndex === 1));
  await assert.rejects(adapter.writeDashboardPhotoSlots(2, ['a', 'b', 'c', 'd'], 'today'), /3/);
});
