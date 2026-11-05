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
  Box,
  Title,
  Modal,
  SimpleGrid,
  Badge,
} from '@mantine/core';
import { useState, type ReactNode } from 'react';
import { FORM_TEAMS } from '@shared/features/lending/formConstants.js';
import { catalogCategory } from '@shared/features/catalog/search.js';
import { ErrorAlert } from '@/components/ui/feedback';
import { CatalogPhoto, LendingCatalogPicker } from './catalog-picker';
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
  const [detailsStep, setDetailsStep] = useState(false);
  const showSelection = true;
  return (
    <Box component="section">
      {!showSelection && (
        <Group justify="space-between" align="center" className="dash-heading">
          <Title order={1}>{title}</Title>
        </Group>
      )}
      <Paper
        withBorder={!showSelection}
        bg={showSelection ? 'transparent' : undefined}
        radius="lg"
        p={showSelection ? 0 : 'lg'}
      >
        {mode === 'loan' || mode === 'return' ? (
          <Stack>
            <LendingCatalogPicker
              heading={title}
              mode={mode}
              key={pickerVersion}
              selected={selected}
              onSelect={(record) => {
                selectLendingAsset(record);
                if (record) setDetailsStep(true);
              }}
              disabled={busy}
              error={selectionError}
            />
          </Stack>
        ) : null}
        {
          <Modal
            opened={detailsStep && selected !== null}
            onClose={() => {
              if (!busy) setDetailsStep(false);
            }}
            title={
              <Stack gap={2}>
                <Text size="sm" fw={600} c="portalGreen.7" style={{ overflowWrap: 'anywhere' }}>
                  {selected?.asset}
                </Text>
              </Stack>
            }
            styles={{
              header: {
                position: 'sticky',
                top: 0,
                zIndex: 5,
                background: 'var(--mantine-color-body)',
                borderBottom: '1px solid var(--mantine-color-gray-2)',
              },
              title: { flex: 1, minWidth: 0 },
              body: { paddingTop: 20 },
            }}
            centered
            size="lg"
            closeOnClickOutside={!busy}
            closeOnEscape={!busy}
            withCloseButton={!busy}
          >
            {renderForm()}
          </Modal>
        }
        {notice && (
          <Text role="status" c="portalGreen.7" mt="md">
            {notice}
          </Text>
        )}
      </Paper>
    </Box>
  );
  function renderForm() {
    return (
      <form noValidate onSubmit={form.handleSubmit(handleSubmitLendingRequest)}>
        <Stack>
          {selected && (
            <>
              <Paper
                withBorder
                p={8}
                radius="md"
                bg="portalGreen.0"
                style={{
                  borderColor: 'var(--mantine-color-portalGreen-2)',
                  boxShadow: '0 2px 6px rgba(17, 108, 78, 0.04)',
                }}
              >
                <Group wrap="nowrap" align="center" gap={10}>
                  <Box
                    w={80}
                    p={2}
                    bg="white"
                    style={{
                      flexShrink: 0,
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: '1px solid var(--mantine-color-gray-2)',
                    }}
                  >
                    <CatalogPhoto
                      key={selected?.photo}
                      url={selected?.photo}
                      name={selected?.name ?? ''}
                      height={72}
                    />
                  </Box>
                  <Stack gap={3} style={{ minWidth: 0, flex: 1 }}>
                    <Badge
                      variant="light"
                      color="portalGreen"
                      size="xs"
                      maw="100%"
                      title={catalogCategory(selected?.name ?? '')}
                    >
                      {catalogCategory(selected?.name ?? '')}
                    </Badge>
                    <Text fw={700} size="sm" lh={1.4} style={{ overflowWrap: 'anywhere' }}>
                      {selected?.name}
                    </Text>
                    <Group gap={6} wrap="wrap">
                      <Text
                        size="xs"
                        c="portalGreen.7"
                        fw={600}
                        style={{ overflowWrap: 'anywhere' }}
                      >
                        {selected?.asset}
                      </Text>
                      <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
                        S/N: {selected?.serial || '—'}
                      </Text>
                    </Group>
                  </Stack>
                </Group>
              </Paper>
            </>
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="ชื่อ - สกุล"
              withAsterisk
              maxLength={200}
              readOnly={mode === 'loan' || borrowerReadOnly}

              {...(mode === 'return'
                ? { value: form.watch('borrower') }
                : form.register('borrower'))}
              error={form.formState.errors.borrower?.message}
              disabled={busy || mode === 'return'}
            />
            {mode === 'return' ? (
              <TextInput
                label="ทีม"
                withAsterisk
                readOnly
                value={form.watch('team')}
                error={form.formState.errors.team?.message}
                disabled
              />
            ) : (
              <NativeSelect
                label="ทีม"
                withAsterisk
                data={[{ value: '', label: 'เลือก' }, ...FORM_TEAMS]}
                {...form.register('team')}
                error={form.formState.errors.team?.message}
                disabled={busy}
              />
            )}
          </SimpleGrid>
          {mode === 'return' && sectionTitle && <Text fw={600}>{sectionTitle}</Text>}
          {mode === 'return' &&
            terms.map((text) => (
              <Text size="sm" c="dimmed" key={text}>
                {text}
              </Text>
            ))}
          {mode === 'return' && (
            <TextInput
              label="เลขครุภัณฑ์, Serial Number (S/N), Service Tag"
              withAsterisk
              disabled
              description="เติมอัตโนมัติเมื่อเลือกอุปกรณ์จากผลค้นหา"
              readOnly
              value={selected ? [selected.asset, selected.serial].filter(Boolean).join(' / ') : ''}
            />
          )}
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
              {mode === 'loan' ? 'ส่งคำขอยืม' : 'ส่งคำขอคืน'}
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={busy}
              onClick={() => resetLendingRequestForm(mode === 'loan')}
            >
              ล้างแบบฟอร์ม
            </Button>
          </Group>
        </Stack>
      </form>
    );
  }
}
