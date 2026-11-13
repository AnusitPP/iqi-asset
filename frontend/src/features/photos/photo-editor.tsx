'use client';
import { useToast } from '@/providers/toast-provider';
import {
  Button,
  Text,
  Group,
  Progress,
  Image,
  Box,
  Title,
  Anchor,
  Paper,
  Stack,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/features/auth/auth-provider';
import type { DashboardRecord } from '@/types/contracts';
import { useSessionTaskGuard } from '@/hooks/use-session-task-guard';
import { photosService } from '@/services/photos.service';
import { ErrorPopup } from '@/components/core/error-popup';
import { getErrorMessage } from '@/lib/api-client';
import { PhotoDropzone } from './photo-dropzone';
import {
  extractUniqueDrivePhotos,
  preparePhotoForUpload,
  validatePhotoUploadSelection,
} from './photo-utils';
export function AssetPhotoEditor({
  record,
  headers,
  busy,
  onBusy,
  onRefresh,
}: {
  record: DashboardRecord;
  headers: string[];
  busy: boolean;
  onBusy: (value: boolean) => void;
  onRefresh: () => Promise<void>;
}) {
  const { api } = useAuthSession();
  const { showToast } = useToast();
  const isUploadCurrent = useSessionTaskGuard();
  const config = useQuery({
    queryKey: ['upload-config'],
    queryFn: ({ signal }) => photosService.fetchUploadLimits(api, signal),
  });
  const [files, setFiles] = useState<File[]>([]),
    [previews, setPreviews] = useState<{ url: string; file: File }[]>([]),
    [notice, setNotice] = useState(''),
    [readError, setReadError] = useState<unknown>(null),
    [progress, setProgress] = useState(0),
    [primaryFile, setPrimaryFile] = useState<File | null>(null);
  const photos = extractUniqueDrivePhotos(headers, record.values),
    remaining = Math.max(0, 3 - photos.length);
  useEffect(() => {
    const urls = files
      .filter((f) => !/hei[cf]/i.test(f.name + f.type))
      .map((file) => ({ url: URL.createObjectURL(file), file }));
    setPreviews(urls);
    return () => urls.forEach((p) => URL.revokeObjectURL(p.url));
  }, [files]);
  const uploadPhotosMutation = useMutation({
    mutationFn: async () => {
      validatePhotoUploadSelection(files, remaining);
      if (!config.data) throw new Error('ยังอ่านขนาดอัปโหลดจากเซิร์ฟเวอร์ไม่ได้');
      onBusy(true);
      let revision = record.revision,
        completed = 0;
      setProgress(0);
      try {
        for (const file of files) {
          if (!isUploadCurrent()) break;
          setNotice(`กำลังอัปโหลด ${completed + 1}/${files.length}…`);
          const binary = await preparePhotoForUpload(file, config.data.maxUploadBytes);
          if (!isUploadCurrent()) break;
          const saved = await photosService.uploadAssetPhoto(api, record.row, binary, revision);
          revision = saved.revision;
          completed++;
          if (file === primaryFile && photos.length > 0) {
            const id = saved.url.match(/\/file\/d\/([\w-]+)\/view$/)?.[1];
            if (!id) throw new Error('Invalid photo URL');
            const updated = await photosService.setPrimaryPhoto(api, record.row, id, revision);
            revision = updated.revision;
          }
          setProgress((completed / files.length) * 100);
        }
        if (isUploadCurrent()) {
          setNotice(`เพิ่มแล้ว ${completed}/${files.length} รูป`);
          showToast(`เพิ่มแล้ว ${completed}/${files.length} รูป`);
        }
      } catch (error) {
        setNotice(`เพิ่มแล้ว ${completed}/${files.length} รูป`);
        throw error;
      } finally {
        setFiles([]);
        setPrimaryFile(null);
        try {
          if (isUploadCurrent()) await onRefresh();
        } catch (error) {
          setReadError(error);
        }
        onBusy(false);
      }
    },
  });
  const primaryMutation = useMutation({
    mutationFn: async (id: string) => {
      onBusy(true);
      try {
        await photosService.setPrimaryPhoto(api, record.row, id, record.revision);
        await onRefresh();
        setNotice('ตั้งเป็นรูปแรกแล้ว');
      } finally {
        onBusy(false);
      }
    },
  });
  const locked = busy || uploadPhotosMutation.isPending || primaryMutation.isPending;
  function selectFiles(selected: File[]) {
    if (!selected.length || locked) return;
    try {
      const combined = [...files, ...selected];
      validatePhotoUploadSelection(combined, remaining);
      setFiles(combined);
      setNotice(`เลือกแล้ว ${combined.length} รูป`);
    } catch (error) {
      setNotice(getErrorMessage(error));
    }
  }
  return (
    <Box component="section" className="dash-photo-section">
      <ErrorPopup
        error={uploadPhotosMutation.error || primaryMutation.error || readError}
        onRefresh={async () => {
          await onRefresh();
          uploadPhotosMutation.reset();
          primaryMutation.reset();
          setReadError(null);
        }}
      />
      <Title order={3}>รูปครุภัณฑ์ · {photos.length}/3</Title>
      <Box className="dash-photo-gallery">
        {photos.map((photo, index) => (
          <Stack key={photo.id} gap="xs">
            <DrivePhotoPreview
              row={record.row}
              photo={photo}
              label={`รูป${index + 1} ${record.asset}`}
            />
            <Button
              type="button"
              size="xs"
              variant={index === 0 ? 'filled' : 'light'}
              aria-label={`ตั้งรูปที่ ${index + 1} เป็นรูปแรก`}
              aria-pressed={index === 0}
              disabled={locked || index === 0}
              onClick={() => primaryMutation.mutate(photo.id)}
            >
              {index === 0 ? 'รูปแรก' : 'ตั้งเป็นรูปแรก'}
            </Button>
          </Stack>
        ))}
      </Box>
      {remaining ? (
        <>
          <Text size="sm">
            เลือกพร้อมกันได้อีก {remaining} รูป · เว็บจะแปลงและย่อรูปให้อัตโนมัติ
          </Text>
          <PhotoDropzone
            onSelect={selectFiles}
            disabled={locked || files.length >= remaining}
            label="เลือกไฟล์รูปภาพ"
            inputLabel={`เลือกรูปครุภัณฑ์ ${record.asset}`}
          />
          {files.length > 0 && (
            <Text size="sm" c="dimmed">
              เลือกแล้ว {files.length} รูป
            </Text>
          )}
          <Group align="stretch" my={8}>
            {files.map((file, index) => {
              const preview = previews.find((item) => item.file === file);
              return (
                <Paper key={`${file.name}-${index}`} withBorder p="sm" w={180}>
                  <Stack gap="xs">
                    {preview ? (
                      <Image src={preview.url} alt={file.name} h={110} fit="contain" />
                    ) : (
                      <Text size="sm" c="dimmed">
                        ไฟล์ HEIC/HEIF · ไม่มีภาพตัวอย่าง
                      </Text>
                    )}
                    <Text size="xs" style={{ overflowWrap: 'anywhere' }}>
                      {file.name}
                    </Text>
                    <Button
                      type="button"
                      size="xs"
                      variant={
                        primaryFile === file || (!photos.length && !primaryFile && index === 0)
                          ? 'filled'
                          : 'light'
                      }
                      aria-label={`ตั้งรูป ${file.name} เป็นรูปแรก`}
                      aria-pressed={
                        primaryFile === file || (!photos.length && !primaryFile && index === 0)
                      }
                      disabled={locked}
                      onClick={() => {
                        setPrimaryFile(file);
                        setFiles((current) => [file, ...current.filter((entry) => entry !== file)]);
                      }}
                    >
                      {primaryFile === file || (!photos.length && !primaryFile && index === 0)
                        ? 'รูปแรก'
                        : 'ตั้งเป็นรูปแรก'}
                    </Button>
                    <Button
                      type="button"
                      color="red"
                      variant="light"
                      size="xs"
                      aria-label={`นำรูป ${file.name} ออก`}
                      disabled={locked}
                      onClick={() => {
                        const remainingFiles = files.filter((_, fileIndex) => fileIndex !== index);
                        setFiles(remainingFiles);
                        if (primaryFile === file) setPrimaryFile(null);
                        setNotice(
                          remainingFiles.length ? `เลือกแล้ว ${remainingFiles.length} รูป` : '',
                        );
                      }}
                    >
                      นำออก
                    </Button>
                  </Stack>
                </Paper>
              );
            })}
          </Group>
          <Group>
            <Button
              disabled={!files.length || !config.data || locked}
              loading={uploadPhotosMutation.isPending}
              onClick={() => uploadPhotosMutation.mutate()}
            >
              อัปโหลด
            </Button>
          </Group>
          {uploadPhotosMutation.isPending && (
            <Progress value={progress} aria-label="ความคืบหน้าจำนวนรูปที่อัปโหลด" />
          )}
          <ErrorPopup error={config.error} onRefresh={() => config.refetch()} />
        </>
      ) : (
        <Text>ครบ 3 รูปแล้ว</Text>
      )}
      <Text role="status" size="sm">
        {notice}
      </Text>
    </Box>
  );
}
function DrivePhotoPreview({
  row,
  photo,
  label,
}: {
  row: number;
  photo: { id: string; url: string };
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <Anchor href={photo.url} target="_blank" rel="noopener noreferrer">
      {failed ? (
        `เปิด${label}ใน Drive`
      ) : (
        <Image
          src={photosService.buildPhotoPreviewUrl(row, photo.id)}
          alt={label}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </Anchor>
  );
}
