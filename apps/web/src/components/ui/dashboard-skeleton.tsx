import { Skeleton, Stack, Group } from '@mantine/core';
export function DashboardLoadingSkeleton() {
  return (
    <Stack py="xl" role="status" aria-label="กำลังโหลด Dashboard">
      <Skeleton height={35} width="45%" />
      <Skeleton height={140} radius="lg" />
      <Group grow>
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} height={90} />
        ))}
      </Group>
      <Skeleton height={320} radius="lg" />
    </Stack>
  );
}
