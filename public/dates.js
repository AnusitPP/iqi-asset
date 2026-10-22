export function todayBangkok(date=new Date()) {
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(date);
 const get=type=>parts.find(p=>p.type===type).value;
 return `${get('day')}/${get('month')}/${Number(get('year'))+543}`;
}
export function inspectionNote(value,date) {
 const pattern=/(วันที่ตรวจ(?:สอบ|เช็ค|เช็ก)?\s*[:：]?\s*)\d{1,2}\s*[/.-]\s*\d{1,2}\s*[/.-]\s*\d{2,4}/gu;
 return pattern.test(value)?value.replace(pattern,(_,prefix)=>prefix+date):`${value.trim()}${value.trim()?'\n':''}วันที่ตรวจสอบ ${date}`;
}
function civilDate(value){
 const text=String(value??'').trim().replace(/[๐-๙]/g,digit=>String(digit.charCodeAt(0)-3664));
 let day,month,year;let match=text.match(/^(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})$/);
 if(match)[,day,month,year]=match.map(Number);
 else{match=text.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return null;[,year,month,day]=match.map(Number);}
 if(year>=2400)year-=543;
 if(year<1900||year>2200)return null;
 const stamp=Date.UTC(year,month-1,day);const date=new Date(stamp);
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;
 return {stamp,label:`${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year+543}`};
}
export function inspectionAge(value,now=new Date()){
 const checked=civilDate(value);const today=civilDate(typeof now==='string'?now:todayBangkok(now));
 return checked&&today?{date:checked.label,days:Math.round((today.stamp-checked.stamp)/86400000)}:null;
}
