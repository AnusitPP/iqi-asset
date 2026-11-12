'use client';
import { useState } from 'react';
import { Button, FileButton, Paper, Stack, Text } from '@mantine/core';
import { Upload } from 'lucide-react';

export function PhotoDropzone({
  onSelect,
  disabled,
  label,
  inputLabel,
}: {
  onSelect: (files: File[]) => void;
  disabled: boolean;
  label: string;
  inputLabel: string;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      role="group"
      aria-label="พื้นที่วางรูปภาพ"
      aria-disabled={disabled}
      style={{
        borderStyle: 'dashed',
        borderColor: dragging && !disabled ? 'var(--mantine-primary-color-filled)' : undefined,
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setDragging(false);
        if (!disabled) onSelect(Array.from(event.dataTransfer.files));
      }}
    >
      <Stack align="center" gap="xs">
        <Upload aria-hidden="true" size={24} />
        <Text size="sm">ลากรูปมาวางที่นี่ หรือเลือกหลายรูปพร้อมกัน</Text>
        <FileButton
          multiple
          accept="image/*,.heic,.heif"
          disabled={disabled}
          onChange={onSelect}
          inputProps={{
            'aria-label': inputLabel,
            onClick: (event) => {
              event.currentTarget.value = '';
            },
          }}
        >
          {(props) => (
            <Button {...props} type="button" variant="light" disabled={disabled}>
              {label}
            </Button>
          )}
        </FileButton>
      </Stack>
    </Paper>
  );
}
