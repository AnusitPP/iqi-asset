'use client';
import { useToast } from '@/providers/toast-provider';
import {
  Button,
  Text,
  Group,
  Progress,
  FileButton,
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
import { ErrorAlert } from '@/components/ui/feedback';
import { getErrorMessage } from '@/lib/api-client';
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
    [progress, setProgress] = useState(0),
    [inputKey, setInputKey] = useState(0);
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
          setProgress((completed / files.length) * 100);
        }
        if (isUploadCurrent()) {
          setNotice(`เพิ่มแล้ว ${completed}/${files.length} รูป`);
          showToast(`เพิ่มแล้ว ${completed}/${files.length} รูป`);
        }
      } catch (error) {
        setNotice(`เพิ่มแล้ว ${completed}/${files.length} รูป · ${getErrorMessage(error)}`);
        throw error;
      } finally {
        setFiles([]);
        setInputKey((v) => v + 1);
        try {
          if (isUploadCurrent()) await onRefresh();
        } catch (error) {
          setNotice((v) => `${v} · โหลดข้อมูลล่าสุดไม่สำเร็จ: ${getErrorMessage(error)}`);
        }
        onBusy(false);
      }
    },
  });
  return (
    <Box component="section" className="dash-photo-section">
      <Title order={3}>รูปครุภัณฑ์ · {photos.length}/3</Title>
      <Box className="dash-photo-gallery">
        {photos.map((photo, index) => (
          <DrivePhotoPreview
            key={photo.id}
            row={record.row}
            photo={photo}
            label={`รูป${index + 1} ${record.asset}`}
          />
        ))}
      </Box>
      {remaining ? (
        <>
          <Text size="sm">เลือกพร้อมกันได้อีก {remaining} รูป · ไม่เกิน 25 MB/รูป</Text>
          <FileButton
            key={inputKey}
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            inputProps={{ 'aria-label': `เลือกรูปครุภัณฑ์ ${record.asset}` }}
            disabled={busy || uploadPhotosMutation.isPending}
            onChange={(selected) => {
              if (!selected.length) return;
              try {
                validatePhotoUploadSelection(selected, remaining);
                setFiles(selected);
                setNotice(`เลือกแล้ว ${selected.length} รูป`);
              } catch (error) {
                setFiles([]);
                setNotice(getErrorMessage(error));
              }
            }}
          >
            {(props) => (
              <Group mt="xs">
                <Button
                  {...props}
                  variant="default"
                  disabled={busy || uploadPhotosMutation.isPending}
                >
                  เลือกไฟล์รูปภาพ
                </Button>
                {files.length > 0 && (
                  <Text size="sm" c="dimmed">
                    เลือกแล้ว {files.length} รูป
                  </Text>
                )}
              </Group>
            )}
          </FileButton>
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
                      color="red"
                      variant="light"
                      size="xs"
                      aria-label={`นำรูป ${file.name} ออก`}
                      disabled={busy || uploadPhotosMutation.isPending}
                      onClick={() => {
                        const remainingFiles = files.filter((_, fileIndex) => fileIndex !== index);
                        setFiles(remainingFiles);
                        setInputKey((value) => value + 1);
                        setNotice(
                          remainingFiles.length
                            ? `เลือกแล้ว ${remainingFiles.length} รูป`
                            : '',
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
              disabled={!files.length || !config.data || busy}
              loading={uploadPhotosMutation.isPending}
              onClick={() => uploadPhotosMutation.mutate()}
            >
              อัปโหลด
            </Button>
          </Group>
          {uploadPhotosMutation.isPending && (
            <Progress value={progress} aria-label="ความคืบหน้าจำนวนรูปที่อัปโหลด" />
          )}
          <ErrorAlert error={config.error} />
          {config.error && (
            <Button
              onClick={() => {
                void config.refetch();
              }}
            >
              ลองอ่านขนาดอัปโหลดอีกครั้ง
            </Button>
          )}
          <ErrorAlert error={uploadPhotosMutation.error} />
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
