# Deploy IQI Asset to Vercel

The existing `api/index.js` exports an Express app without a listener. It loads the shared runtime lazily and returns a safe JSON 503 if configuration or runtime imports fail. `server.js` remains the local listener. `vercel.json` selects the generic Node API function and serves `public/` as static assets; do not switch the project to the Express framework preset while retaining this configuration.

## Root causes fixed

- OAuth previously read `process.env` independently of config and treated a configured object as a file path. Both Sheets and Drive now receive credentials through config, preferring JSON environment variables over local file paths.
- Invalid credential JSON could throw during module import and become `FUNCTION_INVOCATION_FAILED`. Parsing now reports the variable name without its contents, and the entry point catches runtime import failures.
- The frontend called `response.json()` on every response, including Vercel text/HTML failures. It now checks Content-Type and HTTP status and reports non-JSON or malformed JSON errors.
- Runtime readiness loads existing queue metadata without running migrations. Missing schema returns 422 with the setup command; migrations remain a separate explicit command.
- Hosted requests use configured hostnames, one platform proxy hop, secure cookies, signed-cookie sessions and a stable secret for CSRF and signed revisions. Local requests do not trust forwarded headers.
- Logs include safe messages, status and stack frames rather than Google request objects, response bodies, credential values or authorization headers.

## Local environment

Copy `.env.example` to `.env` if you have not already configured it. Keep your existing private values. Use `GOOGLE_SERVICE_ACCOUNT_FILE` and, for a My Drive folder, `GOOGLE_DRIVE_OAUTH_FILE`. Configure `APP_PASSWORD`, `GOOGLE_SPREADSHEET_ID`, `GOOGLE_PHOTO_FOLDER_ID`, the three `SHEET_*` names and the existing `IQI_DATE_*` settings. `PORT` and `HOST` default to 3000 and 0.0.0.0.

Leave the JSON variables empty to retain local file credentials. Signed session cookies expire after eight hours. `APP_SECRET` is optional locally but required on Vercel. Do not set `VERCEL=1` in local `.env`.

```sh
npm ci
npm test
npm run lint
npm run check
npm start
```

Tests use mocks and never write to real Google Sheets or Drive. Starting the local server preserves its existing sheet preparation behavior and may modify a configured sheet. If a sheet has not been prepared, run the following deliberately against the correct spreadsheet before deployment:

```sh
npm run setup:sheets
```

This command may add the existing required status/review columns and tabs, apply the app's existing migrations, and copy pending selections. It is not a read-only health check. It was not run against live data during verification.

## Required Vercel environment variables

| Name                                        | Value                                                               |
| ------------------------------------------- | ------------------------------------------------------------------- |
| `APP_PASSWORD`                              | Your application password; no production fallback                   |
| `APP_SECRET`                                | Random secret of at least 32 characters, identical across instances |
| `GOOGLE_SERVICE_ACCOUNT_JSON`               | Complete Service Account JSON with `client_email` and `private_key` |
| `GOOGLE_SPREADSHEET_ID`                     | Target Google spreadsheet ID                                        |
| `SHEET_IQI`, `SHEET_ALL_ITEMS`, `SHEET_ALL` | Exact existing sheet names                                          |

For My Drive photo upload, set `GOOGLE_DRIVE_OAUTH_JSON` to the complete OAuth JSON with `client_id`, `client_secret` and `refresh_token`. The existing flat, `installed`, and `web` formats are supported; a root `tokens.refresh_token` is also accepted. Obtain consent locally using the existing `npm run drive:connect` workflow, then copy the resulting private JSON into Vercel settings. Never commit it. A Service Account alone can upload to an authorized Shared Drive, not a personal My Drive folder.

Also configure `GOOGLE_PHOTO_FOLDER_ID`, `IQI_DATE_HEADER`, `IQI_DATE_MODE` as locally. Set `ALLOWED_HOSTS` for custom domains as comma-separated bare hostnames, without protocol or path. The platform's `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL` are added automatically. Do not set `HOST` to a public domain; it is the local bind address.

`PUBLIC_PHOTO_PREVIEW` defaults to false. Setting true retains the existing explicit behavior of granting anyone-with-link read permission to newly uploaded photos. It is not required for authenticated in-app previews.

No external session database is required. Login cookies are signed with a key derived from `APP_SECRET` and `APP_PASSWORD`, so every instance can verify them. Changing either value invalidates existing login cookies after redeployment. Keep these values consistent across instances.

Rate limits, revoked-session IDs and write queues are kept only in each instance's memory. Logout clears the browser cookie and revokes it on the instance handling logout; a previously copied cookie can still be accepted on another instance until its eight-hour expiry. Process restarts clear local revocations and rate limits. Write queues do not coordinate simultaneous writes between instances. Existing fresh-row/revision checks remain, but do not make Sheets writes atomic. These are deliberate limitations while shared storage is disabled.

Generate a secret locally without modifying cloud credentials:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Store complete JSON as the environment variable value, not a path, and do not surround the entire value with an extra pair of quotes. JSON escapes for private-key newlines are supported. Secrets remain server-side.

## Deploy

1. Import the repository into Vercel, with Root Directory set to `iqi-asset` if that is a subdirectory of your Git repository; use the repository root if it already contains `package.json`.
2. Use Framework Preset **Other**, the committed `vercel.json`, and a supported Node.js version (22.x or 24.x). No frontend build command is needed. The static output directory is `public`.
3. Add the required Environment Variables for the intended Production/Preview environment. Share the spreadsheet and photo folder with the relevant account and enable Google Sheets API and Google Drive API.
4. Confirm the sheet schema has already been prepared, then deploy. Environment-variable changes require a new deployment.
5. Check `/`, `/app.js`, `/style.css` and `/api/auth/session`. Log in, check `/api/status`, search, open details and read an existing authorized photo. Perform write checks only with a designated test record and explicit authorization.
6. Inspect Vercel Runtime Logs for sanitized startup errors if the API returns 503. Missing environment variables must be configured in Vercel; the code cannot supply private credentials.

## Verification and limits

Automated tests cover configuration parsing, file fallback, JSON credential initialization, import/startup failures, frontend non-JSON errors, signed-cookie login across two independent instances, local logout/rate limits, signed revisions, local write queues, queue metadata readiness and HEIC size rejection. They do not establish that your actual Google credentials are valid.

The Vercel function allows 120 seconds. Writes from other instances or external Google Sheets editors are not protected by a shared lock; existing before/after validation remains in place, but Sheets does not provide atomic compare-and-set updates.

Hosted upload bodies are limited by the app to 4 MiB to stay below Vercel's 4.5 MB request limit. JPEG/PNG/WebP are resized before sending. HEIC/HEIF that cannot be decoded locally are sent as originals and must fit the hosted limit; larger files must be converted or reduced first. Local uploads retain the 25 MiB original limit. Extremely large search/dashboard responses can also reach the platform response limit; pagination or a different storage/query architecture would then be needed.

No production deployment, live Google write, credential rotation, commit or push is performed by these changes.

References: [Vercel Node runtime](https://vercel.com/docs/functions/runtimes/node-js), [request headers](https://vercel.com/docs/headers/request-headers), [function limits](https://vercel.com/docs/functions/limitations).

## Files changed in this fix

- Deployment/startup: `api/index.js`, `server.js`, `setup-sheets.js`, `vercel.json`, `src/runtime.js`, `src/readiness.js`.
- Configuration/credentials: `src/config.js`, `src/loadConfig.js`, `src/credentials.js`, `src/driveAuth.js`, `src/photos.js`, `.env.example`.
- API/errors/local state: `src/app.js`, `src/errors.js`, `src/state.js`.
- Frontend: `public/app.js`, `public/apiResponse.js`.
- Verification/docs: `test/configuration.test.js`, `test/deployment.test.js`, `package.json`, `.gitignore`, `README.md`, `docs/vercel-deployment.md`.

Verification covers configuration parsing, signed-session expiration/tampering, local startup, the Vercel entry point, frontend errors and Google integration through mocks. Actual Google authentication and deployment still require verification with configured services. The private `.env` and credential JSON contents were not modified.
