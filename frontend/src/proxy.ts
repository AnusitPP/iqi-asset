import { NextResponse, type NextRequest } from 'next/server';
// Transport-only bridge. Authentication, CSRF and authorization stay in Express.
export function proxy(request: NextRequest) {
  // Same-project Vercel requests go directly to the existing Express adapter.
  if (process.env.VERCEL === '1') return NextResponse.next();
  const backend = process.env.IQI_BACKEND_ORIGIN;
  if (!backend) return NextResponse.next();
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin)
    return new NextResponse('ไม่อนุญาตคำขอจากเว็บไซต์อื่น', { status: 403 });
  const headers = new Headers(request.headers);
  if (origin) headers.set('origin', new URL(backend).origin);
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: '/api/:path*' };
