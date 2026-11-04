import { Badge } from '@mantine/core';

export function AuditActionBadge({ action }: { action: string }) {
  const color = /FAILED|REJECTED|DISABLED/.test(action)
    ? 'red'
    : /SUCCESS|APPROVED|ACCEPTED|CREATED/.test(action)
      ? 'green'
      : /CHANGED|ASSIGNED/.test(action)
        ? 'blue'
        : 'gray';
  return (
    <Badge
      color={color}
      variant="light"
      radius="sm"
      size="sm"
      maw="100%"
      h="auto"
      py={4}
      styles={{ label: { whiteSpace: 'normal', overflowWrap: 'anywhere' } }}
    >
      {action}
    </Badge>
  );
}
