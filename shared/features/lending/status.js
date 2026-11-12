export const MAX_LOAN_DAYS = 7;
export const LENDING_STATUS = {
  LOAN_PENDING: 'รอดำเนินการ',
  RETURN_PENDING: 'รอดำเนินการ',
  RETURN_RECEIVED: 'เสร็จสิ้น',
  RETURNED: 'เสร็จสิ้น',
  GOOD: 'ดี',
  DAMAGED: 'ชำรุด',
};
export const LENDING_REQUEST_TYPE = {
  LOAN: 'ส่วนที่ 1 : ยืมครุภัณฑ์คอมพิวเตอร์ หรือยืมวัสดุด้านเทคโนโลยีสารสนเทศ',
  RETURN: 'ส่วนที่ 5 : คืนครุภัณฑ์คอมพิวเตอร์ หรือคืนวัสดุด้านเทคโนโลยีสารสนเทศ',
};
export const REQUEST_STATUS_PRESENTATION = {
  รอดำเนินการ: { label: 'รอดำเนินการ', color: 'yellow' },
  เสร็จสิ้น: { label: 'เสร็จสิ้น', color: 'green' },
  ไม่อนุมัติ: { label: 'ไม่อนุมัติ', color: 'red' },
  ยกเลิก: { label: 'ยกเลิก', color: 'gray' },
  กำลังยืม: { label: 'กำลังยืม', color: 'grape' },
  รอดำเนินการคืน: { label: 'รอดำเนินการ', color: 'blue' },
  รอรับคืน: { label: 'รอรับคืน', color: 'orange' },
  รับคืนแล้ว: { label: 'รับคืนแล้ว', color: 'teal' },
  คืนแล้ว: { label: 'คืนแล้ว', color: 'teal' },
  พร้อมยืม: { label: 'พร้อมยืม', color: 'green' },
};
export const LOAN_APPROVAL_STATUSES = [
  'รอดำเนินการ',
  'เสร็จสิ้น',
  'ไม่อนุมัติ',
  'ยกเลิก',
  'กำลังยืม',
];
export const RETURN_APPROVAL_STATUSES = ['รอดำเนินการ', 'เสร็จสิ้น'];

export function requestStatusValue({ status = '', kind, completed = false }) {
  if (kind === 'คืน') return { รอรับคืน: 'รอดำเนินการ', รับคืนแล้ว: 'เสร็จสิ้น' }[status] ?? status;
  return kind === 'ยืม' && completed ? 'เสร็จสิ้น' : status;
}
export function isReturnPending({ status = '', kind, completed = false }) {
  return kind === 'คืน'
    ? ['รอดำเนินการ', 'รอรับคืน'].includes(status)
    : kind === 'ยืม' && !completed && status === 'รอดำเนินการคืน';
}
export function requestStatusPresentation(status) {
  return Object.hasOwn(REQUEST_STATUS_PRESENTATION, status)
    ? REQUEST_STATUS_PRESENTATION[status]
    : { label: status || '—', color: 'gray' };
}
export function approvalStatuses(kind) {
  return kind === 'คืน' ? RETURN_APPROVAL_STATUSES : LOAN_APPROVAL_STATUSES;
}
