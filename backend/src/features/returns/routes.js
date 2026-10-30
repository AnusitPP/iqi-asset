import { auditEntry } from '../audit/repository.js';
import { createHash } from 'node:crypto';
export function registerReturnsRoutes(app, { returnRequests }) {
  app.post('/api/returns', async (req, res, next) => {
    try {
      const body = req.body || {};
      const request = req.user ? { ...body, borrower:req.user.name,
        requestId:createHash('sha256').update(req.user.id+':'+body.requestId).digest('hex') } : body;
      const result = await returnRequests.submit(request);
      if (req.authStorage) await req.authStorage.write([auditEntry(req.user,'RETURN_CREATED','Return',result.id)]);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
}
