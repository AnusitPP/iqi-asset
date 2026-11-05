'use client';
import {
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Box,
  UnstyledButton,
  Title,
  Table,
  ScrollArea,
} from '@mantine/core';
import { Package, Search, LayoutGrid, List, RotateCcw } from 'lucide-react';
import { Image } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useWorkspaceState } from '@/hooks/use-workspace-state';
import { useState } from 'react';
import { catalogCategory, matchCatalog } from '@shared/features/catalog/search.js';
import { catalogService } from '@/services/catalog.service';
import { useAuthSession } from '@/features/auth/auth-provider';
import type { CatalogRecord } from '@/types/lending';
import { ErrorAlert } from '@/components/ui/feedback';
export function LendingCatalogPicker({
  onSelect,
  disabled,
  error,
  mode,
  heading,
}: {
  selected: CatalogRecord | null;
  onSelect: (record: CatalogRecord | null) => void;
  disabled: boolean;
  error?: string;
  mode: 'loan' | 'return';
  heading?: string;
}) {
  const { api, user } = useAuthSession();
  const action = mode === 'loan' ? 'ยืม' : 'คืน';
  const [query, setQuery] = useWorkspaceState(`${mode}-catalog-query`, '');
  const [category, setCategory] = useState('');
  const [view, setView] = useState('grid');
  const catalog = useQuery({
    queryKey: [mode === 'loan' ? 'loan-catalog' : 'return-catalog', user?.id],
    // Let remounts reuse the in-flight read instead of aborting and restarting it.
    queryFn: () =>
      mode === 'loan'
        ? catalogService.fetchLoanCatalog(api)
        : catalogService.fetchReturnCatalog(api),
    enabled: !!user,
  });
  const matches = matchCatalog(catalog.data?.records ?? [], mode === 'loan' ? query : '');
  {
    const records = catalog.data?.records ?? [];
    const categories = [...new Set(records.map((record) => catalogCategory(record.name)))];
    const visible = matches.filter(
      (record) => mode === 'return' || !category || catalogCategory(record.name) === category,
    );
    return (
      <Stack>
        {heading && (
          <Group align="center" gap="md">
            <Title order={1}>{heading}</Title>
            {mode === 'loan' && (
              <Group gap={6} wrap="nowrap">
                <Box
                  w={6}
                  h={6}
                  bg="portalGreen.6"
                  aria-hidden="true"
                  style={{ borderRadius: '50%', flexShrink: 0 }}
                />
                <Text size="xs" c="portalGreen.6">
                  เฉพาะพร้อมยืม
                </Text>
              </Group>
            )}
          </Group>
        )}

        {mode === 'loan' && (
          <Paper withBorder radius="lg" p={{ base: 'sm', sm: 'lg' }} shadow="xs">
            <Stack gap="sm">
              <Group align="center" gap="xs">
                <TextInput
                  leftSection={<Search size={18} aria-hidden="true" />}
                  flex="1 1 280px"
                  miw={200}
                  aria-label="ค้นหาอุปกรณ์"
                  placeholder="ชื่ออุปกรณ์ เลขครุภัณฑ์ หรือ S/N"
                  value={query}
                  disabled={disabled}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                />

                <Button
                  type="button"
                  variant="default"
                  px="xs"
                  aria-label="ล้างตัวกรอง"
                  title="ล้างตัวกรอง"
                  disabled={disabled}
                  onClick={() => {
                    setQuery('');
                    setCategory('');
                  }}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                </Button>
                <Button.Group>
                  <Button
                    leftSection={<LayoutGrid size={16} aria-hidden="true" />}
                    variant={view === 'grid' ? 'filled' : 'default'}
                    aria-pressed={view === 'grid'}
                    onClick={() => setView('grid')}
                  >
                    การ์ด
                  </Button>
                  <Button
                    leftSection={<List size={16} aria-hidden="true" />}
                    variant={view === 'list' ? 'filled' : 'default'}
                    aria-pressed={view === 'list'}
                    onClick={() => setView('list')}
                  >
                    รายการ
                  </Button>
                </Button.Group>
              </Group>
              <ScrollArea type="auto" offsetScrollbars>
                <Group wrap="nowrap" gap="xs" pb={4}>
                  {['', ...categories].map((value) => (
                    <Button
                      key={value}
                      type="button"
                      radius="xl"
                      size="xs"
                      variant={category === value ? 'filled' : 'default'}
                      aria-pressed={category === value}
                      disabled={disabled}
                      style={{ flexShrink: 0 }}
                      onClick={() => setCategory(value)}
                    >
                      {value || 'ทั้งหมด'} (
                      {value
                        ? records.filter((record) => catalogCategory(record.name) === value).length
                        : records.length}
                      )
                    </Button>
                  ))}
                </Group>
              </ScrollArea>
            </Stack>
          </Paper>
        )}
        {heading && (
          <Group gap="sm" wrap="nowrap">
            <Box
              aria-hidden="true"
              w={4}
              bg="var(--mantine-primary-color-filled)"
              style={{ alignSelf: 'stretch', flexShrink: 0, borderRadius: 999 }}
            />
            <Text fw={700} size="lg">
              {mode === 'loan' ? '1. ' : ''}เลือกอุปกรณ์ที่ต้องการ{action}
            </Text>
          </Group>
        )}
        <Text size="sm" role="status">
          {catalog.isPending ? 'กำลังโหลดอุปกรณ์…' : `รายการอุปกรณ์ (${visible.length} รายการ)`}
        </Text>
        <ErrorAlert error={catalog.error} />
        {catalog.error && (
          <Button variant="default" onClick={() => void catalog.refetch()}>
            ลองโหลดอุปกรณ์อีกครั้ง
          </Button>
        )}
        {error && (
          <Text c="red" role="alert">
            {error}
          </Text>
        )}
        {!catalog.isPending && !catalog.error && !visible.length && (
          <Text c="dimmed">
            {mode === 'return' && !records.length
              ? 'คุณไม่มีครุภัณฑ์ที่สามารถส่งคำขอคืนได้'
              : 'ไม่พบอุปกรณ์ที่ตรงกับคำค้น'}
          </Text>
        )}
        {view === 'list' ? (
          <Table.ScrollContainer minWidth={760}>
            <Table
              verticalSpacing="sm"
              horizontalSpacing="md"
              highlightOnHover
              withTableBorder
              style={{ borderRadius: 16, overflow: 'hidden' }}
            >
              <Table.Thead bg="var(--mantine-color-gray-0)">
                <Table.Tr>
                  {['อุปกรณ์', 'เลขครุภัณฑ์', 'S/N', 'หมวดหมู่', 'สถานะ', `การ${action}`].map(
                    (label) => (
                      <Table.Th key={label}>
                        <Text size="xs" c="dimmed" fw={600}>
                          {label}
                        </Text>
                      </Table.Th>
                    ),
                  )}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visible.map((record) => {
                  return (
                    <Table.Tr
                      key={record.row}
                      onClick={() => {
                        if (!disabled) onSelect(record);
                      }}
                      style={{
                        cursor: 'pointer',
                      }}
                    >
                      <Table.Td>
                        <Group wrap="nowrap" gap="sm">
                          <Box
                            w={56}
                            bg="var(--mantine-color-gray-0)"
                            style={{ flexShrink: 0, borderRadius: 10, overflow: 'hidden' }}
                          >
                            <CatalogPhoto
                              key={record.photo}
                              url={record.photo}
                              name={record.name}
                              height={56}
                            />
                          </Box>
                          <UnstyledButton
                            type="button"
                            aria-label={`${action} ${record.name} ${record.asset}`}
                            style={{ minWidth: 0, width: 300, maxWidth: '100%' }}
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelect(record);
                            }}
                          >
                            <Text size="sm" fw={600} lineClamp={2} title={record.name}>
                              {record.name || 'ไม่ระบุชื่ออุปกรณ์'}
                            </Text>
                          </UnstyledButton>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" truncate maw={180} title={record.asset}>
                          {record.asset}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" truncate maw={140} title={record.serial}>
                          {record.serial || '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text
                          size="xs"
                          c="dimmed"
                          truncate
                          maw={170}
                          title={catalogCategory(record.name)}
                        >
                          {catalogCategory(record.name)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color="green"
                          variant="light"
                          leftSection={
                            <Box w={6} h={6} bg="green" style={{ borderRadius: '50%' }} />
                          }
                        >
                          {mode === 'loan' ? 'พร้อมยืม' : 'กำลังยืม'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          type="button"
                          size="sm"
                          miw={130}
                          variant="outline"

                          disabled={disabled}

                          aria-label={`${action} ${record.name} ${record.asset} ${record.serial}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect(record);
                          }}
                        >
                          {action}อุปกรณ์นี้
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        ) : (
          <SimpleGrid
            cols={view === 'grid' ? { base: 1, xs: 2, sm: 3, lg: 4, xl: 6 } : 1}
            spacing="sm"
          >
            {visible.map((record) => (
              <Paper
                key={record.row}
                withBorder
                radius="lg"
                shadow="xs"
                style={{
                  minWidth: 0,
                  position: 'relative',
                  overflow: 'hidden',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <UnstyledButton
                  type="button"
                  disabled={disabled}
                  aria-label={`${action} ${record.name} ${record.asset}`}
                  onClick={() => onSelect(record)}
                  style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 1 }}
                />
                <Box
                  bg="var(--mantine-color-gray-0)"
                  h={150}
                  style={{ position: 'relative', flexShrink: 0 }}
                >
                  <CatalogPhoto
                    key={record.photo}
                    url={record.photo}
                    name={record.name}
                    height={150}
                  />
                  <Group
                    justify="space-between"
                    gap={4}
                    style={{ position: 'absolute', top: 8, left: 8, right: 8 }}
                  >
                    <Badge
                      color="gray"
                      variant="white"
                      radius="sm"
                      maw="55%"
                      title={record.asset}
                      styles={{ label: { textTransform: 'none' } }}
                    >
                      {record.asset}
                    </Badge>
                    <Badge color="green" variant="light" size="xs">
                      {mode === 'loan' ? 'พร้อมยืม' : 'กำลังยืม'}
                    </Badge>
                  </Group>
                </Box>
                <Stack gap="xs" p="sm" style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    size="xs"
                    c="portalGreen.6"
                    fw={600}
                    truncate
                    title={catalogCategory(record.name)}
                  >
                    {catalogCategory(record.name)}
                  </Text>
                  <Text size="sm" fw={700} lineClamp={2} mih={44} lh="22px" title={record.name}>
                    {record.name || 'ไม่ระบุชื่ออุปกรณ์'}
                  </Text>
                  <Text size="xs" c="dimmed" truncate title={record.serial}>
                    S/N: {record.serial || '—'}
                  </Text>
                  <Box
                    mt="auto"
                    pt="sm"
                    style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}
                  >
                    <Button
                      fullWidth
                      size="sm"
                      type="button"
                      disabled={disabled}
                      style={{ position: 'relative', zIndex: 2 }}
                      aria-label={`${action} ${record.name} ${record.asset} ${record.serial}`}
                      onClick={() => onSelect(record)}
                    >
                      {mode === 'loan' ? 'ขอยืมอุปกรณ์นี้' : 'คืนอุปกรณ์นี้'}
                    </Button>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    );
  }
}

export function CatalogPhoto({
  url,
  name,
  height = 160,
}: {
  url?: string;
  name: string;
  height?: number;
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
      fit="contain"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
