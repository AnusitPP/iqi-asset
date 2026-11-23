'use client';
import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  SimpleGrid,
  Modal,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useAuthSession } from '@/features/auth/auth-provider';
import { ErrorPopup } from '@/components/core/error-popup';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved';
import { isElectronicEquipment } from './electronics';

const fields = ['asset', 'serial', 'name', 'status', 'location', 'owner', 'photo'] as const;
const editableSchema = z.object({
  sourceId: z.string(),
  revision: z.string(),
  asset: z.string(),
  serial: z.string(),
  name: z.string(),
  status: z.string(),
  location: z.string(),
  owner: z.string().optional(),
  photo: z.string(),
  selected: z.boolean().default(false),
  reviewed: z.boolean().default(false),
});
const recordSchema = editableSchema.omit({ selected: true, reviewed: true }).extend({
  cost: z.string().default(''),
  owner: z.string().default(''),
  pdfStatus: z.string().default(''),
  pdfCost: z.string().default(''),
  drivePhoto: z.string().default(''),
  appMatched: z.boolean().default(true),
  appFields: z.record(z.string(), z.string()).default({}),
  row: z.number(),
  appStatus: z.string(),
  pdfGroups: z.array(z.string()),
  sent: z.boolean(),
  source: z.record(z.string(), z.string()),
});
const dataSchema = z.object({ sheet: z.string(), records: z.array(recordSchema) });
type RecordData = z.infer<typeof recordSchema>;
type Draft = z.infer<typeof editableSchema>;
const draftSchema = z.record(z.string(), editableSchema);
const labels: Record<(typeof fields)[number], string> = {
  asset: 'เลขครุภัณฑ์',
  serial: 'S/N',
  name: 'ชื่ออุปกรณ์',
  status: 'สภาพ',
  location: 'ที่ตั้ง',
  owner: 'ผู้ถือครอง',
  photo: 'ลิงก์รูปครุภัณฑ์',
};
const asDraft = (record: RecordData): Draft => editableSchema.parse(record);

export function PordDatabasePage() {
  const { user } = useAuthSession();
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role))
    return <Text>เฉพาะแอดมินเท่านั้น</Text>;
  return <PordDatabaseWorkspace key={user.id} userId={user.id} />;
}

function PordDatabaseWorkspace({ userId }: { userId: string }) {
  const { api } = useAuthSession();
  const storageKey = `iqi:porddatabase:v1:${userId}`;
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('electronics');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<RecordData | null>(null);
  const [form, setForm] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const data = useQuery({
    queryKey: ['porddatabase'],
    queryFn: () => api.request('/api/porddatabase', dataSchema),
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setDrafts(raw ? draftSchema.parse(JSON.parse(raw)) : {});
      setLoaded(true);
    } catch {
      setStorageError('เปิดฉบับร่างไม่ได้ กรุณาสำรองข้อมูลเบราว์เซอร์ก่อนล้างฉบับร่าง');
    }
  }, [storageKey]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(drafts));
      setStorageError('');
    } catch {
      setStorageError(
        'บันทึกฉบับร่างในเบราว์เซอร์ไม่สำเร็จ อย่าปิดหน้านี้จนกว่าจะส่งข้อมูลหรือสำรองฉบับร่าง',
      );
    }
  }, [drafts, loaded, storageKey]);
  const records = data.data?.records ?? [];
  const value = (record: RecordData) =>
    record.sent
      ? asDraft(record)
      : {
          ...(drafts[record.sourceId] ?? asDraft(record)),
          owner: drafts[record.sourceId]?.owner ?? record.owner,
        };
  const selected = records.filter((r) => !r.sent && value(r).selected);
  const mutation = useMutation({
    mutationFn: () =>
      api.request(
        '/api/porddatabase',
        z.object({
          sent: z.array(z.string()),
          added: z.number(),
          skipped: z.number(),
          sheet: z.string(),
        }),
        { method: 'POST', body: { records: selected.map(value) } },
      ),
    onSuccess: async (result) => {
      setConfirm(false);
      setNotice(
        `ส่งเข้าชีต ${result.sheet} เพิ่ม ${result.added} รายการ / มีอยู่แล้ว ${result.skipped} รายการ`,
      );
      // Mark acknowledged writes immediately, even if refreshing the source fails.
      setDrafts((current) =>
        Object.fromEntries(
          Object.entries(current).map(([id, draft]) => [
            id,
            result.sent.includes(id) ? { ...draft, selected: false } : draft,
          ]),
        ),
      );
      await data.refetch();
    },
  });
  const formDirty = !!editing && !!form && JSON.stringify(form) !== JSON.stringify(value(editing));
  useUnsavedChangesGuard(
    formDirty || mutation.isPending || (!!storageError && Object.keys(drafts).length > 0),
  );
  const conflict = (r: RecordData) =>
    (!!r.pdfStatus && r.appMatched && !!r.appStatus && r.pdfStatus !== r.appStatus) ||
    (!!drafts[r.sourceId] && value(r).revision !== r.revision);
  const filtered = records
    .filter((r) => {
      const d = value(r);
      return (
        `${d.asset} ${d.serial} ${d.name} ${d.status} ${d.owner || ''} ${r.asset}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()) &&
        (filter === 'all' ||
          (filter === 'electronics' &&
            !r.sent &&
            isElectronicEquipment(r.appFields.name || r.name)) ||
          (filter === 'pdf' && r.pdfGroups.length > 0 && !r.sent) ||
          (filter === 'selected' && d.selected && !r.sent) ||
          (filter === 'sent' && r.sent) ||
          (filter === 'pending' && !r.sent) ||
          (filter === 'appPending' && r.appMatched && !r.sent) ||
          (filter === 'conflict' && conflict(r)))
      );
    })
    .sort((a, b) => Number(conflict(b)) - Number(conflict(a)) || a.asset.localeCompare(b.asset));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 25)));
  const changeSelected = (r: RecordData, checked: boolean) =>
    setDrafts((current) => ({ ...current, [r.sourceId]: { ...value(r), selected: checked } }));
  const backup = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(drafts, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'PORDDATABASE-drafts.json';
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={1}>PORDDATABASE</Title>
          <Text c="dimmed">
            เทียบ PDF กับ Appscriptdata เลือกข้อมูล แล้วส่ง → ชีต{' '}
            {data.data?.sheet ?? 'PORDDATABASE'}
          </Text>
        </div>
        <Button
          variant="default"
          disabled={mutation.isPending || data.isFetching}
          onClick={() => void data.refetch()}
        >
          โหลดข้อมูลล่าสุด
        </Button>
      </Group>
      <Alert title="พื้นที่จัดข้อมูลชั่วคราว" color="blue">
        เริ่มจากอุปกรณ์อิเล็กทรอนิกส์ที่ยังไม่ส่ง โดยคัดเบื้องต้นจากชื่ออุปกรณ์
        รายการอื่นดูได้จากตัวกรองทั้งหมด กรุณาตรวจแต่ละรายการก่อนส่ง เริ่มต้นไม่เลือกทุกรายการ
        การแก้ไขเก็บเป็นฉบับร่างเฉพาะบัญชีนี้ในเบราว์เซอร์นี้ กดส่งจึงบันทึกลงชีตใหม่ ข้อมูล
        Appscriptdata และพร้อมยืมเดิมจะคงไว้
      </Alert>
      <Text size="sm" c="dimmed">
        ข้อมูล PDF อ้างอิงผลเทียบเดิมใน stash เฉพาะเลขที่อ่านได้ ไม่พบใน PDF ไม่ได้แปลว่าสภาพดี
        กรุณาตรวจข้อมูลต้นทางในแต่ละรายการ
      </Text>
      {storageError && (
        <Alert color="red" title="ฉบับร่าง">
          {storageError}
          <Group mt="sm">
            <Button onClick={backup} variant="default">
              ดาวน์โหลดฉบับร่าง
            </Button>
            {!loaded && (
              <Button
                color="red"
                onClick={() => {
                  if (window.confirm('ล้างฉบับร่างที่เปิดไม่ได้และเริ่มใหม่?')) {
                    localStorage.removeItem(storageKey);
                    setDrafts({});
                    setLoaded(true);
                    setStorageError('');
                  }
                }}
              >
                ล้างฉบับร่างที่เปิดไม่ได้
              </Button>
            )}
          </Group>
        </Alert>
      )}
      <ErrorPopup
        error={data.error || mutation.error}
        onRefresh={async () => {
          mutation.reset();
          await data.refetch();
        }}
      />
      {notice && (
        <Alert color="green" role="status">
          {notice}
        </Alert>
      )}
      <Group>
        <Badge color="cyan" size="lg">
          อิเล็กทรอนิกส์ยังไม่ส่ง{' '}
          {
            records.filter((r) => !r.sent && isElectronicEquipment(r.appFields.name || r.name))
              .length
          }{' '}
          รายการ
        </Badge>
        <Badge size="lg">ต้องจัดการ {records.filter((r) => !r.sent).length} รายการ</Badge>
        <Badge color="blue">
          Appscriptdata ยังไม่ส่ง {records.filter((r) => r.appMatched && !r.sent).length} รายการ
        </Badge>
        <Badge color="gray">
          PDF ยังไม่ส่ง {records.filter((r) => r.pdfGroups.length > 0 && !r.sent).length} รายการ
        </Badge>
        <Badge color="orange">
          สถานะต่างกัน{' '}
          {
            records.filter(
              (r) => r.pdfStatus && r.appMatched && r.appStatus && r.pdfStatus !== r.appStatus,
            ).length
          }
        </Badge>
        <Badge color="yellow" size="lg">
          เลือก {selected.length}
        </Badge>
        <Badge color="green" size="lg">
          ส่งแล้ว {records.filter((r) => r.sent).length}
        </Badge>
        <Button variant="subtle" onClick={backup} disabled={!loaded}>
          สำรองฉบับร่าง
        </Button>
      </Group>
      <Group align="end">
        <TextInput
          label="ค้นหา"
          placeholder="เลขครุภัณฑ์ / S/N / ชื่อ / สภาพ / ผู้ถือครอง"
          value={query}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            setPage(1);
          }}
          style={{ flex: 1 }}
        />
        <Select
          label="แสดงรายการ"
          value={filter}
          onChange={(v) => {
            setFilter(v || 'all');
            setPage(1);
          }}
          data={[
            { value: 'electronics', label: 'อิเล็กทรอนิกส์ที่ยังไม่ส่ง' },
            { value: 'pending', label: 'ต้องจัดการ (ทั้งหมดที่ยังไม่ส่ง)' },
            { value: 'appPending', label: 'Appscriptdata ที่ยังไม่ส่ง' },
            { value: 'pdf', label: 'PDF ที่ยังไม่ส่ง' },
            { value: 'all', label: 'ทั้งหมด รวมรายการนอก PDF' },
            { value: 'selected', label: 'เลือกแล้ว' },
            { value: 'sent', label: 'ส่งแล้ว' },
            { value: 'conflict', label: 'ข้อมูลขัดกัน / ต้นทางเปลี่ยน' },
          ]}
        />
        <Button
          disabled={!loaded || !selected.length || mutation.isPending || data.isFetching}
          onClick={() => {
            mutation.reset();
            setConfirm(true);
          }}
        >
          ส่งที่เลือก ({selected.length})
        </Button>
      </Group>
      {data.isPending ? (
        <Text role="status">กำลังโหลดข้อมูล…</Text>
      ) : (
        <Paper withBorder radius="md">
          <Table.ScrollContainer minWidth={950}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>เลือก</Table.Th>
                  <Table.Th>เลขครุภัณฑ์ / S/N</Table.Th>
                  <Table.Th>ชื่ออุปกรณ์</Table.Th>
                  <Table.Th>ผู้ถือครอง</Table.Th>
                  <Table.Th>ราคาทุน (บาท)</Table.Th>
                  <Table.Th>PDF → Appscriptdata</Table.Th>
                  <Table.Th>จัดการ</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.slice((currentPage - 1) * 25, currentPage * 25).map((r) => {
                  const d = value(r);
                  return (
                    <Table.Tr key={r.sourceId}>
                      <Table.Td>
                        <Checkbox
                          aria-label={`เลือก ${r.asset}`}
                          checked={!r.sent && d.selected}
                          disabled={!loaded || r.sent || mutation.isPending}
                          onChange={(e) => changeSelected(r, e.currentTarget.checked)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600}>
                          {d.asset}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {d.serial || 'ไม่มี S/N'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ maxWidth: 320 }}>
                        <Text size="sm">{d.name}</Text>
                        {r.sent && <Badge color="green">ส่งแล้ว</Badge>}
                        {conflict(r) && <Badge color="orange">ตรวจข้อมูลขัดกัน</Badge>}
                      </Table.Td>
                      <Table.Td>{d.owner || 'ไม่มีผู้ถือครอง'}</Table.Td>
                      <Table.Td>{r.cost || '—'}</Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {r.pdfStatus || 'ไม่ระบุ'} →{' '}
                          {r.appMatched ? r.appStatus || 'ไม่ระบุ' : 'ไม่พบรายการ'}
                        </Text>
                        <Text size="xs">
                          ที่จะส่ง: {d.status || 'ยังไม่เลือก'}
                          {d.reviewed ? ' · ตรวจแล้ว' : ''}
                        </Text>
                        <Text size="xs" c="dimmed">
                          PDF: {r.pdfGroups.join(', ') || 'ไม่พบในผลเทียบ'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="light"
                          disabled={!loaded || mutation.isPending}
                          onClick={() => {
                            setEditing(r);
                            setForm(value(r));
                          }}
                        >
                          {' '}
                          {r.sent ? 'ดูข้อมูล' : 'ตรวจ / แก้ไข'}
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {!filtered.length && <Text p="lg">ไม่พบรายการ</Text>}
        </Paper>
      )}
      <Pagination
        value={currentPage}
        total={Math.max(1, Math.ceil(filtered.length / 25))}
        onChange={setPage}
        aria-label="หน้ารายการ"
      />
      <Modal
        opened={!!editing}
        onClose={() => {
          if (
            formDirty &&
            !window.confirm('มีการแก้ไขที่ยังไม่ได้บันทึกฉบับร่าง ต้องการปิดหรือไม่?')
          )
            return;
          setEditing(null);
          setForm(null);
        }}
        title={`ตรวจ / แก้ไข ${editing?.asset ?? ''}`}
        size="xl"
      >
        {editing && form && (
          <Stack>
            <Text size="sm">
              {editing.appMatched
                ? `Appscriptdata แถว ${editing.row}`
                : 'ไม่พบเลขครุภัณฑ์ใน Appscriptdata'}{' '}
              · PDF: {editing.pdfGroups.join(', ') || 'ไม่พบในผลเทียบ'}
            </Text>
            {form.revision !== editing.revision && (
              <Alert color="orange">
                ต้นทางเปลี่ยนหลังเริ่มแก้ กรุณาตรวจข้อมูลต้นทางด้านล่าง แล้วกดยืนยันก่อนส่ง
                <Button mt="sm" onClick={() => setForm({ ...form, revision: editing.revision })}>
                  ตรวจแล้ว ใช้ฉบับร่างนี้กับต้นทางล่าสุด
                </Button>
              </Alert>
            )}
            {editing.sent && (
              <Alert color="green">รายการนี้ส่งแล้ว ช่องด้านล่างแสดงข้อมูลที่บันทึกในชีตใหม่</Alert>
            )}
            {!editing.sent && (
              <>
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <Paper withBorder p="md">
                    <Stack gap="xs">
                      <Title order={3}>PDF เดิม</Title>
                      <Text>เลขครุภัณฑ์: {editing.sourceId}</Text>
                      <Text>สภาพ: {editing.pdfStatus || 'ไม่มีข้อมูลสภาพ'}</Text>
                      <Text>กลุ่ม: {editing.pdfGroups.join(', ') || 'ไม่พบใน PDF'}</Text>
                      <Text>ราคาทุน: {editing.pdfCost || 'ไม่มีข้อมูล'}</Text>
                      <Text size="xs" c="dimmed">
                        ข้อมูล PDF ที่สกัดไว้ไม่มีชื่อ S/N และรูป จึงคงข้อมูลช่องอื่นไว้
                      </Text>
                      <Button
                        variant="light"
                        disabled={!editing.pdfStatus}
                        onClick={() =>
                          setForm({ ...form, status: editing.pdfStatus, reviewed: true })
                        }
                      >
                        ใช้ฝั่ง PDF
                      </Button>
                    </Stack>
                  </Paper>
                  <Paper withBorder p="md">
                    <Stack gap="xs">
                      <Title order={3}>Appscriptdata ปัจจุบัน</Title>
                      <Text>ชื่อ: {editing.appFields.name || 'ไม่มีข้อมูล'}</Text>
                      <Text>S/N: {editing.appFields.serial || 'ไม่มีข้อมูล'}</Text>
                      <Text>ผู้ถือครอง: {editing.appFields.owner || 'ไม่มีผู้ถือครอง'}</Text>
                      <Text>สภาพ: {editing.appStatus || 'ไม่มีข้อมูล'}</Text>
                      <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        รูป: {editing.appFields.photo || 'ไม่มีข้อมูล'}
                      </Text>
                      {editing.drivePhoto && (
                        <Text size="xs" c="dimmed">
                          รวมลิงก์รูปจาก Google Drive ที่ตรงกับเลขครุภัณฑ์แล้ว
                        </Text>
                      )}
                      <Button
                        variant="light"
                        disabled={!editing.appMatched}
                        onClick={() => {
                          const next = { ...form, reviewed: true };
                          for (const key of fields) {
                            const v = editing.appFields[key];
                            if (v && key !== 'asset') next[key] = v;
                          }
                          setForm(next);
                        }}
                      >
                        ใช้ฝั่ง Appscriptdata
                      </Button>
                    </Stack>
                  </Paper>
                </SimpleGrid>
                <Text fw={600}>ข้อมูลที่จะส่ง — เลือกแยกช่องหรือแก้ไขด้านล่างได้</Text>
              </>
            )}
            <TextInput
              label="ราคาทุนจาก PDF (บาท)"
              value={editing.cost || ''}
              readOnly
              description="ไม่พบราคาใน PDF จะเว้นว่าง ราคานี้ใช้จาก PDF เท่านั้น"
            />
            {fields.map((key) => (
              <Stack key={key} gap={4}>
                {!editing.sent && (
                  <Group gap="xs">
                    <Text size="xs">เลือก{labels[key]}จาก:</Text>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      disabled={key !== 'status' || !editing.pdfStatus}
                      onClick={() =>
                        setForm({ ...form, status: editing.pdfStatus, reviewed: true })
                      }
                    >
                      PDF
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      disabled={key === 'asset' || !editing.appMatched || !editing.appFields[key]}
                      onClick={() =>
                        setForm({ ...form, [key]: editing.appFields[key], reviewed: true })
                      }
                    >
                      Appscriptdata
                    </Button>
                  </Group>
                )}
                {key === 'photo' ? (
                  <Textarea
                    key={key}
                    label={labels[key]}
                    description="ใส่ลิงก์ Google Drive หนึ่งรูปต่อบรรทัด เหมือนชีตพร้อมยืม"
                    autosize
                    minRows={3}
                    value={form[key]}
                    maxLength={4000}
                    disabled={editing.sent}
                    onChange={(e) => setForm({ ...form, [key]: e.currentTarget.value })}
                  />
                ) : (
                  <TextInput
                    key={key}
                    label={labels[key]}
                    value={form[key]}
                    maxLength={500}
                    required={key === 'asset' || key === 'name'}
                    disabled={editing.sent || key === 'asset'}
                    onChange={(e) => setForm({ ...form, [key]: e.currentTarget.value })}
                  />
                )}
              </Stack>
            ))}
            <details>
              <summary>ดูข้อมูลต้นทางครบทุกช่อง</summary>
              <Table>
                <Table.Tbody>
                  {Object.entries(editing.source).map(([key, v]) => (
                    <Table.Tr key={key}>
                      <Table.Th>{key}</Table.Th>
                      <Table.Td style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        {v || '—'}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </details>
            {!editing.sent && (
              <>
                <Checkbox
                  label="ตรวจข้อมูลที่จะส่งแล้ว"
                  checked={form.reviewed}
                  onChange={(e) => setForm({ ...form, reviewed: e.currentTarget.checked })}
                />
                <Checkbox
                  label="เลือกรายการนี้เพื่อส่งชีตใหม่"
                  checked={form.selected}
                  onChange={(e) => setForm({ ...form, selected: e.currentTarget.checked })}
                />
                <Button
                  disabled={!form.asset.trim() || !form.name.trim()}
                  onClick={() => {
                    setDrafts((current) => ({ ...current, [editing.sourceId]: form }));
                    setEditing(null);
                    setForm(null);
                  }}
                >
                  บันทึกฉบับร่าง
                </Button>
              </>
            )}
          </Stack>
        )}
      </Modal>
      <Modal
        opened={confirm}
        onClose={() => !mutation.isPending && setConfirm(false)}
        title="ตรวจสอบก่อนส่ง"
        closeOnClickOutside={!mutation.isPending}
        closeOnEscape={!mutation.isPending}
        withCloseButton={!mutation.isPending}
      >
        <Stack>
          <Text>
            ส่ง {selected.length} รายการไปชีต {data.data?.sheet} ตามค่าที่แก้ไว้
            รายการที่ไม่เลือกจะไม่ถูกส่ง
          </Text>
          <Table.ScrollContainer minWidth={600}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>เลขครุภัณฑ์</Table.Th>
                  <Table.Th>ข้อมูลที่จะส่ง</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {selected.map((r) => (
                  <Table.Tr key={r.sourceId}>
                    <Table.Td>{r.asset}</Table.Td>
                    <Table.Td>
                      {fields
                        .filter((key) => key !== 'asset')
                        .map((key) => (
                          <Text
                            key={key}
                            size="sm"
                            style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                          >
                            {labels[key]}: {value(r)[key] || '—'}
                          </Text>
                        ))}
                      <Text size="sm">ราคาทุน: {r.pdfCost || '—'}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {selected
            .filter(
              (r) =>
                !value(r).reviewed || !value(r).name.trim() || value(r).revision !== r.revision,
            )
            .map((r) => (
              <Text key={r.sourceId} c="red" size="sm">
                {r.asset}:{' '}
                {!value(r).reviewed
                  ? 'กรุณาตรวจและเลือกข้อมูลก่อนส่ง'
                  : !value(r).name.trim()
                    ? 'กรุณากรอกชื่ออุปกรณ์'
                    : 'ต้นทางเปลี่ยน กรุณาตรวจอีกครั้ง'}
              </Text>
            ))}
          <ErrorPopup error={mutation.error} onRefresh={() => mutation.reset()} />
          <Button
            loading={mutation.isPending}
            disabled={
              !selected.length ||
              selected.some(
                (r) =>
                  !value(r).reviewed || !value(r).name.trim() || value(r).revision !== r.revision,
              )
            }
            onClick={() => mutation.mutate()}
          >
            ยืนยันส่ง {selected.length} รายการ
          </Button>
          <Text size="xs" c="dimmed">
            หากเชื่อมต่อขัดข้อง ให้โหลดข้อมูลล่าสุดเพื่อตรวจผลก่อนลองใหม่
            ระบบตรวจเลขครุภัณฑ์เพื่อป้องกันส่งซ้ำ
          </Text>
        </Stack>
      </Modal>
    </Stack>
  );
}
