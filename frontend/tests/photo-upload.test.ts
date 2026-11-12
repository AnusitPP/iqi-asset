import { afterEach, expect, it, vi } from 'vitest';
import { preparePhotoForUpload } from '../src/features/photos/photo-utils';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('reduces quality then dimensions until the encoded photo fits', async () => {
  const close = vi.fn();
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width: 4000, height: 3000, close }),
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  const attempts: { width: number; quality: number }[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    function (this: HTMLCanvasElement, callback, _type, quality) {
      attempts.push({ width: this.width, quality: Number(quality) });
      callback(new Blob([new Uint8Array(this.width > 1000 ? 2000 : 500)], { type: 'image/jpeg' }));
    },
  );
  const result = await preparePhotoForUpload(new File(['photo'], 'photo.jpg'), 1000);
  expect(result.size).toBeLessThanOrEqual(1000);
  expect(attempts[0]!.width).toBe(1600);
  expect(attempts.some((attempt) => attempt.quality < attempts[0]!.quality)).toBe(true);
  expect(attempts.at(-1)!.width).toBeLessThan(1600);
  expect(close).toHaveBeenCalledOnce();
});

it('resizes HEIC when the browser can decode it', async () => {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width: 2000, height: 1000, close: vi.fn() }),
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
    callback(new Blob(['jpeg'], { type: 'image/jpeg' })),
  );
  const result = await preparePhotoForUpload(
    new File([new Uint8Array(2000)], 'photo.heic', { type: 'image/heic' }),
    1000,
  );
  expect(result.type).toBe('image/jpeg');
  expect(result.size).toBeLessThanOrEqual(1000);
});

it.each(['oversized', 'null'] as const)(
  'stops safely when encoding stays %s and releases the bitmap',
  async (failure) => {
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 320, height: 240, close }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const encode = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((callback) =>
        callback(failure === 'null' ? null : new Blob([new Uint8Array(2000)])),
      );
    await expect(preparePhotoForUpload(new File(['photo'], 'photo.jpg'), 1000)).rejects.toThrow(
      'ย่อรูป',
    );
    expect(encode.mock.calls.length).toBeLessThanOrEqual(3);
    expect(close).toHaveBeenCalledOnce();
  },
);
