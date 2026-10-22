export async function resizeForUpload(file){
 if(file.size>25*1024*1024)throw new Error('เลือกภาพขนาดไม่เกิน 25 MB');
 // HEIC is decoded on the server when the phone cannot decode it locally.
 if(/\.hei[cf]$/i.test(file.name)||/hei[cf]/i.test(file.type))return file;
 let bitmap;try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw new Error('อ่านรูปไม่ได้ กรุณาเลือก JPEG, PNG, WebP หรือ HEIC');}
 try{const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('ย่อรูปไม่สำเร็จ')),'image/jpeg',.82));}finally{bitmap.close();}
}
