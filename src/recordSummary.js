const key=value=>value.trim().replace(/[\s\-–—]/g,'').toLowerCase();
export function recordSummary(headers,values,config={}){
 const get=names=>{const index=headers.findIndex(h=>names.some(name=>key(name)===key(h)));return index<0?'':values[index]||'';};
 const dedicated=config.dateMode==='date'&&config.dateHeader?[config.dateHeader]:['วันที่ตรวจสอบ','วันที่ตรวจเช็ค','วันที่ตรวจเช็ก','วันที่ตรวจครุภัณฑ์'];
 const notes=get(['หมายเหตุ']);
 const date=get(dedicated)||notes.match(/(?:วันที่ตรวจ(?:สอบ|เช็ค|เช็ก)?|ตรวจสอบเมื่อ|ตรวจเช็คเมื่อ)\s*[:：]?\s*(\d{1,2}\s*[/.-]\s*\d{1,2}\s*[/.-]\s*\d{4})/u)?.[1]||'';
 return {owner:get(['ชื่อ - นามสกุล','ชื่อ - สกุล','ชื่อผู้ถือครอง','ชื่อ']),initials:get(['ชื่อย่อ']),nickname:get(['ชื่อเล่น']),team:get(['ทีม']),inspectionDate:date};
}
