/* All lending writes must enter this one script project. */
function doPost(event) {
  let lock;
  try {
    const properties = PropertiesService.getScriptProperties();
    const secret = properties.getProperty('LENDING_SCRIPT_SECRET');
    const spreadsheetId = properties.getProperty('GOOGLE_SPREADSHEET_ID');
    if (!secret || secret.length < 32 || !spreadsheetId) reject_(503, 'ตั้งค่า Apps Script ไม่ครบ');
    const text = event && event.postData && event.postData.contents;
    if (!text || text.length > 100000) reject_(400, 'คำขอไม่ถูกต้อง');
    let envelope, command;
    try { envelope = JSON.parse(text); } catch (_) { reject_(400, 'คำขอไม่ถูกต้อง'); }
    if (typeof envelope.payload !== 'string' || !/^[a-f0-9]{64}$/.test(envelope.signature || '')) reject_(401, 'ลายเซ็นคำขอไม่ถูกต้อง');
    const expected = hex_(Utilities.computeHmacSha256Signature(envelope.payload, secret, Utilities.Charset.UTF_8));
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ envelope.signature.charCodeAt(i);
    if (mismatch) reject_(401, 'ลายเซ็นคำขอไม่ถูกต้อง');
    try { command = JSON.parse(envelope.payload); } catch (_) { reject_(400, 'คำขอไม่ถูกต้อง'); }
    if (command.version !== 1 || !Number.isFinite(command.timestamp) || Math.abs(Date.now() - command.timestamp) > 300000) reject_(401, 'คำขอหมดอายุ กรุณาลองใหม่');
    if (!['loan', 'return', 'approve'].includes(command.action) || !command.body || typeof command.body !== 'object') reject_(400, 'คำสั่งไม่ถูกต้อง');
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) reject_(503, 'มีรายการกำลังบันทึก กรุณาลองคำขอเดิมอีกครั้ง');
    const book = SpreadsheetApp.openById(spreadsheetId);
    const state = readState_(book);
    const result = command.action === 'approve'
      ? approve_(spreadsheetId, state, command.body)
      : submit_(spreadsheetId, book, state, command.action, command.body);
    return json_({ ok: true, result });
  } catch (error) {
    return json_({ ok: false, status: error.status || 502, error: error.status ? error.message : 'บันทึก Google Sheets ไม่สำเร็จ กรุณาลองคำขอเดิมอีกครั้ง' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}
function reject_(status, message) { throw Object.assign(new Error(message), { status }); }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function hex_(bytes) { return bytes.map((byte) => (byte & 255).toString(16).padStart(2, '0')).join(''); }
function fingerprint_(value) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(value), Utilities.Charset.UTF_8)); }
function text_(value, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) reject_(400, 'ข้อมูลไม่ครบหรือยาวเกินกำหนด');
  return value.trim();
}
function date_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) reject_(400, 'วันที่ไม่ถูกต้อง');
  return value;
}
function sheet_(book, name) {
  const sheet = book.getSheetByName(name);
  if (!sheet) reject_(422, 'ไม่พบชีต ' + name);
  return sheet;
}
function readState_(book) {
  const loanSheet = sheet_(book, 'รายการยืมครุภัณฑ์');
  const returnSheet = sheet_(book, 'รายการคืนครุภัณฑ์');
  const loanGrid = loanSheet.getDataRange().getDisplayValues();
  const returnGrid = returnSheet.getDataRange().getDisplayValues();
  const mapping = loanColumnMapping(loanGrid[0]);
  if (JSON.stringify(returnGrid[0]) !== JSON.stringify(RETURN_HEADERS)) reject_(422, 'หัวคอลัมน์ชีตคืนไม่ตรง กรุณาตรวจสอบ');
  const loans = normalizeLoanGrid(loanGrid).slice(1).map((row, index) => ({ row, index: index + 1 })).filter((entry) => entry.row[0]);
  const returns = returnGrid.slice(1).map((row, index) => ({ row, index: index + 1 })).filter((entry) => entry.row[0]);
  return { loanSheet, returnSheet, mapping, loans, returns };
}
function cell_(sheetId, rowIndex, columnIndex, value) {
  return { updateCells: { start: { sheetId, rowIndex, columnIndex }, rows: [{ values: [{ userEnteredValue: { stringValue: value } }] }], fields: 'userEnteredValue' } };
}
function append_(sheetId, row) {
  return { appendCells: { sheetId, rows: [{ values: row.map((value) => ({ userEnteredValue: { stringValue: String(value ?? '') } })) }], fields: 'userEnteredValue' } };
}
function submit_(spreadsheetId, book, state, action, body) {
  const requestId = text_(body.requestId, 100);
  if (!/^[\w-]{8,100}$/.test(requestId)) reject_(400, 'รหัสคำขอไม่ถูกต้อง');
  // Canonical fields keep retries stable and ignore extra browser payload fields.
  const input = {
    requestId, borrower: text_(body.borrower, 200), team: text_(body.team, 200),
    notes: text_(body.notes ?? '', 2000, false),
    asset: text_(body.selectedAsset?.asset, 500), serial: text_(body.selectedAsset?.serial ?? '', 500, false),
  };
  if (!FORM_TEAMS.includes(input.team)) reject_(400, 'กรุณาเลือกทีมจากรายการ');
  if (action === 'loan') {
    input.purpose = text_(body.purpose, 500);
    input.start = date_(body.start); input.due = date_(body.due);
    input.email = text_(body.email ?? '', 254, false);
    if (input.email && !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(input.email)) reject_(400, 'อีเมลผู้ยืมไม่ถูกต้อง');
  } else {
    input.date = date_(body.date);
    if (!Array.isArray(body.ownLoanIds) || body.ownLoanIds.some((id) => typeof id !== 'string')) reject_(403, 'ไม่พบรายการยืมของบัญชีนี้');
  }
  const hash = fingerprint_(input);
  const existing = (action === 'loan' ? state.loans : state.returns).filter((entry) => entry.row[17] === requestId);
  if (existing.length) {
    if (existing.length !== 1 || existing[0].row[18] !== hash) reject_(409, 'รหัสคำขอถูกใช้กับข้อมูลอื่นแล้ว');
    if (action === 'return' && !body.ownLoanIds.includes(existing[0].row[1])) reject_(403, 'รายการนี้ไม่ใช่ของบัญชีนี้');
    return { id: existing[0].row[0], unchanged: true };
  }
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss');
  if (action === 'loan') {
    const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
    if (input.start < today) reject_(400, 'วันที่ยืมต้องไม่ย้อนหลัง');
    const days = (Date.parse(input.due) - Date.parse(input.start)) / 86400000;
    if (days < 0 || days > MAX_LOAN_DAYS) reject_(400, 'กำหนดคืนต้องอยู่ภายใน 7 วันหลังวันยืม');
    const matches = readyToBorrowData(sheet_(book, 'พร้อมยืม').getDataRange().getDisplayValues()).records.filter((record) => record.asset === input.asset && record.serial === input.serial);
    if (matches.length !== 1) reject_(409, 'ไม่พบอุปกรณ์ในชีตพร้อมยืมหรือข้อมูลซ้ำ');
    const record = matches[0];
    const received = state.returns.filter((entry) => entry.row[14] === 'เสร็จสิ้น');
    const returned = new Set(received.map((entry) => entry.row[2]));
    if (state.loans.some(({ row }) => !returned.has(row[1]) && !['ไม่อนุมัติ', 'ยกเลิก'].includes(row[14]) && row[7] === input.asset && (row[8] || '') === input.serial)) reject_(409, 'อุปกรณ์นี้มีรายการยืมค้างอยู่');
    const latest = received.filter(({ row }) => row[8] === input.asset && (row[9] || '') === input.serial).pop();
    if (latest && latest.row[13] !== 'ดี') reject_(409, 'อุปกรณ์นี้ไม่พร้อมยืม');
    const id = 'L-' + Utilities.getUuid();
    const row = [id, Utilities.getUuid(), timestamp, input.borrower, input.team, LENDING_REQUEST_TYPE.LOAN, catalogCategory(record.name), record.asset, record.serial, record.name, input.purpose, input.start, input.due, input.notes, 'รอดำเนินการ', '', '', requestId, hash];
    const physical = Array(LOAN_HEADERS.length + (state.mapping.emailIndex >= 0 ? 1 : 0)).fill('');
    state.mapping.indices.forEach((column, index) => { physical[column] = row[index]; });
    if (state.mapping.emailIndex >= 0) physical[state.mapping.emailIndex] = input.email;
    Sheets.Spreadsheets.batchUpdate({ requests: [append_(state.loanSheet.getSheetId(), physical)] }, spreadsheetId);
    return { id };
  }
  const matches = state.loans.filter(({ row }) => body.ownLoanIds.includes(row[0]) && row[7] === input.asset && (row[8] || '') === input.serial && !state.returns.some((entry) => entry.row[2] === row[1] && entry.row[14] === 'เสร็จสิ้น') && !['ไม่อนุมัติ', 'ยกเลิก'].includes(row[14]));
  if (matches.length !== 1) reject_(409, 'ไม่พบรายการยืมของบัญชีนี้ที่ตรงกับอุปกรณ์');
  const loan = matches[0];
  if (state.returns.some((entry) => entry.row[2] === loan.row[1])) reject_(409, 'รายการนี้ส่งคำขอคืนแล้ว');
  if (loan.row[14] !== 'กำลังยืม') reject_(409, 'คืนได้เฉพาะรายการที่อยู่ในสถานะกำลังยืม');
  const id = 'R-' + Utilities.getUuid();
  const row = [id, loan.row[0], loan.row[1], timestamp, input.borrower, loan.row[4], LENDING_REQUEST_TYPE.RETURN, loan.row[6], loan.row[7], loan.row[8] || '', loan.row[9] || '', input.date, input.notes, '', 'รอดำเนินการ', '', '', requestId, hash];
  // One atomic batch: the return row and the loan status cannot diverge.
  Sheets.Spreadsheets.batchUpdate({ requests: [cell_(state.loanSheet.getSheetId(), loan.index, state.mapping.indices[14], 'รอดำเนินการคืน'), append_(state.returnSheet.getSheetId(), row)] }, spreadsheetId);
  return { id };
}
function approve_(spreadsheetId, state, body) {
  const returning = body.kind === 'คืน';
  if (!['ยืม', 'คืน'].includes(body.kind)) reject_(400, 'ประเภทคำขอไม่ถูกต้อง');
  const statuses = returning ? ['รอดำเนินการ', 'กำลังดำเนินการ', 'เสร็จสิ้น'] : ['รอดำเนินการ', 'กำลังดำเนินการ', 'เสร็จสิ้น', 'ไม่อนุมัติ', 'ยกเลิก', 'กำลังยืม'];
  if (!statuses.includes(body.status)) reject_(400, 'สถานะไม่ถูกต้อง');
  const responsible = text_(body.responsible, 200);
  const expectedStatus = text_(body.expectedStatus, 200);
  const matches = (returning ? state.returns : state.loans).filter((entry) => entry.row[0] === body.id);
  if (matches.length !== 1) reject_(409, 'ไม่พบรายการหรือรหัสซ้ำ');
  const { row, index } = matches[0];
  if (row[14] === body.status && (!returning || body.status !== 'เสร็จสิ้น' || row[13] === body.condition)) return { id: body.id, unchanged: true };
  if (row[14] !== expectedStatus) reject_(409, 'สถานะเปลี่ยนไปแล้ว กรุณาโหลดรายการใหม่');
  if (['เสร็จสิ้น', 'รับคืนแล้ว'].includes(row[14]) || (!returning && (row[14] === 'รอดำเนินการคืน' || state.returns.some((entry) => entry.row[2] === row[1])))) reject_(409, 'รายการนี้ไม่สามารถเปลี่ยนสถานะได้แล้ว');
  if (returning && body.status === 'เสร็จสิ้น' && !['ดี', 'ชำรุด'].includes(body.condition)) reject_(400, 'กรุณาระบุสภาพหลังคืน');
  const sheetId = (returning ? state.returnSheet : state.loanSheet).getSheetId();
  const column = (logical) => returning ? logical : state.mapping.indices[logical];
  const requests = [cell_(sheetId, index, column(14), body.status), cell_(sheetId, index, column(15), responsible)];
  if (returning && body.status === 'เสร็จสิ้น') {
    const loans = state.loans.filter((entry) => entry.row[0] === row[1] && entry.row[1] === row[2]);
    if (loans.length !== 1) reject_(409, 'ไม่พบรายการยืมที่เชื่อมกับคำขอคืน');
    requests.push(cell_(sheetId, index, 13, body.condition), cell_(state.loanSheet.getSheetId(), loans[0].index, state.mapping.indices[14], 'เสร็จสิ้น'));
  }
  // Reactivating a rejected/canceled loan must not double-book its equipment.
  if (!returning && !['ไม่อนุมัติ', 'ยกเลิก'].includes(body.status)) {
    const returned = new Set(state.returns.filter((entry) => entry.row[14] === 'เสร็จสิ้น').map((entry) => entry.row[2]));
    if (state.loans.some((entry) => entry.row[0] !== row[0] && entry.row[7] === row[7] && (entry.row[8] || '') === (row[8] || '') && !returned.has(entry.row[1]) && !['ไม่อนุมัติ', 'ยกเลิก'].includes(entry.row[14]))) reject_(409, 'อุปกรณ์นี้มีรายการยืมอื่นค้างอยู่');
  }
  Sheets.Spreadsheets.batchUpdate({ requests }, spreadsheetId);
  return { id: body.id, previousStatus: row[14] };
}
