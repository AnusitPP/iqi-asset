import os from 'node:os';
export function lanAddresses() {
  return [
    ...new Set(
      Object.values(os.networkInterfaces())
        .flat()
        .filter((n) => n && n.family === 'IPv4' && !n.internal && !n.address.startsWith('169.254.'))
        .map((n) => n.address),
    ),
  ];
}
