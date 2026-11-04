import { Badge } from '@mantine/core';
import type { AccountRole } from '@/types/account';

const roleColors: Record<AccountRole, string> = {
  SUPER_ADMIN: 'teal',
  ADMIN: 'blue',
  STAFF: 'gray',
};

export function UserRoleBadge({ role }: { role: AccountRole }) {
  return (
    <Badge color={roleColors[role]} variant="light" radius="sm" size="sm" fw={600}>
      {role}
    </Badge>
  );
}
