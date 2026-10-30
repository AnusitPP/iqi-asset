import { renderSignedInProfile } from './profile.js';
import { applyCurrentUser } from './permissions.js';
import { UI_MESSAGES } from '/shared/core/constants/messages.js';
import { selectElement } from '../../core/dom/elements.js';
import { setUploadLimit } from '../photos/prepareUpload.js';
export function initializeSession({
  api,
  setCsrf,
  connect,
  onConnected,
  onClear,
  hasUnsavedChanges,
  toast,
}) {
  const authDialog = selectElement('#auth-dialog');
  let authenticated = false;
  const dashboard = { show: onConnected };
  function showLogin() {
    authenticated = false;
    applyCurrentUser(null);
    document.dispatchEvent(new Event('auth-cleared'));
    renderSignedInProfile(null);
    onClear();
    selectElement('#logout-button').hidden = true;
    if (!authDialog.open) authDialog.showModal();
    selectElement('#auth-google-login').focus();
  }
  authDialog.addEventListener('cancel', (event) => event.preventDefault());
  authDialog.addEventListener('close', () => {
    if (!authenticated && !authDialog.open) authDialog.showModal();
  });
  selectElement('#logout-button').addEventListener('click', async () => {
    if (hasUnsavedChanges() && !confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการล็อกออกหรือไม่?'))
      return;
    try {
      await api('/api/auth/logout', { method: 'POST' });
      onClear();
      showLogin();
    } catch (error) {
      toast(error.message);
    }
  });
  async function initializeAuth() {
    try {
      const { maxUploadBytes } = await api('/api/upload-config');
      setUploadLimit(maxUploadBytes);
      const session = await api('/api/auth/me');
      setCsrf(session.csrf);
      if (session.authenticated) {
        authenticated = true;
        applyCurrentUser(session.user);
        renderSignedInProfile(session.user);
        selectElement('#logout-button').hidden = false;
        if (await connect()) dashboard.show();
      } else showLogin();
    } catch (error) {
      showLogin();
      selectElement('#auth-error').textContent =
        error.message || UI_MESSAGES.SESSION_CONNECTION_FAILED;
      selectElement('#auth-error').hidden = false;
    }
  }

  return { start: initializeAuth, showLogin, isAuthenticated: () => authenticated };
}
