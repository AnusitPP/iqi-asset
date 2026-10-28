import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const output = new URL('frontend/dist/', root);
await mkdir(output, { recursive: true });
await cp(new URL('frontend/public/', root), output, { recursive: true });
await cp(new URL('shared/', root), new URL('shared/', output), { recursive: true });
console.log(`Frontend assets prepared: ${fileURLToPath(output)}`);
