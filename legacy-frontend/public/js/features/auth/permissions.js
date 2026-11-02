import { hasPermission } from '/shared/features/auth/permissions.js';
let currentUser = null;
export const can = (permission) => hasPermission(currentUser, permission);
export function applyCurrentUser(user) {
  currentUser = user;
  for (const element of document.querySelectorAll('[data-permission]'))
    element.hidden = !can(element.dataset.permission);
  for (const mode of ['loan', 'return']) {
    const borrower = document.querySelector(`#${mode}-borrower`);
    if (borrower) {
      borrower.defaultValue = user?.name || '';
      borrower.value = borrower.defaultValue;
      borrower.readOnly = !!user;
    }
  }
}
