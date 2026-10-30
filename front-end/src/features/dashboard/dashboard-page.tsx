'use client';
import { Button, Group, Text, TextInput } from '@mantine/core';
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
import { getStatusColorClass } from '@/lib/display';
import { DashboardRecordDialog } from './dashboard-details';
import { saveStatusDraftsSequentially, type StatusDraft } from './save-drafts';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved';
export function DashboardPage() {
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
    <button
      key={label}
      type="button"
      className={`dash-stat ${getStatusColorClass(label)} ${selected ? 'selected' : ''}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="dash-stat-label">{label}</span>
      <strong>{count}</strong>
      <span className="dash-stat-caption">รายการ</span>
    </button>
  );
  return (
    <section aria-label="Dashboard ครุภัณฑ์ IQI">
      <div className="dash-heading">
        <div>
          <div className="eyebrow">IQI · APPSCRIPTDATA</div>
          <h1>Dashboard ครุภัณฑ์</h1>
          <p>ผลตรวจจาก Apps Script และการเทียบข้อมูลกับ Google Sheets</p>
        </div>
        <Button
          variant="default"
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
      </div>
      <div
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
          disabled={!drafts.current.size}
          onClick={() => saveStatusDraftsMutation.mutate(undefined)}
        >
          บันทึกทั้งหมด ({drafts.current.size})
        </Button>
      </div>
      <ErrorAlert error={data.error} />
      <ErrorAlert error={saveStatusDraftsMutation.error} />
      {notice && (
        <Text className="dash-save-success" role="status">
          {notice}
        </Text>
      )}
      <section className="dash-progress">
        <div className="dash-progress-head">
          <h2>ความคืบหน้าการตรวจ</h2>
          <strong>{dashboard.percent}%</strong>
        </div>
        <p>
          ตรวจแล้ว {dashboard.completed} / {dashboard.total} รายการ
        </p>
        <progress
          max={dashboard.total || 1}
          value={dashboard.completed}
          aria-label="ความคืบหน้าการตรวจครุภัณฑ์"
        />
        <p className="dash-hint">
          นับตรวจแล้วจาก ดี + ชำรุด + หาไม่เจอ + อุปกรอื่นๆ + กล้องวงจรปิด ตามผลตรวจ Apps Script
        </p>
      </section>
      <details
        className="dash-filters"
        open={filtersOpen}
        onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
      >
        <summary>ตัวกรองสถานะและการเทียบข้อมูล</summary>
        <h2 className="dash-section-title">ผลตรวจ Apps Script</h2>
        <div className="dash-stats">
          {[...dashboardStatuses, ...(dashboard.inspection['ไม่ระบุ'] ? ['ไม่ระบุ'] : [])].map(
            (s) =>
              renderStatusFilterCard(s, dashboard.inspection[s] ?? 0, inspection === s, () =>
                setInspection(inspection === s ? '' : s),
              ),
          )}
        </div>
        <h2 className="dash-section-title">ข้อมูล Apps Script เทียบกับ Google Sheets</h2>
        <div className="dash-matches">
          {Object.entries(dashboard.comparison).map(([s, count]) =>
            renderStatusFilterCard(s, count, comparison === s, () =>
              setComparison(comparison === s ? '' : s),
            ),
          )}
        </div>
        <p className="dash-hint">
          “หาไม่เจอ” ในการเทียบข้อมูล หมายถึงไม่พบข้อมูลในชีตต้นฉบับ
          เป็นคนละส่วนกับผลตรวจหาอุปกรณ์ไม่เจอ
        </p>
      </details>
      <Group my="lg">
        <TextInput
          style={{ flex: 1 }}
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
      <div className="dash-list-head">
        <strong>
          แสดง {records.length} จาก {dashboard.total} รายการ
        </strong>
        <span>
          {[inspection, comparison, teamFilter].filter(Boolean).join(' · ') || 'ทุกรายการ'}
        </span>
      </div>
      <div className="dash-list">
        {!records.length ? (
          <p className="dash-empty">ไม่พบรายการตามตัวกรองที่เลือก</p>
        ) : (
          <table className="dash-table">
            <thead>
              <tr>
                {[
                  'เลขครุภัณฑ์ / อุปกรณ์',
                  'S/N',
                  'ผลตรวจ Apps Script',
                  'การเทียบกับชีต',
                  'ผู้ถือครอง / ทีม',
                  'รายละเอียด',
                ].map((title) => (
                  <th key={title} scope="col">
                    {title === 'ผู้ถือครอง / ทีม' ? (
                      <select
                        className="dash-team-filter"
                        aria-label="กรองตามทีม"
                        value={teamFilter}
                        onChange={(event) => setTeamFilter(event.currentTarget.value)}
                      >
                        <option value="">ผู้ถือครอง / ทีม · ทุกทีม</option>
                        {[
                          ...new Set(
                            dashboard.records.map((record) => record.team.trim()).filter(Boolean),
                          ),
                        ]
                          .sort((a, b) => a.localeCompare(b, 'th'))
                          .map((team) => (
                            <option key={team} value={team}>
                              {team}
                            </option>
                          ))}
                      </select>
                    ) : (
                      title
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.row} className={`dash-row ${getStatusColorClass(r.inspection)}`}>
                  <td>
                    <CopyableText value={r.asset} />
                    <span className="dash-item-name">{r.name || 'ไม่ระบุชื่ออุปกรณ์'}</span>
                  </td>
                  <td>
                    <CopyableText value={r.serial} />
                  </td>
                  <td>
                    <div className="dash-status-controls">
                      <select
                        aria-label={`สถานะ ${r.asset} ${r.serial}`}
                        className={`dash-status-select ${getStatusColorClass(drafts.current.get(r.row)?.status ?? r.inspection)}`}
                        value={
                          drafts.current.get(r.row)?.status ??
                          (r.inspection === 'ไม่ระบุ' ? '' : r.inspection)
                        }
                        disabled={saveStatusDraftsMutation.isPending}
                        onChange={(e) => {
                          if (!e.currentTarget.value || e.currentTarget.value === r.inspection)
                            drafts.current.delete(r.row);
                          else
                            drafts.current.set(r.row, {
                              status: e.currentTarget.value,
                              revision: r.revision,
                            });
                          setDraftVersion((v) => v + 1);
                        }}
                      >
                        <option value="" disabled>
                          เลือกสถานะ
                        </option>
                        {dashboardStatuses.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <Button
                        size="compact-xs"
                        disabled={saveStatusDraftsMutation.isPending || !drafts.current.has(r.row)}
                        onClick={() => saveStatusDraftsMutation.mutate(r.row)}
                      >
                        บันทึก
                      </Button>
                    </div>
                    <div className="dash-updated-at">
                      {r.updatedAt ? `อัปเดตล่าสุด ${r.updatedAt}` : 'ยังไม่มีวันที่อัปเดตจากเว็บ'}
                    </div>
                  </td>
                  <td>
                    <span className={`dash-badge ${getStatusColorClass(r.comparison)}`}>
                      {r.comparison}
                    </span>
                  </td>
                  <td>
                    {r.owner || '—'}
                    <span className="dash-item-name">{r.team}</span>
                  </td>
                  <td>
                    <Button
                      size="compact-xs"
                      variant="light"
                      disabled={saveStatusDraftsMutation.isPending}
                      onClick={() => setSelected(r.row)}
                    >
                      ดูข้อมูล
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="dash-updated">
        อ่านจากแท็บ Appscriptdata เมื่อ{' '}
        {new Date(dashboard.loadedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} ·
        แก้สถานะผ่านหน้านี้จะบันทึกลง Appscriptdata เท่านั้น
      </p>
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
    </section>
  );
}
