import {test} from 'node:test';
import assert from 'node:assert/strict';
import {displayFieldValue} from '../public/labels.js';
test('team labels hide number prefixes while other fields and original values remain intact',()=>{
 const original='15.IQI';assert.equal(displayFieldValue('ทีม',original),'IQI');assert.equal(original,'15.IQI');
 assert.equal(displayFieldValue('ทีม','1. GA'),'GA');
 assert.equal(displayFieldValue('ทีม','0.TOP'),'TOP');
 assert.equal(displayFieldValue('ทีม','Tech Up'),'Tech Up');
 assert.equal(displayFieldValue('รายการ','1. อุปกรณ์'),'1. อุปกรณ์');
});
