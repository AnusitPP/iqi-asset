'use client';
import { Box, Group, Modal, Stack, Text } from '@mantine/core';
import { Layers } from 'lucide-react';
import { CopyableText } from '@/components/core/copyable-text';
import { RequestDetailsSummary } from '@/components/core/request-details-summary';
import styles from '@/components/core/request-details.module.css';
import { RequestPickupFields } from './request-pickup-fields';
import { RequestApprovalControls } from './request-approval-controls';
import type { myRequestsSchema } from '@/types/account';
import type { z } from 'zod';

type RequestRecord = z.infer<typeof myRequestsSchema>['records'][number];

export function RequestDetailsModal({
  details,
  approvals,
  today,
  onClose,
  canApprove,
  saving,
  savingId,
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
  setPickupDate,
  pickupTime,
  setPickupTime,
  pickupIncomplete,
  pickupLabel,
  onSave,
}: {
  details: RequestRecord | null;
  approvals: boolean;
  today: string;
  onClose: () => void;
  canApprove: boolean;
  saving: boolean;
  savingId?: string;
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
  setPickupDate: (value: string) => void;
  pickupTime: string;
  setPickupTime: (value: string) => void;
  pickupIncomplete: boolean;
  pickupLabel: (entry: RequestRecord) => string;
  onSave: (id: string, status: string) => void;
}) {
  return (
    <Modal
      opened={details !== null}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Box className={styles.titleIcon}>
            <Layers size={22} aria-hidden="true" />
          </Box>
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text fw={700} size="lg">
              รายละเอียดรายการของฉัน
            </Text>
            {details && (
              <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere', minWidth: 0 }}>
                เลขคำขอ: <CopyableText key={details.id} value={details.id} />
              </Text>
            )}
          </Stack>
        </Group>
      }
      classNames={{ header: styles.header, body: styles.body, content: styles.content }}
      centered
      size={680}
    >
      {details && (
        <Stack gap="sm">
          <RequestDetailsSummary
            record={details}
            today={today}
            showCountdown={!approvals || details.status === 'กำลังยืม'}
          />
          {details.kind === 'ยืม' && approvals && !details.statusLocked ? (
            <RequestPickupFields
              today={today}
              pickupDate={pickupDate}
              setPickupDate={setPickupDate}
              pickupTime={pickupTime}
              setPickupTime={setPickupTime}
              pickupIncomplete={pickupIncomplete}
              disabled={saving || !canApprove}
            />
          ) : (
            details.kind === 'ยืม' && <Text size="sm">{pickupLabel(details)}</Text>
          )}
          {approvals && !details.statusLocked && (
            <RequestApprovalControls
              record={details}
              saving={saving}
              savingId={savingId}
              canApprove={canApprove}
              updateError={updateError}
              summaryStatuses={summaryStatuses}
              drafts={drafts}
              onDraftStatusChange={onDraftStatusChange}
              conditions={conditions}
              onConditionChange={onConditionChange}
              conditionError={conditionError}
              setConditionError={setConditionError}
              comment={comment}
              setComment={setComment}
              pickupDate={pickupDate}
              pickupTime={pickupTime}
              pickupIncomplete={pickupIncomplete}
              onSave={onSave}
            />
          )}
          {(!approvals || details.statusLocked) && (
            <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              คอมเมนต์จากแอดมิน: {details.adminComment || '—'}
            </Text>
          )}
          {conditionError === details.id && (
            <Text id="return-condition-error" role="alert" size="xs" c="red" mt={-8}>
              กรุณาระบุสภาพหลังคืน
            </Text>
          )}
        </Stack>
      )}
    </Modal>
  );
}
