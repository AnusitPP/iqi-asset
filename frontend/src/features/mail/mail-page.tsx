'use client';
import { useRef, useState } from 'react';
import { Box, Button, NativeSelect, Paper, Stack, Text, TextInput } from '@mantine/core';
import { z } from 'zod';
import { useAuthSession } from '@/features/auth/auth-provider';
import { ErrorAlert } from '@/components/ui/feedback';
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

  return (
    <Box component="section">
      <PageHeader title="ส่งอีเมล" description="กรอกผู้รับและเลือกประเภทข้อมูลที่ต้องการส่ง" />
      <Paper withBorder radius="lg" p="lg" maw={560}>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (sending.current || !can('ADMIN_DASHBOARD_VIEW')) return;
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
              }}
              disabled={busy}
              data={[
                { value: 'summary', label: 'สรุปทั้งหมด' },
                { value: 'loan', label: 'รายการยืม (รอดำเนินการ / เกินกำหนด)' },
                { value: 'return', label: 'รายการคืน (รอรับคืน)' },
              ]}
            />
            <ErrorAlert error={error} />
            <Text role="status" size="sm">
              {notice}
            </Text>
            <Button type="submit" loading={busy} disabled={!can('ADMIN_DASHBOARD_VIEW')}>
              ส่งอีเมล
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
