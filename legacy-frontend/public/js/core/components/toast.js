export function showToast(message) {
  const toast = document.querySelector('#toast');
  const detailDialog = document.querySelector('#detail-dialog');
  (detailDialog?.open ? detailDialog : document.body).append(toast);
  toast.textContent = message;
  toast.hidden = false;
  window.setTimeout(() => {
    toast.hidden = true;
  }, 4500);
}
