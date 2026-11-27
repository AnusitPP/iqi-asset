import { useState } from 'react';
import { Alert, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { ApiError, getErrorMessage, type ApiClient } from '@/lib/api-client';
import { systemService } from '@/services/system.service';

export function ReportManageEntries({
  api,
  rows,
  onChanged,
}: {
  api: ApiClient;
  rows: string[][];
  onChanged: () => Promise<unknown>;
}) {
  const [opened, setOpened] = useState(false);
  const [query, setQuery] = useState('');
  const [candidate, setCandidate] = useState<{ row: number; values: string[] }>();
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [headers = [], ...data] = rows;
  const identityColumns = ['เลขครุภัณฑ์', 'ชื่ออุปกรณ์', 'S/N'].map((label) =>
    headers.indexOf(label),
  );
  const labelFor = (values: string[]) =>
    identityColumns
      .map((index) => values[index])
      .filter(Boolean)
      .join(' · ');
  const needle = query.trim().toLowerCase();
  const matches = data
    .map((values, index) => ({ row: index + 2, values }))
    .filter(
      ({ values }) =>
        values.some((value) => value.trim()) &&
        (!needle || labelFor(values).toLowerCase().includes(needle)),
    );

  async function moveToTrash() {
    if (!candidate || moving) return;
    setMoving(true);
    setError('');
    try {
      await systemService.trashAssetReportEntry(api, candidate.row, candidate.values);
      setCandidate(undefined);
      setMessage('ย้ายรายการไปแท็บรายการที่ลบแล้ว');
      await onChanged();
    } catch (error) {
      if (error instanceof ApiError && [409, 502, 504, 0].includes(error.status)) {
        setCandidate(undefined);
        await onChanged();
      }
      setError(getErrorMessage(error));
    } finally {
      setMoving(false);
    }
  }

  return (
    <>
      <Button
        variant="default"
        onClick={() => {
          setOpened(true);
          setCandidate(undefined);
          setError('');
          setMessage('');
          setQuery('');
        }}
      >
        จัดการรายการ
      </Button>
      <Modal
        opened={opened}
        onClose={() => {
          if (!moving) setOpened(false);
        }}
        withCloseButton={!moving}
        title={candidate ? 'ยืนยันย้ายรายการไปถัง' : 'จัดการรายการครุภัณฑ์'}
      >
        <Stack>
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}
          {message && (
            <Text role="status" size="sm">
              {message}
            </Text>
          )}
          {candidate ? (
            <>
              <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
                {labelFor(candidate.values) || `แถว ${candidate.row}`}
              </Text>
              <Text size="sm">รายการจะถูกย้ายไปแท็บรายการที่ลบ และหายจากพรีวิวรายงาน</Text>
              <Group justify="end">
                <Button variant="default" disabled={moving} onClick={() => setCandidate(undefined)}>
                  ยกเลิก
                </Button>
                <Button color="red" loading={moving} onClick={() => void moveToTrash()}>
                  ย้ายไปถัง
                </Button>
              </Group>
            </>
          ) : (
            <>
              <TextInput
                label="ค้นหารายการ"
                placeholder="เลขครุภัณฑ์ ชื่อ หรือ S/N"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
              {!matches.length && <Text size="sm">ไม่พบรายการ</Text>}
              {matches.length > 25 && (
                <Text size="sm">
                  แสดง 25 จาก {matches.length} รายการ ใช้ช่องค้นหาเพื่อเจาะจงรายการ
                </Text>
              )}
              {matches.slice(0, 25).map((entry) => (
                <Group key={entry.row} justify="space-between" wrap="nowrap">
                  <Text size="sm" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    {labelFor(entry.values) || `แถว ${entry.row}`}
                  </Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    disabled={moving}
                    aria-label={`ลบรายการ ${labelFor(entry.values) || `แถว ${entry.row}`}`}
                    onClick={() => {
                      setError('');
                      setMessage('');
                      setCandidate(entry);
                    }}
                  >
                    ลบ
                  </Button>
                </Group>
              ))}
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
