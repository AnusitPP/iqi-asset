# IQI Asset frontend

Next.js + TypeScript frontend. `src/pages/api/[[...path]].ts` forwards API requests to the existing Express backend in `../backend/` through `../api/index.js`.

Run from the repository root:

```sh
npm ci
cp frontend/.env.example frontend/.env.local
npm run dev:api
# Another terminal
npm run dev
```

`npm run build` builds this workspace into `frontend/.next`. `npm start` starts the built app. Local development uses `IQI_BACKEND_ORIGIN`; Vercel uses the embedded API adapter.

On Vercel set Root Directory to `frontend`, Framework Preset to Next.js, and enable source files outside Root Directory. `vercel.json` installs from the root lockfile, builds Next.js, and uses `.next` as output. Keep the existing backend environment variables in the same project.

See [deployment settings](../docs/vercel-deployment.md) and [frontend guide](../docs/web.md).
