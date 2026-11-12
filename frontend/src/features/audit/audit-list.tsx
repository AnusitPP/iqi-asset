'use client';
import { Box, Button, Code, Group, Paper, Stack, Table, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { AuditEntry } from '@/types/account';
import { formatAccountTimestamp } from '@/lib/account-display';
import { UserAvatar } from '@/components/ui/user-avatar';
import { AuditActionBadge } from './audit-action-badge';

function AuditActor({ entry }: { entry: AuditEntry }) {
  return (
    <Group wrap="nowrap" gap="sm" align="center">
      <UserAvatar name={entry.actor_name_snapshot || 'ไม่ระบุตัวตน'} url={entry.actor_avatar_url} />
      <Box miw={0}>
        <Text size="xs" fw={600} style={{ overflowWrap: 'anywhere' }}>
          {entry.actor_name_snapshot || 'ไม่ระบุตัวตน'}
        </Text>
        <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
          {entry.actor_email_snapshot || '—'}
        </Text>
      </Box>
    </Group>
  );
}

export function AuditList({
  records,
  onSelect,
}: {
  records: AuditEntry[];
  onSelect: (entry: AuditEntry) => void;
}) {
  const mobile = useMediaQuery('(max-width: 47.99em)', false);
  if (mobile)
    return (
      <Stack gap="sm">
        {records.map((entry) => (
          <Paper key={entry.id} withBorder radius={14} p="md" bg="white">
            <Stack gap="sm">
              <AuditActor entry={entry} />
              <Text size="xs" c="dimmed">
                {formatAccountTimestamp(entry.created_at)}
              </Text>
              <Box>
                <AuditActionBadge action={entry.action} />
              </Box>
              <Text size="xs" style={{ overflowWrap: 'anywhere' }}>
                {entry.entity_type} · {entry.entity_id || '—'}
              </Text>
              <Button
                variant="default"
                radius={8}
                h={40}
                style={{ borderWidth: '0.1px', borderColor: 'var(--mantine-color-default-border)' }}
                onClick={() => onSelect(entry)}
              >
                ดูรายละเอียด
              </Button>
            </Stack>
          </Paper>
        ))}
      </Stack>
    );

  return (
    <Paper withBorder radius={14} bg="white" style={{ overflow: 'hidden' }}>
      <Table.ScrollContainer minWidth={1000}>
        <Table
          layout="fixed"
          w="100%"
          fz={11}
          styles={{
            th: {
              textAlign: 'left',
              padding: 14,
              color: '#7c8989',
              whiteSpace: 'nowrap',
              fontSize: 11,
            },
            td: {
              textAlign: 'left',
              padding: 14,
              verticalAlign: 'middle',
              borderTop: '1px solid #e9ecf0',
              overflowWrap: 'anywhere',
            },
          }}
        >
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '19%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <Table.Thead bg="#f1f4f3">
            <Table.Tr>
              <Table.Th>ผู้ใช้งาน</Table.Th>
              <Table.Th>Entity ID</Table.Th>
              <Table.Th>การกระทำ</Table.Th>
              <Table.Th>ประเภท</Table.Th>
              <Table.Th>วันและเวลา</Table.Th>
              <Table.Th>รายละเอียด</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {records.map((entry) => (
              <Table.Tr key={entry.id}>
                <Table.Td style={{ textAlign: 'left' }}>
                  <AuditActor entry={entry} />
                </Table.Td>
                <Table.Td>
                  <Code
                    title={entry.entity_id || '—'}
                    display="inline-block"
                    maw="100%"
                    px={6}
                    py={3}
                    c="dimmed"
                    bg="gray.0"
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      verticalAlign: 'middle',
                    }}
                  >
                    {entry.entity_id || '—'}
                  </Code>
                </Table.Td>
                <Table.Td>
                  <AuditActionBadge action={entry.action} />
                </Table.Td>
                <Table.Td c="dimmed">{entry.entity_type}</Table.Td>
                <Table.Td>{formatAccountTimestamp(entry.created_at)}</Table.Td>
                <Table.Td>
                  <Button
                    variant="default"
                    size="sm"
                    radius={8}
                    h={36}
                    px={16}
                    fw={600}
                    style={{
                      borderWidth: '0.1px',
                      borderColor: 'var(--mantine-color-default-border)',
                    }}
                    onClick={() => onSelect(entry)}
                  >
                    ดูรายละเอียด
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}
