import { logError } from '../../core/errors/errors.js';

const normalizeName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLowerCase();

export function borrowerNickname(index, borrower) {
  return index.get(normalizeName(borrower)) || '';
}

export function staffNicknameIndex(valueRanges) {
  const nicknames = new Map();
  for (const { values = [] } of valueRanges) {
    for (const [i, row] of values.entries()) {
      const name = normalizeName(row[0]);
      if (!name) continue;
      let nickname = String(row[2] || '').trim();
      const previous = values[i - 1];
      // This directory places an English name alone immediately below its Thai name.
      if (
        !nickname &&
        /^[a-z]+(?:[ .'-]+[a-z]+)+$/i.test(name) &&
        row.slice(1).every((value) => !String(value || '').trim()) &&
        /[ก-๙]/u.test(String(previous?.[0] || ''))
      ) {
        nickname = String(previous?.[2] || '').trim();
      }
      if (!nickname) continue;
      nicknames.set(name, nicknames.has(name) && nicknames.get(name) !== nickname ? '' : nickname);
    }
  }
  return nicknames;
}

export function createStaffNicknameReader(adapter, spreadsheetId) {
  let cached;
  let expiresAt = 0;
  return async () => {
    if (!spreadsheetId) return new Map();
    if (!cached || Date.now() >= expiresAt) {
      expiresAt = Date.now() + 5 * 60_000;
      cached = adapter.api.spreadsheets
        .get({
          spreadsheetId,
          fields: 'sheets.properties.title',
        })
        .then(({ data }) =>
          adapter.api.spreadsheets.values.batchGet({
            spreadsheetId,
            // shortcut: names/nicknames use columns C/E; update if the directory layout changes.
            ranges: data.sheets.map(
              ({ properties }) => `'${properties.title.replaceAll("'", "''")}'!C:E`,
            ),
          }),
        )
        .then(({ data }) => staffNicknameIndex(data.valueRanges || []))
        .catch((error) => {
          logError(error, 'staff-nicknames');
          expiresAt = Date.now() + 30_000;
          return new Map();
        });
    }
    return cached;
  };
}
