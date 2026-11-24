'use client';
import styles from './error-recovery-screen.module.css';

export function ErrorRecoveryScreen({
  message = 'เกิดข้อผิดพลาด กรุณากลับหน้าแรกเพื่อเริ่มต้นใหม่',
}: {
  message?: string;
}) {
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
        <p className={styles.hint}>หากยังไม่ได้เข้าสู่ระบบ ระบบจะพาไปหน้าเข้าสู่ระบบโดยอัตโนมัติ</p>
        <div className={styles.actions}>
          <a href="/" className={styles.primary}>
            กลับหน้าแรก
          </a>
        </div>
      </div>
    </section>
  );
}
