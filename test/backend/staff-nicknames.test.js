import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStaffNicknameReader,
  staffNicknameIndex,
  borrowerNickname,
} from '../../backend/src/features/loans/staff-nicknames.js';
import { registerLoansRoutes } from '../../backend/src/features/loans/routes.js';

test('matches names across tabs with column E nicknames and paired English rows', () => {
  const index = staffNicknameIndex([
    {
      values: [
        ['นางสาวธนสา คำเขียว', 'TNS', 'มายด์'],
        ['Thanasa khamkhiaw'],
        ['Other Person', '', 'Other'],
        [],
        ['Unrelated Person'],
        ['Same Name', '', 'One'],
      ],
    },
    {
      values: [
        ['Same Name', '', 'Two'],
        ['Third Person', '', 'Three'],
      ],
    },
    {
      values: [
        ['Same Name', '', 'One'],
        ['Fourth Person', '', 'Four'],
      ],
    },
  ]);
  assert.equal(borrowerNickname(index, ' THANASA   khamkhiaw '), 'มายด์');
  assert.equal(borrowerNickname(index, 'นางสาวธนสา คำเขียว'), 'มายด์');
  assert.equal(borrowerNickname(index, 'Third Person'), 'Three');
  assert.equal(borrowerNickname(index, 'Fourth Person'), 'Four');
  assert.equal(borrowerNickname(index, 'Same Name'), '');
  assert.equal(borrowerNickname(index, 'Unrelated Person'), '');
  assert.equal(borrowerNickname(index, 'Missing Person'), '');
  assert.equal(borrowerNickname(index, 'Thanasa'), '');
});

test('directory reads are shared, cached and recover after a Sheets failure', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 0 });
  let calls = 0;
  const adapter = {
    api: {
      spreadsheets: {
        get: async () => ({
          data: {
            sheets: [
              { properties: { title: 'First' } },
              { properties: { title: 'Second' } },
              { properties: { title: "New ' Tab" } },
            ],
          },
        }),
        values: {
          batchGet: async ({ spreadsheetId, ranges }) => {
            calls++;
            assert.equal(spreadsheetId, 'staff');
            assert.equal(ranges.length, 3);
            assert.equal(ranges[2], "'New '' Tab'!C:E");
            if (calls === 2) throw new Error('Unavailable');
            return {
              data: {
                valueRanges: [{ values: [['Full Name', '', 'Nick', '', 'staff@example.com']] }],
              },
            };
          },
        },
      },
    },
  };
  t.mock.method(console, 'error', () => {});
  const read = createStaffNicknameReader(adapter, 'staff');
  const results = await Promise.all([read(), read()]);
  assert.equal(calls, 1);
  assert.equal(borrowerNickname(results[0], 'Full Name'), 'Nick');
  t.mock.timers.tick(300_001);
  assert.equal((await read()).size, 0);
  assert.equal(calls, 2);
  t.mock.timers.tick(30_001);
  assert.equal(borrowerNickname(await read(), 'Full Name'), 'Nick');
  assert.equal((await createStaffNicknameReader({}, '')()).size, 0);
});

test('approval and my-request responses enrich loans and returns using the displayed borrower name', async () => {
  const routes = new Map();
  let reads = 0;
  const loan = ['loan', 'item', '', 'Full Name'];
  const returned = ['return', 'loan', 'item', '', 'Full Name'];
  registerLoansRoutes(
    { get: (path, handler) => routes.set(path, handler), post() {}, patch() {} },
    {
      lendingLedger: {
        readLedger: async () => ({
          loans: [loan],
          returns: [returned],
          loanEmails: new Map([['item', 'staff@example.com']]),
        }),
      },
      readStaffNicknames: async () => {
        reads++;
        return staffNicknameIndex([
          { values: [['Full Name', '', 'Nick', '', 'staff@example.com']] },
        ]);
      },
    },
  );
  for (const admin of [true, false]) {
    let result;
    await routes.get(admin ? '/api/approval-requests' : '/api/my-requests')(
      {
        originalUrl: admin ? '/api/approval-requests' : '/api/my-requests',
        user: { id: 'user', role: admin ? 'ADMIN' : 'STAFF', email: 'staff@example.com' },
        authStorage: { read: async () => ({ AuditLogs: [] }) },
      },
      {
        set() {},
        json(value) {
          result = value;
        },
      },
    );
    assert.equal(result.records.length, 2);
    assert.ok(
      result.records.every(
        (record) =>
          record.borrower === 'Full Name' && record.borrowerNickname === 'Nick',
      ),
    );
  }
  assert.equal(reads, 2);
  loan[3] = 'Actual Borrower';
  returned[4] = 'Actual Borrower';
  let mismatched;
  await routes.get('/api/approval-requests')(
    {
      originalUrl: '/api/approval-requests',
      user: { id: 'operator', role: 'ADMIN', email: 'staff@example.com' },
      authStorage: { read: async () => ({ AuditLogs: [] }) },
    },
    {
      set() {},
      json(value) {
        mismatched = value;
      },
    },
  );
  assert.ok(mismatched.records.every((record) => record.borrowerNickname === ''));
});
