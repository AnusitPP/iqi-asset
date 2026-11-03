'use client';
import {
  Button,
  Group,
  NativeSelect,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import type { ReactNode } from 'react';
import { FORM_TEAMS } from '@shared/features/lending/formConstants.js';
import { ErrorAlert } from '@/components/ui/feedback';
import { LendingCatalogPicker } from './catalog-picker';
import type { LendingRequestController } from './use-lending-request-form';

type LendingRequestFormProps = {
  request: LendingRequestController;
  title: string;
  sectionTitle: string;
  terms: readonly string[];
  children: ReactNode;
};

export function LendingRequestForm({
  request,
  title,
  sectionTitle,
  terms,
  children,
}: LendingRequestFormProps) {
  const {
    mode,
    borrowerReadOnly,
    form,
    busy,
    selected,
    selectionError,
    error,
    notice,
    pickerVersion,
    selectLendingAsset,
    resetLendingRequestForm,
    handleSubmitLendingRequest,
  } = request;
  return (
    <section>
      <div className="dash-heading">
        <h1>{title}</h1>
      </div>
      <Paper withBorder radius="lg" p="lg">
        <form noValidate onSubmit={form.handleSubmit(handleSubmitLendingRequest)}>
          <Stack>
            <TextInput
              label="ชื่อ - สกุล"
              withAsterisk
              maxLength={200}
              readOnly={borrowerReadOnly}
              {...form.register('borrower')}
              error={form.formState.errors.borrower?.message}
              disabled
            />
            <NativeSelect
              label="ทีม"
              withAsterisk
              data={[{ value: '', label: 'เลือก' }, ...FORM_TEAMS]}
              {...form.register('team')}
              error={form.formState.errors.team?.message}
              disabled={busy}
            />
            <Text fw={600}>{sectionTitle}</Text>
            {terms.map((text) => (
              <Text size="sm" c="dimmed" key={text}>
                {text}
              </Text>
            ))}
            <LendingCatalogPicker
              mode={mode}
              key={pickerVersion}
              selected={selected}
              onSelect={selectLendingAsset}
              disabled={busy}
              error={selectionError}
            />
            <TextInput
              label="เลขครุภัณฑ์, Serial Number (S/N), Service Tag"
              withAsterisk
              disabled
              description="เติมอัตโนมัติเมื่อเลือกอุปกรณ์จากผลค้นหา"
              readOnly
              value={selected ? [selected.asset, selected.serial].filter(Boolean).join(' / ') : ''}
            />
            {children}
            <Textarea
              label="หมายเหตุ (ถ้ามี)"
              maxLength={2000}
              {...form.register('notes')}
              error={form.formState.errors.notes?.message}
              disabled={busy}
            />
            <ErrorAlert error={error} />
            <Text role="status">{notice}</Text>
            <Group>
              <Button type="submit" loading={busy}>
                ส่ง
              </Button>
              <Button variant="default" disabled={busy} onClick={resetLendingRequestForm}>
                ล้างแบบฟอร์ม
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </section>
  );
}
