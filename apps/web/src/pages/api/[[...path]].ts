// Reuse the existing Express entrypoint; business logic stays in backend/.
export { default } from '@iqi/vercel-api';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
  maxDuration: 120,
};
