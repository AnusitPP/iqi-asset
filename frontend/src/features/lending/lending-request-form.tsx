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
  Checkbox,
} from '@mantine/core';
import { Layers, Trash2 } from 'lucide-react';
import { RequestDetailsSummary } from '@/components/core/request-details-summary';
import { CopyableText } from '@/components/core/copyable-text';
import { bangkokIsoDate } from '@shared/core/extensions/dates.js';
import detailStyles from '@/components/core/request-details.module.css';
import { useState, type ReactNode } from 'react';
import { FORM_TEAMS } from '@shared/features/lending/formConstants.js';
import { ErrorAlert } from '@/components/ui/feedback';
import { LendingCatalogPicker } from './catalog-picker';
import { CatalogPhotoGallery } from '@/components/core/catalog-photo-gallery';
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
  const [deleteOpened, setDeleteOpened] = useState(false);
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
              mode === 'return' ? (
                <Group gap="sm">
                  <Box className={detailStyles.titleIcon}>
                    <Layers size={22} aria-hidden="true" />
                  </Box>
                  <Stack gap={2}>
                    <Text fw={700} size="lg">
                      รายละเอียดรายการของฉัน
                    </Text>
                    <Text size="xs" c="dimmed">
                      เลขคำขอ: <CopyableText value={selected?.loanId || ''} />
                    </Text>
                  </Stack>
                </Group>
              ) : (
                <Stack gap={2}>
                  <Text size="sm" fw={600} c="portalGreen.7" style={{ overflowWrap: 'anywhere' }}>
                    {selected?.asset}
                  </Text>
                </Stack>
              )
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
            size={mode === 'return' ? 680 : 'lg'}
            classNames={
              mode === 'return'
                ? {
                  header: detailStyles.header,
                  body: detailStyles.body,
                  content: detailStyles.content,
                }
                : undefined
            }
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
      <Modal
        opened={deleteOpened && detailsStep && selected !== null && request.canDeleteCatalogItem}
        onClose={() => {
          if (!busy) setDeleteOpened(false);
        }}
        title="ยืนยันการลบรายการ"
        centered
        size="sm"
        closeOnClickOutside={!busy}
        closeOnEscape={!busy}
        withCloseButton={!busy}
      >
        <Stack>
          <Text>ต้องการลบ {selected?.name} ใช่ไหม?</Text>
          <Text size="sm">
            เลขครุภัณฑ์: {selected?.asset} · S/N: {selected?.serial || '—'}
          </Text>
          <Text size="sm" c="dimmed">
            รายการนี้จะถูกลบจากชีตพร้อมยืม
            รูปในโฟลเดอร์ของระบบที่ไม่มีการอ้างอิงในชีตอื่นจะถูกย้ายไปถังขยะ Drive
            โดยไม่ลบประวัติยืม–คืน
          </Text>
          <ErrorAlert error={request.deleteError} />
          <Group justify="flex-end">
            <Button
              type="button"
              variant="default"
              disabled={busy}
              onClick={() => setDeleteOpened(false)}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              color="red"
              loading={request.deleting}
              disabled={busy && !request.deleting}
              onClick={async () => {
                if (await request.deleteLendingAsset()) {
                  setDeleteOpened(false);
                  setDetailsStep(false);
                }
              }}
            >
              ยืนยันการลบ
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
  function renderForm() {
    return (
      <form noValidate onSubmit={form.handleSubmit(handleSubmitLendingRequest)}>
        <Stack>
          {selected && mode === 'return' && (
            <RequestDetailsSummary
              today={bangkokIsoDate()}
              record={{
                ...selected,
                kind: 'ยืม',
                date: selected.start || '',
                due: selected.due || '',
                status: selected.status || 'กำลังยืม',
                borrower: selected.borrower || form.watch('borrower'),
              }}
            />
          )}
          {selected && mode === 'return' && selected.adminComment && (
            <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              คอมเมนต์จากแอดมิน: {selected.adminComment}
            </Text>
          )}
          {selected && mode !== 'return' && (
            <Stack gap={6}>
              <CatalogPhotoGallery
                key={`${selected.asset}-${selected.serial}-${selected.photo || ''}`}
                url={selected.photo}
                name={selected.name}
              />
              <Paper p="sm" radius="sm" bg="portalGreen.0">
                <Stack gap={3} style={{ minWidth: 0, flex: 1 }}>
                  <Text fw={700} size="sm" lh={1.4} style={{ overflowWrap: 'anywhere' }}>
                    {selected?.name}
                  </Text>
                  <Group gap={6} wrap="wrap">
                    <Text size="xs" c="portalGreen.7" fw={600} style={{ overflowWrap: 'anywhere' }}>
                      {selected?.asset}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
                      S/N: {selected?.serial || '—'}
                    </Text>
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          )}
          {request.canProvideService && (
            <Checkbox
              label="ให้บริการ"
              description="ทำรายการยืมให้ผู้อื่น โดยระบุชื่อและอีเมลผู้ยืม"
              checked={request.serviceMode}
              onChange={(event) => request.setServiceMode(event.currentTarget.checked)}
              disabled={busy}
            />
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="ชื่อ - สกุล"
              withAsterisk
              maxLength={200}
              readOnly={borrowerReadOnly}
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
          {mode === 'loan' && (
            <TextInput
              label="อีเมลผู้ยืม"
              type="email"
              maxLength={254}
              withAsterisk={request.serviceMode}
              readOnly={!request.serviceMode}
              disabled={busy}
              {...form.register('email')}
              error={form.formState.errors.email?.message}
            />
          )}
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
            {request.canDeleteCatalogItem && selected && (
              <Button
                type="button"
                color="red"
                variant="light"
                ml="auto"
                disabled={busy}
                leftSection={<Trash2 size={16} aria-hidden="true" />}
                onClick={() => setDeleteOpened(true)}
              >
                ลบรายการ
              </Button>
            )}
          </Group>
        </Stack>
      </form>
    );
  }
}
