'use client';
import { Button, Group, Select } from '@mantine/core';
import { ChevronDown } from 'lucide-react';
import { dashboardStatuses, type DashboardRecord } from '@/types/contracts';
import { formatDashboardStatusLabel, getStatusColorClass } from '@/lib/display';
import type { StatusDraft } from './save-drafts';
export function DashboardStatusEditor({
  record: r,
  draft,
  busy,
  fullWidth = false,
  onChange,
  onSave,
}: {
  record: DashboardRecord;
  draft?: StatusDraft;
  busy: boolean;
  fullWidth?: boolean;
  onChange: (status: string | null) => void;
  onSave: () => void;
}) {
  return (
    <Group justify="center" gap={6} wrap="nowrap">
      <Select
        rightSection={<ChevronDown size={16} className="dash-status-chevron" aria-hidden="true" />}
        rightSectionPointerEvents="none"
        aria-label={`สถานะ ${r.asset} ${r.serial}`}
        className={`dash-status-field ${getStatusColorClass(draft?.status ?? r.inspection)}`}
        classNames={{ input: 'dash-status-input', option: 'dash-status-option' }}
        style={fullWidth ? { width: '100%', flex: 1, minWidth: 0 } : undefined}
        styles={fullWidth ? { input: { height: 40 } } : undefined}
        placeholder="เลือกสถานะ"
        allowDeselect={false}
        data={dashboardStatuses.map((status) => ({
          value: status,
          label: formatDashboardStatusLabel(status),
        }))}
        value={draft?.status ?? (r.inspection === 'ไม่ระบุ' ? null : r.inspection)}
        disabled={busy}
        onChange={onChange}
      />
      <Button
        variant="default"
        size="sm"
        radius={8}
        h={fullWidth ? 40 : 36}
        px={fullWidth ? 12 : 20}
        fw={600}
        disabled={busy || !draft}
        onClick={onSave}
      >
        บันทึก
      </Button>
    </Group>
  );
}
