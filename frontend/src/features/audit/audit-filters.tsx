'use client';
import { ResetFiltersButton } from '@/components/core/action-buttons';
import { SearchInput } from '@/components/core/search-input';
import { Group, NativeSelect, Paper } from '@mantine/core';

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
        <SearchInput
          aria-label="ค้นหาประวัติ"
          placeholder="ค้นหาชื่อ อีเมล หรือ Entity ID"
          iconSize={14}
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
        <ResetFiltersButton ml="auto" onClick={onReset} />
      </Group>
    </Paper>
  );
}
