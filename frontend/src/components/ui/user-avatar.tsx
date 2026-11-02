import { Avatar } from '@mantine/core';
import { googleProfileImageUrl } from '@shared/features/auth/profile.js';
export function UserAvatar({ name, url }: { name: string; url?: string }) {
  return (
    <Avatar
      radius="xl"
      src={googleProfileImageUrl(url)}
      alt={name}
      imageProps={{ referrerPolicy: 'no-referrer', loading: 'lazy' }}
    >
      {name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => Array.from(part)[0])
        .join('')
        .toUpperCase() || '?'}
    </Avatar>
  );
}
