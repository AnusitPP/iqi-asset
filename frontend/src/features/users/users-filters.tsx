'use client';
import { Search } from 'lucide-react';
import { Button, Group, Paper, TextInput, NativeSelect } from '@mantine/core';
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
          <TextInput
            aria-label="ค้นหาผู้ใช้งาน"
            placeholder="ค้นหาชื่อหรืออีเมล"
            leftSection={<Search size={14} />}
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
          <Button
            variant="default"
            type="button"
            h={40}
            px="lg"
            bg="gray.0"
            c="dimmed"
            onClick={onReset}
          >
            ล้างตัวกรอง
          </Button>
        </Group>
      </form>
    </Paper>
  );
}
