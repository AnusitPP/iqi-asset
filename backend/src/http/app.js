import { registerUserRoutes } from '../features/users/routes.js';
import { protectApi } from '../features/auth/middleware/protect-api.js';
import { registerAuditRoutes } from '../features/audit/routes.js';
import { configureRequestSecurity } from '../core/http/security.js';
import { registerCatalogRoutes } from '../features/catalog/routes.js';
import { CatalogEditor } from '../features/catalog/service.js';
import { registerLoansRoutes } from '../features/loans/routes.js';
import { createStaffNicknameReader } from '../features/loans/staff-nicknames.js';
import { registerReturnsRoutes } from '../features/returns/routes.js';
import { registerDashboardRoutes } from '../features/dashboard/routes.js';
import { registerPhotosRoutes } from '../features/photos/routes.js';
import { registerRecordsRoutes } from '../features/records/routes.js';
import { registerReviewRoutes } from '../features/review/routes.js';
import { safeMessage, logError, applicationErrorCode, isRetryableError } from '../core/errors/errors.js';
import express from 'express';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { createAuth } from '../features/auth/middleware.js';
import { DashboardEditor } from '../features/dashboard/editor.js';
import { LendingLedger } from '../core/lending/ledger.js';
import { LoanRequestService } from '../features/loans/service.js';
import { ReturnRequestService } from '../features/returns/service.js';
import { PhotoStore } from '../integrations/google/photoStorage.js';
import { DashboardPhotos } from '../features/photos/service.js';
import { registerMailRoutes } from '../features/mail/routes.js';
import { registerMailCron } from '../features/mail/cron.js';
export { safeMessage as friendlyError } from '../core/errors/errors.js';
export function createApp(service, config) {
  const app = express();
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set('X-Request-Id', req.requestId);
    next();
  });
  const lendingLedger = new LendingLedger(service.adapter, config);
  const loanRequests = new LoanRequestService(lendingLedger);
  const returnRequests = new ReturnRequestService(lendingLedger);
  const csrf = config.appSecret
    ? createHmac('sha256', config.appSecret).update('iqi:csrf').digest('hex')
    : randomBytes(32).toString('hex');
  const maxUploadBytes = config.maxUploadBytes || 4 * 1024 * 1024;
  if (config.hosted) app.set('trust proxy', 1);
  const dashboardEditor = new DashboardEditor(service.adapter);
  const photos = new DashboardPhotos(service.adapter, new PhotoStore(config), dashboardEditor);
  configureRequestSecurity(app, config, csrf);
  registerMailCron(app, { adapter: service.adapter });
  app.get('/api/upload-config', (req, res) => res.json({ maxUploadBytes }));
  app.use('/api', createAuth(config, csrf));
  app.use('/api', protectApi);
  if (config.authSpreadsheetId || config.authStorage) {
    registerAuditRoutes(app);
    registerUserRoutes(app, config);
  }
  app.use('/api', async (req, res, next) => {
    if (service.ready) await service.ready();
    next();
  });
  const readStaffNicknames = createStaffNicknameReader(service.adapter, config.staffSpreadsheetId);
  registerCatalogRoutes(app, {
    lendingLedger,
    catalogEditor: new CatalogEditor(lendingLedger, photos.store),
    maxUploadBytes,
    readStaffNicknames,
  });
  registerMailRoutes(app, { lendingLedger });
  registerLoansRoutes(app, {
    lendingLedger,
    loanRequests,
    confirmLoan: config.confirmLoan,
    readStaffNicknames,
  });
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
  app.use((req, res) => res.status(404).type('text').send('ไม่พบหน้านี้'));
  app.use((error, req, res, next) => {
    logError(error, `API ${req.method} requestId=${req.requestId}`);
    if (res.headersSent) return next(error);
    const status = Number(error.status || error.response?.status || 500);
    const safeStatus = status >= 400 && status <= 599 ? status : 500;
    const message =
        error.type === 'entity.too.large'
          ? `ไฟล์ใหญ่เกินกำหนด กรุณาเลือกภาพไม่เกิน ${maxUploadBytes / 1024 / 1024} MB`
          : error.type === 'entity.parse.failed'
            ? 'รูปแบบ JSON ไม่ถูกต้อง'
            : safeMessage(error);
    res.status(safeStatus).json({
      error: message,
      code: applicationErrorCode(error, safeStatus),
      retryable: isRetryableError(error, safeStatus),
      requestId: req.requestId,
    });
  });
  return app;
}
