import { LendingLedger } from '../../backend/src/core/lending/ledger.js';
import { LoanRequestService } from '../../backend/src/features/loans/service.js';
import { ReturnRequestService } from '../../backend/src/features/returns/service.js';
export { LOAN_HEADERS } from '../../backend/src/core/lending/schema.js';
export { RETURN_HEADERS } from '../../backend/src/core/lending/schema.js';
export class Loans {
  constructor(adapter, config) {
    const ledger = new LendingLedger(adapter, config);
    const loanRequests = new LoanRequestService(ledger);
    const returnRequests = new ReturnRequestService(ledger);
    this.borrowForm = loanRequests.submit.bind(loanRequests);
    this.returnForm = returnRequests.submit.bind(returnRequests);
    this.available = ledger.readAvailableAssets.bind(ledger);
    this.outstanding = ledger.readOutstandingLoans.bind(ledger);
  }
}
