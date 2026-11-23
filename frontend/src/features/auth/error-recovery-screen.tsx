'use client';
import { useRef, useState } from 'react';
import { authService } from '@/services/auth.service';
import { allowSessionResetNavigation } from '@/hooks/use-unsaved';
import styles from './error-recovery-screen.module.css';

export function ErrorRecoveryScreen({
  message = 'เกิดข้อผิดพลาด กรุณากลับหน้าแรกเพื่อเริ่มต้นใหม่',
  onRetry,
  retrying = false,
}: {
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const inFlight = useRef(false);
  const restart = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setResetting(true);
    setResetError('');
    try {
      await authService.resetCurrentSession();
      try {
        sessionStorage.clear();
      } catch {
        /* Storage can be disabled in private browsers. */
      }
      allowSessionResetNavigation();
      window.location.replace('/');
    } catch {
      setResetError('ยังเริ่มต้นใหม่ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วกดอีกครั้ง');
      inFlight.current = false;
      setResetting(false);
    }
  };
  return (
    <section className={styles.screen} aria-label="เกิดข้อผิดพลาด">
      <div className={styles.content}>
        <img
          src="/assets/images/error-state.png"
          alt=""
          aria-hidden="true"
          width={367}
          height={308}
          className={styles.image}
        />
        <h1>เกิดข้อผิดพลาด</h1>
        <p role="alert">{message}</p>
        <p className={styles.hint}>
          กลับหน้าแรกเพื่อล้างการเข้าสู่ระบบของเว็บนี้ แล้วเข้าสู่ระบบใหม่อีกครั้ง
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            disabled={resetting || retrying}
            onClick={() => void restart()}
          >
            {resetting ? 'กำลังเริ่มต้นใหม่…' : 'กลับหน้าแรก'}
          </button>
          {onRetry && (
            <button type="button" disabled={resetting || retrying} onClick={onRetry}>
              รีเฟรช
            </button>
          )}
        </div>
        {resetError && <p role="alert">{resetError}</p>}
      </div>
    </section>
  );
}
