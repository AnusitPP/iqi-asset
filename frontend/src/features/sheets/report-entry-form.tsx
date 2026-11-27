import { useState, type FormEvent } from 'react';
import { Alert, Button, Group, Modal, Stack, Textarea, TextInput } from '@mantine/core';
import { getErrorMessage, type ApiClient } from '@/lib/api-client';
import { systemService } from '@/services/system.service';

const inputs = [
  ['assetNumber', 'เลขครุภัณฑ์'],
  ['serial', 'S/N'],
  ['name', 'ชื่ออุปกรณ์'],
  ['condition', 'สภาพ'],
  ['location', 'ที่ตั้ง'],
  ['cost', 'ราคาทุน'],
  ['updatedAt', 'วันที่อัปเดตล่าสุด'],
  ['photos', 'รูป (ลิงก์)'],
  ['holder', 'ชื่อผู้ถือครอง'],
] as const;

function bangkokTime() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(' ', 'T');
}

export function ReportEntryForm({ api, onSaved }: { api: ApiClient; onSaved: () => void }) {
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      await systemService.addAssetReportEntry(
        api,
        Object.fromEntries(inputs.map(([key]) => [key, String(form.get(key) ?? '')])),
      );
      setOpened(false);
      setResult('เพิ่มรายการลงชีตแล้ว');
      onSaved();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        variant="default"
        onClick={() => {
          setResult('');
          setError('');
          setOpened(true);
        }}
      >
        เพิ่มรายการลงชีต
      </Button>
      <span role="status">{result}</span>
      <Modal
        opened={opened}
        onClose={() => {
          if (!saving) setOpened(false);
        }}
        title="เพิ่มรายการครุภัณฑ์"
      >
        <form onSubmit={submit}>
          <Stack>
            {inputs.map(([name, label]) =>
              name === 'photos' ? (
                <Textarea
                  key={name}
                  name={name}
                  label={label}
                  description="หนึ่งลิงก์ต่อบรรทัด"
                  maxLength={4000}
                />
              ) : (
                <TextInput
                  key={name}
                  name={name}
                  label={label}
                  maxLength={300}
                  required={name === 'assetNumber' || name === 'name' || name === 'updatedAt'}
                  type={
                    name === 'updatedAt' ? 'datetime-local' : name === 'cost' ? 'number' : 'text'
                  }
                  defaultValue={name === 'updatedAt' ? bangkokTime() : undefined}
                  step={name === 'updatedAt' ? '1' : name === 'cost' ? '0.01' : undefined}
                  min={name === 'cost' ? 0 : undefined}
                />
              ),
            )}
            {error && (
              <Alert color="red" role="alert">
                {error}
              </Alert>
            )}
            <Group justify="end">
              <Button type="submit" loading={saving}>
                บันทึกลงชีต
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
