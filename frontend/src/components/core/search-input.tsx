'use client';
import { TextInput, type TextInputProps } from '@mantine/core';
import { Search } from 'lucide-react';

export function SearchInput({ iconSize = 18, ...props }: TextInputProps & { iconSize?: number }) {
  return <TextInput leftSection={<Search size={iconSize} aria-hidden="true" />} {...props} />;
}
