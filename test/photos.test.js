import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {preparePhoto,DashboardPhotos,photoIds} from '../src/photos.js';
import {dashboardData,DashboardEditor} from '../src/dashboard.js';
test('photos are resized, oriented, converted to JPEG and stripped of location metadata',async()=>{
 const input=await sharp({create:{width:2400,height:1200,channels:3,background:'red'}}).withMetadata({orientation:6}).jpeg().toBuffer();
 const out=await preparePhoto(input),m=await sharp(out).metadata();assert.equal(m.format,'jpeg');assert.equal(m.width,800);assert.equal(m.height,1600);assert.equal(m.exif,undefined);assert.ok(out.length<input.length);
 await assert.rejects(preparePhoto(Buffer.from('not an image')),/อ่านรูป/);await assert.rejects(preparePhoto(Buffer.alloc(26*1024*1024)),/25 MB/);
});
test('photo upload rejects stale identities, appends links and preserves inspection status',async()=>{
 const grid=[['ผลตรวจ Apps Script','สถานะการเทียบ','เลขครุภัณฑ์ Apps Script','S/N Apps Script','ลิงก์รูปครุภัณฑ์','วันที่อัปโหลดรูป'],['ดี','ตรงกัน','001','SN-A','',''],['ชำรุด','ตรงกัน','001','SN-B','','']];
 let uploads=0;const adapter={readDashboard:async()=>structuredClone(grid),writeDashboardPhotos:async(row,links,date)=>{grid[row-1][4]=links;grid[row-1][5]=date;}};
 const store={upload:async()=>{uploads++;return {id:'test-photo',url:'https://drive.google.com/file/d/test-photo/view'};},read:async id=>id};
 const service=new DashboardPhotos(adapter,store,new DashboardEditor(adapter));const image=await sharp({create:{width:20,height:10,channels:3,background:'red'}}).png().toBuffer();
 await assert.rejects(service.upload(2,'stale',image),/เปลี่ยน/);assert.equal(uploads,0);
 const result=await service.upload(2,dashboardData(grid).records[0].revision,image);assert.ok(result.at);assert.equal(grid[1][0],'ดี');assert.equal(grid[2][4],'');assert.equal(await service.read(2,'test-photo'),'test-photo');await assert.rejects(service.read(3,'test-photo'),/ไม่พบ/);
 assert.deepEqual(photoIds('https://evil.example/file/d/xyz/view\nhttps://drive.google.com/file/d/test-photo/view'),['test-photo']);
});
