export async function excelExport(rows) {
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('รายงานครุภัณฑ์ ปี 70', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  if (!rows.length) return Buffer.from(await book.xlsx.writeBuffer());
  const headers = rows[0];
  const photos = headers.indexOf('รูป (ลิงก์)');
  const linksFor = (row) =>
    String(row[photos] || '')
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
  const photoCount =
    photos < 0 ? 0 : rows.slice(1).reduce((max, row) => Math.max(max, linksFor(row).length), 1);
  const columns = headers.flatMap((header, index) =>
    index === photos
      ? Array.from({ length: photoCount }, (_, photo) => ({
          header: `รูป ${photo + 1}`,
          width: 14,
          source: index,
          photo,
        }))
      : [
          {
            header,
            width:
              {
                เลขครุภัณฑ์: 26,
                'S/N': 24,
                ชื่ออุปกรณ์: 58,
                สภาพ: 16,
                ที่ตั้ง: 28,
                ราคาทุน: 18,
                วันที่อัปเดตล่าสุด: 28,
                ชื่อผู้ถือครอง: 28,
              }[header] || 24,
            source: index,
          },
        ],
  );
  sheet.columns = columns.map(({ header, width }) => ({ header, width }));
  sheet.getRow(1).height = 30;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { name: 'Tahoma', size: 11, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8ECEF' } };
    cell.alignment = { vertical: 'middle', wrapText: false };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFB7C2CC' } } };
  });
  for (const sourceRow of rows.slice(1)) {
    const row = sheet.addRow(
      columns.map((column) => {
        if (column.photo !== undefined) {
          const link = linksFor(sourceRow)[column.photo] || '';
          if (/^https?:\/\//i.test(link))
            return { text: `เปิดรูป ${column.photo + 1}`, hyperlink: link };
          return link;
        }
        const text = String(sourceRow[column.source] ?? '');
        if (column.header === 'ราคาทุน' && /^-?\d[\d,]*(?:\.\d+)?$/.test(text))
          return Number(text.replaceAll(',', ''));
        return text;
      }),
    );
    row.height = Math.max(
      30,
      Math.ceil(String(sourceRow[headers.indexOf('ชื่ออุปกรณ์')] || '').length / 48) * 18,
    );
    row.eachCell({ includeEmpty: true }, (cell, index) => {
      const column = columns[index - 1];
      cell.font = {
        name: 'Tahoma',
        size: 11,
        ...(column.photo !== undefined && cell.value
          ? { color: { argb: 'FF1565C0' }, underline: true }
          : {}),
      };
      cell.alignment = { vertical: 'middle', wrapText: column.header === 'ชื่ออุปกรณ์' };
      cell.numFmt = column.header === 'ราคาทุน' ? '#,##0.00' : '@';
    });
  }
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length, column: columns.length },
  };
  sheet.pageSetup.printTitlesRow = '1:1';
  return Buffer.from(await book.xlsx.writeBuffer());
}
