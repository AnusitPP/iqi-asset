'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Checkbox, Fieldset, Paper, Select, Stack, Text } from '@mantine/core';
import { ADMIN_ACCESS_GROUPS } from '@shared/features/auth/permissions.js';
import { ErrorPopup } from '@/components/core/error-popup';
import { PageHeader } from '@/components/portal/page-header';
import { LoadingIndicator } from '@/components/ui/feedback';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved';
import { usersService } from '@/services/users.service';
import type { AccountUser } from '@/types/account';

export function AdminPermissionsPage() {
  const { api, can } = useAuthSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const admins = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: ({ signal }) =>
      usersService.list(api, { role: 'ADMIN', status: '', search: '' }, signal),
    enabled: can('USER_MANAGE'),
  });
  if (!can('USER_MANAGE')) return null;
  const records = admins.data?.records ?? [];
  const selected = records.find((user) => user.id === selectedId);
  return (
    <section>
      <PageHeader
        title="จัดการสิทธิ์แอดมิน"
        description="เลือกแอดมินเพื่อกำหนดหน้าและการดำเนินการที่อนุญาต"
      />
      <Stack maw={660}>
        <ErrorPopup error={admins.error} onRefresh={() => admins.refetch()} />
        {admins.isPending ? (
          <LoadingIndicator />
        ) : (
          <Select
            label="แอดมิน"
            placeholder={records.length ? 'เลือกแอดมิน' : 'ไม่มีบัญชีแอดมิน'}
            data={records.map((user) => ({
              value: user.id,
              label: `${user.name} (${user.email})`,
            }))}
            value={selectedId}
            onChange={setSelectedId}
            searchable
            disabled={!records.length}
            nothingFoundMessage="ไม่พบแอดมิน"
          />
        )}
        {selected && <PermissionsForm key={selected.id} user={selected} />}
      </Stack>
    </section>
  );
}

function PermissionsForm({ user }: { user: AccountUser }) {
  const { api } = useAuthSession();
  const client = useQueryClient();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const current = new Set(draft ?? user.permissions);
  const managed = ADMIN_ACCESS_GROUPS.flatMap(({ page, actions }) => [
    page,
    ...actions.map(({ id }) => id),
  ]);
  const changed = managed.some((id) => current.has(id) !== user.permissions.includes(id));
  useUnsavedChangesGuard(changed);
  const save = useMutation({
    mutationFn: () =>
      usersService.updatePermissions(
        api,
        user.id,
        managed.filter((id) => current.has(id)),
      ),
    onSuccess: ({ user: updated }) => {
      client.setQueryData<{ records: AccountUser[] }>(
        ['admin-permissions'],
        (data) =>
          data && {
            records: data.records.map((record) => (record.id === updated.id ? updated : record)),
          },
      );
      void client.invalidateQueries({ queryKey: ['users'] });
      setDraft(null);
      setSaved(true);
    },
  });
  const change = (id: string, checked: boolean, children: readonly { id: string }[] = []) => {
    const next = new Set(current);
    if (checked) next.add(id);
    else {
      next.delete(id);
      children.forEach(({ id }) => next.delete(id));
    }
    setDraft([...next]);
    setSaved(false);
    save.reset();
  };
  return (
    <Paper
      withBorder
      radius="lg"
      p="lg"
      component="form"
      onSubmit={(event) => {
        event.preventDefault();
        if (changed && !save.isPending) save.mutate();
      }}
    >
      <Stack>
        {ADMIN_ACCESS_GROUPS.map(({ page, label, actions }) => (
          <Fieldset key={page} legend={label} disabled={save.isPending}>
            <Stack gap="xs">
              <Checkbox
                label="เข้าหน้า"
                checked={current.has(page)}
                onChange={(event) => change(page, event.currentTarget.checked, actions)}
              />
              {actions.map(({ id, label }) => (
                <Checkbox
                  key={id}
                  label={label}
                  ml="lg"
                  disabled={!current.has(page)}
                  checked={current.has(id)}
                  onChange={(event) => change(id, event.currentTarget.checked)}
                />
              ))}
            </Stack>
          </Fieldset>
        ))}
        <ErrorPopup error={save.error} onRefresh={() => save.reset()} />
        {saved && <Text role="status">บันทึกสิทธิ์แล้ว</Text>}
        <Button type="submit" disabled={!changed} loading={save.isPending}>
          บันทึกสิทธิ์
        </Button>
      </Stack>
    </Paper>
  );
}
