'use client';
import { useRef, useState } from 'react';
import { Box, Button, Checkbox, NativeSelect, Paper, Stack, Text, TextInput } from '@mantine/core';
import { z } from 'zod';
import { useAuthSession } from '@/features/auth/auth-provider';
import { ErrorPopup } from '@/components/core/error-popup';
import { PageHeader } from '@/components/portal/page-header';
import { useSessionTaskGuard } from '@/hooks/use-session-task-guard';

export function MailPage() {
  const { api, can } = useAuthSession();
  const isCurrent = useSessionTaskGuard();
  const [email, setEmail] = useState('');
  const [type, setType] = useState('summary');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [mockGroups, setMockGroups] = useState<string[]>(['pending', 'return', 'overdue']);
  const [isMockPreview, setIsMockPreview] = useState(false);

  return (
    <Box component="section">
      <PageHeader title="ส่งอีเมล" description="กรอกผู้รับและเลือกประเภทข้อมูลที่ต้องการส่ง" />
      <Paper withBorder radius="lg" p="lg" maw={560}>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (sending.current || !can('MAIL_SEND')) return;
            sending.current = true;
            setBusy(true);
            setError(null);
            setNotice('');
            try {
              await api.request('/api/mail/send', z.object({ sent: z.literal(true) }), {
                method: 'POST',
                body: { email: email.trim(), type },
              });
              if (isCurrent())
                setNotice(`ส่งให้ ${email.trim()} แล้ว · เซิร์ฟเวอร์อีเมลรับข้อความแล้ว`);
            } catch (caught) {
              if (isCurrent()) setError(caught);
            } finally {
              sending.current = false;
              if (isCurrent()) setBusy(false);
            }
          }}
        >
          <Stack>
            <TextInput
              label="อีเมลผู้รับ"
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => {
                setEmail(event.currentTarget.value);
                setNotice('');
              }}
              disabled={busy}
              placeholder="name@example.com"
            />
            <NativeSelect
              label="ประเภทอีเมล"
              required
              value={type}
              onChange={(event) => {
                setType(event.currentTarget.value);
                setNotice('');
                setPreview(null);
              }}
              disabled={busy || previewBusy}
              data={[
                { value: 'summary', label: 'สรุปทั้งหมด' },
                { value: 'loan', label: 'รายการยืม (รอดำเนินการ / เกินกำหนด)' },
                { value: 'return', label: 'รายการคืน (รอรับคืน)' },
              ]}
            />
            <ErrorPopup error={error} />
            <Text role="status" size="sm">
              {notice}
            </Text>
            <Button type="submit" loading={busy} disabled={!can('MAIL_SEND')}>
              ส่งอีเมล
            </Button>
            <Button
              type="button"
              variant="default"
              loading={previewBusy}
              disabled={busy || previewBusy || !can('MAIL_VIEW')}
              onClick={async () => {
                setPreviewBusy(true);
                setError(null);
                try {
                  const message = await api.request(
                    '/api/mail/preview',
                    z.object({ subject: z.string(), html: z.string() }),
                    { method: 'POST', body: { type } },
                  );
                  if (isCurrent()) {
                    setPreview(message);
                    setIsMockPreview(false);
                  }
                } catch (caught) {
                  if (isCurrent()) setError(caught);
                } finally {
                  if (isCurrent()) setPreviewBusy(false);
                }
              }}
            >
              ดูตัวอย่างอีเมลจริง
            </Button>
          </Stack>
        </form>
      </Paper>
      <Paper withBorder radius="lg" p="lg" maw={560} mt="lg">
        <Stack>
          <Checkbox.Group
            label="พรีวิวข้อมูลจำลอง"
            description="เลือกได้หลายกลุ่ม หรือไม่เลือกเลยเพื่อดูกรณีไม่มีรายการ"
            value={mockGroups}
            onChange={(groups) => {
              setMockGroups(groups);
              if (isMockPreview) setPreview(null);
            }}
          >
            <Stack gap="sm" mt="sm">
              <Checkbox value="pending" label="รออนุมัติ" disabled={previewBusy} />
              <Checkbox value="return" label="รอรับคืน" disabled={previewBusy} />
              <Checkbox value="overdue" label="ยืมเกินกำหนด" disabled={previewBusy} />
            </Stack>
          </Checkbox.Group>
          <Button
            type="button"
            variant="default"
            loading={previewBusy}
            disabled={busy || previewBusy || !can('MAIL_VIEW')}
            onClick={async () => {
              setPreviewBusy(true);
              setError(null);
              try {
                const message = await api.request(
                  '/api/mail/mockup',
                  z.object({ subject: z.string(), html: z.string() }),
                  { method: 'POST', body: { groups: mockGroups } },
                );
                if (isCurrent()) {
                  setPreview(message);
                  setIsMockPreview(true);
                }
              } catch (caught) {
                if (isCurrent()) setError(caught);
              } finally {
                if (isCurrent()) setPreviewBusy(false);
              }
            }}
          >
            ดูตัวอย่างข้อมูลจำลอง
          </Button>
          <Text size="sm" c="dimmed">
            ใช้สำหรับดูหน้าตาอีเมลเท่านั้น ไม่มีการส่งหรือบันทึกข้อมูลจำลอง
          </Text>
        </Stack>
      </Paper>
      {preview && (
        <Paper withBorder radius="lg" p="lg" mt="lg">
          <Stack>
            <Text fw={600}>{preview.subject}</Text>
            <Text size="sm" c="dimmed">
              {isMockPreview
                ? 'ข้อมูลจำลองสำหรับดูหน้าตา ใช้เทมเพลตเดียวกับที่ส่งจริง'
                : 'ใช้ข้อมูลล่าสุดและเทมเพลตเดียวกับที่ส่งจริง'}{' '}
              ไม่มีการส่งอีเมลจากการพรีวิว ทั้งนี้โปรแกรมอีเมลแต่ละตัวอาจแสดงผลต่างกันเล็กน้อย
            </Text>
            <iframe
              title="ตัวอย่างเนื้อหาอีเมลที่จะส่ง"
              srcDoc={preview.html.replace(
                /<!-- IQI_MAIL_LOGO_START -->[\s\S]*?<!-- IQI_MAIL_LOGO_END -->/,
                '<img src="/icon.png" width="44" height="44" alt="IQI Asset" style="display:block;border:0;">',
              )}
              sandbox=""
              referrerPolicy="no-referrer"
              style={{ width: '100%', height: 800, border: 0 }}
            />
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
