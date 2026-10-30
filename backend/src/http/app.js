import { configureRequestSecurity } from '../core/http/security.js';
import { registerCatalogRoutes } from '../features/catalog/routes.js';
import { registerLoansRoutes } from '../features/loans/routes.js';
import { registerReturnsRoutes } from '../features/returns/routes.js';
import { registerDashboardRoutes } from '../features/dashboard/routes.js';
import { registerPhotosRoutes } from '../features/photos/routes.js';
import { registerRecordsRoutes } from '../features/records/routes.js';
import { registerReviewRoutes } from '../features/review/routes.js';
import { safeMessage, logError } from '../core/errors/errors.js';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomBytes, createHmac } from 'node:crypto';
import { createAuth } from '../features/auth/middleware.js';
import { DashboardEditor } from '../features/dashboard/editor.js';
import { LendingLedger } from '../core/lending/ledger.js';
import { LoanRequestService } from '../features/loans/service.js';
import { ReturnRequestService } from '../features/returns/service.js';
import { PhotoStore } from '../integrations/google/photoStorage.js';
import { DashboardPhotos } from '../features/photos/service.js';
export { safeMessage as friendlyError } from '../core/errors/errors.js';
export function createApp(service, config) {
  const app = express();
  const httpDirectory = dirname(fileURLToPath(import.meta.url));
  const lendingLedger = new LendingLedger(service.adapter, config);
  const loanRequests = new LoanRequestService(lendingLedger);
  const returnRequests = new ReturnRequestService(lendingLedger);
  const csrf = config.appSecret
    ? createHmac('sha256', config.appSecret).update('iqi:csrf').digest('hex')
    : randomBytes(32).toString('hex');
  const maxUploadBytes = config.maxUploadBytes || 25 * 1024 * 1024;
  if (config.hosted) app.set('trust proxy', 1);
  const dashboardEditor = new DashboardEditor(service.adapter);
  const photos = new DashboardPhotos(service.adapter, new PhotoStore(config), dashboardEditor);
  configureRequestSecurity(app, config, csrf);
  app.get('/api/upload-config', (req, res) => res.json({ maxUploadBytes }));
  app.use('/api', createAuth(config, csrf));
  app.use('/api', async (req, res, next) => {
    if (service.ready) await service.ready();
    next();
  });
  registerCatalogRoutes(app, { service });
  registerLoansRoutes(app, { lendingLedger, loanRequests });
  registerReturnsRoutes(app, { returnRequests });
  registerDashboardRoutes(app, { dashboardEditor, service });
  registerPhotosRoutes(app, { photos, maxUploadBytes });
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
  registerRecordsRoutes(app, { service });
  registerReviewRoutes(app, { service });
  app.use('/api', (req, res) =>
    res.status(404).json({ error: 'ไม่พบ API นี้ — บันทึกได้เฉพาะ IQI' }),
  );
  app.use(
    '/shared',
    express.static(resolve(httpDirectory, '../../../shared'), {
      dotfiles: 'deny',
    }),
  );
  app.use(
    express.static(resolve(httpDirectory, '../../../frontend/public'), {
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
