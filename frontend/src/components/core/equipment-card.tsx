'use client';
import { Box, Group, Paper, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import styles from './equipment-card.module.css';
import { CatalogPhoto } from './catalog-photo';

export function EquipmentCard({
  photo,
  name,
  category,
  detail,
  badges,
  overlay,
  action,
  progress,
  children,
  categoryIndicator,
}: {
  photo?: string;
  name: string;
  category: string;
  detail: string;
  badges: ReactNode;
  overlay?: ReactNode;
  action: ReactNode;
  progress?: ReactNode;
  children?: ReactNode;
  categoryIndicator?: ReactNode;
}) {
  return (
    <Box style={{ position: 'relative', minWidth: 0, height: '100%' }}>
      <Paper
        withBorder
        radius="lg"
        shadow="xs"
        style={{
          minWidth: 0,
          position: 'relative',
          overflow: 'hidden',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {overlay}
        <Box
          bg="var(--mantine-color-gray-0)"
          h={150}
          style={{ position: 'relative', flexShrink: 0 }}
        >
          <CatalogPhoto key={photo} url={photo} name={name} height={150} fit="cover" />
          <Group justify="space-between" className={styles.banners}>
            {badges}
          </Group>
          {children}
        </Box>
        <Stack gap="xs" p="sm" style={{ flex: 1, minWidth: 0 }}>
          <Box style={{ position: 'relative', minWidth: 0 }}>
            <Text size="xs" c="portalGreen.6" fw={600} truncate title={category}>
              {category}
            </Text>
            {categoryIndicator}
          </Box>
          <Text size="sm" fw={700} lineClamp={2} mih={44} lh="22px" title={name}>
            {name}
          </Text>
          <Text size="xs" c="dimmed" truncate title={detail}>
            {detail}
          </Text>
          {progress}
          <Box mt="auto" pt="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
            {action}
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
