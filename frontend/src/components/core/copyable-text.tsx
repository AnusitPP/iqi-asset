'use client';
import { Button } from '@mantine/core';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/providers/toast-provider';
import { copyTextToClipboard } from '@/lib/clipboard';
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
