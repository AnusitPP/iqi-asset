import { auditEntry } from '../audit/repository.js';
import { createHash } from 'node:crypto';
export function registerLoansRoutes(app, { lendingLedger, loanRequests }) {
  app.get('/api/ready-to-borrow', async (req, res, next) => {
    try {
      res.json(await lendingLedger.readAvailableAssets());
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/my-requests', async (req,res) => {
    if (!req.user) return res.status(401).json({error:'กรุณาเข้าสู่ระบบ'});
    const [ledger,tables] = await Promise.all([lendingLedger.readLedger(),req.authStorage.read()]);
    const own = new Set(tables.AuditLogs.filter(entry => entry.actor_user_id === req.user.id && ['LOAN_CREATED','RETURN_CREATED'].includes(entry.action)).map(entry => entry.entity_id));
    res.json({records:[...ledger.loans.map(row => ({id:row[0],kind:'ยืม',asset:row[7],name:row[9],date:row[11],status:row[14]})),
      ...ledger.returns.map(row => ({id:row[0],kind:'คืน',asset:row[8],name:row[10],date:row[11],status:row[14]}))].filter(record => own.has(record.id))});
  });
  app.get('/api/loans', async (req, res, next) => {
    try {
      res.json(await lendingLedger.readOutstandingLoans());
    } catch (error) {
      next(error);
    }
  });
  app.post('/api/loans', async (req, res, next) => {
    try {
      const body = req.body || {};
      const request = req.user ? { ...body, borrower:req.user.name,
        requestId:createHash('sha256').update(req.user.id+':'+body.requestId).digest('hex') } : body;
      const result = await loanRequests.submit(request);
      if (req.authStorage) await req.authStorage.write([auditEntry(req.user,'LOAN_CREATED','Loan',result.id)]);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
}
