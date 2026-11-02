declare module '@iqi/vercel-api' {
  import type { IncomingMessage, ServerResponse } from 'node:http';
  export default function forwardExpressApiRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): void;
}
