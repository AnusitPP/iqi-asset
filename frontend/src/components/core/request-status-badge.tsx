'use client';
import { Badge, type BadgeProps } from '@mantine/core';
import { requestStatusPresentation, requestStatusValue } from '@shared/features/lending/status.js';

export function RequestStatusBadge({
  status = '',
  record,
  size,
  ...props
}: Omit<BadgeProps, 'color' | 'children'> & {
  status?: string;
  record?: { status: string; kind?: string; completed?: boolean };
}) {
  const presentation = requestStatusPresentation(requestStatusValue(record ?? { status }));
  return (
    <Badge
      variant="filled"
      size={size}
      {...props}
      c="white"
      color={presentation.color}
      title={presentation.label}
    >
      {presentation.label}
    </Badge>
  );
}
