import test from 'node:test';
import assert from 'node:assert/strict';
import { pordDrivePhotos } from '../../backend/src/features/porddatabase/drive-photos.js';

test('matches exact asset folders and filenames, follows nested folders and pagination, and skips ambiguous images', async () => {
  const requests = [];
  const folder = (id, name, parent) => ({
    id,
    name,
    parents: [parent],
    mimeType: 'application/vnd.google-apps.folder',
  });
  const image = (id, name, parent) => ({ id, name, parents: [parent], mimeType: 'image/jpeg' });
  const store = {
    folder: 'root',
    drive: {
      files: {
        list: async (request) => {
          requests.push(request);
          assert.match(request.q, /trashed = false/);
          if (request.q.includes("'root'")) {
            if (request.pageToken)
              return {
                data: {
                  files: [
                    image('named', 'STEP61-107-041_photo1.jpg', 'root'),
                    image('prefix', 'STEP61-107-0411.jpg', 'root'),
                    image('unknown', 'IMG123.jpg', 'root'),
                  ],
                },
              };
            return {
              data: {
                files: [
                  folder('asset', ' STeP61-107-041 ', 'root'),
                  folder('other', 'misc', 'root'),
                ],
                nextPageToken: 'page2',
              },
            };
          }
          if (request.q.includes("'asset'"))
            return {
              data: {
                files: [
                  image('photo', 'catalog_123.jpg', 'asset'),
                  image('conflict', 'STEP61-107-042_photo1.jpg', 'asset'),
                  folder('nested', 'more', 'asset'),
                  { id: 'doc', name: 'manual', parents: ['asset'], mimeType: 'application/pdf' },
                ],
              },
            };
          return { data: { files: [image('nested-photo', 'รูป2.jpg', 'nested')] } };
        },
      },
    },
  };
  const result = await pordDrivePhotos(store, ['STEP61-107-041', 'STEP61-107-042']);
  assert.deepEqual(
    new Set(result.get('STEP61-107-041').split('\n')),
    new Set([
      'https://drive.google.com/file/d/named/view',
      'https://drive.google.com/file/d/photo/view',
      'https://drive.google.com/file/d/nested-photo/view',
    ]),
  );
  assert.equal(result.has('STEP61-107-042'), false);
  assert.ok(requests.some((r) => r.pageToken === 'page2'));
});

test('propagates Drive failures instead of presenting a failed scan as no photos', async () => {
  await assert.rejects(
    pordDrivePhotos(
      {
        folder: 'root',
        drive: {
          files: {
            list: async () => {
              throw new Error('Drive unavailable');
            },
          },
        },
      },
      ['A1'],
    ),
    /Drive unavailable/,
  );
});
