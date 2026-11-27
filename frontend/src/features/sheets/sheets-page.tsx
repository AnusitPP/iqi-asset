'use client';
import { Anchor, List, Paper, Text, Box, Button, Menu, Group } from '@mantine/core';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/features/auth/auth-provider';
import { systemService } from '@/services/system.service';
import { LoadingIndicator } from '@/components/ui/feedback';
import { ErrorPopup } from '@/components/core/error-popup';
import { PageHeader } from '@/components/portal/page-header';
import { ReportPreview } from './report-preview';

export function SheetsPage() {
  const { api, can } = useAuthSession();
  const [preview, setPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);
  const canView = can('SHEETS_VIEW');
  const canExport = can('SHEETS_EXPORT');
  const exportFile = async (format: 'csv' | 'xlsx') => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const result = await systemService.exportAssetReport(api, format);
      const bytes =
        format === 'xlsx'
          ? Uint8Array.from(atob(result.content), (value) => value.charCodeAt(0))
          : result.content;
      const type =
        format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv;charset=utf-8';
      const url = URL.createObjectURL(new Blob([bytes], { type }));
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(error);
    } finally {
      setExporting(false);
    }
  };
  const status = useQuery({
    queryKey: ['connection'],
    queryFn: ({ signal }) => systemService.fetchConnectionStatus(api, signal),
    enabled: canView,
  });
  const links = [{ label: 'ไฟล์ข้อมูลยืม–คืนครุภัณฑ์', url: status.data?.spreadsheetUrl }].filter(
    (link) => link.url,
  );

  return (
    <Box component="section">
      <PageHeader
        title="ไฟล์ Google Sheets"
        description="เลือกไฟล์ที่ต้องการเปิด ลิงก์จะเปิดในแท็บใหม่"
      />
      {canView && (
        <Group mb="md">
          <Button
            variant="default"
            onClick={() => setPreview((value) => !value)}
            aria-expanded={preview}
          >
            {preview ? 'ปิดพรีวิวตาราง' : 'พรีวิวตารางรายงาน'}
          </Button>
          {canExport && (
            <Menu>
              <Menu.Target>
                <Button loading={exporting}>Export รายงานครุภัณฑ์ ปี 70</Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>เลือกรูปแบบไฟล์</Menu.Label>
                <Menu.Item disabled={exporting} onClick={() => void exportFile('xlsx')}>
                  Excel (.xlsx)
                </Menu.Item>
                <Menu.Item disabled={exporting} onClick={() => void exportFile('csv')}>
                  CSV (.csv)
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      )}
      {canExport && (
        <Text size="sm" c="dimmed" mb="md">
          แนะนำ Excel เพื่อคงรูปแบบตาราง วันที่ และลิงก์รูปภาพ
        </Text>
      )}
      <ErrorPopup error={exportError} onRefresh={async () => setExportError(null)} />
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
      {canView && preview && <ReportPreview />}
    </Box>
  );
}
