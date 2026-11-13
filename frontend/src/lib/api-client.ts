import { z } from 'zod';

const errorMessages: Record<number, string> = {
  400: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบข้อมูลแล้วลองใหม่',
  401: 'กรุณาเข้าสู่ระบบอีกครั้งเพื่อใช้งานต่อ',
  403: 'คุณยังไม่มีสิทธิ์ทำรายการนี้ กรุณาติดต่อผู้ดูแลระบบ',
  404: 'ไม่พบข้อมูลที่ต้องการ กรุณาโหลดข้อมูลใหม่',
  409: 'ข้อมูลเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนทำรายการอีกครั้ง',
  410: 'ช่องทางนี้ไม่เปิดให้ใช้งานแล้ว กรุณาเข้าสู่ระบบด้วย Google',
  413: 'ไฟล์ใหญ่เกินไป กรุณาลดขนาดไฟล์แล้วลองใหม่',
  422: 'ยังทำรายการนี้ไม่ได้ กรุณาตรวจสอบข้อมูลหรือติดต่อผู้ดูแลระบบ',
  429: 'ขณะนี้มีผู้ใช้งานจำนวนมาก กรุณารอสักครู่แล้วลองใหม่',
  500: 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง',
  501: 'ระบบยังไม่รองรับการทำรายการนี้ กรุณาติดต่อผู้ดูแลระบบ',
  502: 'ยังยืนยันผลรายการไม่ได้ กรุณาตรวจสอบข้อมูลล่าสุดก่อนทำรายการซ้ำ',
  503: 'ระบบยังไม่พร้อมใช้งาน กรุณารอสักครู่หรือติดต่อผู้ดูแลระบบ',
  504: 'ระบบใช้เวลาตอบกลับนานกว่าปกติ กรุณาตรวจสอบผลรายการก่อนลองใหม่',
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfter: string | null = null,
  ) {
    const clean = message.replace(/\s*\(?HTTP\s+\d{3}\)?/gi, '').trim();
    super(
      status === 429
        ? errorMessages[429]
        : /[ก-๙]/.test(clean)
          ? clean
          : (errorMessages[status] ?? 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่'),
    );
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
    }).catch((error: unknown) => {
      if (options.signal?.aborted || (error instanceof Error && error.name === 'AbortError'))
        throw error;
      throw new ApiError('เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', 0);
    });
    if (response.status === 401 && !path.startsWith('/api/auth/')) this.onUnauthorized();
    if (!/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(response.headers.get('content-type') ?? ''))
      throw new ApiError(
        response.ok
          ? 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่'
          : (errorMessages[response.status] ?? 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่'),
        response.status,
      );
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        response.ok ? 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่' : (errorMessages[response.status] ?? ''),
        response.status,
      );
    }
    if (!response.ok) {
      const parsed = errorSchema.safeParse(data);
      throw new ApiError(
        parsed.success ? parsed.data.error : (errorMessages[response.status] ?? ''),
        response.status,
        response.headers.get('retry-after'),
      );
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success)
      throw new ApiError(
        'โหลดข้อมูลไม่สำเร็จ กรุณาโหลดหน้าใหม่ หากยังพบปัญหาให้ติดต่อผู้ดูแลระบบ',
        response.status,
      );
    return parsed.data;
  }
}
