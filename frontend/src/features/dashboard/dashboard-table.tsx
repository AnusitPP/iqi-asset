'use client';
import { memo, type ReactNode } from 'react';
import { Box, Button, Table, Text } from '@mantine/core';
import { CopyableText } from '@/components/ui/feedback';
import { getStatusColorClass } from '@/lib/display';
import type { DashboardRecord } from '@/types/contracts';
import type { StatusDraft } from './save-drafts';
import { DashboardStatusEditor } from './dashboard-status-editor';
export const DashboardTable = memo(function DashboardTable({
  records,
  drafts,
  busy,
  renderTeamFilter,
  onStatusChange,
  onSave,
  onSelect,
}: {
  records: DashboardRecord[];
  drafts: ReadonlyMap<number, StatusDraft>;
  draftVersion: number;
  busy: boolean;
  renderTeamFilter: () => ReactNode;
  onStatusChange: (record: DashboardRecord, status: string | null) => void;
  onSave: (row: number) => void;
  onSelect: (row: number) => void;
}) {
  return (
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
                    draft={drafts.get(r.row)}
                    busy={busy}
                    onChange={(status) => onStatusChange(r, status)}
                    onSave={() => onSave(r.row)}
                  />
                  <Box className="dash-updated-at">
                    {r.updatedAt ? `อัปเดตล่าสุด ${r.updatedAt}` : 'ยังไม่มีวันที่อัปเดตจากเว็บ'}
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
                    disabled={busy}
                    onClick={() => onSelect(r.row)}
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
  );
});
