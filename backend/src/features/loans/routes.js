import { approvalStatuses } from '../../../../shared/features/lending/status.js';
import { auditEntry } from '../audit/repository.js';
import { createHash } from 'node:crypto';
import { readyToBorrowData } from '../../../../shared/features/catalog/parser.js';
import { sendLoanConfirmation } from '../mail/loan-confirmation.js';
import { bangkokIsoDate, isIsoCalendarDate } from '../../../../shared/core/extensions/dates.js';
export function registerLoansRoutes(
  app,
  { lendingLedger, loanRequests, confirmLoan = sendLoanConfirmation },
) {
  app.get('/api/ready-to-borrow', async (req, res, next) => {
    try {
      res.json(await lendingLedger.readAvailableAssets());
    } catch (error) {
      next(error);
    }
  });
  const listRequests = async (req, res) => {
    const admin = req.originalUrl?.split('?')[0] === '/api/approval-requests';
    if (admin && !['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role))
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ดำเนินการนี้' });
    res.set('Cache-Control', 'private, no-store');
    if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    const [ledger, tables] = await Promise.all([
      lendingLedger.readLedger(),
      req.authStorage.read(),
    ]);
    const own = new Set(
      tables.AuditLogs.filter(
        (entry) =>
          entry.actor_user_id === req.user.id &&
          ['LOAN_CREATED', 'RETURN_CREATED'].includes(entry.action),
      ).map((entry) => entry.entity_id),
    );
    const catalog = lendingLedger.adapter?.readReadyToBorrow
      ? readyToBorrowData(await lendingLedger.adapter.readReadyToBorrow()).records
      : [];
    const photo = (asset, serial) =>
      catalog.find((record) => record.asset === asset && record.serial === (serial || ''))?.photo ||
      '';
    const returned = new Set(
      ledger.returns.filter((row) => row[14] === 'เสร็จสิ้น').map((row) => row[2]),
    );
    res.json({
      records: [
        ...ledger.loans.map((row, index) => ({
          order: index,
          id: row[0],
          kind: 'ยืม',
          asset: row[7],
          name: row[9],
          date: row[11],
          status: row[14],
          serial: row[8] || '',
          due: row[12] || '',
          purpose: row[10] || '',
          notes: row[13] || '',
          adminComment: row[19] || '',
          pickupDate: row[20] || '',
          pickupTime: row[21] || '',
          team: row[4] || '',
          borrower: row[3] || '',
          photo: photo(row[7], row[8]),
          completed: returned.has(row[1]),
          statusLocked:
            row[14] === 'เสร็จสิ้น' ||
            row[14] === 'รอดำเนินการคืน' ||
            ledger.returns.some((entry) => entry[2] === row[1]),
        })),
        ...ledger.returns.map((row, index) => ({
          order: index,
          id: row[0],
          kind: 'คืน',
          asset: row[8],
          name: row[10],
          date: row[11],
          status: row[14],
          serial: row[9] || '',
          due: '',
          purpose: '',
          notes: row[12] || '',
          adminComment: row[19] || '',
          team: row[5] || '',
          borrower: row[4] || '',
          photo: photo(row[8], row[9]),
          completed: true,
          statusLocked: ['เสร็จสิ้น', 'รับคืนแล้ว'].includes(row[14]),
        })),
      ].filter((record) => admin || own.has(record.id)),
    });
  };
  app.get('/api/my-requests', listRequests);
  app.get('/api/approval-requests', listRequests);
  app.patch('/api/approval-requests/:id', async (req, res, next) => {
    try {
      if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role))
        return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ดำเนินการนี้' });
      const comment = req.body?.adminComment;
      if (comment !== undefined && (typeof comment !== 'string' || comment.length > 2000))
        return res.status(400).json({ error: 'คอมเมนต์ต้องเป็นข้อความไม่เกิน 2000 ตัวอักษร' });
      const returning = req.body?.kind === 'คืน';
      let pickup;
      if (req.body?.pickupDate !== undefined || req.body?.pickupTime !== undefined) {
        const { pickupDate, pickupTime } = req.body;
        if (
          returning ||
          typeof pickupDate !== 'string' ||
          typeof pickupTime !== 'string' ||
          ((pickupDate || pickupTime) &&
            (!isIsoCalendarDate(pickupDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(pickupTime)))
        )
          return res.status(400).json({ error: 'กรุณาระบุวันและเวลานัดรับให้ครบและถูกต้อง' });
        pickup = { date: pickupDate, time: pickupTime };
      }
      const statuses = approvalStatuses(returning ? 'คืน' : 'ยืม');
      if (!statuses.includes(req.body?.status))
        return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
      await lendingLedger.withWriteLock(async () => {
        const state = await lendingLedger.readLedger();
        const matches = (returning ? state.returns : state.loans).filter(
          (row) => row[0] === req.params.id,
        );
        if (matches.length !== 1)
          throw Object.assign(new Error('ไม่พบรายการยืมหรือรหัสซ้ำ'), { status: 409 });
        const record = matches[0];
        if (
          pickup?.date &&
          pickup.date < bangkokIsoDate() &&
          (pickup.date !== (record[20] || '') || pickup.time !== (record[21] || ''))
        )
          throw Object.assign(new Error('วันนัดรับต้องไม่ย้อนหลัง'), { status: 400 });
        if (
          ['เสร็จสิ้น', 'รับคืนแล้ว'].includes(record[14]) ||
          (!returning &&
            (record[14] === 'รอดำเนินการคืน' ||
              state.returns.some((entry) => entry[2] === record[1])))
        )
          throw Object.assign(new Error('รายการนี้ไม่สามารถเปลี่ยนสถานะได้แล้ว'), { status: 409 });
        if (returning) {
          if (req.body.status === 'เสร็จสิ้น' && !['ดี', 'ชำรุด'].includes(req.body.condition))
            throw Object.assign(new Error('กรุณาระบุสภาพหลังคืน'), { status: 400 });
          await lendingLedger.adapter.updateReturnStatus(
            req.params.id,
            req.body.status,
            req.user.name,
            req.body.condition,
            comment,
          );
        } else
          await lendingLedger.adapter.updateLoanStatus(
            req.params.id,
            req.body.status,
            req.user.name,
            comment,
            pickup,
          );
        await req.authStorage.write([
          auditEntry(
            req.user,
            returning ? 'RETURN_STATUS_UPDATED' : 'LOAN_STATUS_UPDATED',
            returning ? 'Return' : 'Loan',
            req.params.id,
            { status: matches[0][14] },
            {
              status: req.body.status,
              ...(pickup ? { pickupDate: pickup.date, pickupTime: pickup.time } : {}),
            },
          ),
        ]);
      });
      res.json({ id: req.params.id });
    } catch (error) {
      next(error);
    }
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
      if (body.serviceMode !== undefined && typeof body.serviceMode !== 'boolean')
        return res.status(400).json({ error: 'รูปแบบตัวเลือกให้บริการไม่ถูกต้อง' });
      if (body.serviceMode && !['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role))
        return res.status(403).json({ error: 'เฉพาะแอดมินเท่านั้นที่ทำรายการให้บริการได้' });
      const request = req.user
        ? {
            ...body,
            borrower: body.serviceMode ? body.borrower : req.user.name,
            email: body.serviceMode ? body.email : req.user.email,
            requestId: createHash('sha256')
              .update(req.user.id + ':' + body.requestId)
              .digest('hex'),
          }
        : body;
      const result = await loanRequests.submit(request);
      if (req.authStorage)
        await req.authStorage.write([
          auditEntry(
            req.user,
            'LOAN_CREATED',
            'Loan',
            result.id,
            null,
            body.serviceMode
              ? { serviceMode: true, borrower: request.borrower, email: request.email }
              : null,
          ),
        ]);
      if (req.user && !result.unchanged)
        result.mailNotification = await confirmLoan(lendingLedger, result, request.email.trim());
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
}
