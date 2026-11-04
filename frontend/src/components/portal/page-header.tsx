import { Box, Title, Text } from '@mantine/core';
import type { ReactNode } from 'react';
export function PageHeader({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <Box component="header" className="portal-page-heading">
      <Box>
        {eyebrow && <span className="portal-eyebrow">{eyebrow}</span>}
        <Title order={1}>{title}</Title>
        <Text component="p" className="portal-paragraph">
          {description}
        </Text>
      </Box>
      {action && <Box className="portal-page-action">{action}</Box>}
    </Box>
  );
}
