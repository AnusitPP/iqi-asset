import { registerSheetsRoutes } from '../features/sheets/routes.js';
import { registerUserRoutes } from '../features/users/routes.js';
import { protectApi } from '../features/auth/middleware/protect-api.js';
import { registerAuditRoutes } from '../features/audit/routes.js';
import { configureRequestSecurity } from '../core/http/security.js';
import { redirectBrowserErrors } from '../core/http/browser-errors.js';
import {
  registerCatalogRoutes,
  registerPublicCatalogPhotoRoute,
} from '../features/catalog/routes.js';
import { sendRequestNotification } from '../features/notifications/google-chat.js';
import { devActivityEnabled, registerDevActivity } from '../features/notifications/dev-activity.js';
import { CatalogEditor } from '../features/catalog/service.js';
import { registerLoansRoutes } from '../features/loans/routes.js';
import { createStaffNicknameReader } from '../features/loans/staff-nicknames.js';
import { registerReturnsRoutes } from '../features/returns/routes.js';
import {
  safeMessage,
  logError,
  applicationErrorCode,
  isRetryableError,
} from '../core/errors/errors.js';
import express from 'express';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { createAuth } from '../features/auth/middleware.js';
import { LendingLedger } from '../core/lending/ledger.js';
import { LoanRequestService } from '../features/loans/service.js';
import { ReturnRequestService } from '../features/returns/service.js';
import { PhotoStore } from '../integrations/google/photoStorage.js';
import { registerMailRoutes } from '../features/mail/routes.js';
import { registerMailCron } from '../features/mail/cron.js';
export { safeMessage as friendlyError } from '../core/errors/errors.js';
export function createApp(service, config) {
  const app = express();
  app.use(redirectBrowserErrors(config.frontendOrigin));
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
  const photoStore = new PhotoStore(config);
  const catalogEditor = new CatalogEditor(lendingLedger, photoStore);
  const notifyRequest =
    config.notifyRequest ??
    ((ledger, kind, result) =>
      devActivityEnabled(config)
        ? Promise.resolve('skipped')
        : sendRequestNotification(ledger, kind, result, { photoStore }));
  configureRequestSecurity(app, config, csrf);
  // Only catalog images already shared publicly in Drive can be fetched by Chat.
  registerPublicCatalogPhotoRoute(app, { catalogEditor });
  registerMailCron(app, { adapter: service.adapter });
  app.get('/api/upload-config', (req, res) => res.json({ maxUploadBytes }));
  app.use('/api', createAuth(config, csrf));
  app.use('/api', protectApi);
  registerDevActivity(app, config);
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
    catalogEditor,
    maxUploadBytes,
    readStaffNicknames,
  });
  registerMailRoutes(app, { lendingLedger, readStaffNicknames });
  registerSheetsRoutes(app, { adapter: service.adapter });
  registerLoansRoutes(app, {
    lendingLedger,
    loanRequests,
    confirmLoan: config.confirmLoan,
    notifyRequest,
    readStaffNicknames,
  });
  registerReturnsRoutes(app, {
    returnRequests,
    lendingLedger,
    notifyRequest,
  });
  app.get('/api/status', async (req, res, next) => {
    try {
      await service.adapter.initialize();
      res.json({
        connected: true,
        sheets: config.sheets,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${encodeURIComponent(config.spreadsheetId)}/edit`,
        csrf,
      });
    } catch (e) {
      next(e);
    }
  });
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
