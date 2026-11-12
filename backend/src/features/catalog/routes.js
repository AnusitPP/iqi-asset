import { readyToBorrowData } from '../../../../shared/features/catalog/parser.js';
import express from 'express';
import { preparePhoto } from '../photos/prepareUpload.js';
export function registerCatalogRoutes(app, { lendingLedger, catalogEditor, maxUploadBytes }) {
  app.delete('/api/loan-catalog/:row', async (req, res, next) => {
    try {
      if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role))
        return res.status(403).json({ error: 'เฉพาะแอดมินเท่านั้นที่ลบรายการได้' });
      res.json(await catalogEditor.remove(Number(req.params.row), req.body));
    } catch (error) {
      next(error);
    }
  });
  app.post(
    '/api/loan-catalog/preview',
    express.raw({ type: 'application/octet-stream', limit: maxUploadBytes }),
    async (req, res, next) => {
      try {
        const bytes = await preparePhoto(req.body);
        res.json({ preview: `data:image/jpeg;base64,${bytes.toString('base64')}` });
      } catch (error) {
        next(error);
      }
    },
  );
  app.post('/api/loan-catalog', async (req, res, next) => {
    try {
      res.status(201).json(await catalogEditor.create(req.body));
    } catch (error) {
      next(error);
    }
  });
  app.post(
    '/api/loan-catalog/:row/photos',
    express.raw({ type: 'application/octet-stream', limit: maxUploadBytes }),
    async (req, res, next) => {
      try {
        res.json(
          await catalogEditor.upload(
            Number(req.params.row),
            req.get('X-Record-Revision'),
            req.body,
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  app.get('/api/catalog-photos/:id', async (req, res, next) => {
    try {
      const bytes = await catalogEditor.readPhoto(req.params.id);
      res
        .set('Cache-Control', 'private, no-store')
        .set('X-Content-Type-Options', 'nosniff')
        .type('image/jpeg')
        .send(Buffer.from(bytes));
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/loan-catalog', async (req, res, next) => {
    try {
      res.json(await lendingLedger.readAvailableAssets());
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/return-catalog', async (req, res, next) => {
    try {
      const [state, tables] = await Promise.all([
        lendingLedger.readLedger(),
        req.authStorage.read(),
      ]);
      const own = new Set(
        tables.AuditLogs.filter(
          (entry) => entry.actor_user_id === req.user.id && entry.action === 'LOAN_CREATED',
        ).map((entry) => entry.entity_id),
      );
      const email = String(req.user.email || '')
        .trim()
        .toLowerCase();
      const catalog = lendingLedger.adapter?.readReadyToBorrow
        ? readyToBorrowData(await lendingLedger.adapter.readReadyToBorrow()).records
        : [];
      return res.json({
        records: state.active
          .filter(
            (row) =>
              (own.has(row[0]) || (email && state.loanEmails?.get(row[1]) === email)) &&
              row[14] === 'กำลังยืม' &&
              !state.returns.some((returned) => returned[2] === row[1]),
          )
          .map((row, index) => ({
            row: index + 2,
            asset: row[7],
            serial: row[8] || '',
            name: row[9] || '',
            team: row[4] || '',
            loanId: row[0],
            start: row[11] || '',
            due: row[12] || '',
            status: row[14] || '',
            borrower: row[3] || '',
            purpose: row[10] || '',
            notes: row[13] || '',
            adminComment: row[19] || '',
            photo:
              catalog.find((record) => record.asset === row[7] && record.serial === (row[8] || ''))
                ?.photo || '',
          })),
      });
    } catch (error) {
      next(error);
    }
  });
}
