import { safeMessage, logError } from './errors.js';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHmac } from 'node:crypto';
import os from 'node:os';
import { lanAddresses } from './network.js';
import { createAuth } from './auth.js';
import { dashboardData, DashboardEditor } from './dashboard.js';
import { DashboardPhotos, PhotoStore } from './photos.js';
export { safeMessage as friendlyError } from './errors.js';
export function createApp(service, config) {
  const app = express();
  const csrf = config.appSecret
    ? createHmac('sha256', config.appSecret).update('iqi:csrf').digest('hex')
    : randomBytes(32).toString('hex');
  const maxUploadBytes = config.maxUploadBytes || 25 * 1024 * 1024;
  if (config.hosted) app.set('trust proxy', 1);
  const dashboardEditor = new DashboardEditor(service.adapter);
  const photos = new DashboardPhotos(service.adapter, new PhotoStore(config), dashboardEditor);
  const hosts = new Set([
    'localhost',
    '127.0.0.1',
    '[::1]',
    os.hostname().toLowerCase(),
    ...lanAddresses(),
    config.host,
    ...(config.allowedHosts || []),
  ]);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    try {
      const host = new URL(`http://${req.get('host')}`).hostname.toLowerCase();
      if (!hosts.has(host))
        return res
          .status(403)
          .json({ error: 'ไม่อนุญาต hostname นี้ กรุณาเปิดผ่าน localhost หรือ IP ของเครื่อง' });
      next();
    } catch {
      res.status(400).json({ error: 'Host ไม่ถูกต้อง' });
    }
  });
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    });
    next();
  });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET') {
      if (req.get('X-IQI-Request') !== csrf)
        return res.status(403).json({ error: 'คำขอไม่ถูกต้อง กรุณาโหลดหน้าเว็บใหม่' });
      if (req.get('origin') && req.get('origin') !== `${req.protocol}://${req.get('host')}`)
        return res.status(403).json({ error: 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น' });
    }
    next();
  });
  app.use(express.json({ limit: '2mb' }));
  app.get('/api/upload-config', (req, res) => res.json({ maxUploadBytes }));
  app.use('/api', createAuth(config, csrf));
  app.use('/api', async (req, res, next) => {
    if (service.ready) await service.ready();
    next();
  });
  app.get('/api/dashboard', async (req, res, next) => {
    try {
      res.json(dashboardData(await service.adapter.readDashboard()));
    } catch (e) {
      next(e);
    }
  });
  app.put('/api/dashboard/:row/status', async (req, res, next) => {
    try {
      res.json(await dashboardEditor.save(Number(req.params.row), req.body || {}));
    } catch (e) {
      next(e);
    }
  });
  app.put('/api/dashboard/:row/details', async (req, res, next) => {
    try {
      res.json(await dashboardEditor.saveDetails(Number(req.params.row), req.body || {}));
    } catch (e) {
      next(e);
    }
  });
  app.post(
    '/api/dashboard/:row/photos',
    express.raw({ type: 'application/octet-stream', limit: maxUploadBytes }),
    async (req, res, next) => {
      try {
        res.json(
          await photos.upload(
            Number(req.params.row),
            req.get('X-Record-Revision'),
            req.body,
            req.get('X-Photo-Type'),
          ),
        );
      } catch (e) {
        next(e);
      }
    },
  );
  app.get('/api/dashboard/:row/photos/:id', async (req, res, next) => {
    try {
      const bytes = await photos.read(Number(req.params.row), req.params.id);
      res.type('image/jpeg').send(Buffer.from(bytes));
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/status', async (req, res, next) => {
    try {
      await service.adapter.initialize();
      res.json({
        connected: true,
        sheets: config.sheets,
        csrf,
        reviewUrl: service.adapter.reviewQueue?.url || null,
        iqiItUrl: service.adapter.iqiItQueue?.url || null,
      });
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/search', async (req, res, next) => {
    try {
      if (req.query.pendingOnly !== undefined && !['0', '1'].includes(req.query.pendingOnly))
        return res.status(400).json({ error: 'ตัวกรองไม่ถูกต้อง' });
      res.json(
        await service.search(req.query.q ?? '', { pendingOnly: req.query.pendingOnly === '1' }),
      );
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/record', async (req, res, next) => {
    try {
      res.json(await service.detail(req.query.sheet, Number(req.query.row)));
    } catch (e) {
      next(e);
    }
  });
  app.put('/api/iqi/:row', async (req, res, next) => {
    try {
      res.json(await service.save(Number(req.params.row), req.body || {}));
    } catch (e) {
      next(e);
    }
  });
  app.put('/api/iqi/:row/search-status', async (req, res, next) => {
    try {
      res.json(await service.setPending(Number(req.params.row), req.body || {}));
    } catch (e) {
      next(e);
    }
  });
  app.put('/api/review-selection', async (req, res, next) => {
    try {
      const body = req.body || {};
      res.json(await service.setReviewPending(body.sheet, Number(body.row), body));
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/review-inspection', async (req, res, next) => {
    try {
      res.json(await service.reviewInspection(req.query.sheet, Number(req.query.row), req.query));
    } catch (e) {
      next(e);
    }
  });
  app.put('/api/review-inspection', async (req, res, next) => {
    try {
      const body = req.body || {};
      res.json(await service.reviewInspection(body.sheet, Number(body.row), body, true));
    } catch (e) {
      next(e);
    }
  });
  app.use('/api', (req, res) =>
    res.status(404).json({ error: 'ไม่พบ API นี้ — บันทึกได้เฉพาะ IQI' }),
  );
  app.use(
    express.static(fileURLToPath(new URL('../public', import.meta.url)), {
      dotfiles: 'deny',
      index: 'index.html',
    }),
  );
  app.use((req, res) => res.status(404).type('text').send('ไม่พบหน้านี้'));
  app.use((error, req, res, next) => {
    logError(error, `API ${req.method}`);
    if (res.headersSent) return next(error);
    const status = Number(error.status || error.response?.status || 500);
    res.status(status >= 400 && status <= 599 ? status : 500).json({
      error:
        error.type === 'entity.too.large'
          ? `ไฟล์ใหญ่เกินกำหนด กรุณาเลือกภาพไม่เกิน ${maxUploadBytes / 1024 / 1024} MB`
          : error.type === 'entity.parse.failed'
            ? 'รูปแบบ JSON ไม่ถูกต้อง'
            : safeMessage(error),
    });
  });
  return app;
}
