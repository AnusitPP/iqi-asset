'use client';
import { RefreshButton, ResetFiltersButton } from '@/components/core/action-buttons';
import {
  Accordion,
  Progress,
  Button,
  Group,
  Select,
  Text,
  TextInput,
  UnstyledButton,
  Box,
  Title,
  Paper,
  SimpleGrid,
} from '@mantine/core';
import { Modal } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { DashboardMobileCards } from './dashboard-mobile-cards';
import { DashboardTable } from './dashboard-table';
import { ChevronDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceState } from '@/hooks/use-workspace-state';
import { useSessionTaskGuard } from '@/hooks/use-session-task-guard';
import { useToast } from '@/providers/toast-provider';
import { DashboardLoadingSkeleton } from '@/components/ui/dashboard-skeleton';
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { useAuthSession } from '@/features/auth/auth-provider';
import { dashboardStatuses, type DashboardRecord } from '@/types/contracts';
import { dashboardService, type DashboardData } from '@/services/dashboard.service';
import { ErrorAlert } from '@/components/ui/feedback';
import { formatDashboardStatusLabel, getStatusColorClass } from '@/lib/display';
import { DashboardRecordDialog } from './dashboard-details';
import { saveStatusDraftsSequentially, type StatusDraft } from './save-drafts';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved';
export function DashboardPage() {
  const mobile = useMediaQuery('(max-width: 47.99em)', false);
  const { api } = useAuthSession(),
    client = useQueryClient();
  const data = useQuery({
    queryKey: ['dashboard'],
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // Keep this cacheable read running across navigation and Strict Mode cleanup.
    queryFn: () => dashboardService.fetchDashboardData(api),
  });
  const [inspection, setInspection] = useWorkspaceState('dashboard-inspection', ''),
    [comparison, setComparison] = useWorkspaceState('dashboard-comparison', ''),
    [query, setQuery] = useWorkspaceState('dashboard-query', ''),
    [notice, setNotice] = useState(''),
    [selected, setSelected] = useState<number | null>(null),
    [addOpen, setAddOpen] = useState(false),
    [addAsset, setAddAsset] = useState(''),
    [iqiPreview, setIqiPreview] = useState<Awaited<
      ReturnType<typeof dashboardService.findIqiAsset>
    > | null>(null);
  const [teamFilter, setTeamFilter] = useWorkspaceState('dashboard-team', '');
  const [filtersOpen, setFiltersOpen] = useWorkspaceState('dashboard-filters-open', false);
  const isSaveCurrent = useSessionTaskGuard();
  const { showToast } = useToast();
  const drafts = useRef(new Map<number, StatusDraft>()),
    [draftVersion, setDraftVersion] = useState(0);
  useUnsavedChangesGuard(drafts.current.size > 0);
  const reloadDashboardData = async () => {
    const fresh = await dashboardService.fetchDashboardData(api);
    client.setQueryData(['dashboard'], fresh);
  };
  const updateCachedDashboardRecord = (record: DashboardRecord) =>
    client.setQueryData(['dashboard'], (old: DashboardData | undefined) =>
      old ? { ...old, records: old.records.map((r) => (r.row === record.row ? record : r)) } : old,
    );
  const saveStatusDraftsMutation = useMutation({
    mutationFn: async (row?: number) => {
      const targets =
        row === undefined
          ? drafts.current
          : new Map([...drafts.current].filter(([id]) => id === row));
      const result = await saveStatusDraftsSequentially(
        targets,
        (id, draft) => dashboardService.updateInspectionStatus(api, id, draft),
        (done, total) => setNotice(`กำลังบันทึก ${done}/${total}…`),
        isSaveCurrent,
      );
      if (!isSaveCurrent()) return;
      for (const saved of result.saved) {
        drafts.current.delete(saved.row);
        updateCachedDashboardRecord(saved.result.record);
      }
      setNotice(
        `บันทึกสำเร็จ ${result.saved.length} รายการ${result.failed.length ? ` · ไม่สำเร็จ ${result.failed.length} รายการ (เก็บค่าที่เลือกไว้): ${result.failed.map((f) => `แถว ${f.row}: ${f.message}`).join(' · ')}` : ''}`,
      );
      showToast(
        `บันทึกสำเร็จ ${result.saved.length} รายการ${result.failed.length ? ` · ไม่สำเร็จ ${result.failed.length} รายการ` : ''}`,
      );
      setDraftVersion((v) => v + 1);
      try {
        await reloadDashboardData();
      } catch (error) {
        setNotice(
          (v) =>
            `${v} · โหลดข้อมูลล่าสุดไม่สำเร็จ: ${error instanceof Error ? error.message : 'ลองใหม่'}`,
        );
      }
    },
  });
  const deferredQuery = useDeferredValue(query);
  const searchIndex = useMemo(
    () =>
      (data.data?.records ?? []).map((record) => ({
        record,
        values: record.values.map((value) => value.toLocaleLowerCase()),
      })),
    [data.data?.records],
  );
  const records = useMemo(() => {
    const normalized = deferredQuery.trim().toLocaleLowerCase();
    return searchIndex
      .filter(
        ({ record, values }) =>
          (!inspection || record.inspection === inspection) &&
          (!comparison || record.comparison === comparison) &&
          (!teamFilter || record.team.trim() === teamFilter) &&
          (!normalized || values.some((value) => value.includes(normalized))),
      )
      .map(({ record }) => record);
  }, [searchIndex, deferredQuery, inspection, comparison, teamFilter]);
  const teamOptions = useMemo(
    () => [
      { value: '', label: 'ผู้ถือครอง / ทีม · ทุกทีม' },
      ...[
        ...new Set((data.data?.records ?? []).map((record) => record.team.trim()).filter(Boolean)),
      ]
        .sort((a, b) => a.localeCompare(b, 'th'))
        .map((team) => ({ value: team, label: team })),
    ],
    [data.data?.records],
  );
  const saveStatusDraft = useCallback(
    (row: number) => saveStatusDraftsMutation.mutate(row),
    [saveStatusDraftsMutation.mutate],
  );
  const updateStatusDraft = useCallback((record: DashboardRecord, status: string | null) => {
    if (!status || status === record.inspection) drafts.current.delete(record.row);
    else drafts.current.set(record.row, { status, revision: record.revision });
    setDraftVersion((value) => value + 1);
  }, []);
  const renderTeamFilter = useCallback(
    () => (
      <Select
        className="dash-team-filter"
        mx="auto"
        style={mobile ? { width: '100%' } : undefined}
        classNames={{
          input: 'dash-team-filter-input',
          option: 'dash-status-option',
        }}
        aria-label="กรองตามทีม"
        value={teamFilter}
        onChange={(team) => setTeamFilter(team ?? '')}
        allowDeselect={false}
        rightSection={<ChevronDown size={16} className="dash-team-chevron" aria-hidden="true" />}
        rightSectionPointerEvents="none"
        data={teamOptions}
      />
    ),
    [mobile, teamFilter, setTeamFilter, teamOptions],
  );
  const addFromIqiMutation = useMutation({
    mutationFn: ({ asset, row }: { asset: string; row: number }) =>
      dashboardService.addFromIqi(api, asset, row),
    onSuccess: async ({ asset }) => {
      setNotice(`เพิ่ม ${asset} จาก IQI แล้ว`);
      showToast(`เพิ่ม ${asset} แล้ว`);
      setAddOpen(false);
      setAddAsset('');
      await reloadDashboardData();
    },
  });
  const findIqiMutation = useMutation({
    mutationFn: (asset: string) => dashboardService.findIqiAsset(api, asset),
    onSuccess: setIqiPreview,
  });
  if (data.isPending) return <DashboardLoadingSkeleton />;
  if (!data.data)
    return (
      <>
        <ErrorAlert error={data.error} onRefresh={() => data.refetch()} />
      </>
    );
  const dashboard = data.data;
  const current = dashboard.records.find((r) => r.row === selected);
  const renderStatusFilterCard = (
    label: string,
    count: number,
    selected: boolean,
    onClick: () => void,
  ) => (
    <UnstyledButton
      key={label}
      type="button"
      className={`dash-stat ${getStatusColorClass(label)} ${selected ? 'selected' : ''}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="dash-stat-label">{formatDashboardStatusLabel(label)}</span>
      <span className="dash-stat-total">
        <strong>{count.toLocaleString('th-TH')}</strong>
        <span className="dash-stat-caption">รายการ</span>
      </span>
    </UnstyledButton>
  );
  return (
    <Box component="section" aria-label="Dashboard ครุภัณฑ์ IQI">
      <Group justify="space-between" align="center" className="dash-heading">
        <Box>
          <Box className="eyebrow">IQI · APPSCRIPTDATA</Box>
          <Title order={1}>Dashboard ครุภัณฑ์</Title>
          <Text component="p" className="portal-paragraph">
            ผลตรวจจาก Apps Script และการเทียบข้อมูลกับ Google Sheets
          </Text>
        </Box>
        <Group>
          <Button
            onClick={() => {
              addFromIqiMutation.reset();
              findIqiMutation.reset();
              setIqiPreview(null);
              setAddOpen(true);
            }}
          >
            เพิ่มจาก IQI
          </Button>
          <RefreshButton
            disabled={saveStatusDraftsMutation.isPending}
            loading={data.isFetching}
            onClick={() => {
              if (
                drafts.current.size &&
                !window.confirm('โหลดข้อมูลล่าสุดและยกเลิกสถานะที่ยังไม่บันทึก?')
              )
                return;
              drafts.current.clear();
              setDraftVersion((v) => v + 1);
              setNotice('');
              void data.refetch();
            }}
          />
        </Group>
      </Group>
      <Box
        className="dash-bulk-bar"
        hidden={!drafts.current.size && !saveStatusDraftsMutation.isPending}
      >
        <span>
          {drafts.current.size
            ? `มี ${drafts.current.size} รายการที่แก้ไขยังไม่บันทึก · รวมรายการที่ซ่อนด้วยตัวกรอง`
            : 'ไม่มีรายการที่แก้ไขค้างไว้'}
        </span>
        <Button
          loading={saveStatusDraftsMutation.isPending}
          fullWidth={mobile}
          disabled={!drafts.current.size}
          onClick={() => saveStatusDraftsMutation.mutate(undefined)}
        >
          บันทึกทั้งหมด ({drafts.current.size})
        </Button>
      </Box>
      <ErrorAlert error={data.error} onRefresh={() => data.refetch()} />
      <ErrorAlert error={saveStatusDraftsMutation.error} />
      <ErrorAlert error={addFromIqiMutation.error} />
      <ErrorAlert error={findIqiMutation.error} />
      {notice && (
        <Text className="dash-save-success" role="status">
          {notice}
        </Text>
      )}
      <Paper withBorder component="section" className="dash-progress">
        <Box className="dash-progress-head">
          <Title order={2}>ความคืบหน้าการตรวจ</Title>
          <strong>{dashboard.percent}%</strong>
        </Box>
        <Text component="p" className="portal-paragraph">
          ตรวจแล้ว {dashboard.completed} / {dashboard.total} รายการ
        </Text>
        <Progress
          value={dashboard.percent}
          aria-label="ความคืบหน้าการตรวจครุภัณฑ์"
          className="dash-inspection-progress"
          size={15}
          radius="xl"
        />
        <Text component="p" className="portal-paragraph dash-hint">
          นับตรวจแล้วจาก ดี + ชำรุด + หาไม่เจอ + อุปกรอื่นๆ + กล้องวงจรปิด ตามผลตรวจ Apps Script
        </Text>
      </Paper>
      <Accordion
        chevronSize={16}
        radius={18}
        styles={{
          item: {
            border: '1px solid var(--line)',
            overflow: 'hidden',
            backgroundColor: 'var(--mantine-color-white)',
          },
          control: {
            minHeight: filtersOpen ? 44 : 60,
            backgroundColor: 'var(--mantine-color-portalYellow-1)',
            color: 'var(--mantine-color-black)',
          },
          label: { paddingBlock: 0, fontSize: 16, fontWeight: 700 },
          chevron: { color: '#111827' },
          content: { padding: 0 },
        }}
        value={filtersOpen ? 'filters' : null}
        onChange={(value) => setFiltersOpen(value === 'filters')}
        variant="separated"
        my="md"
      >
        <Accordion.Item value="filters">
          <Accordion.Control p={{ base: 18, compact: 24 }}>
            ตัวกรองสถานะและการเทียบข้อมูล
          </Accordion.Control>
          <Accordion.Panel px={{ base: 18, compact: 24 }} pb={{ base: 18, compact: 24 }}>
            <Title order={2} className="dash-section-title">
              ผลตรวจ Apps Script
            </Title>
            <SimpleGrid
              cols={{ base: 1, xs: 2, sm: 3, xl: 6 }}
              spacing="sm"
              className="dash-stats"
              style={mobile ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : undefined}
            >
              {[...dashboardStatuses, ...(dashboard.inspection['ไม่ระบุ'] ? ['ไม่ระบุ'] : [])].map(
                (s) =>
                  renderStatusFilterCard(s, dashboard.inspection[s] ?? 0, inspection === s, () =>
                    setInspection(inspection === s ? '' : s),
                  ),
              )}
            </SimpleGrid>
            <Title order={2} className="dash-section-title">
              ข้อมูล Apps Script เทียบกับ Google Sheets
            </Title>
            <SimpleGrid
              cols={{ base: 1, sm: 2, lg: 3 }}
              spacing="sm"
              className="dash-matches"
              style={mobile ? { gridTemplateColumns: 'minmax(0, 1fr)' } : undefined}
            >
              {Object.entries(dashboard.comparison).map(([s, count]) =>
                renderStatusFilterCard(s, count, comparison === s, () =>
                  setComparison(comparison === s ? '' : s),
                ),
              )}
            </SimpleGrid>
            <Text component="p" className="portal-paragraph dash-hint">
              “หาไม่เจอ” ในการเทียบข้อมูล หมายถึงไม่พบข้อมูลในชีตต้นฉบับ
              เป็นคนละส่วนกับผลตรวจหาอุปกรณ์ไม่เจอ
            </Text>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
      <Group my="lg">
        <TextInput
          flex={mobile ? '1 1 100%' : 1}
          miw={0}
          aria-label="ค้นหารายการ Dashboard"
          placeholder="ค้นหาเลขครุภัณฑ์ S/N อุปกรณ์ ผู้ถือครอง หรือหมายเหตุ"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        <ResetFiltersButton
          ml="auto"
          onClick={() => {
            setQuery('');
            setInspection('');
            setComparison('');
            setTeamFilter('');
          }}
        />
      </Group>
      {mobile && <Box mb="md">{renderTeamFilter()}</Box>}
      <Box className="dash-list-head">
        <strong>
          แสดง {records.length} จาก {dashboard.total} รายการ
        </strong>
        <span>
          {[inspection, comparison, teamFilter].filter(Boolean).join(' · ') || 'ทุกรายการ'}
        </span>
      </Box>
      {mobile ? (
        <DashboardMobileCards
          records={records}
          drafts={drafts.current}
          draftVersion={draftVersion}
          busy={saveStatusDraftsMutation.isPending}
          onStatusChange={updateStatusDraft}
          onSave={saveStatusDraft}
          onSelect={setSelected}
        />
      ) : (
        <DashboardTable
          records={records}
          drafts={drafts.current}
          draftVersion={draftVersion}
          busy={saveStatusDraftsMutation.isPending}
          renderTeamFilter={renderTeamFilter}
          onStatusChange={updateStatusDraft}
          onSave={saveStatusDraft}
          onSelect={setSelected}
        />
      )}
      <Text component="p" className="portal-paragraph dash-updated">
        อ่านจากแท็บ Appscriptdata เมื่อ{' '}
        {new Date(dashboard.loadedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} ·
        แก้สถานะผ่านหน้านี้จะบันทึกลง Appscriptdata เท่านั้น
      </Text>
      {current && (
        <DashboardRecordDialog
          key={current.row}
          record={current}
          headers={dashboard.headers}
          teams={dashboard.teams}
          onClose={() => setSelected(null)}
          onRefresh={reloadDashboardData}
          onSaved={updateCachedDashboardRecord}
        />
      )}
      <Modal opened={addOpen} onClose={() => setAddOpen(false)} title="เพิ่มรายการจาก IQI" centered>
        <Text size="sm" mb="sm">
          ค้นหาข้อมูลใน IQI และตรวจรายละเอียดก่อนเพิ่มลง Appscriptdata
        </Text>
        <Group align="end">
          <TextInput
            style={{ flex: 1 }}
            label="เลขครุภัณฑ์"
            placeholder="เช่น STeP61-107-041"
            value={addAsset}
            onChange={(event) => {
              setAddAsset(event.currentTarget.value);
              setIqiPreview(null);
            }}
            maxLength={200}
            autoFocus
          />
          <Button
            loading={findIqiMutation.isPending}
            disabled={!addAsset.trim()}
            onClick={() => findIqiMutation.mutate(addAsset.trim())}
          >
            ค้นหา
          </Button>
        </Group>
        {iqiPreview && (
          <>
            <Text mt="md" fw={600}>
              {iqiPreview.asset} · {iqiPreview.name || 'ไม่ระบุชนิด'}
            </Text>
            <Text size="sm">
              ยี่ห้อ/รุ่น: {[iqiPreview.brand, iqiPreview.model].filter(Boolean).join(' ') || '—'} ·
              S/N: {iqiPreview.serial || '—'}
            </Text>
            <Text size="sm">
              ผู้ถือครอง: {iqiPreview.owner || '—'} · ทีม: {iqiPreview.team || '—'} · รายละเอียด:{' '}
              {iqiPreview.details || '—'}
            </Text>
            <Button
              mt="md"
              loading={addFromIqiMutation.isPending}
              onClick={() =>
                addFromIqiMutation.mutate({ asset: iqiPreview.asset, row: iqiPreview.row })
              }
            >
              ยืนยันเพิ่มลง Appscriptdata
            </Button>
          </>
        )}
      </Modal>
    </Box>
  );
}
