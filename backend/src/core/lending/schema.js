export const LOAN_HEADERS = [
  'เลขรายการยืม',
  'รหัสรายการอุปกรณ์ยืม',
  'ประทับเวลา',
  'ชื่อ - สกุล',
  'ทีม',
  'ประเภทคำร้องขอ',
  'ประเภทอุปกรณ์',
  'เลขครุภัณฑ์',
  'S/N',
  'ชื่ออุปกรณ์',
  'เหตุผล หรือวัตถุประสงค์',
  'วันที่ต้องการยืม',
  'กำหนดวันส่งคืน',
  'หมายเหตุ',
  'สถานะ',
  'ผู้รับผิดชอบ',
  'รายละเอียด',
  'รหัสคำขอ',
  'ลายนิ้วมือคำขอ',
];
export const RETURN_HEADERS = [
  'เลขรายการคืน',
  'เลขรายการยืม',
  'รหัสรายการอุปกรณ์ยืม',
  'ประทับเวลา',
  'ชื่อผู้คืน',
  'ทีม',
  'ประเภทคำร้องขอ',
  'ประเภทอุปกรณ์',
  'เลขครุภัณฑ์',
  'S/N',
  'ชื่ออุปกรณ์',
  'วันที่ส่งคืน',
  'หมายเหตุ',
  'สภาพหลังคืน',
  'สถานะรับคืน',
  'ผู้รับผิดชอบ',
  'รายละเอียด',
  'รหัสคำขอ',
  'ลายนิ้วมือคำขอ',
];

// Services keep their existing field order; the physical sheet may include email anywhere.
export function loanColumnMapping(headers = []) {
  const names = headers.map((value) => String(value).trim());
  if (
    names.length !==
      LOAN_HEADERS.length +
        (names.includes('email') ? 1 : 0) +
        (names.includes('comment') ? 1 : 0) ||
    LOAN_HEADERS.some((header) => names.filter((name) => name === header).length !== 1) ||
    names.filter((name) => name === 'email').length > 1
  )
    throw Object.assign(new Error('หัวคอลัมน์ชีตยืม–คืนไม่ตรง กรุณาตรวจสอบ'), { status: 422 });
  return {
    indices: LOAN_HEADERS.map((header) => names.indexOf(header)),
    emailIndex: names.indexOf('email'),
  };
}

export function normalizeLoanGrid(values = []) {
  const { indices } = loanColumnMapping(values[0]);
  return [
    LOAN_HEADERS,
    ...values
      .slice(1)
      .map((row) => [
        ...indices.map((index) => row[index] ?? ''),
        ...(values[0].includes('comment') ? [row[values[0].indexOf('comment')] ?? ''] : []),
      ]),
  ];
}
