'use client';
import { useState } from 'react';
import { Box, Button, Group, Image, Text, UnstyledButton } from '@mantine/core';
import { catalogPhotoSource } from './catalog-photo';
import styles from './catalog-photo-gallery.module.css';

export function CatalogPhotoGallery({ url, name }: { url?: string; name: string }) {
  const sources = [
    ...new Set(
      (url || '')
        .split('\n')
        .map((value) => catalogPhotoSource(value.trim()))
        .filter((value): value is string => !!value),
    ),
  ].slice(0, 3);
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const position = sources.length ? selected % sources.length : 0;
  if (!sources.length)
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        ยังไม่มีรูปอุปกรณ์
      </Text>
    );
  return (
    <Box component="section" aria-label={`รูปอุปกรณ์ ${name}`} className={styles.gallery}>
      <Box
        className={styles.frames}
        style={{
          gridTemplateColumns: `repeat(${sources.length}, minmax(0, 1fr))`,
          maxWidth: sources.length * 180,
        }}
      >
        {sources.map((source, index) => (
          <UnstyledButton
            key={source}
            type="button"
            className={styles.photo}
            data-selected={index === position || undefined}
            aria-label={`แสดงรูปที่ ${index + 1} ของ ${name}`}
            aria-pressed={index === position}
            onClick={() => setSelected(index)}
          >
            {failed.includes(source) ? (
              <Text size="xs" c="dimmed" ta="center">
                โหลดรูปไม่สำเร็จ
              </Text>
            ) : (
              <Image
                src={source}
                alt={`${name} รูปที่ ${index + 1}`}
                fit="cover"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setFailed((current) => [...current, source])}
              />
            )}
          </UnstyledButton>
        ))}
      </Box>
      {sources.length > 1 && (
        <>
          <Button
            type="button"
            variant="default"
            size="compact-xs"
            radius="xl"
            className={styles.previous}
            aria-label={`รูปก่อนหน้าของ ${name}`}
            onClick={() => setSelected((position + sources.length - 1) % sources.length)}
          >
            ‹
          </Button>
          <Button
            type="button"
            variant="default"
            size="compact-xs"
            radius="xl"
            className={styles.next}
            aria-label={`รูปถัดไปของ ${name}`}
            onClick={() => setSelected((position + 1) % sources.length)}
          >
            ›
          </Button>
          <Group justify="center" gap={5} mt={6} aria-label="เลือกรูปที่แสดง">
            {sources.map((source, index) => (
              <UnstyledButton
                key={source}
                type="button"
                className={styles.dot}
                data-selected={index === position || undefined}
                aria-label={`ไปยังรูปที่ ${index + 1} ของ ${name}`}
                aria-pressed={index === position}
                onClick={() => setSelected(index)}
              />
            ))}
          </Group>
        </>
      )}
    </Box>
  );
}
