'use client';
import { Button, Checkbox, Group, TextInput, Text, Box, Title, Paper, Stack } from '@mantine/core';
import { Heart, Search, Check } from 'lucide-react';
import { useWorkspaceState } from '@/hooks/use-workspace-state';
import { useToast } from '@/providers/toast-provider';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthSession } from '@/features/auth/auth-provider';
import type { SearchRecord, ReviewTarget } from '@/types/contracts';
import { assetsService } from '@/services/assets.service';
import { LoadingIndicator } from '@/components/ui/feedback';
import { ErrorPopup } from '@/components/core/error-popup';
import { CopyableText } from '@/components/core/copyable-text';
import { formatAssetFieldValue, calculateInspectionAgeInDays } from '@/lib/display';
import { AssetRecordDialog } from './record-dialog';
import { ReviewInspectionDialog } from '@/features/inspections/inspection-dialog';
export function AssetsPage() {
  const { api, can } = useAuthSession(),
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
      <Box component="section" className="intro">
        <Box className="eyebrow">IQI WORKSPACE</Box>
        <Title order={1}>
          ครุภัณฑ์ที่ต้องการ
          <br className="mobile-break" /> หาได้ในที่เดียว<span className="heading-dot">.</span>
        </Title>
        <Text component="p" className="portal-paragraph">
          ค้นหา ตรวจสอบข้อมูล และอัปเดตครุภัณฑ์ IQI
          <br />
          จาก Google Sheets ของคุณ
        </Text>
      </Box>
      <Paper withBorder component="section" className="search-card">
        <form
          id="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            setDebounced(query.trim());
            if (query.trim() === debounced) void results.refetch();
          }}
        >
          <Group align="end" className="search-row">
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
          </Group>
          <Text component="p" className="portal-paragraph">
            ค้นหาทุกคอลัมน์ พิมพ์หลายคำได้ เช่น จอ IQI หรือชื่อคน
          </Text>
        </form>
        <Box className="source-strip">ค้นหาพร้อมกันใน · IQI · รายการทั้งหมด · all</Box>
        <Checkbox
          mt="md"
          label="แสดงเฉพาะรายการรอค้นหา"
          checked={pending}
          onChange={(e) => setPending(e.currentTarget.checked)}
        />
      </Paper>
      <ErrorPopup error={results.error} onRefresh={() => results.refetch()} />
      {notice && <Text role="status">{notice}</Text>}
      <Box component="section" aria-live="polite" aria-busy={results.isFetching}>
        {!debounced && !pending ? (
          <Box className="empty-start">
            <Title order={2}>เริ่มต้นด้วยคำที่ต้องการค้นหา</Title>
            <Text component="p" className="portal-paragraph">
              ข้อมูลครบทุกคอลัมน์ พร้อมแก้ไขรายการจาก IQI
            </Text>
          </Box>
        ) : results.isPending ? (
          <LoadingIndicator />
        ) : (
          results.data && (
            <>
              <Box className="results-heading">
                <Title order={2}>
                  {!results.data.query && pending
                    ? 'รายการรอตรวจสอบทั้งหมด'
                    : `ผลการค้นหา “${results.data.query}”`}
                </Title>
                <span>
                  {total} รายการ / {results.data.groups.length} กลุ่ม
                </span>
              </Box>
              <Stack gap="lg" className="result-groups">
                {results.data.groups
                  .filter((g) => !pending || g.count > 0)
                  .map((group) => (
                    <Box
                      component="section"
                      className={`result-group ${group.reviewGroup ? 'review-group' : ''}`}
                      key={group.sheet}
                    >
                      <Box className="group-header">
                        <Box>
                          <Title order={3}>{group.label}</Title>
                          <span>
                            {group.reviewGroup
                              ? 'รายการในชีต IQI + IT'
                              : group.editable && can('ASSET_EDIT')
                                ? 'อ่านและแก้ไขได้'
                                : 'ดูอย่างเดียว'}
                          </span>
                        </Box>
                        <span>{group.count} รายการ</span>
                      </Box>
                      {group.sheet !== group.label && (
                        <Text component="p" className="portal-paragraph">
                          แท็บ: {group.sheet}
                        </Text>
                      )}
                      {group.count > 0 && group.matchType === 'fallback' && (
                        <Text component="p" className="portal-paragraph">
                          พบจากเลขเก่า 2 ส่วนท้าย
                        </Text>
                      )}
                      {!group.count && (
                        <Text component="p" className="portal-paragraph group-empty">
                          ไม่พบข้อมูลที่ตรงกันใน Sheet นี้
                        </Text>
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
                    </Box>
                  ))}
              </Stack>
              {!total && (
                <Text component="p" className="portal-paragraph">
                  {pending
                    ? 'ไม่พบรายการรอค้นหาที่ตรงกับตัวกรอง'
                    : 'ไม่พบเลขนี้ในทั้ง 3 Sheet ลองตรวจสอบตัวเลขและเครื่องหมายขีดอีกครั้ง'}
                </Text>
              )}
            </>
          )
        )}
      </Box>
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
  const { api, can } = useAuthSession(),
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
    <Paper
      component="article"
      data-inspection-status={record.inspectionStatus}
      className={`result-item ${record.inspected && record.pending ? 'is-inspected' : ''}`}
    >
      <Group justify="space-between">
        <CopyableText value={record.asset} />
        {can('ASSET_EDIT') && (
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
        )}
      </Group>
      <Box className="inspection-stamp">
        {age
          ? `${age.date} · ${age.days === 0 ? 'วันนี้' : age.days > 0 ? `${age.days} วัน` : `อีก ${Math.abs(age.days)} วัน`}`
          : record.inspectionDate
            ? 'วันที่ตรวจไม่ถูกต้อง'
            : 'ไม่ระบุวันที่ตรวจ'}
      </Box>
      <Text component="p" className="portal-paragraph asset-description">
        {[record.name || 'ไม่ระบุรายการ', record.brand].filter(Boolean).join(' · ')}
      </Text>
      <Box className="identity-line">
        {[
          record.owner,
          record.initials,
          record.nickname,
          formatAssetFieldValue('ทีม', record.team),
        ].map((value, i) => (
          <span key={i}>{value || '-'}</span>
        ))}
      </Box>
      {record.pending && (
        <Text component="p" className="portal-paragraph">
          อยู่ในชีต {record.reviewSheet}
          {record.inspected && ` · บันทึกผลตรวจแล้ว: ${record.inspectionStatus}`}
        </Text>
      )}
      <ErrorPopup error={reviewSelectionMutation.error} />
      <Group mt="sm">
        <Button variant="light" onClick={onDetail}>
          ดูรายละเอียด
        </Button>
        {record.pending && can('ASSET_EDIT') && (
          <Button leftSection={<Check size={16} />} onClick={onInspection}>
            บันทึกผลตรวจ
          </Button>
        )}
      </Group>
    </Paper>
  );
}
