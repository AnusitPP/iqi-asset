export async function readDropdowns(cells, width, resolveRange) {
  const rangeCache = new Map();
  return Promise.all(
    Array.from({ length: width }, async (_, index) => {
      const rule = cells[index]?.dataValidation;
      const condition = rule?.condition;
      if (!['ONE_OF_LIST', 'ONE_OF_RANGE'].includes(condition?.type)) return null;
      let values = [];
      if (condition.type === 'ONE_OF_LIST')
        values = (condition.values || []).map((v) => v.userEnteredValue ?? '');
      else {
        const range = condition.values?.[0]?.userEnteredValue?.replace(/^=/, '');
        if (!range)
          throw Object.assign(new Error('ไม่พบช่วงข้อมูลของ dropdown ใน Google Sheets'), {
            status: 422,
          });
        if (!rangeCache.has(range)) rangeCache.set(range, resolveRange(range));
        values = (await rangeCache.get(range)).flat();
      }
      return {
        options: [
          ...new Set(values.filter((v) => v !== '' && v !== null && v !== undefined).map(String)),
        ],
        strict: rule.strict === true,
      };
    }),
  );
}
export function validateDropdownChanges(changes, rules, headers) {
  for (const { index, value } of changes) {
    const rule = rules[index];
    if (rule?.strict && value !== '' && !rule.options.includes(value))
      throw Object.assign(
        new Error(
          `ช่อง “${headers[index] || `คอลัมน์ ${index + 1}`}” ต้องเลือกค่าจาก dropdown ล่าสุดใน Google Sheets กรุณาเปิดรายละเอียดใหม่`,
        ),
        { status: 422 },
      );
  }
}
