'use client';
import { ResetFiltersButton } from '@/components/core/action-buttons';
import { SearchInput } from '@/components/core/search-input';
import { Button, Group, Paper, NativeSelect } from '@mantine/core';
import { roleSchema, userStatusSchema } from '@/types/account';

export type UsersFilters = { search: string; role: string; status: string };
export function UsersFiltersForm({
  search,
  filters,
  onSearchChange,
  onFilterChange,
  onReset,
}: {
  search: string;
  filters: UsersFilters;
  onSearchChange: (search: string) => void;
  onFilterChange: (changes: Partial<UsersFilters>) => void;
  onReset: () => void;
}) {
  return (
    <Paper withBorder p="sm" radius="md" bg="white">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onFilterChange({ search });
        }}
      >
        <Group align="center" gap="xs">
          <SearchInput
            aria-label="ค้นหาผู้ใช้งาน"
            placeholder="ค้นหาชื่อหรืออีเมล"
            iconSize={14}
            flex={{ base: '1 1 100%', sm: '1 1 240px' }}
            styles={{ input: { height: 40 } }}
            maxLength={400}
            value={search}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
          />
          <NativeSelect
            aria-label="สิทธิ์ผู้ใช้งาน"
            w={140}
            styles={{ input: { height: 40 } }}
            data={[{ value: '', label: 'ทุก Role' }, ...roleSchema.options]}
            value={filters.role}
            onChange={(event) => onFilterChange({ role: event.currentTarget.value })}
          />
          <NativeSelect
            aria-label="สถานะผู้ใช้งาน"
            w={110}
            styles={{ input: { height: 40 } }}
            data={[{ value: '', label: 'ทุกสถานะ' }, ...userStatusSchema.options]}
            value={filters.status}
            onChange={(event) => onFilterChange({ status: event.currentTarget.value })}
          />
          <Button type="submit" color="dark" h={40} px="lg">
            ค้นหา
          </Button>
          <ResetFiltersButton ml="auto" onClick={onReset} />
        </Group>
      </form>
    </Paper>
  );
}
