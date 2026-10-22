export async function copyText(value){
 if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(value);return;}catch{/* LAN HTTP may need the legacy clipboard path. */}}
 const previous=document.activeElement;const selection=document.getSelection();
 const ranges=selection?Array.from({length:selection.rangeCount},(_,i)=>selection.getRangeAt(i).cloneRange()):[];
 const input=document.createElement('textarea');input.value=value;input.readOnly=true;input.style.cssText='position:fixed;left:0;top:0;opacity:0;pointer-events:none';
 document.body.append(input);
 try{input.focus({preventScroll:true});input.select();if(!document.execCommand('copy'))throw new Error('copy failed');}
 finally{input.remove();previous?.focus({preventScroll:true});if(selection){selection.removeAllRanges();ranges.forEach(range=>selection.addRange(range));}}
}
