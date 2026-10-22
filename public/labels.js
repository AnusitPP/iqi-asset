export function displayFieldValue(header, value) {
  return header.trim() === 'ทีม' ? value.replace(/^\s*\d+\s*\.\s*/, '') : value;
}
