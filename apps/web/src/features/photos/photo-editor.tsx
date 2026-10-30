'use client';
import { useToast } from '@/providers/toast-provider';
import { Button, Text, Group, Progress } from '@mantine/core';
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
    [previews, setPreviews] = useState<{ url: string; name: string }[]>([]),
    [notice, setNotice] = useState(''),
    [progress, setProgress] = useState(0),
    [inputKey, setInputKey] = useState(0);
  const photos = extractUniqueDrivePhotos(headers, record.values),
    remaining = Math.max(0, 3 - photos.length);
  useEffect(() => {
    const urls = files
      .filter((f) => !/hei[cf]/i.test(f.name + f.type))
      .map((f) => ({ url: URL.createObjectURL(f), name: f.name }));
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
    <section className="dash-photo-section">
      <h3>รูปครุภัณฑ์ · {photos.length}/3</h3>
      <div className="dash-photo-gallery">
        {photos.map((photo, index) => (
          <DrivePhotoPreview
            key={photo.id}
            row={record.row}
            photo={photo}
            label={`รูป${index + 1} ${record.asset}`}
          />
        ))}
      </div>
      {remaining ? (
        <>
          <Text size="sm">เลือกพร้อมกันได้อีก {remaining} รูป · ไม่เกิน 25 MB/รูป</Text>
          <input
            key={inputKey}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            aria-label={`เลือกรูปครุภัณฑ์ ${record.asset}`}
            disabled={busy || uploadPhotosMutation.isPending}
            onChange={(e) => {
              const selected = Array.from(e.currentTarget.files ?? []);
              try {
                validatePhotoUploadSelection(selected, remaining);
                setFiles(selected);
                setNotice(`เลือกแล้ว ${selected.length} รูป`);
              } catch (error) {
                setFiles([]);
                setNotice(getErrorMessage(error));
              }
            }}
          />
          <div className="dash-photo-gallery">
            {previews.map((p) => (
              <img key={p.url} src={p.url} alt={p.name} />
            ))}
          </div>
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
    </section>
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
    <a href={photo.url} target="_blank" rel="noopener noreferrer">
      {failed ? (
        `เปิด${label}ใน Drive`
      ) : (
        <img
          src={photosService.buildPhotoPreviewUrl(row, photo.id)}
          alt={label}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </a>
  );
}
