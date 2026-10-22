import {reviewValues,reviewKey,REVIEW_SHEET} from './reviewQueue.js';
export const IQI_IT_SHEET='IQI + IT';
export function reviewDestination(table,record){
 const values=reviewValues(table,record),team=values[4].trim().toUpperCase(),owner=values[1].trim().toUpperCase();
 return team==='IQI'&&(owner==='IT'||owner==='')?IQI_IT_SHEET:REVIEW_SHEET;
}
export class ReviewQueues{
 constructor(adapter,queues){this.adapter=adapter;this.queues=new Map(queues.map(q=>[q.sheet,q]));}
 async read(){
  const queues=[...this.queues.values()],request={spreadsheetId:this.adapter.config.spreadsheetId,ranges:queues.map(q=>`'${q.sheet.replaceAll("'","''")}'`)};
  const [formatted,raw]=await Promise.all(['FORMATTED_VALUE','FORMULA'].map(valueRenderOption=>this.adapter.api.spreadsheets.values.batchGet({...request,valueRenderOption})));
  const tabs=queues.map((q,i)=>q.parse(formatted.data.valueRanges[i].values||[],raw.data.valueRanges[i].values||[]));
  return {entries:tabs.flatMap(t=>t.entries)};
 }
 async locate(table,record,next=record){
  const oldKey=reviewKey(table,record),newKey=reviewKey(table,next);const entries=(await this.read()).entries.filter(e=>e.key===oldKey||e.key===newKey);
  if(entries.length>1)throw Object.assign(new Error('พบรายการซ้ำระหว่างชีตรอตรวจสอบ กรุณาตรวจสอบก่อนบันทึก'),{status:409});
  return this.queues.get(entries[0]?.queueSheet||reviewDestination(table,next));
 }
 async setSelection(table,record,pending){const queue=await this.locate(table,record);return {...await queue.setSelection(table,record,pending),reviewSheet:queue.sheet};}
 async applyChanges(table,record,changes){const next={...record,values:[...record.values]};for(const c of changes)next.values[c.index]=c.value;return (await this.locate(table,record,next)).applyChanges(table,record,changes);}
 async inspection(table,record,update){const queue=await this.locate(table,record);return {...await queue.inspection(table,record,update),reviewSheet:queue.sheet};}
}
