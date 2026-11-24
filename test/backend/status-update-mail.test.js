import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderStatusUpdateTemplate } from '../../backend/src/features/mail/status-update.js';
import { sendLoanStatusNotification } from '../../backend/src/features/mail/loan-confirmation.js';
import { LOAN_HEADERS } from '../../backend/src/core/lending/schema.js';
import { REQUEST_STATUS_PRESENTATION } from '../../shared/features/lending/status.js';

const env = { FRONTEND_URL: 'https://portal.example.com' };

test('status update follows the supplied layout without daily-report or unrelated fields', () => {
  const html = renderStatusUpdateTemplate({
    id: 'REQUEST-UNIQUE',
    oldStatus: 'รอดำเนินการ',
    status: 'กำลังยืม',
    kind: 'ยืม',
    assetName: 'Laptop <IT> & accessories',
    env,
  });
  const doc = new JSDOM(html).window.document;
  assert.equal(doc.body.textContent.split('REQUEST-UNIQUE').length - 1, 1);
  assert.match(doc.body.textContent, /สถานะปัจจุบัน/);
  assert.match(doc.body.textContent, /คำขอยืมของคุณได้รับการอนุมัติแล้ว/);
  assert.match(html, /font-size:28px;[^"\n]*font-weight:bold;color:#27824A/);
  assert.ok(doc.querySelector('table[width="60"][height="60"]'));
  assert.equal(doc.querySelector('img').getAttribute('src'), 'https://portal.example.com/icon.png');
  assert.equal(
    doc.querySelector('a').getAttribute('href'),
    'https://portal.example.com/my-requests',
  );
  assert.match(html, /Laptop &lt;IT&gt; &amp; accessories/);
  assert.match(html, /STATUS UPDATE/);
  assert.match(html, /background:#202124/);
  assert.match(html, /background:#FFCC00/);
  assert.match(html, /IT Quality Management · STeP/);
  assert.doesNotMatch(
    doc.body.textContent,
    /Daily Report|DAILY REPORT|Serial Number|ผู้ยืม|เลขครุภัณฑ์|วันที่ยืม|กำหนดส่งคืน|—/,
  );
  assert.doesNotMatch(html, /<script|<svg|<style|display:\s*(flex|grid)/);
});

test('every existing status renders its label and status color, with no placeholder data', () => {
  const colors = {
    yellow: '#A16207',
    green: '#27824A',
    red: '#B42318',
    gray: '#71717A',
    grape: '#27824A',
    blue: '#2563EB',
    orange: '#B45309',
    teal: '#27824A',
  };
  for (const [status, presentation] of Object.entries(REQUEST_STATUS_PRESENTATION)) {
    const html = renderStatusUpdateTemplate({ status, oldStatus: '', assetName: ' ', env });
    const doc = new JSDOM(html).window.document;
    assert.match(doc.body.textContent, new RegExp(presentation.label));
    assert.ok(html.includes(`font-weight:bold;color:${colors[presentation.color]}`));
    assert.doesNotMatch(doc.body.textContent, /ชื่ออุปกรณ์|เลขคำขอ|สถานะเดิม|—/);
  }
});

test('missing data is omitted and dynamic status, name and ID are escaped with safe URLs', () => {
  const values = {
    id: '<script>id</script>',
    status: '<img src=x>',
    oldStatus: '"old" & value',
    assetName: '<b>device</b>',
  };
  for (const base of [undefined, 'javascript:alert(1)', 'https://user:secret@example.com']) {
    const html = renderStatusUpdateTemplate({ ...values, env: { APP_URL: base } });
    assert.doesNotMatch(html, /<script|<img src=x|<b>device|href=|user:secret/);
    assert.match(html, /&lt;script&gt;id&lt;\/script&gt;/);
    assert.match(html, /&lt;img src=x&gt;/);
    assert.match(html, /&lt;b&gt;device&lt;\/b&gt;/);
  }
  const empty = new JSDOM(renderStatusUpdateTemplate({ env })).window.document.body.textContent;
  assert.doesNotMatch(empty, /ชื่ออุปกรณ์|เลขคำขอ|สถานะเดิม|สถานะใหม่|—|undefined|null/);
});

test('status mail preserves recipients and reordered sheet mapping for loans and returns', async () => {
  const headers = ['email', ...LOAN_HEADERS.toReversed()];
  const entry = {
    email: 'borrower@example.com',
    เลขรายการยืม: 'LOAN-1',
    ชื่ออุปกรณ์: 'Real device',
  };
  const row = headers.map((name) => entry[name] || '');
  const sheets = { loans: [headers, row], returns: [[], ['RETURN-1', 'LOAN-1']] };
  const sent = [];
  const ledger = { adapter: { readLoanSheets: async () => sheets } };
  const options = {
    env: {
      ...env,
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'u',
      SMTP_PASS: 'p',
      MAIL_FROM: 'sender@example.com',
    },
    factory: (settings) => ({ send: async (message) => sent.push({ settings, message }) }),
  };
  for (const [kind, id] of [
    ['ยืม', 'LOAN-1'],
    ['คืน', 'RETURN-1'],
  ]) {
    assert.equal(
      await sendLoanStatusNotification(
        ledger,
        { kind, id, oldStatus: 'รอดำเนินการ', status: 'เสร็จสิ้น' },
        options,
      ),
      'sent',
    );
    assert.deepEqual(sent.at(-1).settings.to, ['borrower@example.com']);
    const doc = new JSDOM(sent.at(-1).message.html).window.document;
    assert.equal(doc.body.textContent.split(id).length - 1, 1);
    assert.match(doc.body.textContent, /Real device/);
    assert.match(sent.at(-1).message.subject, new RegExp(id));
  }
  row[0] = '';
  assert.equal(
    await sendLoanStatusNotification(
      ledger,
      { kind: 'ยืม', id: 'LOAN-1', status: 'เสร็จสิ้น' },
      options,
    ),
    'skipped',
  );
  assert.equal(sent.length, 2);
});
