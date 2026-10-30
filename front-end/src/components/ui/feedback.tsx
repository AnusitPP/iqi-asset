'use client';
import { useToast } from '@/providers/toast-provider';
import { Alert, Button, Loader } from '@mantine/core';
import { copyTextToClipboard } from '@/lib/clipboard';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import { getErrorMessage } from '@/lib/api-client';
export function ErrorAlert({ error }: { error: unknown }) {
  return error ? (
    <Alert color="red" role="alert">
      {getErrorMessage(error)}
    </Alert>
  ) : null;
}
export function LoadingIndicator() {
  return (
    <div className="loading" role="status">
      <Loader size="sm" /> กำลังอ่านข้อมูลล่าสุด…
    </div>
  );
}
export function CopyableText({ value }: { value: string }) {
  const { showToast } = useToast();
  const [message, setMessage] = useState('');
  return (
    <span className="dash-copy-value">
      <span>{value || '—'}</span>
      {value && (
        <Button
          variant="subtle"
          size="compact-xs"
          aria-label={`คัดลอก ${value}`}
          onClick={async () => {
            try {
              await copyTextToClipboard(value);
              setMessage('คัดลอกแล้ว');
              showToast('คัดลอกแล้ว');
            } catch {
              setMessage('คัดลอกไม่ได้ กรุณาเลือกข้อความแล้วคัดลอก');
              showToast('คัดลอกไม่ได้ กรุณาเลือกข้อความแล้วคัดลอก');
            }
          }}
        >
          <Copy size={14} />
        </Button>
      )}
      <span role="status">{message}</span>
    </span>
  );
}
