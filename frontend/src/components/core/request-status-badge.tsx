'use client';
import { Badge, type BadgeProps } from '@mantine/core';
import {
  requestStatusPresentation,
  requestStatusValue,
  isReturnPending,
} from '@shared/features/lending/status.js';

export function RequestStatusBadge({
  status = '',
  record,
  size,
  variant = 'light',
  color,
  ...props
}: Omit<BadgeProps, 'color' | 'children'> & {
  status?: string;
  color?: string;
  record?: { status: string; kind?: string; completed?: boolean };
}) {
  const presentation = isReturnPending(record ?? { status })
    ? { label: 'รอดำเนินการ', color: 'blue' }
    : requestStatusPresentation(requestStatusValue(record ?? { status }));
  return (
    <Badge
      variant={variant}
      size={size ?? 'md'}
      {...props}
      color={color ?? presentation.color}
      {...(variant === 'light'
        ? {
            radius: 8,
            styles: {
              root: { minHeight: 24, paddingInline: 10 },
              label: { fontSize: 11, fontWeight: 500, lineHeight: 1.2 },
            },
          }
        : {})}
      title={presentation.label}
    >
      {presentation.label}
    </Badge>
  );
}
