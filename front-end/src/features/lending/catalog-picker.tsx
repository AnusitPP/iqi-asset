'use client';
import { Button, Combobox, InputBase, Text, useCombobox } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useWorkspaceState } from '@/hooks/use-workspace-state';
import { useState } from 'react';
import { matchCatalog } from '@shared/features/catalog/search.js';
import { catalogService } from '@/services/catalog.service';
import { useAuthSession } from '@/features/auth/auth-provider';
import type { CatalogRecord } from '@/types/lending';
import { ErrorAlert } from '@/components/ui/feedback';
export function LendingCatalogPicker({
  selected,
  onSelect,
  disabled,
  error,
  mode,
}: {
  selected: CatalogRecord | null;
  onSelect: (record: CatalogRecord | null) => void;
  disabled: boolean;
  error?: string;
  mode: 'loan' | 'return';
}) {
  const { api } = useAuthSession();
  const [query, setQuery] = useWorkspaceState(`${mode}-catalog-query`, selected?.name ?? ''),
    [requested, setRequested] = useState(false);
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const catalog = useQuery({
    queryKey: ['loan-catalog'],
    queryFn: ({ signal }) => catalogService.fetchLoanCatalog(api, signal),
    enabled: requested,
  });
  const matches = matchCatalog(catalog.data?.records ?? [], query);
  return (
    <div>
      <Combobox
        store={combobox}
        onOptionSubmit={(value) => {
          const record = catalog.data?.records.find((item) => String(item.row) === value);
          if (!record) return;
          onSelect(record);
          setQuery(record.name);
          combobox.closeDropdown();
        }}
      >
        <Combobox.Target>
          <InputBase
            label="ประเภทของครุภัณฑ์ หรือวัสดุ"
            withAsterisk
            placeholder="ค้นหาชื่ออุปกรณ์ เลขครุภัณฑ์ หรือ S/N"
            value={query}
            disabled={disabled}
            error={error}
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              onSelect(null);
              setRequested(true);
              combobox.openDropdown();
              combobox.resetSelectedOption();
            }}
            onFocus={() => {
              if (!selected) {
                setRequested(true);
                combobox.openDropdown();
              }
            }}
            onBlur={() => combobox.closeDropdown()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') combobox.closeDropdown();
            }}
          />
        </Combobox.Target>
        <Combobox.Dropdown>
          <Combobox.Options mah={260} style={{ overflowY: 'auto' }}>
            {catalog.isFetching ? (
              <Combobox.Empty>กำลังอ่านข้อมูลจากชีตพร้อมยืม…</Combobox.Empty>
            ) : matches.length ? (
              matches.map((record) => (
                <Combobox.Option key={record.row} value={String(record.row)}>
                  {[record.name, record.asset, record.serial].filter(Boolean).join(' · ')}
                </Combobox.Option>
              ))
            ) : (
              <Combobox.Empty>ไม่พบอุปกรณ์ที่ตรงกับคำค้น</Combobox.Empty>
            )}
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>
      <Text size="xs" role="status">
        {selected
          ? `เลือกแล้ว: ${selected.asset}`
          : requested
            ? `พบ ${matches.length} รายการ · กรุณาเลือกอุปกรณ์จากผลค้นหา`
            : 'ค้นหาจากชีตพร้อมยืม'}
      </Text>
      <ErrorAlert error={catalog.error} />
      {catalog.error && (
        <Button
          variant="subtle"
          onClick={() => {
            void catalog.refetch();
          }}
        >
          ลองโหลดอุปกรณ์อีกครั้ง
        </Button>
      )}
    </div>
  );
}
