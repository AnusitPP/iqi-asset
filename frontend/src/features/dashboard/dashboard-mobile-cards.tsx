'use client';
import { memo } from 'react';
import { Badge, Box, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { CopyableText } from '@/components/ui/feedback';
import { getStatusColorClass } from '@/lib/display';
import type { DashboardRecord } from '@/types/contracts';
import type { StatusDraft } from './save-drafts';
import { DashboardStatusEditor } from './dashboard-status-editor';

const statusBackgrounds: Record<string, string> = {
  good: 'green.0',
  damaged: 'yellow.0',
  lost: 'red.0',
  other: 'blue.0',
  cctv: 'violet.0',
  todo: 'white',
};

export const DashboardMobileCards = memo(function DashboardMobileCards({
  records,
  drafts,
  busy,
  onStatusChange,
  onSave,
  onSelect,
}: {
  records: DashboardRecord[];
  drafts: ReadonlyMap<number, StatusDraft>;
  draftVersion: number;
  busy: boolean;
  onStatusChange: (record: DashboardRecord, status: string | null) => void;
  onSave: (row: number) => void;
  onSelect: (row: number) => void;
}) {
  if (!records.length)
    return (
      <Paper withBorder p="lg" radius={14}>
        <Text size="sm" c="dimmed" ta="center">
          ไม่พบรายการตามตัวกรองที่เลือก
        </Text>
      </Paper>
    );
  return (
    <Stack gap="sm">
      {records.map((record) => (
        <Paper
          key={record.row}
          withBorder
          radius={14}
          p="md"
          bg={statusBackgrounds[getStatusColorClass(record.inspection)]}
        >
          <Stack gap="sm" style={{ overflowWrap: 'anywhere' }}>
            <Box>
              <CopyableText value={record.asset} />
              <Text size="sm" fw={600}>
                {record.name || 'ไม่ระบุชื่ออุปกรณ์'}
              </Text>
            </Box>
            <Group gap="xs" wrap="nowrap">
              <Text size="xs" c="dimmed">
                S/N
              </Text>
              <CopyableText value={record.serial} />
            </Group>
            <Box>
              <Text size="xs" c="dimmed" mb={6}>
                ผลตรวจ Apps Script
              </Text>
              <DashboardStatusEditor
                record={record}
                draft={drafts.get(record.row)}
                busy={busy}
                fullWidth
                onChange={(status) => onStatusChange(record, status)}
                onSave={() => onSave(record.row)}
              />
              <Text size="xs" c="dimmed" mt={6}>
                {record.updatedAt
                  ? `อัปเดตล่าสุด ${record.updatedAt}`
                  : 'ยังไม่มีวันที่อัปเดตจากเว็บ'}
              </Text>
            </Box>
            <Group justify="space-between" align="flex-start" gap="xs">
              <Text size="xs" c="dimmed">
                การเทียบกับชีต
              </Text>
              <Badge
                variant="light"
                color={
                  record.comparison === 'ตรงกัน'
                    ? 'green'
                    : record.comparison === 'ข้อมูลไม่ตรง'
                      ? 'yellow'
                      : 'red'
                }
                maw="100%"
                h="auto"
                styles={{ label: { whiteSpace: 'normal', overflowWrap: 'anywhere' } }}
              >
                {record.comparison}
              </Badge>
            </Group>
            <Box>
              <Text size="xs" c="dimmed">
                ผู้ถือครอง / ทีม
              </Text>
              <Text size="sm">
                {record.owner || '—'}
                {record.team ? ` · ${record.team}` : ''}
              </Text>
            </Box>
            <Button
              variant="default"
              radius={8}
              h={40}
              fullWidth
              disabled={busy}
              onClick={() => onSelect(record.row)}
            >
              ดูข้อมูล
            </Button>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
});
