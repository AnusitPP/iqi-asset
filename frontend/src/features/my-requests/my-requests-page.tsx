'use client';
import { useQuery } from '@tanstack/react-query';
import { Button, Paper, Stack, Text, Badge, Box, Group, Title } from '@mantine/core';
import { useAuthSession } from '@/features/auth/auth-provider';
import { myRequestsService } from '@/services/my-requests.service';
import { ErrorAlert, LoadingIndicator } from '@/components/ui/feedback';
export function MyRequestsPage() {
  const { api, can } = useAuthSession();
  const requests = useQuery({
    queryKey: ['my-requests'],
    queryFn: ({ signal }) => myRequestsService.list(api, signal),
    enabled: can('LOAN_VIEW_OWN'),
  });
  return (
    <Box component="section">
      <Group justify="space-between" align="center" className="dash-heading">
        <Title order={1}>รายการของฉัน</Title>
        <Button
          loading={requests.isFetching}
          onClick={() => {
            void requests.refetch();
          }}
        >
          โหลดรายการล่าสุด
        </Button>
      </Group>
      <ErrorAlert error={requests.error} />
      {requests.isPending ? (
        <LoadingIndicator />
      ) : (
        <Stack>
          <Text role="status">
            {requests.data?.records.length
              ? `พบ ${requests.data.records.length} รายการ`
              : 'ยังไม่มีรายการของคุณ'}
          </Text>
          {requests.data?.records.map((entry) => (
            <Paper key={`${entry.kind}-${entry.id}`} withBorder p="lg" radius="lg">
              <Text component="h2" fw={700}>
                {entry.kind} · {entry.name || entry.asset}
              </Text>
              <Text>
                {entry.id} · {entry.date}
              </Text>
              <Badge>{entry.status || '—'}</Badge>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}
