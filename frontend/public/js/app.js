import { initializeAdminUsers } from './features/adminUsers/index.js';
import { initializeAudit } from './features/audit/index.js';
import { initializeMyRequests } from './features/myRequests/index.js';
import { initializeReturns } from './features/returns/returns.js';
import { createApiClient } from './core/http/client.js';
import { createConnection } from './core/http/connection.js';
import { initializeIcons } from './core/components/icons.js';
import { showToast } from './core/components/toast.js';
import { initializeWorkspaceMenu } from './core/navigation/menu.js';
import { initializeSession } from './features/auth/session.js';
import { initializeSearch } from './features/search/search.js';
import { initializeDashboard } from './features/dashboard/dashboard.js';
import { initializeLoans } from './features/loans/loans.js';
initializeIcons(document);
let session, search;
const client = createApiClient(() => session.showLogin());
const api = client.request;
const connect = createConnection({
  api,
  setCsrf: client.setCsrf,
  onError: (message) => search.showError(message),
});
const dashboard = initializeDashboard({
  api,
  isAuthenticated: () => session?.isAuthenticated() ?? false,
  onLogin: () => session.showLogin(),
});
const loanForm = initializeLoans(api);
const returnForm = initializeReturns(api);
search = initializeSearch({ api, connect, getCsrf: client.getCsrf, toast: showToast });
session = initializeSession({
  api,
  setCsrf: client.setCsrf,
  connect,
  onConnected: dashboard.show,
  onClear() {
    dashboard.clear();
    loanForm.clear();
    returnForm.clear();
    search.clear();
  },
  hasUnsavedChanges: search.hasUnsavedChanges,
  toast: showToast,
});
initializeAdminUsers(api);
initializeAudit(api);
initializeMyRequests(api);
initializeWorkspaceMenu();
session.start();
