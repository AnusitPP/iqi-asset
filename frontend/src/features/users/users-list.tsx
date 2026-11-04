'use client';
import { useMediaQuery } from '@mantine/hooks';
import { Button, Group, Stack, Paper, Table, Text, Badge, Box } from '@mantine/core';
import type { AccountUser } from '@/types/account';
import { formatAccountTimestamp } from '@/lib/account-display';
import { UserAvatar } from '@/components/ui/user-avatar';
import { UserRoleBadge } from './user-role-badge';

export type UserSelection = { id: string; editing: boolean };
export function UsersList({
  records,
  canManage,
  onSelect,
}: {
  records: AccountUser[];
  canManage: boolean;
  onSelect: (selection: UserSelection) => void;
}) {
  const mobile = useMediaQuery('(max-width: 47.99em)', false);
  return (
    <>
      {mobile ? (
        <Stack gap="sm">
          {records.map((user) => (
            <Paper key={user.id} withBorder radius={14} p="md" bg="white">
              <Stack gap="sm">
                <Group wrap="nowrap" align="flex-start">
                  <UserAvatar name={user.name} url={user.avatar_url} />
                  <Box miw={0} flex={1}>
                    <Text size="sm" fw={600} style={{ overflowWrap: 'anywhere' }}>
                      {user.name}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
                      {user.email}
                    </Text>
                  </Box>
                </Group>
                <Group justify="space-between" gap="xs">
                  <UserRoleBadge role={user.role} />
                  {user.status === 'ACTIVE' ? (
                    <Group gap={6} wrap="nowrap">
                      <Box
                        w={6}
                        h={6}
                        bg="teal.6"
                        style={{ borderRadius: '50%' }}
                        aria-hidden="true"
                      />
                      <Text size="xs" c="teal.6" fw={600}>
                        ใช้งานอยู่
                      </Text>
                    </Group>
                  ) : (
                    <Badge color="gray">{user.status}</Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  เข้าใช้ล่าสุด: {formatAccountTimestamp(user.last_login_at)}
                </Text>
                <Group grow gap="xs">
                  <Button
                    variant="default"
                    radius={8}
                    h={40}
                    onClick={() => onSelect({ id: user.id, editing: false })}
                  >
                    รายละเอียด
                  </Button>
                  {canManage && user.role !== 'SUPER_ADMIN' && (
                    <Button
                      variant="default"
                      radius={8}
                      h={40}
                      onClick={() => onSelect({ id: user.id, editing: true })}
                    >
                      จัดการสิทธิ์
                    </Button>
                  )}
                </Group>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Paper withBorder radius={14} bg="white" style={{ overflow: 'hidden' }}>
          <Table.ScrollContainer minWidth={1100}>
            <Table
              fz={11}
              layout="fixed"
              w="100%"
              styles={{
                th: {
                  textAlign: 'center',
                  padding: 14,
                  color: '#616462',
                  whiteSpace: 'nowrap',
                },
                td: {
                  textAlign: 'center',
                  padding: 14,
                  verticalAlign: 'middle',
                  borderTop: '1px solid #e9ecf0',
                  overflowWrap: 'anywhere',
                },
              }}
            >
              <colgroup>
                <col style={{ width: '23%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '22%' }} />
              </colgroup>
              <Table.Thead bg="#e9ecf0">
                <Table.Tr>
                  <Table.Th style={{ textAlign: 'left' }}>ผู้ใช้งาน</Table.Th>
                  <Table.Th style={{ textAlign: 'left' }}>อีเมล</Table.Th>
                  <Table.Th>สิทธิ์</Table.Th>
                  <Table.Th>สถานะ</Table.Th>
                  <Table.Th>เข้าใช้ล่าสุด</Table.Th>
                  <Table.Th>จัดการ</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {records.map((user) => (
                  <Table.Tr key={user.id}>
                    <Table.Td style={{ textAlign: 'left' }}>
                      <Group wrap="nowrap" gap="md">
                        <UserAvatar name={user.name} url={user.avatar_url} />
                        <Text size="xs" fw={600} miw={0} style={{ overflowWrap: 'anywhere' }}>
                          {user.name}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'left' }}>{user.email}</Table.Td>
                    <Table.Td>
                      <UserRoleBadge role={user.role} />
                    </Table.Td>

                    <Table.Td>
                      {user.status === 'ACTIVE' ? (
                        <Group justify="center" gap={6} wrap="nowrap">
                          <Box
                            w={6}
                            h={6}
                            bg="teal.6"
                            style={{ borderRadius: '50%' }}
                            aria-hidden="true"
                          />
                          <Text size="xs" c="teal.6" fw={600}>
                            ใช้งานอยู่
                          </Text>
                        </Group>
                      ) : (
                        <Badge color="gray">{user.status}</Badge>
                      )}
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>
                      {formatAccountTimestamp(user.last_login_at)}
                    </Table.Td>
                    <Table.Td>
                      <Group justify="center" gap="xs" wrap="nowrap">
                        <Button
                          variant="default"
                          size="sm"
                          radius={8}
                          h={36}
                          px={20}
                          fw={600}
                          onClick={() => onSelect({ id: user.id, editing: false })}
                        >
                          รายละเอียด
                        </Button>
                        {canManage && user.role !== 'SUPER_ADMIN' && (
                          <Button
                            variant="default"
                            size="sm"
                            radius={8}
                            h={36}
                            px={20}
                            fw={600}
                            onClick={() => onSelect({ id: user.id, editing: true })}
                          >
                            จัดการสิทธิ์
                          </Button>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}
    </>
  );
}
