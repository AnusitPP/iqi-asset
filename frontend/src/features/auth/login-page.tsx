'use client';
import { Button } from '@mantine/core';
import { ArrowRight, Box, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSession } from './auth-provider';
import { defaultWorkspacePath } from '@/types/account';
import { ErrorAlert, LoadingIndicator } from '@/components/ui/feedback';
import styles from './login-page.module.css';
export function LoginPage() {
  const auth = useAuthSession();
  const router = useRouter();
  useEffect(() => {
    if (auth.authenticated) router.replace(defaultWorkspacePath(auth.user));
  }, [auth.authenticated, auth.user, router]);
  if (auth.loading) return <LoadingIndicator />;
  return (
    <main className={styles.page}>
      <section className={styles.story} aria-label="IQI Asset Checker">
        <div className={styles.brand}>
          <span className={styles.brandIcon}>
            <Box size={23} />
          </span>{' '}
          IQI <span className={styles.brandCaption}>ASSET CHECKER</span>
        </div>
        <div className={styles.storyContent}>
          <span className={styles.eyebrow}>YOUR EVERYDAY WORKSPACE</span>
          <h1 className={styles.headline}>
            จัดการครุภัณฑ์
            <br />
            ให้เป็นเรื่องง่าย<span className={styles.dot}>.</span>
          </h1>
          <p className={styles.description}>
            ค้นหา ยืม–คืน และติดตามครุภัณฑ์
            <br />
            ครบทุกขั้นตอน ในพื้นที่เดียว
          </p>
          <div className={styles.features}>
            <span>
              <Box size={16} /> ค้นหาครุภัณฑ์
            </span>
            <span>
              <ClipboardCheck size={16} /> ติดตามคำขอ
            </span>
          </div>
        </div>
        <span className={styles.storyFooter}>IQI ASSET MANAGEMENT</span>
      </section>
      <section className={styles.loginPanel} aria-labelledby="login-title">
        <div className={styles.form}>
          <span className={styles.welcome}>พร้อมสำหรับวันทำงานของคุณ</span>
          <h2 id="login-title" className={styles.loginTitle}>
            ยินดีต้อนรับกลับมา
          </h2>
          <p className={styles.loginDescription}>
            เข้าสู่ระบบด้วยบัญชี Google ของหน่วยงาน
            <br />
            เพื่อเริ่มใช้งาน IQI Asset Checker
          </p>
          <div className={styles.feedback}>
            <ErrorAlert error={auth.error} onRefresh={auth.retrySessionLookup} />
          </div>
          <Button
            component="a"
            href="/api/auth/google"
            fullWidth
            size="lg"
            variant="default"
            className={styles.googleButton}
            leftSection={
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
                />
                <path
                  fill="#34A853"
                  d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.59A10 10 0 0 0 12 22Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.35-2.59Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.35 2.59C7.19 7.72 9.4 5.96 12 5.96Z"
                />
              </svg>
            }
            rightSection={<ArrowRight size={18} aria-hidden="true" />}
          >
            เข้าสู่ระบบด้วย Google
          </Button>
          <div className={styles.security}>
            <ShieldCheck size={18} aria-hidden="true" />
            <p>
              เข้าใช้งานอย่างปลอดภัย<small>สิทธิ์การใช้งานเป็นไปตามบัญชีที่ได้รับอนุญาต</small>
            </p>
          </div>
          <p className={styles.help}>หากไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแลระบบ</p>
        </div>
        <footer className={styles.footer}>
          IQI Asset Checker <span>ศูนย์กลางบริการครุภัณฑ์</span>
        </footer>
      </section>
    </main>
  );
}
