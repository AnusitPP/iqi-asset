'use client';
import { ActionIcon, Box, Group, Image, Text } from '@mantine/core';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { useState } from 'react';
export function catalogPhotoSource(value: string) {
  try {
    const link = new URL(value);
    const id = link.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] ?? link.searchParams.get('id');
    if (
      link.protocol === 'https:' &&
      link.hostname === 'drive.google.com' &&
      id &&
      /^[\w-]+$/.test(id)
    )
      return `/api/catalog-photos/${encodeURIComponent(id)}`;
  } catch {
    /* Invalid sheet links use the placeholder. */
  }
  return null;
}
export function CatalogPhoto({
  url,
  name,
  height = 160,
  fit = 'contain',
}: {
  url?: string;
  name: string;
  height?: number;
  fit?: 'contain' | 'cover';
}) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState('');
  const urls = (url || '')
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 3);
  const position = urls.length ? selected % urls.length : 0;
  const currentUrl = urls[position] || '';
  const source = catalogPhotoSource(currentUrl);
  const image =
    !source || failed === currentUrl ? (
      <Box
        w="100%"
        h={height}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Package
          size={Math.min(64, Math.round(height * 0.65))}
          style={{ flexShrink: 0, display: 'block' }}
          strokeWidth={1}
          aria-label="ไม่มีภาพอุปกรณ์"
        />
      </Box>
    ) : (
      <Image
        src={source}
        alt={name || 'รูปอุปกรณ์'}
        h={height}
        fit={fit}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(currentUrl)}
      />
    );
  return (
    <Box pos="relative" w="100%">
      {image}
      {urls.length > 1 && height >= 100 && (
        <Group
          pos="absolute"
          bottom={8}
          left={0}
          right={0}
          justify="center"
          gap={6}
          style={{ zIndex: 3 }}
        >
          <ActionIcon
            variant="filled"
            color="dark"
            size="sm"
            aria-label={`รูปก่อนหน้าของ ${name}`}
            onClick={(event) => {
              event.stopPropagation();
              setSelected((position + urls.length - 1) % urls.length);
            }}
          >
            <ChevronLeft size={16} />
          </ActionIcon>
          <Text
            size="xs"
            c="white"
            bg="dark.7"
            px={6}
            style={{ borderRadius: 4 }}
            aria-live="polite"
          >
            {position + 1}/{urls.length}
          </Text>
          <ActionIcon
            variant="filled"
            color="dark"
            size="sm"
            aria-label={`รูปถัดไปของ ${name}`}
            onClick={(event) => {
              event.stopPropagation();
              setSelected((position + 1) % urls.length);
            }}
          >
            <ChevronRight size={16} />
          </ActionIcon>
        </Group>
      )}
    </Box>
  );
}
