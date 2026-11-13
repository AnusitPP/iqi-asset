'use client';
import { Box, Button, Group, Select, Stack, Text, Textarea } from '@mantine/core';
import { ClipboardCheck, MessageSquare, Save } from 'lucide-react';
import { requestStatusPresentation } from '@shared/features/lending/status.js';
import { ErrorPopup } from '@/components/core/error-popup';
import styles from '@/components/core/request-details.module.css';
import type { myRequestsSchema } from '@/types/account';
import type { z } from 'zod';

type RequestRecord = z.infer<typeof myRequestsSchema>['records'][number];

export function RequestApprovalControls({
  record,
  saving,
  savingId,
  canApprove,
  updateError,
  summaryStatuses,
  drafts,
  onDraftStatusChange,
  conditions,
  onConditionChange,
  conditionError,
  setConditionError,
  comment,
  setComment,
  pickupDate,
  pickupTime,
  pickupIncomplete,
  onSave,
}: {
  record: RequestRecord;
  saving: boolean;
  savingId?: string;
  canApprove: boolean;
  updateError: unknown;
  summaryStatuses: string[];
  drafts: Record<string, string>;
  onDraftStatusChange: (id: string, status: string) => void;
  conditions: Record<string, string>;
  onConditionChange: (id: string, condition: string) => void;
  conditionError: string;
  setConditionError: (value: string) => void;
  comment: string;
  setComment: (value: string) => void;
  pickupDate: string;
  pickupTime: string;
  pickupIncomplete: boolean;
  onSave: (id: string, status: string) => void;
}) {
  const status = drafts[record.id] ?? record.status;
  return (
    <Stack className={styles.controls}>
      <Box className={styles.statusRow}>
        <Group gap="sm">
          <ClipboardCheck className={styles.orangeIcon} aria-hidden="true" />
          <Text fw={700}>สถานะรายการ</Text>
        </Group>
        <Select
          aria-label={`สถานะ ${record.id}`}
          classNames={{ input: styles.statusInput }}
          value={status}
          data={[
            ...new Set(
              [
                ...(record.status === 'กำลังดำเนินการ' ? [] : [record.status]),
                ...summaryStatuses,
              ].filter(Boolean),
            ),
          ].map((value) => ({ value, label: requestStatusPresentation(value).label }))}
          disabled={saving || !canApprove}
          allowDeselect={false}
          onChange={(value) => {
            setConditionError('');
            if (value) onDraftStatusChange(record.id, value);
          }}
        />
      </Box>
      {record.kind === 'คืน' && status === 'เสร็จสิ้น' && (
        <Select
          aria-label={`สภาพหลังคืน ${record.id}`}
          placeholder="สภาพหลังคืน"
          data={['ดี', 'ชำรุด']}
          value={conditions[record.id] || null}
          onChange={(value) => {
            onConditionChange(record.id, value || '');
            setConditionError('');
          }}
          aria-invalid={conditionError === record.id}
          aria-describedby={conditionError === record.id ? 'return-condition-error' : undefined}
          w={130}
        />
      )}
      <Textarea
        label={
          <Group gap="sm">
            <MessageSquare className={styles.orangeIcon} aria-hidden="true" />
            <Text fw={700}>คอมเมนต์จากแอดมิน</Text>
          </Group>
        }
        value={comment}
        onChange={(event) => setComment(event.currentTarget.value)}
        maxLength={2000}
        minRows={2}
        autosize
        size="sm"
        disabled={saving || !canApprove}
      />
      <ErrorPopup error={updateError} />
      <Group justify="flex-end" className={styles.footer}>
        <Button
          size="sm"
          className={styles.saveButton}
          leftSection={<Save size={19} aria-hidden="true" />}
          disabled={
            (status === record.status &&
              comment === record.adminComment &&
              pickupDate === record.pickupDate &&
              pickupTime === record.pickupTime) ||
            saving ||
            (record.kind === 'ยืม' && pickupIncomplete) ||
            !canApprove
          }
          loading={saving && savingId === record.id}
          onClick={() => {
            if (record.kind === 'คืน' && status === 'เสร็จสิ้น' && !conditions[record.id]) {
              setConditionError(record.id);
              return;
            }
            setConditionError('');
            onSave(record.id, status);
          }}
        >
          บันทึก
        </Button>
      </Group>
    </Stack>
  );
}
