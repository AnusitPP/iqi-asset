import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { ViewToggle } from '../src/components/core/view-toggle';
import { EquipmentCard } from '../src/components/core/equipment-card';
import { CatalogPhoto } from '../src/components/core/catalog-photo';
import { CatalogPhotoGallery } from '../src/components/core/catalog-photo-gallery';

it('shows three private photos together and supports choosing photos without submitting the form', async () => {
  const submit = vi.fn((event) => event.preventDefault());
  render(
    <MantineProvider>
      <form onSubmit={submit}>
        <CatalogPhotoGallery
          name="Monitor"
          url={[1, 2, 3].map((n) => `https://drive.google.com/file/d/p${n}/view`).join('\n')}
        />
      </form>
    </MantineProvider>,
  );
  expect(screen.getAllByRole('img')).toHaveLength(3);
  expect(screen.getByRole('img', { name: 'Monitor รูปที่ 2' }).getAttribute('src')).toBe(
    '/api/catalog-photos/p2',
  );
  await userEvent.click(screen.getByRole('button', { name: 'แสดงรูปที่ 2 ของ Monitor' }));
  expect(
    screen.getByRole('button', { name: 'แสดงรูปที่ 2 ของ Monitor' }).getAttribute('aria-pressed'),
  ).toBe('true');
  await userEvent.click(screen.getByRole('button', { name: 'รูปถัดไปของ Monitor' }));
  expect(
    screen.getByRole('button', { name: 'แสดงรูปที่ 3 ของ Monitor' }).getAttribute('aria-pressed'),
  ).toBe('true');
  expect(submit).not.toHaveBeenCalled();
});

it('uses a friendly text placeholder without an equipment icon for absent or unsafe gallery photos', () => {
  render(
    <MantineProvider>
      <CatalogPhotoGallery name="Monitor" url="javascript:alert(1)" />
    </MantineProvider>,
  );
  expect(screen.getByText('ยังไม่มีรูปอุปกรณ์')).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.queryByLabelText('ไม่มีภาพอุปกรณ์')).toBeNull();
});
import { SearchInput } from '../src/components/core/search-input';
afterEach(cleanup);

it('catalog gallery switches between three sheet links without opening the equipment', async () => {
  const open = vi.fn();
  render(
    <MantineProvider>
      <div onClick={open}>
        <CatalogPhoto
          url={[1, 2, 3].map((n) => `https://drive.google.com/file/d/photo-${n}/view`).join('\n')}
          name="Mouse"
        />
      </div>
    </MantineProvider>,
  );
  expect(screen.getByRole('img', { name: 'Mouse' }).getAttribute('src')).toBe(
    '/api/catalog-photos/photo-1',
  );
  await userEvent.click(screen.getByRole('button', { name: 'รูปถัดไปของ Mouse' }));
  expect(screen.getByRole('img', { name: 'Mouse' }).getAttribute('src')).toBe(
    '/api/catalog-photos/photo-2',
  );
  await userEvent.click(screen.getByRole('button', { name: 'รูปถัดไปของ Mouse' }));
  expect(screen.getByRole('img', { name: 'Mouse' }).getAttribute('src')).toBe(
    '/api/catalog-photos/photo-3',
  );
  expect(open).not.toHaveBeenCalled();
});

it('catalog photo uses the authenticated preview API for private Drive files', () => {
  render(
    <MantineProvider>
      <CatalogPhoto url="https://drive.google.com/file/d/photo-123/view" name="Mouse" />
    </MantineProvider>,
  );
  expect(screen.getByRole('img', { name: 'Mouse' }).getAttribute('src')).toBe(
    '/api/catalog-photos/photo-123',
  );
});

it('shared view toggle reports the selected view and emits the requested view', async () => {
  const change = vi.fn();
  render(
    <MantineProvider>
      <ViewToggle value="grid" onChange={change} />
    </MantineProvider>,
  );
  expect(screen.getByRole('button', { name: 'การ์ด' }).getAttribute('aria-pressed')).toBe('true');
  await userEvent.click(screen.getByRole('button', { name: 'รายการ' }));
  expect(change).toHaveBeenCalledWith('list');
});

it('shared equipment card preserves labels, badges and its action', async () => {
  const open = vi.fn();
  render(
    <MantineProvider>
      <EquipmentCard
        name="Monitor"
        category="จอ"
        detail="เลขคำขอ: L-1"
        badges={<span>กำลังยืม</span>}
        action={<button onClick={open}>ดูรายละเอียด</button>}
      />
    </MantineProvider>,
  );
  expect(screen.getByText('เลขคำขอ: L-1')).toBeTruthy();
  expect(screen.getByText('กำลังยืม')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'ดูรายละเอียด' }));
  expect(open).toHaveBeenCalledOnce();
});

it('shared photo rejects non-Drive links and search preserves accessible input props', () => {
  render(
    <MantineProvider>
      <CatalogPhoto url="https://example.com/file/d/private" name="Device" />
      <SearchInput label="ค้นหา" disabled maxLength={400} />
    </MantineProvider>,
  );
  expect(screen.getByLabelText('ไม่มีภาพอุปกรณ์')).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
  expect((screen.getByLabelText('ค้นหา') as HTMLInputElement).disabled).toBe(true);
  expect(screen.getByLabelText('ค้นหา').getAttribute('maxlength')).toBe('400');
});
import { RefreshButton, ResetFiltersButton } from '../src/components/core/action-buttons';
import { CopyableText } from '../src/components/core/copyable-text';
import { copyTextToClipboard } from '../src/lib/clipboard';
vi.mock('../src/lib/clipboard', () => ({
  copyTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));

it('shared copy control uses the dashboard interaction and shows copy failures', async () => {
  render(
    <MantineProvider>
      <CopyableText value="STeP-IQI-L1" />
    </MantineProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'คัดลอก STeP-IQI-L1' }));
  expect(copyTextToClipboard).toHaveBeenCalledWith('STeP-IQI-L1');
  expect(screen.getByRole('status').textContent).toBe('คัดลอกแล้ว');
  vi.mocked(copyTextToClipboard).mockRejectedValueOnce(new Error('denied'));
  await userEvent.click(screen.getByRole('button', { name: 'คัดลอก STeP-IQI-L1' }));
  expect(screen.getByRole('status').textContent).toContain('คัดลอกไม่ได้');
});

it('shared refresh and reset buttons preserve disabled and callback behavior', async () => {
  const refresh = vi.fn(),
    reset = vi.fn();
  const view = render(
    <MantineProvider>
      <RefreshButton disabled onClick={refresh} />
      <ResetFiltersButton onClick={reset} />
    </MantineProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'โหลดรายการล่าสุด' }));
  expect(refresh).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'ล้างตัวกรอง' }));
  expect(reset).toHaveBeenCalledOnce();
  view.rerender(
    <MantineProvider>
      <RefreshButton onClick={refresh} />
    </MantineProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'โหลดรายการล่าสุด' }));
  expect(refresh).toHaveBeenCalledOnce();
});
import { RequestStatusBadge } from '../src/components/core/request-status-badge';

it('shared status badge uses central labels and normalizes completed requests', () => {
  const view = render(
    <MantineProvider>
      <RequestStatusBadge record={{ kind: 'ยืม', status: 'กำลังยืม', completed: true }} />
    </MantineProvider>,
  );
  expect(screen.getByText('เสร็จสิ้น')).toBeTruthy();
  expect(screen.queryByText('กำลังยืม')).toBeNull();
  view.rerender(
    <MantineProvider>
      <RequestStatusBadge record={{ kind: 'คืน', status: 'รอรับคืน', completed: true }} size="xs" />
    </MantineProvider>,
  );
  expect(screen.getByText('รอดำเนินการ')).toBeTruthy();
  expect(
    (
      screen.getByText('รอดำเนินการ').closest('.mantine-Badge-root') as HTMLElement
    ).style.getPropertyValue('--badge-bg'),
  ).toContain('blue');
});
import { LoanPeriod } from '../src/components/core/loan-period';
import { LoanTimeBadge } from '../src/components/core/loan-time-badge';

it('shows a return-today message for same-day loans and an overdue message after midnight', () => {
  const view = render(
    <MantineProvider>
      <LoanPeriod start="2026-11-12" due="2026-11-12" today="2026-11-12" />
    </MantineProvider>,
  );
  expect(screen.getByText('กำหนดคืนวันนี้')).toBeTruthy();
  expect(screen.getByText('1 / 1 วัน')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  view.rerender(
    <MantineProvider>
      <LoanPeriod start="2026-11-12" due="2026-11-12" today="2026-11-13" />
    </MantineProvider>,
  );
  expect(screen.getByText('เกินกำหนด 1 วัน')).toBeTruthy();
  expect(screen.getByText('2 / 1 วัน')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe(
    '200% เกินกำหนด 1 วัน',
  );
  view.rerender(
    <MantineProvider>
      <LoanPeriod start="2026-11-11" due="2026-11-12" today="2026-11-12" />
    </MantineProvider>,
  );
  expect(screen.getByText('กำหนดคืนวันนี้')).toBeTruthy();
});

it('loan period displays the overdue extension and retains the actual elapsed days', () => {
  const view = render(
    <MantineProvider>
      <LoanPeriod start="2026-11-01" due="2026-11-06" today="2026-11-07" />
    </MantineProvider>,
  );
  expect(screen.getByText('6 / 5 วัน')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe(
    '120% เกินกำหนด 1 วัน',
  );
  expect(screen.getByText('เกินกำหนด 1 วัน')).toBeTruthy();
  view.rerender(
    <MantineProvider>
      <LoanPeriod start="2026-11-01" due="2026-11-06" today="2026-10-31" />
    </MantineProvider>,
  );
  expect(screen.getByText('0 / 5 วัน')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  view.rerender(
    <MantineProvider>
      <LoanPeriod start="" due="2026-11-06" today="2026-11-07" />
    </MantineProvider>,
  );
  expect(screen.queryByRole('progressbar')).toBeNull();
});

it('loan time pill retains an accessible time label', () => {
  render(
    <MantineProvider>
      <LoanTimeBadge text="เกินกำหนด 2 วัน" overdue />
    </MantineProvider>,
  );
  expect(screen.getByText('เกินกำหนด 2 วัน')).toBeTruthy();
});

it('loan period stays green with three days left and turns yellow with two days left', () => {
  const view = render(
    <MantineProvider>
      <LoanPeriod start="2026-11-01" due="2026-11-08" today="2026-11-05" />
    </MantineProvider>,
  );
  expect(screen.getByText('เหลือ 3 วัน').style.color).toBe('var(--mantine-color-green-text)');
  view.rerender(
    <MantineProvider>
      <LoanPeriod start="2026-11-01" due="2026-11-08" today="2026-11-06" />
    </MantineProvider>,
  );
  expect(screen.getByText('เหลือ 2 วัน').style.color).toBe('var(--mantine-color-yellow-text)');
  view.rerender(
    <MantineProvider>
      <LoanPeriod start="2026-11-01" due="2026-11-08" today="2026-11-09" />
    </MantineProvider>,
  );
  expect(screen.getByText('เกินกำหนด 1 วัน').style.color).toBe('var(--mantine-color-red-text)');
});
