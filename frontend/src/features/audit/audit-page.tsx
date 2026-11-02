'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Group,
  Modal,
  NativeSelect,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useAuthSession } from '@/features/auth/auth-provider';
import { auditService } from '@/services/audit.service';
import type { AuditEntry } from '@/types/account';
import { formatAccountTimestamp, readableAuditData } from '@/lib/account-display';
import { ErrorAlert, LoadingIndicator } from '@/components/ui/feedback';
import { UserAvatar } from '@/components/ui/user-avatar';

export function AuditPage() {
  const { api, can } = useAuthSession();
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('');
  const [type, setType] = useState('');
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const audit = useQuery({
    queryKey: ['audit'],
    queryFn: ({ signal }) => auditService.list(api, signal),
    enabled: can('AUDIT_VIEW'),
  });
  const records = audit.data?.records ?? [];
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = records.filter(
    (entry) =>
      (!action || entry.action === action) &&
      (!type || entry.entity_type === type) &&
      terms.every((term) =>
        [
          entry.actor_name_snapshot,
          entry.actor_email_snapshot,
          entry.entity_id,
          entry.action,
          entry.entity_type,
        ].some((value) => value.toLowerCase().includes(term)),
      ),
  );
  const actions = [...new Set(records.map((entry) => entry.action).filter(Boolean))].sort();
  const types = [...new Set(records.map((entry) => entry.entity_type).filter(Boolean))].sort();
  return (
    <section>
      <div className="dash-heading">
        <h1>Audit Log</h1>
        <Button
          loading={audit.isFetching}
          onClick={() => {
            void audit.refetch();
          }}
        >
          โหลดประวัติล่าสุด
        </Button>
      </div>
      <Paper withBorder p="lg" radius="lg">
        <Group align="end">
          <TextInput
            label="ค้นหาประวัติ"
            placeholder="ชื่อ อีเมล หรือ Entity ID"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <NativeSelect
            label="การกระทำ"
            data={[{ value: '', label: 'ทุกการกระทำ' }, ...actions]}
            value={action}
            onChange={(event) => setAction(event.currentTarget.value)}
          />
          <NativeSelect
            label="ประเภท"
            data={[{ value: '', label: 'ทุกประเภท' }, ...types]}
            value={type}
            onChange={(event) => setType(event.currentTarget.value)}
          />
          <Button
            variant="default"
            onClick={() => {
              setQuery('');
              setAction('');
              setType('');
            }}
          >
            ล้างตัวกรอง
          </Button>
        </Group>
      </Paper>
      <ErrorAlert error={audit.error} />
      {audit.isPending ? (
        <LoadingIndicator />
      ) : (
        <>
          <Text role="status" my="md">
            แสดง {matches.length} จาก {records.length} รายการล่าสุด
          </Text>
          {!matches.length ? (
            <Text>
              {records.length
                ? 'ไม่พบรายการที่ตรงกับตัวกรอง ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง'
                : 'ยังไม่มีประวัติการใช้งาน'}
            </Text>
          ) : (
            <Table.ScrollContainer minWidth={780}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>วันและเวลา</Table.Th>
                    <Table.Th>ผู้ใช้งาน</Table.Th>
                    <Table.Th>การกระทำ</Table.Th>
                    <Table.Th>ประเภท / Entity ID</Table.Th>
                    <Table.Th>รายละเอียด</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {matches.map((entry) => (
                    <Table.Tr key={entry.id}>
                      <Table.Td>{formatAccountTimestamp(entry.created_at)}</Table.Td>
                      <Table.Td>
                        <Group wrap="nowrap">
                          <UserAvatar
                            name={entry.actor_name_snapshot || 'ไม่ระบุตัวตน'}
                            url={entry.actor_avatar_url}
                          />
                          <div>
                            <Text>{entry.actor_name_snapshot || 'ไม่ระบุตัวตน'}</Text>
                            <Text size="xs">{entry.actor_email_snapshot}</Text>
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={
                            /FAILED|REJECTED|DISABLED/.test(entry.action)
                              ? 'red'
                              : /SUCCESS|APPROVED|ACCEPTED|CREATED/.test(entry.action)
                                ? 'green'
                                : /CHANGED|ASSIGNED/.test(entry.action)
                                  ? 'blue'
                                  : 'gray'
                          }
                        >
                          {entry.action}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {entry.entity_type}
                        <Text size="xs">{entry.entity_id || '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Button variant="subtle" onClick={() => setSelected(entry)}>
                          ดูรายละเอียด
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </>
      )}
      <Modal
        opened={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.action ?? 'รายละเอียด Audit'}
        size="xl"
      >
        {selected && (
          <Stack>
            <Text>
              ผู้ใช้งาน: {selected.actor_name_snapshot || 'ไม่ระบุตัวตน'} ·{' '}
              {selected.actor_email_snapshot || '—'}
            </Text>
            <Text>
              ประเภท: {selected.entity_type} · Entity ID: {selected.entity_id || '—'}
            </Text>
            <Text>วันและเวลา: {formatAccountTimestamp(selected.created_at)}</Text>
            <Text>Audit ID: {selected.id}</Text>
            <Text fw={700}>ก่อนเปลี่ยนแปลง</Text>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {readableAuditData(selected.before_data)}
            </pre>
            <Text fw={700}>หลังเปลี่ยนแปลง</Text>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {readableAuditData(selected.after_data)}
            </pre>
            <Button variant="default" onClick={() => setSelected(null)}>
              ปิด
            </Button>
          </Stack>
        )}
      </Modal>
    </section>
  );
}
