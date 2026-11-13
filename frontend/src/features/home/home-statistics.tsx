'use client';
import { useQuery } from '@tanstack/react-query';
import { Box, SimpleGrid } from '@mantine/core';
import { Package, CircleCheck, ClipboardClock, FileText } from 'lucide-react';
import { useAuthSession } from '@/features/auth/auth-provider';
import { dashboardService } from '@/services/dashboard.service';
import { myRequestsService } from '@/services/my-requests.service';
import { StatCard } from '@/components/portal/stat-card';
import { ErrorPopup } from '@/components/core/error-popup';
export function HomeStatistics() {
  const { api, can, authenticated } = useAuthSession();
  const canDashboard = authenticated && can('ADMIN_DASHBOARD_VIEW');
  const canRequests = authenticated && can('LOAN_VIEW_OWN');
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.fetchDashboardData(api),
    enabled: canDashboard,
    staleTime: 60000,
  });
  const requests = useQuery({
    queryKey: ['my-requests'],
    queryFn: ({ signal }) => myRequestsService.list(api, signal),
    enabled: canRequests,
    staleTime: 60000,
  });
  const dashboardState = !canDashboard
    ? 'restricted'
    : dashboard.isPending
      ? 'loading'
      : dashboard.error
        ? 'error'
        : 'ready';
  const requestState = !canRequests
    ? 'restricted'
    : requests.isPending
      ? 'loading'
      : requests.error
        ? 'error'
        : 'ready';
  return (
    <Box component="section" aria-label="สรุปข้อมูลการใช้งาน" className="portal-statistics-section">
      <SimpleGrid className="portal-statistics" cols={{ base: 2, lg: 4 }} spacing="md">
        <StatCard
          label="รายการครุภัณฑ์"
          value={dashboard.data?.total}
          caption="รายการทั้งหมดใน Dashboard"
          icon={Package}
          tone="green"
          state={dashboardState}
        />
        <StatCard
          label="ตรวจเช็คแล้ว"
          value={dashboard.data?.completed}
          caption={
            dashboard.data ? `${Math.round(dashboard.data.percent)}% ของรายการใน Dashboard` : ''
          }
          icon={CircleCheck}
          tone="blue"
          state={dashboardState}
        />
        <StatCard
          label="รอการตรวจเช็ค"
          value={
            dashboard.data
              ? Math.max(0, dashboard.data.total - dashboard.data.completed)
              : undefined
          }
          caption="รายการที่ยังไม่ได้ตรวจเช็ค"
          icon={ClipboardClock}
          tone="amber"
          state={dashboardState}
        />
        <StatCard
          label="คำร้องของฉัน"
          value={requests.data?.records.length}
          caption="รายการยืมและคืนครุภัณฑ์"
          icon={FileText}
          tone="violet"
          state={requestState}
        />
      </SimpleGrid>
      <ErrorPopup
        error={dashboard.error || requests.error}
        onRefresh={() =>
          Promise.all([
            ...(canDashboard ? [dashboard.refetch()] : []),
            ...(canRequests ? [requests.refetch()] : []),
          ])
        }
      />
    </Box>
  );
}
