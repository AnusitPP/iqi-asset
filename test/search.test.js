import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAsset, parseSheet, findRecords, inspectionDate, todayBangkok} from '../src/searchService.js';
test('normalization preserves exact digits and normalizes spaces and dashes',()=>{
 assert.equal(normalizeAsset('  STeP61 – 207—007  '),'step61-207-007');
 assert.notEqual(normalizeAsset('207-008'),normalizeAsset('207-007'));
});
test('finds real header position, preserves empty and extra columns, and every duplicate',()=>{
 const table=parseSheet('IQI', [['title'],['รายการ','เลขครุภัณฑ์','','หมายเหตุ'],['Laptop','207-007','',''],['Other','207-007','','note','extra']]);
 assert.equal(table.headerRow,2); assert.equal(table.headers.length,5);
 assert.equal(findRecords(table,'STeP61-207-007').records.length,2);
 assert.equal(findRecords(table,'Laptop').records.length,1);
 assert.equal(findRecords(table,'207-008').records.length,0);
});
test('full search retains suffix fallback without matching a different prefix',()=>{
 const table=parseSheet('all',[['เลขครุภัณฑ์'],['STeP61-207-007'],['207-007'],['STeP62-207-007']]);
 assert.equal(findRecords(table,'step61-207-007').records.length,1);
 assert.equal(findRecords(table,'step60-207-007').records.length,1);
 assert.equal(findRecords(table,'step60-207-007').records[0].row,3);
});
test('date detection refuses ambiguity and Bangkok date uses Buddhist year',()=>{
 assert.equal(inspectionDate(['ชื่อ','วันที่ตรวจสอบ']),1);
 assert.equal(inspectionDate(['วันที่ตรวจสอบ','วันที่ตรวจเช็ค']),null);
 assert.equal(inspectionDate(['วันที่ตรวจสอบ','วันที่ตรวจเช็ค'],'วันที่ตรวจเช็ค'),1);
 assert.equal(todayBangkok(new Date('2026-10-19T18:00:00Z')),'20/10/2569');
});
test('partial search returns every containing asset number, even when an exact match exists',()=>{
 const table=parseSheet('IQI',[['เลขครุภัณฑ์','Serial Number'],['0',''],['STeP64-107-002',''],['207-007',''],['999','0'],['','0']]);
 assert.deepEqual(findRecords(table,'0').records.map(r=>r.row),[2,3,4,5,6]);
 assert.equal(findRecords(table,'107').records.length,1);
 assert.equal(findRecords(table,'STEP64').records.length,1);
 assert.equal(findRecords(table,'   ').records.length,0);
 assert.equal(findRecords(table,'.*').records.length,0);
});

test('searches asset numbers and serial header aliases together without duplicate rows',()=>{
 for(const header of ['Serial Number (S/N)','Serial Number','S/N','SN','Serial No.']){
  const table=parseSheet('all',[['เลขครุภัณฑ์',header,'รายละเอียด'],['ASSET-123','SN-ABC-123',''],['OTHER','SN-ABC-999',''],['UNRELATED','','SN-ABC-123']]);
  assert.deepEqual(findRecords(table,'sn-abc').records.map(r=>r.row),[2,3,4]);
  assert.deepEqual(findRecords(table,'123').records.map(r=>r.row),[2,4]);
  assert.equal(findRecords(table,'sn-abc-1234').records.length,0);
  assert.equal(findRecords(table,'ASSET-123').records.length,1);
 }
});

test('searches all displayed fields and combines words across columns without repeating rows',()=>{
 const t=parseSheet('IQI',[['เลขครุภัณฑ์','รายการ','ชื่อ','ชื่อเล่น','ทีม','Brand','รายละเอียด','รุ่น'],['001','Monitor','สมชาย','ปั๊บ','IQI','SAMSUNG','ซ่อมแล้ว','X900'],['002','Mouse','สมชาย','เอ','IT','Logitech','','M100']]);
 for(const q of ['สมชาย','ปั๊บ','IQI','samsung','ซ่อม','X900'])assert.ok(findRecords(t,q).records.some(r=>r.row===2),q);
 assert.deepEqual(findRecords(t,'สมชาย samsung').records.map(r=>r.row),[2]);
 assert.equal(findRecords(t,'ปั๊บ logitech').records.length,0);
 assert.equal(findRecords(t,'รายละเอียด').records.length,0);
});

test('equipment aliases match Thai and English device names and can combine with owner names',()=>{
 const t=parseSheet('all',[['เลขครุภัณฑ์','อุปกรณ์','ชื่อเล่น','รายละเอียด'],['001','MONITOR','ปั๊บ',''],['002','หน้าจอ','เอ',''],['003','NOTEBOOK','บี',''],['004','Mouse','ซี','Monitor'],['005','เครื่องพิมพ์','ดี','']]);
 assert.deepEqual(findRecords(t,'จอ').records.map(r=>r.row),[2,3]);
 assert.deepEqual(findRecords(t,'monitor').records.map(r=>r.row),[2,3,5]);
 assert.deepEqual(findRecords(t,'จอ ปั๊บ').records.map(r=>r.row),[2]);
 assert.deepEqual(findRecords(t,'แล็ปท็อป').records.map(r=>r.row),[4]);
 assert.deepEqual(findRecords(t,'printer').records.map(r=>r.row),[6]);
 assert.equal(findRecords(t,'จอไม่มีจริง').records.length,0);
});
