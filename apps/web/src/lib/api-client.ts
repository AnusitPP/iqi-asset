import { z } from 'zod';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfter: string | null = null,
  ) {
    super(message);
  }
}
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่';
}
const errorSchema = z.object({ error: z.string() });
export class ApiClient {
  private csrf = '';
  constructor(
    private readonly onUnauthorized: () => void = () => {},
    private readonly transport: typeof fetch = (...args) => fetch(...args),
  ) {}
  setCsrfToken(value: string) {
    this.csrf = value;
  }
  async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: unknown;
      binary?: Blob;
      revision?: string;
      signal?: AbortSignal;
    } = {},
  ): Promise<T> {
    const headers = new Headers({ 'X-IQI-Request': this.csrf });
    headers.set('Content-Type', options.binary ? 'application/octet-stream' : 'application/json');
    if (options.revision) headers.set('X-Record-Revision', options.revision);
    const response = await this.transport(path, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      signal: options.signal,
      body:
        options.binary ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    });
    if (response.status === 401 && !path.startsWith('/api/auth/')) this.onUnauthorized();
    const suffix = ` (HTTP ${response.status})`;
    if (!/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(response.headers.get('content-type') ?? ''))
      throw new ApiError(
        (response.status === 413
          ? 'ไฟล์ใหญ่เกินขนาดที่เซิร์ฟเวอร์รับได้'
          : 'เซิร์ฟเวอร์ส่งข้อมูลผิดรูปแบบ กรุณาลองใหม่') + suffix,
        response.status,
      );
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ApiError('เซิร์ฟเวอร์ส่ง JSON ไม่สมบูรณ์' + suffix, response.status);
    }
    if (!response.ok) {
      const parsed = errorSchema.safeParse(data);
      throw new ApiError(
        (parsed.success ? parsed.data.error : 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่') + suffix,
        response.status,
        response.headers.get('retry-after'),
      );
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success)
      throw new ApiError(
        'ข้อมูลจากเซิร์ฟเวอร์ไม่ตรงกับรูปแบบที่รองรับ กรุณาโหลดข้อมูลใหม่',
        response.status,
      );
    return parsed.data;
  }
}
