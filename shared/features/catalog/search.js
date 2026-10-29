export function matchCatalog(records, query) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return words.length
    ? records.filter((r) => {
        const text = [r.asset, r.serial, r.name].join(' ').toLocaleLowerCase();
        return words.every((word) => text.includes(word));
      })
    : records;
}
export function catalogCategory(name) {
  return /keyboard|คีย์บอร์ด/i.test(name)
    ? 'คีย์บอร์ด (Keyboard)'
    : /mouse|เมาส์/i.test(name)
      ? 'เมาส์ (Mouse)'
      : /printer|เครื่องพิมพ์|เครื่องปริ้น/i.test(name)
        ? 'เครื่องพิมพ์เอกสาร (Printer)'
        : /monitor|จอมอนิเตอร์/i.test(name)
          ? 'หน้าจอ (Monitor)'
          : /laptop|notebook|โน๊ตบุ๊|โน้ตบุ๊/i.test(name)
            ? 'คอมพิวเตอร์พกพา (Laptop Computer)'
            : /คอมพิวเตอร์|desktop|all in one/i.test(name)
              ? 'คอมพิวเตอร์ตั้งโต๊ะ (Desktop Computer)'
              : 'อื่นๆ';
}

export const assetIdentityKey = (record) => JSON.stringify([record.asset, record.serial]);
