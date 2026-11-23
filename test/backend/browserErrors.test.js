import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { redirectBrowserErrors } from '../../backend/src/core/http/browser-errors.js';

test('all JSON error statuses become UI redirects for documents but remain JSON for API clients', async (t) => {
  const app = express();
  app.use(redirectBrowserErrors('http://localhost:3001'));
  app.all('/:status', (req, res) =>
    res.status(Number(req.params.status)).json({ error: 'private details' }),
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const status of [400, 401, 403, 404, 409, 429, 500, 503]) {
    const document = await fetch(`${base}/${status}`, {
      redirect: 'manual',
      headers: { Accept: 'text/html' },
    });
    assert.equal(document.status, 303);
    assert.equal(document.headers.get('location'), 'http://localhost:3001/error');
    assert.ok(!(await document.text()).includes('private details'));
    const api = await fetch(`${base}/${status}`, { headers: { Accept: 'application/json' } });
    assert.equal(api.status, status);
    assert.deepEqual(await api.json(), { error: 'private details' });
  }
  const post = await fetch(base + '/403', {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Sec-Fetch-Dest': 'document' },
  });
  assert.equal(post.status, 303);
  const success = await fetch(base + '/200', { headers: { Accept: 'text/html' } });
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { error: 'private details' });
});
