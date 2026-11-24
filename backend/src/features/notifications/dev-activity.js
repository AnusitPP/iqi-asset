import { escapeMailHtml } from '../mail/templates.js';

const actions = [
  ['POST', /^\/api\/loans$/, 'สร้างคำขอยืม'],
  ['POST', /^\/api\/returns$/, 'สร้างคำขอคืน'],
  ['POST', /^\/api\/my-requests\/[^/]+\/cancel$/, 'ยกเลิกคำขอยืม'],
  ['PATCH', /^\/api\/approval-requests\/[^/]+$/, 'ปรับสถานะคำขอ'],
  ['POST', /^\/api\/loan-catalog$/, 'เพิ่มครุภัณฑ์'],
  ['DELETE', /^\/api\/loan-catalog\/\d+$/, 'ลบครุภัณฑ์'],
  ['POST', /^\/api\/loan-catalog\/\d+\/photos$/, 'เพิ่มรูปครุภัณฑ์'],
  ['PATCH', /^\/api\/admin\/users\/[^/]+\/(?:role|status)$/, 'แก้สิทธิ์หรือสถานะผู้ใช้'],
];

export function devActivityEnabled(config, env = process.env) {
  return !config.hosted && env.VERCEL !== '1' && !!config.devChatWebhookUrl?.trim();
}

export async function sendDevActivity(event, { env = process.env, fetcher = fetch } = {}) {
  try {
    const url = new URL(env.GOOGLE_CHAT_DEV_WEBHOOK_URL);
    if (
      url.origin !== 'https://chat.googleapis.com' ||
      url.username ||
      url.password ||
      !/^\/v1\/spaces\/[^/]+\/messages$/.test(url.pathname) ||
      !url.searchParams.get('key') ||
      !url.searchParams.get('token')
    )
      throw new Error('Invalid webhook');
    const text = [
      `<b>ผู้ทำรายการ:</b> ${escapeMailHtml(event.actor)}`,
      `<b>รายการ:</b> ${escapeMailHtml(event.id || '-')}`,
      ...event.fields.map(([label, value]) => `<b>${label}:</b> ${escapeMailHtml(value)}`),
      `<font color="#6b7280">${escapeMailHtml(event.method + ' ' + event.path)}<br>${escapeMailHtml(event.time)}</font>`,
    ].join('<br>');
    const response = await fetcher(url.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardsV2: [
          {
            cardId: 'dev-activity',
            card: {
              header: {
                title: `🛠 DEV · ${event.action}`,
                subtitle: 'localhost · บันทึกการเปลี่ยนข้อมูล',
              },
              sections: [{ widgets: [{ textParagraph: { text } }] }],
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Notification rejected');
    return 'sent';
  } catch {
    process.stderr.write('Dev activity notification failed\n');
    return 'failed';
  }
}

export function registerDevActivity(
  app,
  config,
  { env = process.env, notify = sendDevActivity } = {},
) {
  if (!devActivityEnabled(config, env)) return;
  app.use('/api', (req, res, next) => {
    const path = req.originalUrl.split('?')[0];
    const action = actions.find(
      ([method, pattern]) => method === req.method && pattern.test(path),
    )?.[2];
    if (!action || !['localhost', '127.0.0.1', '[::1]'].includes(req.hostname)) return next();
    let result;
    const json = res.json;
    res.json = function (body) {
      result = body;
      return json.call(this, body);
    };
    res.once('finish', () => {
      if (res.statusCode < 200 || res.statusCode >= 300 || result?.unchanged || !req.user) return;
      // Never include raw bodies: photo binaries, credentials and session data stay local.
      const labels = {
        status: 'สถานะใหม่',
        kind: 'ประเภท',
        role: 'สิทธิ์ใหม่',
        asset: 'เลขครุภัณฑ์',
        name: 'อุปกรณ์',
        condition: 'สภาพ',
        inspection: 'ผลตรวจ',
        comparison: 'ผลเทียบ',
        pending: 'รอดำเนินการ',
      };
      const fields = Object.entries(labels).flatMap(([key, label]) => {
        const value = req.body?.[key];
        return ['string', 'boolean', 'number'].includes(typeof value)
          ? [[label, String(value).slice(0, 200)]]
          : [];
      });
      void Promise.resolve()
        .then(() =>
          notify(
            {
              action,
              actor: req.user.name || req.user.id,
              id: result?.id || result?.row,
              method: req.method,
              path,
              fields,
              time: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
            },
            { env: { GOOGLE_CHAT_DEV_WEBHOOK_URL: config.devChatWebhookUrl } },
          ),
        )
        .catch(() => process.stderr.write('Dev activity notification failed\n'));
    });
    next();
  });
}
