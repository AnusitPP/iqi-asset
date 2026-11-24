'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Group, NativeSelect, Text } from '@mantine/core';
import { useAuthSession } from '@/features/auth/auth-provider';
import { systemService } from '@/services/system.service';
import { LoadingIndicator } from '@/components/ui/feedback';
import { ErrorPopup } from '@/components/core/error-popup';
import styles from './report-preview.module.css';

const pageSize = 12;
const fields = [
  { source: 'เลขครุภัณฑ์', label: 'เลขครุภัณฑ์', kind: 'asset', width: 22 },
  { source: 'ชื่ออุปกรณ์', label: 'รายการ', kind: 'name', width: 42 },
  { source: 'ราคาทุน', label: 'ราคาทุน', kind: 'cost', width: 14 },
  { source: 'สภาพ', label: 'สภาพ', kind: 'condition', width: 10 },
  { source: 'ที่ตั้ง', label: 'ที่ตั้งปัจจุบัน', kind: 'location', width: 12 },
];
export function ReportPreview() {
  const { api } = useAuthSession();
  const [page, setPage] = useState(1);
  const [condition, setCondition] = useState('ทั้งหมด');
  const report = useQuery({
    queryKey: ['asset-report-preview'],
    queryFn: ({ signal }) => systemService.fetchAssetReport(api, signal),
  });
  if (report.isPending) return <LoadingIndicator />;
  if (report.error) return <ErrorPopup error={report.error} onRefresh={() => report.refetch()} />;
  const [headers = [], ...data] = report.data.rows;
  const records = data
    .map((values, index) => ({ values, number: index + 1 }))
    .filter((row) => row.values.some((value) => value.trim()));
  const conditionIndex = headers.indexOf('สภาพ');
  const choices = [
    'ทั้งหมด',
    ...new Set(records.map((row) => row.values[conditionIndex] || '').filter(Boolean)),
  ];
  const filtered = records.filter(
    (row) => condition === 'ทั้งหมด' || row.values[conditionIndex] === condition,
  );
  const columns = fields
    .map((field) => ({ ...field, index: headers.indexOf(field.source) }))
    .filter(
      (field) =>
        field.index >= 0 && filtered.some((row) => Boolean(row.values[field.index]?.trim())),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return (
    <Box mt="lg">
      <Group justify="space-between" mb="md" align="end">
        <Box>
          <Text fw={600}>พรีวิวตารางรายงาน</Text>
          <Text size="sm" c="dimmed">
            {filtered.length} รายการ · ยังไม่สร้าง PDF
          </Text>
        </Box>
        {conditionIndex >= 0 && (
          <NativeSelect
            label="กรองตามสภาพ"
            data={choices}
            value={condition}
            onChange={(event) => {
              setCondition(event.currentTarget.value);
              setPage(1);
            }}
          />
        )}
        <Group gap="xs">
          <Button
            variant="default"
            size="xs"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            หน้าก่อนหน้า
          </Button>
          <Text size="sm">
            หน้า {currentPage} / {pages}
          </Text>
          <Button
            variant="default"
            size="xs"
            disabled={currentPage === pages}
            onClick={() => setPage(currentPage + 1)}
          >
            หน้าถัดไป
          </Button>
        </Group>
      </Group>
      <div className={styles.viewport}>
        <article className={styles.paper} aria-label="รายงานครุภัณฑ์ ปี 70">
          <h2>รายงานครุภัณฑ์ ปี 70</h2>
          <table className={styles.table}>
            <caption className={styles.caption}>ตารางรายการครุภัณฑ์</caption>
            <colgroup>
              {columns.map((column) => (
                <col key={column.source} style={{ width: `${column.width}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th scope="col" key={column.source}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.number}>
                  {columns.map((column) => {
                    const value = row.values[column.index] || '';
                    const serial = row.values[headers.indexOf('S/N')] || '';
                    const numericCost = Number(value.replaceAll(',', ''));
                    return (
                      <td
                        key={column.source}
                        className={column.kind === 'cost' ? styles.amount : undefined}
                      >
                        {column.kind === 'cost' && value.trim() && Number.isFinite(numericCost)
                          ? numericCost.toLocaleString('th-TH', { maximumFractionDigits: 2 })
                          : value}
                        {column.kind === 'name' &&
                          serial &&
                          !value.toLowerCase().includes(serial.toLowerCase()) && (
                            <span className={styles.serial}>S/N: {serial}</span>
                          )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={Math.max(1, columns.length)} className={styles.empty}>
                    ไม่มีรายการ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
      </div>
    </Box>
  );
}
