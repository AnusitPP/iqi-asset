'use client';
import { Code, Modal, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import type { AuditEntry } from '@/types/account';
import { formatAccountTimestamp, readableAuditData } from '@/lib/account-display';

export function AuditDetailsDialog({
  selected,
  onClose,
}: {
  selected: AuditEntry;
  onClose: () => void;
}) {
  const fields = [
    ['ผู้ใช้งาน', selected.actor_name_snapshot || 'ไม่ระบุตัวตน'],
    ['อีเมล', selected.actor_email_snapshot || '—'],
    ['ประเภท', selected.entity_type || '—'],
    ['Entity ID', selected.entity_id || '—'],
    ['วันและเวลา', formatAccountTimestamp(selected.created_at)],
    ['Audit ID', selected.id],
  ];
  return (
    <Modal
      opened
      onClose={onClose}
      title={selected.action}
      size={760}
      radius="lg"
      padding="lg"
      centered
      styles={{ title: { fontSize: 18, fontWeight: 700 }, header: { paddingBottom: 24 } }}
      closeButtonProps={{
        'aria-label': 'ปิด',
        icon: (
          <Text span size="xs" fw={600} c="dimmed">
            ปิด
          </Text>
        ),
        w: 60,
        h: 42,
        radius: 'md',
        bg: 'gray.0',
        style: { border: '1px solid var(--mantine-color-gray-2)', flexShrink: 0 },
      }}
    >
      <Stack gap="xl">
        <Stack gap="sm">
          {fields.map(([label, value]) => (
            <SimpleGrid
              key={label}
              cols={2}
              spacing="md"
              style={{ gridTemplateColumns: '110px minmax(0, 1fr)' }}
            >
              <Text size="sm" c="dimmed">
                {label}
              </Text>
              <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
                {value}
              </Text>
            </SimpleGrid>
          ))}
        </Stack>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {[
            { label: 'ก่อนเปลี่ยนแปลง', data: selected.before_data },
            { label: 'หลังเปลี่ยนแปลง', data: selected.after_data },
          ].map(({ label, data }) => (
            <Stack key={label} gap="sm" miw={0}>
              <Text size="sm" c="dimmed" fw={600}>
                {label}
              </Text>
              <Paper withBorder radius="md" p="md" bg="gray.0" flex={1}>
                <Code
                  block
                  bg="transparent"
                  p={0}
                  style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                >
                  {readableAuditData(data)}
                </Code>
              </Paper>
            </Stack>
          ))}
        </SimpleGrid>
      </Stack>
    </Modal>
  );
}
