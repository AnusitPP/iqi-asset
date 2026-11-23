const normalize = (value) =>
  String(value || '')
    .normalize('NFKC')
    .replace(/[\s\u200b-\u200d\ufeff]+/g, '')
    .toUpperCase();

export async function pordDrivePhotos(store, assetIds) {
  const assets = new Set(assetIds);
  const patterns = [...assets].map((asset) => [
    asset,
    new RegExp(`(^|[^A-Z0-9])${asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^A-Z0-9])`),
  ]);
  const photos = new Map();
  const folders = new Map([[store.folder, '']]);
  const queue = [store.folder];
  const visited = new Set();
  while (queue.length) {
    const batch = queue.splice(0, 10).filter((id) => !visited.has(id));
    if (!batch.length) continue;
    batch.forEach((id) => visited.add(id));
    let pageToken;
    do {
      const { data } = await store.drive.files.list({
        q: `(${batch.map((id) => `'${id.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' in parents`).join(' or ')}) and trashed = false`,
        fields: 'files(id,name,mimeType,parents),nextPageToken',
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        orderBy: 'name',
      });
      for (const file of data.files || []) {
        const inherited = (file.parents || []).map((id) => folders.get(id)).filter(Boolean);
        const name = normalize(file.name);
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          folders.set(
            file.id,
            assets.has(name) ? name : inherited.length === 1 ? inherited[0] : '',
          );
          queue.push(file.id);
        } else if (file.mimeType?.startsWith('image/')) {
          const matches = new Set([
            ...inherited,
            ...patterns.filter(([, pattern]) => pattern.test(name)).map(([asset]) => asset),
          ]);
          if (matches.size !== 1) continue;
          const [asset] = matches;
          if (!photos.has(asset)) photos.set(asset, new Set());
          photos.get(asset).add(`https://drive.google.com/file/d/${file.id}/view`);
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  }
  return new Map([...photos].map(([asset, urls]) => [asset, [...urls].join('\n')]));
}
