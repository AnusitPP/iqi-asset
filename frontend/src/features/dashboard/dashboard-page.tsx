'use client';
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
  Table,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { DashboardMobileCards } from './dashboard-mobile-cards';
import { DashboardStatusEditor } from './dashboard-status-editor';
import { ChevronDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceState } from '@/hooks/use-workspace-state';
import { useSessionTaskGuard } from '@/hooks/use-session-task-guard';
import { useToast } from '@/providers/toast-provider';
import { DashboardLoadingSkeleton } from '@/components/ui/dashboard-skeleton';
import { useRef, useState } from 'react';
import { useAuthSession } from '@/features/auth/auth-provider';
import { dashboardStatuses, type DashboardRecord } from '@/types/contracts';
import { dashboardService, type DashboardData } from '@/services/dashboard.service';
import { CopyableText, ErrorAlert } from '@/components/ui/feedback';
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
    queryFn: ({ signal }) => dashboardService.fetchDashboardData(api, signal),
  });
  const [inspection, setInspection] = useWorkspaceState('dashboard-inspection', ''),
    [comparison, setComparison] = useWorkspaceState('dashboard-comparison', ''),
    [query, setQuery] = useWorkspaceState('dashboard-query', ''),
    [notice, setNotice] = useState(''),
    [selected, setSelected] = useState<number | null>(null);
  const [teamFilter, setTeamFilter] = useWorkspaceState('dashboard-team', '');
  const [filtersOpen, setFiltersOpen] = useWorkspaceState('dashboard-filters-open', false);
  const isSaveCurrent = useSessionTaskGuard();
  const { showToast } = useToast();
  const drafts = useRef(new Map<number, StatusDraft>()),
    [, setDraftVersion] = useState(0);
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
  if (data.isPending) return <DashboardLoadingSkeleton />;
  if (!data.data)
    return (
      <>
        <ErrorAlert error={data.error} />
        <Button
          onClick={() => {
            void data.refetch();
          }}
        >
          ลองโหลดอีกครั้ง
        </Button>
      </>
    );
  const dashboard = data.data,
    normalized = query.trim().toLocaleLowerCase();
  const records = dashboard.records.filter(
    (r) =>
      (!inspection || r.inspection === inspection) &&
      (!comparison || r.comparison === comparison) &&
      (!teamFilter || r.team.trim() === teamFilter) &&
      (!normalized || r.values.some((v) => v.toLocaleLowerCase().includes(normalized))),
  );
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
  const updateStatusDraft = (record: DashboardRecord, status: string | null) => {
    if (!status || status === record.inspection) drafts.current.delete(record.row);
    else drafts.current.set(record.row, { status, revision: record.revision });
    setDraftVersion((value) => value + 1);
  };
  const renderTeamFilter = () => (
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
      data={[
        { value: '', label: 'ผู้ถือครอง / ทีม · ทุกทีม' },
        ...[...new Set(dashboard.records.map((record) => record.team.trim()).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, 'th'))
          .map((team) => ({ value: team, label: team })),
      ]}
    />
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
        <Button
          variant="default"
          fullWidth={mobile}
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
        >
          โหลดข้อมูลล่าสุด
        </Button>
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
      <ErrorAlert error={data.error} />
      <ErrorAlert error={saveStatusDraftsMutation.error} />
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
          <Accordion.Control p={{ base: 18, '37.5em': 24 }}>
            ตัวกรองสถานะและการเทียบข้อมูล
          </Accordion.Control>
          <Accordion.Panel px={{ base: 18, '37.5em': 24 }} pb={{ base: 18, '37.5em': 24 }}>
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
        <Button
          variant="default"
          onClick={() => {
            setQuery('');
            setInspection('');
            setComparison('');
            setTeamFilter('');
          }}
        >
          ล้างตัวกรอง
        </Button>
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
          busy={saveStatusDraftsMutation.isPending}
          onStatusChange={updateStatusDraft}
          onSave={(row) => saveStatusDraftsMutation.mutate(row)}
          onSelect={setSelected}
        />
      ) : (
        <Table.ScrollContainer minWidth={850} className="dash-list">
          {!records.length ? (
            <Text component="p" className="portal-paragraph dash-empty">
              ไม่พบรายการตามตัวกรองที่เลือก
            </Text>
          ) : (
            <Table
              className="dash-table"
              styles={{
                th: { textAlign: 'center' },
                td: { textAlign: 'center', verticalAlign: 'middle' },
              }}
            >
              <Table.Thead>
                <Table.Tr>
                  {[
                    'เลขครุภัณฑ์ / อุปกรณ์',
                    'S/N',
                    'ผลตรวจ Apps Script',
                    'การเทียบกับชีต',
                    'ผู้ถือครอง / ทีม',
                    'รายละเอียด',
                  ].map((title) => (
                    <Table.Th
                      key={title}
                      scope="col"
                      style={title === 'เลขครุภัณฑ์ / อุปกรณ์' ? { textAlign: 'left' } : undefined}
                    >
                      {title === 'ผู้ถือครอง / ทีม' ? renderTeamFilter() : title}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {records.map((r) => (
                  <Table.Tr key={r.row} className={`dash-row ${getStatusColorClass(r.inspection)}`}>
                    <Table.Td style={{ textAlign: 'left', verticalAlign: 'top' }}>
                      <CopyableText value={r.asset} />
                      <span className="dash-item-name">{r.name || 'ไม่ระบุชื่ออุปกรณ์'}</span>
                    </Table.Td>
                    <Table.Td>
                      <CopyableText value={r.serial} />
                    </Table.Td>
                    <Table.Td>
                      <DashboardStatusEditor
                        record={r}
                        draft={drafts.current.get(r.row)}
                        busy={saveStatusDraftsMutation.isPending}
                        onChange={(status) => updateStatusDraft(r, status)}
                        onSave={() => saveStatusDraftsMutation.mutate(r.row)}
                      />
                      <Box className="dash-updated-at">
                        {r.updatedAt
                          ? `อัปเดตล่าสุด ${r.updatedAt}`
                          : 'ยังไม่มีวันที่อัปเดตจากเว็บ'}
                      </Box>
                    </Table.Td>
                    <Table.Td>
                      <span className={`dash-badge ${getStatusColorClass(r.comparison)}`}>
                        {r.comparison}
                      </span>
                    </Table.Td>
                    <Table.Td>
                      {r.owner || '—'}
                      <span className="dash-item-name">{r.team}</span>
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="sm"
                        variant="default"
                        radius={8}
                        h={36}
                        px={20}
                        fw={600}
                        disabled={saveStatusDraftsMutation.isPending}
                        onClick={() => setSelected(r.row)}
                      >
                        ดูข้อมูล
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Table.ScrollContainer>
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
    </Box>
  );
}
