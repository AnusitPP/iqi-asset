export function readyToBorrowData(values = []) {
  const headers = (values[0] || []).map((value) => String(value).trim());
  for (const name of ['เลขครุภัณฑ์', 'S/N', 'ชื่ออุปกรณ์']) {
    if (headers.filter((header) => header === name).length !== 1)
      throw Object.assign(new Error(`พร้อมยืม: ไม่พบคอลัมน์ ${name} หรือมีคอลัมน์ซ้ำ`), {
        status: 422,
      });
  }
  const records = values.slice(1).flatMap((row, index) => {
    const get = (name) => String(row[headers.indexOf(name)] ?? '').trim();
    const asset = get('เลขครุภัณฑ์');
    if (!asset) return [];
    return [{ row: index + 2, asset, serial: get('S/N'), name: get('ชื่ออุปกรณ์') }];
  });
  return { records };
}
