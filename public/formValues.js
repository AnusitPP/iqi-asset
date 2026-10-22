// Textareas normalize CRLF. Preserve original cell strings unless the user
// changed the displayed value, so untouched formula results remain untouched.
export function editedValues(original,baseline,current){
 return current.map((value,index)=>value===baseline[index]?original[index]:value);
}
