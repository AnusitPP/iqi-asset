'use client';
import { Button, Group, NativeSelect, Paper, TextInput } from '@mantine/core';
import { Search } from 'lucide-react';

export function AuditFilters({
  query,
  action,
  type,
  actions,
  types,
  onQueryChange,
  onActionChange,
  onTypeChange,
  onReset,
}: {
  query: string;
  action: string;
  type: string;
  actions: string[];
  types: string[];
  onQueryChange: (value: string) => void;
  onActionChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <Paper withBorder p="sm" radius="md" bg="white">
      <Group align="center" gap="xs">
        <TextInput
          aria-label="ค้นหาประวัติ"
          placeholder="ค้นหาชื่อ อีเมล หรือ Entity ID"
          leftSection={<Search size={14} />}
          flex={{ base: '1 1 100%', sm: '1 1 240px' }}
          styles={{ input: { height: 40 } }}
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
        />
        <NativeSelect
          aria-label="การกระทำ"
          w={{ base: '100%', xs: 210 }}
          styles={{ input: { height: 40 } }}
          data={[{ value: '', label: 'ทุกการกระทำ' }, ...actions]}
          value={action}
          onChange={(event) => onActionChange(event.currentTarget.value)}
        />
        <NativeSelect
          aria-label="ประเภท"
          w={{ base: '100%', xs: 150 }}
          styles={{ input: { height: 40 } }}
          data={[{ value: '', label: 'ทุกประเภท' }, ...types]}
          value={type}
          onChange={(event) => onTypeChange(event.currentTarget.value)}
        />
        <Button variant="default" h={40} px="lg" bg="gray.0" c="dimmed" onClick={onReset}>
          ล้างตัวกรอง
        </Button>
      </Group>
    </Paper>
  );
}
