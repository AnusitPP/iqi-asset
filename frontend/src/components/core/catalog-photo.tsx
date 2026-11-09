'use client';
import { Box, Image } from '@mantine/core';
import { Package } from 'lucide-react';
import { useState } from 'react';
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
  const [failed, setFailed] = useState(false);
  let id: string | null = null;
  try {
    const link = new URL(url ?? '');
    if (link.protocol === 'https:' && link.hostname === 'drive.google.com') {
      id = link.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] ?? link.searchParams.get('id');
    }
  } catch {
    /* Missing or invalid sheet link uses the placeholder. */
  }
  if (!id || !/^[\w-]+$/.test(id) || failed) {
    return (
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
    );
  }
  return (
    <Image
      src={`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w600`}
      alt={name || 'รูปอุปกรณ์'}
      h={height}
      fit={fit}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
