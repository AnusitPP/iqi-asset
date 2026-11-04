import test from 'node:test';
import assert from 'node:assert/strict';
import { registerLoansRoutes } from '../../backend/src/features/loans/routes.js';

test('my requests returns only the authenticated creator and disables caching', async () => {
  const routes = new Map();
  const row = (id) => { const value = []; value[0] = id; return value; };
  registerLoansRoutes({ get: (path, handler) => routes.set(path, handler), post() {}, patch() {} }, {
    lendingLedger: { readLedger: async () => ({ loans: [row('loan-a'), row('loan-b')], returns: [] }) },
  });
  for (const id of ['a', 'b']) {
    let result;
    const headers = {};
    await routes.get('/api/my-requests')({ user: { id }, authStorage: { read: async () => ({ AuditLogs: ['a', 'b'].map((user) => ({ actor_user_id: user, action: 'LOAN_CREATED', entity_id: `loan-${user}` })) }) } }, {
      set: (key, value) => { headers[key] = value; }, json: (value) => { result = value; },
    });
    assert.deepEqual(result.records.map((record) => record.id), [`loan-${id}`]);
    assert.equal(headers['Cache-Control'], 'private, no-store');
  }
});


test('approval routes reject staff before reading or writing data', async () => {
  const routes = new Map();
  registerLoansRoutes({ get: (path, handler) => routes.set(path, handler), post() {}, patch: (path, handler) => routes.set(path, handler) }, {});
  for (const path of ['/api/approval-requests', '/api/approval-requests/:id']) {
    let status;
    await routes.get(path)({ user: { id: 'staff', role: 'STAFF' }, originalUrl: '/api/approval-requests' }, { status: (value) => { status = value; return { json() {} }; } });
    assert.equal(status, 403);
  }
});
