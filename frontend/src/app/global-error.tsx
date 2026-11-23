'use client';
import { ErrorRecoveryScreen } from '@/features/auth/error-recovery-screen';
export default function GlobalError() {
  return (
    <html lang="th">
      <body style={{ margin: 0 }}>
        <ErrorRecoveryScreen />
      </body>
    </html>
  );
}
