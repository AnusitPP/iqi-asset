'use client';
import { Button, PasswordInput, Paper, Stack, Title, Text } from '@mantine/core';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSession } from './auth-provider';
import { passwordSchema } from '@/types/contracts';
import { ErrorAlert, LoadingIndicator } from '@/components/ui/feedback';
export function LoginPage() {
  const auth = useAuthSession(),
    router = useRouter();
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    mode: 'onBlur',
    defaultValues: { password: '' },
  });
  useEffect(() => {
    if (auth.authenticated) router.replace('/dashboard');
  }, [auth.authenticated, router]);
  if (auth.loading) return <LoadingIndicator />;
  return (
    <main className="login-container">
      <Paper withBorder p="xl" radius="lg">
        <form
          onSubmit={form.handleSubmit(async ({ password }) => {
            try {
              await auth.loginWithPassword(password);
              form.reset();
            } catch (e) {
              form.setError('root', {
                message: e instanceof Error ? e.message : 'เข้าใช้งานไม่สำเร็จ',
              });
            }
          })}
        >
          <Stack>
            <Title order={2}>เข้าใช้งาน IQI Asset Checker</Title>
            <Text>กรอกรหัสผ่านเพื่อค้นหาและจัดการครุภัณฑ์</Text>
            <ErrorAlert error={auth.error} />
            {auth.error && <Button onClick={auth.retrySessionLookup}>ลองเชื่อมต่ออีกครั้ง</Button>}
            <PasswordInput
              label="รหัสผ่าน"
              autoComplete="current-password"
              maxLength={256}
              autoFocus
              {...form.register('password')}
              error={form.formState.errors.password?.message}
              disabled={form.formState.isSubmitting}
            />
            <ErrorAlert
              error={
                form.formState.errors.root ? new Error(form.formState.errors.root.message) : null
              }
            />
            <Button type="submit" loading={form.formState.isSubmitting}>
              เข้าใช้งาน
            </Button>
          </Stack>
        </form>
      </Paper>
    </main>
  );
}
