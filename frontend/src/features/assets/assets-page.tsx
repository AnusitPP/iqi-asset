'use client';
import { Button, Checkbox, Group, TextInput, Text } from '@mantine/core';
import { Heart, Search, Check } from 'lucide-react';
import { useWorkspaceState } from '@/hooks/use-workspace-state';
import { useToast } from '@/providers/toast-provider';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthSession } from '@/features/auth/auth-provider';
import type { SearchRecord, ReviewTarget } from '@/types/contracts';
import { assetsService } from '@/services/assets.service';
import { CopyableText, ErrorAlert, LoadingIndicator } from '@/components/ui/feedback';
import { formatAssetFieldValue, calculateInspectionAgeInDays } from '@/lib/display';
import { AssetRecordDialog } from './record-dialog';
import { ReviewInspectionDialog } from '@/features/inspections/inspection-dialog';
export function AssetsPage() {
  const { api } = useAuthSession(),
    client = useQueryClient();
  const [query, setQuery] = useWorkspaceState('asset-query', ''),
    [debounced, setDebounced] = useState(query.trim()),
    [pending, setPending] = useWorkspaceState('asset-pending-only', false),
    [composing, setComposing] = useState(false);
  const [detail, setDetail] = useState<{ sheet: string; row: number } | null>(null),
    [inspection, setInspection] = useState<ReviewTarget | null>(null),
    [notice, setNotice] = useState('');
  useEffect(() => {
    if (composing) return;
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query, composing]);
  const results = useQuery({
    queryKey: ['search', debounced, pending],
    queryFn: ({ signal }) =>
      assetsService.searchAssets(api, { query: debounced, pendingOnly: pending }, signal),
    enabled: Boolean(debounced || pending) && !composing,
  });
  const { showToast } = useToast();
  const notifySearchResult = (message: string) => {
    setNotice(message);
    showToast(message);
  };
  const total = results.data?.groups.reduce((n, group) => n + group.count, 0) ?? 0;
  return (
    <>
      <section className="intro">
        <div className="eyebrow">IQI WORKSPACE</div>
        <h1>
          ครุภัณฑ์ที่ต้องการ
          <br className="mobile-break" /> หาได้ในที่เดียว<span className="heading-dot">.</span>
        </h1>
        <p>
          ค้นหา ตรวจสอบข้อมูล และอัปเดตครุภัณฑ์ IQI
          <br />
          จาก Google Sheets ของคุณ
        </p>
      </section>
      <section className="search-card">
        <form
          id="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            setDebounced(query.trim());
            if (query.trim() === debounced) void results.refetch();
          }}
        >
          <div className="search-row">
            <TextInput
              label="ค้นหาข้อมูลครุภัณฑ์"
              placeholder="ชื่อคน อุปกรณ์ ทีม เลขครุภัณฑ์ หรือ S/N"
              maxLength={200}
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              leftSection={<Search size={16} />}
            />
            <Button type="submit" loading={results.isFetching} disabled={!query.trim() && !pending}>
              ค้นหา
            </Button>
          </div>
          <p>ค้นหาทุกคอลัมน์ พิมพ์หลายคำได้ เช่น จอ IQI หรือชื่อคน</p>
        </form>
        <div className="source-strip">ค้นหาพร้อมกันใน · IQI · รายการทั้งหมด · all</div>
        <Checkbox
          mt="md"
          label="แสดงเฉพาะรายการรอค้นหา"
          checked={pending}
          onChange={(e) => setPending(e.currentTarget.checked)}
        />
      </section>
      <ErrorAlert error={results.error} />
      {notice && <Text role="status">{notice}</Text>}
      <section aria-live="polite" aria-busy={results.isFetching}>
        {!debounced && !pending ? (
          <div className="empty-start">
            <h2>เริ่มต้นด้วยคำที่ต้องการค้นหา</h2>
            <p>ข้อมูลครบทุกคอลัมน์ พร้อมแก้ไขรายการจาก IQI</p>
          </div>
        ) : results.isPending ? (
          <LoadingIndicator />
        ) : (
          results.data && (
            <>
              <div className="results-heading">
                <h2>
                  {!results.data.query && pending
                    ? 'รายการรอตรวจสอบทั้งหมด'
                    : `ผลการค้นหา “${results.data.query}”`}
                </h2>
                <span>
                  {total} รายการ / {results.data.groups.length} กลุ่ม
                </span>
              </div>
              <div className="result-groups">
                {results.data.groups
                  .filter((g) => !pending || g.count > 0)
                  .map((group) => (
                    <section
                      className={`result-group ${group.reviewGroup ? 'review-group' : ''}`}
                      key={group.sheet}
                    >
                      <div className="group-header">
                        <div>
                          <h3>{group.label}</h3>
                          <span>
                            {group.reviewGroup
                              ? 'รายการในชีต IQI + IT'
                              : group.editable
                                ? 'อ่านและแก้ไขได้'
                                : 'ดูอย่างเดียว'}
                          </span>
                        </div>
                        <span>{group.count} รายการ</span>
                      </div>
                      {group.sheet !== group.label && <p>แท็บ: {group.sheet}</p>}
                      {group.count > 0 && group.matchType === 'fallback' && (
                        <p>พบจากเลขเก่า 2 ส่วนท้าย</p>
                      )}
                      {!group.count && (
                        <p className="group-empty">ไม่พบข้อมูลที่ตรงกันใน Sheet นี้</p>
                      )}
                      {group.records.map((record) => (
                        <AssetSearchResultCard
                          key={`${record.sourceSheet}-${record.row}`}
                          record={record}
                          onDetail={() =>
                            setDetail({ sheet: record.sourceSheet || group.sheet, row: record.row })
                          }
                          onInspection={() =>
                            setInspection({
                              sheet: record.sourceSheet || group.sheet,
                              row: record.row,
                              revision: record.revision,
                              asset: record.asset,
                            })
                          }
                          onNotice={notifySearchResult}
                          onRefresh={async () => {
                            await client.invalidateQueries({ queryKey: ['search'] });
                          }}
                        />
                      ))}
                    </section>
                  ))}
              </div>
              {!total && (
                <p>
                  {pending
                    ? 'ไม่พบรายการรอค้นหาที่ตรงกับตัวกรอง'
                    : 'ไม่พบเลขนี้ในทั้ง 3 Sheet ลองตรวจสอบตัวเลขและเครื่องหมายขีดอีกครั้ง'}
                </p>
              )}
            </>
          )
        )}
      </section>
      {detail && <AssetRecordDialog target={detail} onClose={() => setDetail(null)} />}
      {inspection && (
        <ReviewInspectionDialog
          target={inspection}
          onClose={() => setInspection(null)}
          onSaved={notifySearchResult}
        />
      )}
    </>
  );
}
function AssetSearchResultCard({
  record,
  onDetail,
  onInspection,
  onNotice,
  onRefresh,
}: {
  record: SearchRecord;
  onDetail: () => void;
  onInspection: () => void;
  onNotice: (value: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const { api } = useAuthSession(),
    age = calculateInspectionAgeInDays(record.inspectionDate);
  const reviewSelectionMutation = useMutation({
    mutationFn: () =>
      assetsService.updateReviewSelection(api, {
        sheet: record.sourceSheet,
        row: record.row,
        revision: record.revision,
        pending: !record.pending,
      }),
    onSuccess: async (saved) => {
      onNotice(
        saved.pending
          ? `ส่งข้อมูลไปชีต ${saved.reviewSheet || 'รอตรวจสอบ'} แล้ว`
          : `นำรายการออกจากชีต ${saved.reviewSheet || 'รอตรวจสอบ'} แล้ว`,
      );
      await onRefresh();
    },
  });
  return (
    <article
      data-inspection-status={record.inspectionStatus}
      className={`result-item ${record.inspected && record.pending ? 'is-inspected' : ''}`}
    >
      <Group justify="space-between">
        <CopyableText value={record.asset} />
        <Button
          variant="subtle"
          color="pink"
          aria-label={record.pending ? 'ยกเลิกรอค้นหา' : 'ตั้งสถานะรอค้นหา'}
          aria-pressed={record.pending}
          loading={reviewSelectionMutation.isPending}
          onClick={() => reviewSelectionMutation.mutate()}
        >
          <Heart size={20} fill={record.pending ? 'currentColor' : 'none'} />
        </Button>
      </Group>
      <div className="inspection-stamp">
        {age
          ? `${age.date} · ${age.days === 0 ? 'วันนี้' : age.days > 0 ? `${age.days} วัน` : `อีก ${Math.abs(age.days)} วัน`}`
          : record.inspectionDate
            ? 'วันที่ตรวจไม่ถูกต้อง'
            : 'ไม่ระบุวันที่ตรวจ'}
      </div>
      <p className="asset-description">
        {[record.name || 'ไม่ระบุรายการ', record.brand].filter(Boolean).join(' · ')}
      </p>
      <div className="identity-line">
        {[
          record.owner,
          record.initials,
          record.nickname,
          formatAssetFieldValue('ทีม', record.team),
        ].map((value, i) => (
          <span key={i}>{value || '-'}</span>
        ))}
      </div>
      {record.pending && (
        <p>
          อยู่ในชีต {record.reviewSheet}
          {record.inspected && ` · บันทึกผลตรวจแล้ว: ${record.inspectionStatus}`}
        </p>
      )}
      <ErrorAlert error={reviewSelectionMutation.error} />
      <Group mt="sm">
        <Button variant="light" onClick={onDetail}>
          ดูรายละเอียด
        </Button>
        {record.pending && (
          <Button leftSection={<Check size={16} />} onClick={onInspection}>
            บันทึกผลตรวจ
          </Button>
        )}
      </Group>
    </article>
  );
}
