'use client';
import { useState } from 'react';
import {
  Button,
  FileButton,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Select,
  Image,
  Paper,
  SimpleGrid,
  Box,
  Badge,
  Progress,
} from '@mantine/core';
import { ImagePlus, Trash2, Check } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useAuthSession } from '@/features/auth/auth-provider';
import { ErrorPopup } from '@/components/core/error-popup';
import { catalogSchema } from '@/types/lending';
import { preparePhotoForUpload, validatePhotoUploadSelection } from '@/features/photos/photo-utils';
import { photosService } from '@/services/photos.service';
import { PhotoDropzone } from '@/features/photos/photo-dropzone';
import { getErrorMessage } from '@/lib/api-client';
import { LOAN_TYPES } from '@shared/features/lending/formConstants.js';

type SelectedPhoto = { file: File; binary: Blob; preview: string; uploaded: boolean };

export function AddEquipment({ disabled }: { disabled: boolean }) {
  const { api, user } = useAuthSession();
  const client = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [asset, setAsset] = useState('');
  const [serial, setSerial] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('อื่นๆ');
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [saved, setSaved] = useState<z.infer<typeof catalogSchema>['records'][number] | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      const record =
        saved ??
        (await api.request('/api/loan-catalog', catalogSchema.shape.records.element, {
          method: 'POST',
          body: { asset: asset.trim(), serial: serial.trim(), name: name.trim(), category },
        }));
      setSaved(record);
      await client.invalidateQueries({ queryKey: ['loan-catalog'] });
      for (const photo of photos.filter((entry) => !entry.uploaded)) {
        await api.request(`/api/loan-catalog/${record.row}/photos`, z.object({ url: z.string() }), {
          method: 'POST',
          binary: photo.binary,
          revision: encodeURIComponent(JSON.stringify([record.asset, record.serial])),
        });
        setPhotos((current) =>
          current.map((entry) => (entry === photo ? { ...entry, uploaded: true } : entry)),
        );
        await client.invalidateQueries({ queryKey: ['loan-catalog'] });
      }
      await client.invalidateQueries({ queryKey: ['loan-catalog'] });
    },
    onSuccess: close,
  });
  function close() {
    setOpened(false);
    setAsset('');
    setSerial('');
    setName('');
    setCategory('อื่นๆ');
    setPhotos([]);
    setPhotoError('');
    setPreviewError(null);
    setSaved(null);
    mutation.reset();
  }
  async function selectPhotos(files: File[], replace?: number) {
    if (!files.length || preparing || mutation.isPending) return;
    setPhotoError('');
    setPreviewError(null);
    try {
      validatePhotoUploadSelection(files, replace === undefined ? 3 - photos.length : 1);
    } catch (error) {
      setPhotoError(getErrorMessage(error));
      return;
    }
    try {
      setPreparing(true);
      const { maxUploadBytes } = await photosService.fetchUploadLimits(api);
      const selected: SelectedPhoto[] = [];
      for (const file of files) {
        const binary = await preparePhotoForUpload(file, maxUploadBytes);
        const { preview } = await api.request(
          '/api/loan-catalog/preview',
          z.object({ preview: z.string().startsWith('data:image/jpeg;base64,') }),
          { method: 'POST', binary },
        );
        selected.push({ file, binary, preview, uploaded: false });
      }
      setPhotos((current) =>
        replace === undefined
          ? [...current, ...selected]
          : current.map((entry, index) => (index === replace ? (selected[0] ?? entry) : entry)),
      );
    } catch {
      setPreviewError(new Error('อัปโหลดไม่สำเร็จ กรุณาลองใหม่'));
    } finally {
      setPreparing(false);
    }
  }
  const busy = preparing || mutation.isPending;
  const accept = 'image/*,.heic,.heif';
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return null;
  return (
    <>
      <Button type="button" disabled={disabled} onClick={() => setOpened(true)}>
        เพิ่มครุภัณฑ์
      </Button>
      <Modal
        opened={opened}
        onClose={close}
        title="เพิ่มครุภัณฑ์พร้อมยืม"
        size="lg"
        closeOnClickOutside={!busy}
        closeOnEscape={!busy}
        withCloseButton={!busy}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <Stack>
            <Text size="sm" c="dimmed">
              บันทึกลงชีตพร้อมยืม และเปิดให้เลือกยืมทันที วันที่อัปเดตบันทึกอัตโนมัติ
            </Text>
            <TextInput
              label="เลขครุภัณฑ์"
              required
              maxLength={200}
              value={asset}
              disabled={mutation.isPending || !!saved}
              onChange={(event) => setAsset(event.currentTarget.value)}
            />
            <TextInput
              label="S/N"
              maxLength={200}
              value={serial}
              disabled={mutation.isPending || !!saved}
              onChange={(event) => setSerial(event.currentTarget.value)}
            />
            <TextInput
              label="ชื่ออุปกรณ์"
              required
              maxLength={200}
              value={name}
              disabled={mutation.isPending || !!saved}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <Select
              label="หมวดหมู่"
              data={LOAN_TYPES}
              value={category}
              onChange={(value) => setCategory(value || 'อื่นๆ')}
              allowDeselect={false}
              required
              disabled={busy || !!saved}
            />
            <Paper withBorder radius="md" p="md">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={600}>รูปอุปกรณ์</Text>
                  <Badge variant="light">{photos.length}/3 รูป</Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  เลือกได้สูงสุด 3 รูป เว็บจะแปลงและย่อรูปให้อัตโนมัติก่อนอัปโหลด
                </Text>
                <PhotoDropzone
                  onSelect={(files) => void selectPhotos(files)}
                  disabled={busy || photos.length === 3}
                  label="เลือกรูปอุปกรณ์"
                  inputLabel="เลือกรูปอุปกรณ์"
                />
                <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
                  {[0, 1, 2].map((index) => {
                    const photo = photos[index];
                    return (
                      <Paper key={index} withBorder radius="md" p="xs">
                        <Stack gap="xs">
                          <Box
                            h={135}
                            bg="var(--mantine-color-gray-0)"
                            style={{
                              borderRadius: 8,
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {photo ? (
                              <Image
                                src={photo.preview}
                                alt={`ภาพตัวอย่างรูปที่ ${index + 1}`}
                                h={135}
                                fit="contain"
                              />
                            ) : (
                              <ImagePlus
                                size={32}
                                color="var(--mantine-color-gray-5)"
                                aria-hidden="true"
                              />
                            )}
                          </Box>
                          {photo && (
                            <Button
                              type="button"
                              size="xs"
                              variant={index === 0 ? 'filled' : 'light'}
                              aria-label={`ตั้งรูปที่ ${index + 1} เป็นรูปแรก`}
                              aria-pressed={index === 0}
                              disabled={busy || !!saved || index === 0}
                              onClick={() =>
                                setPhotos((current) => [
                                  photo,
                                  ...current.filter((entry) => entry !== photo),
                                ])
                              }
                            >
                              {index === 0 ? 'รูปแรก' : 'ตั้งเป็นรูปแรก'}
                            </Button>
                          )}
                          <Text size="xs" c="dimmed" truncate title={photo?.file.name}>
                            {photo?.file.name || `รูปที่ ${index + 1}`}
                          </Text>
                          {photo?.uploaded ? (
                            <Badge color="green" leftSection={<Check size={12} />}>
                              บันทึกแล้ว
                            </Badge>
                          ) : (
                            <>
                              <FileButton
                                accept={accept}
                                inputProps={{
                                  onClick: (event) => {
                                    event.currentTarget.value = '';
                                  },
                                }}
                                onChange={(file) =>
                                  file && void selectPhotos([file], photo ? index : undefined)
                                }
                              >
                                {(props) => (
                                  <Button
                                    {...props}
                                    type="button"
                                    size="xs"
                                    variant="default"
                                    disabled={busy || (!photo && index !== photos.length)}
                                    aria-label={`${photo ? 'เปลี่ยน' : 'เลือก'}รูปที่ ${index + 1}`}
                                  >
                                    {photo ? 'เปลี่ยนรูป' : 'เลือกรูป'}
                                  </Button>
                                )}
                              </FileButton>
                              {photo && (
                                <Button
                                  type="button"
                                  size="xs"
                                  color="red"
                                  variant="subtle"
                                  leftSection={<Trash2 size={13} />}
                                  disabled={busy}
                                  aria-label={`ลบรูปที่ ${index + 1}`}
                                  onClick={() =>
                                    setPhotos((current) =>
                                      current.filter((_, position) => position !== index),
                                    )
                                  }
                                >
                                  ลบรูป
                                </Button>
                              )}
                            </>
                          )}
                        </Stack>
                      </Paper>
                    );
                  })}
                </SimpleGrid>
                {preparing && (
                  <Text size="xs" role="status">
                    กำลังเตรียมภาพตัวอย่าง…
                  </Text>
                )}
                {mutation.isPending && photos.length > 0 && (
                  <>
                    <Progress
                      value={
                        (photos.filter((photo) => photo.uploaded).length / photos.length) * 100
                      }
                      aria-label="ความคืบหน้าการอัปโหลดรูป"
                    />
                    <Text size="xs" role="status">
                      บันทึกรูปแล้ว {photos.filter((photo) => photo.uploaded).length}/
                      {photos.length} รูป
                    </Text>
                  </>
                )}
                {photoError && (
                  <Text size="sm" c="red" role="alert">
                    {photoError}
                  </Text>
                )}
              </Stack>
            </Paper>
            {saved && mutation.isError && (
              <Text role="status" size="sm">
                เพิ่มครุภัณฑ์แล้ว แต่ยังเพิ่มรูปไม่สำเร็จครบ กดบันทึกเพื่อลองต่อเฉพาะรูปที่เหลือ
                หรือปิดเพื่อใช้รูปที่บันทึกแล้ว
              </Text>
            )}
            <ErrorPopup
              error={
                previewError ||
                (mutation.error && saved
                  ? new Error('อัปโหลดไม่สำเร็จ กรุณาลองใหม่')
                  : mutation.error)
              }
              onRefresh={async () => {
                await client.invalidateQueries({ queryKey: ['loan-catalog'] });
                mutation.reset();
                setPreviewError(null);
              }}
            />
            <Group justify="flex-end">
              <Button type="button" variant="default" disabled={busy} onClick={close}>
                ปิด
              </Button>
              <Button
                type="submit"
                loading={mutation.isPending}
                disabled={preparing || !asset.trim() || !name.trim()}
              >
                บันทึก{saved ? 'รูป' : 'ครุภัณฑ์'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
