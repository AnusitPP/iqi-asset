'use client';
import { Anchor, List, Paper, Text, Box } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/features/auth/auth-provider';
import { systemService } from '@/services/system.service';
import { LoadingIndicator } from '@/components/ui/feedback';
import { ErrorPopup } from '@/components/core/error-popup';
import { PageHeader } from '@/components/portal/page-header';

export function SheetsPage() {
  const { api, can } = useAuthSession();
  const status = useQuery({
    queryKey: ['connection'],
    queryFn: ({ signal }) => systemService.fetchConnectionStatus(api, signal),
    enabled: can('ADMIN_DASHBOARD_VIEW'),
  });
  const links = [
    { label: 'ชีตรอตรวจสอบ', url: status.data?.reviewUrl },
    { label: 'ชีต IT + IQI', url: status.data?.iqiItUrl },
  ].filter((link) => link.url);

  return (
    <Box component="section">
      <PageHeader
        title="ไฟล์ Google Sheets"
        description="เลือกไฟล์ที่ต้องการเปิด ลิงก์จะเปิดในแท็บใหม่"
      />
      <Paper withBorder radius="lg" p="lg">
        <ErrorPopup
          error={can('ASSET_VIEW') ? null : status.error}
          onRefresh={() => status.refetch()}
        />
        {status.isPending ? (
          <LoadingIndicator />
        ) : links.length ? (
          <List spacing="md">
            {links.map((link) => (
              <List.Item key={link.label}>
                <Anchor href={link.url!} target="_blank" rel="noopener noreferrer">
                  {link.label} ↗
                </Anchor>
              </List.Item>
            ))}
          </List>
        ) : !status.error ? (
          <Text c="dimmed">ยังไม่มีลิงก์ไฟล์ที่ตั้งค่าไว้</Text>
        ) : null}
      </Paper>
    </Box>
  );
}
