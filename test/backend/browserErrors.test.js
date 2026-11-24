import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { redirectBrowserErrors } from '../../backend/src/core/http/browser-errors.js';

test('only Google login document errors become UI redirects; other requests retain their responses', async (t) => {
  const app = express();
  app.use(redirectBrowserErrors('http://localhost:3001'));
  app.all(['/api/auth/google', '/api/auth/google/callback', '/api/dashboard'], (req, res) =>
    res.status(Number(req.query.status)).json({ error: 'private details' }),
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const status of [400, 401, 403, 404, 409, 429, 500, 503]) {
    const document = await fetch(`${base}/api/auth/google?status=${status}`, {
      redirect: 'manual',
      headers: { Accept: 'text/html' },
    });
    assert.equal(document.status, 303);
    assert.equal(document.headers.get('location'), 'http://localhost:3001/error');
    assert.ok(!(await document.text()).includes('private details'));
    const api = await fetch(`${base}/api/auth/google?status=${status}`, {
      headers: { Accept: 'application/json' },
    });
    assert.equal(api.status, status);
    assert.deepEqual(await api.json(), { error: 'private details' });
    const ordinary = await fetch(`${base}/api/dashboard?status=${status}`, {
      redirect: 'manual',
      headers: { Accept: 'text/html' },
    });
    assert.equal(ordinary.status, status);
    assert.equal(ordinary.headers.get('location'), null);
  }
  const post = await fetch(base + '/api/auth/google/callback?status=403', {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Sec-Fetch-Dest': 'document' },
  });
  assert.equal(post.status, 303);
  const success = await fetch(base + '/api/auth/google?status=200', {
    headers: { Accept: 'text/html' },
  });
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { error: 'private details' });
});
