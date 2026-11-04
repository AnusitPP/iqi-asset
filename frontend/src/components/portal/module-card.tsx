'use client';
import { Box, Paper, Title, Text, Stack } from '@mantine/core';

import type { PortalModule } from '@/config/navigation';
import { isServiceAllowed } from '@/config/navigation';
import { useAuthSession } from '@/features/auth/auth-provider';
import { ServiceLink } from './service-link';
export function ModuleCard({ module }: { module: PortalModule }) {
  const { can } = useAuthSession();
  const services = module.services.filter((service) => isServiceAllowed(service, can));
  if (!services.length) return null;
  const Icon = module.icon;
  return (
    <Paper
      withBorder
      component="section"
      className={`portal-module-card tone-${module.tone}`}
      aria-labelledby={`module-${module.id}`}
    >
      <Box className="portal-module-heading">
        <span className="portal-category-icon">
          <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <Box>
          <Title order={3} id={`module-${module.id}`}>
            {module.title}
          </Title>
          <Text component="p" className="portal-paragraph">
            {module.description}
          </Text>
        </Box>
      </Box>
      <Stack gap={0} className="portal-service-list">
        {services.map((service) => (
          <ServiceLink key={service.id} service={service} />
        ))}
      </Stack>
    </Paper>
  );
}
