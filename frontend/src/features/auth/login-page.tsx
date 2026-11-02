'use client';
import { Button, Paper, Stack, Title, Text } from '@mantine/core';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSession } from './auth-provider';
import { defaultWorkspacePath } from '@/types/account';
import { ErrorAlert, LoadingIndicator } from '@/components/ui/feedback';
export function LoginPage() {
  const auth = useAuthSession();
  const router = useRouter();
  useEffect(() => {
    if (auth.authenticated) router.replace(defaultWorkspacePath(auth.user));
  }, [auth.authenticated, auth.user, router]);
  if (auth.loading) return <LoadingIndicator />;
  return (
    <main className="login-container">
      <Paper withBorder p="xl" radius="lg">
        <Stack>
          <Title order={2}>เข้าใช้งาน IQI Asset Checker</Title>
          <Text>เข้าสู่ระบบด้วยบัญชี Google เพื่อค้นหาและจัดการครุภัณฑ์</Text>
          <ErrorAlert error={auth.error} />
          {auth.error && (
            <Button variant="default" onClick={auth.retrySessionLookup}>
              ลองเชื่อมต่ออีกครั้ง
            </Button>
          )}
          <Button component="a" href="/api/auth/google">
            เข้าสู่ระบบด้วย Google
          </Button>
        </Stack>
      </Paper>
    </main>
  );
}
