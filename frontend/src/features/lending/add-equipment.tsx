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
import { ImagePlus, Trash2 } from 'lucide-react';
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

type SelectedPhoto = { file: File; preview: string };

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
  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        asset: asset.trim(),
        serial: serial.trim(),
        name: name.trim(),
        category,
        ...(photos.length ? { photos: photos.map((photo) => photo.preview) } : {}),
      };
      if (new Blob([JSON.stringify(body)]).size > 4 * 1024 * 1024)
        throw new Error('รูปทั้งหมดมีขนาดใหญ่เกินไป กรุณาเลือกรูปที่เล็กลง');
      await api.request('/api/loan-catalog', catalogSchema.shape.records.element, {
        method: 'POST',
        body,
      });
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
        const binary = await preparePhotoForUpload(file, Math.min(maxUploadBytes, 900 * 1024));
        const { preview } = await api.request(
          '/api/loan-catalog/preview',
          z.object({ preview: z.string().startsWith('data:image/jpeg;base64,') }),
          { method: 'POST', binary },
        );
        selected.push({ file, preview });
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
              บันทึกรายการพร้อมรูปที่เลือกทั้งหมดเมื่ออัปโหลดสำเร็จครบ หากรูปไม่ครบจะไม่เพิ่มรายการ
            </Text>
            <TextInput
              label="เลขครุภัณฑ์"
              required
              maxLength={200}
              value={asset}
              disabled={busy}
              onChange={(event) => setAsset(event.currentTarget.value)}
            />
            <TextInput
              label="S/N"
              maxLength={200}
              value={serial}
              disabled={busy}
              onChange={(event) => setSerial(event.currentTarget.value)}
            />
            <TextInput
              label="ชื่ออุปกรณ์"
              required
              maxLength={200}
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <Select
              label="หมวดหมู่"
              data={LOAN_TYPES}
              value={category}
              onChange={(value) => setCategory(value || 'อื่นๆ')}
              allowDeselect={false}
              required
              disabled={busy}
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
                              disabled={busy || index === 0}
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
                    <Progress value={100} animated aria-label="ความคืบหน้าการอัปโหลดรูป" />
                    <Text size="xs" role="status">
                      กำลังบันทึกรายการพร้อมรูปทั้งหมด {photos.length} รูป…
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
            <ErrorPopup
              error={previewError || mutation.error}
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
                บันทึกครุภัณฑ์
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
