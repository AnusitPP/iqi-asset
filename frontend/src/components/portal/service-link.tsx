'use client';
import { Anchor } from '@mantine/core';

import Link from 'next/link';
import { ChevronRight, ExternalLink } from 'lucide-react';
import type { PortalService } from '@/config/navigation';
import { usePortalLinkHandler } from './navigation-context';
export function ServiceLink({ service }: { service: PortalService }) {
  const navigate = usePortalLinkHandler();
  const Icon = service.icon;
  const content = (
    <>
      <span className="portal-service-icon">
        <Icon size={17} aria-hidden="true" />
      </span>
      <span className="portal-service-label">{service.label}</span>
      {service.planned && <span className="portal-soon">อยู่ระหว่างพัฒนา</span>}
      {service.external ? (
        <ExternalLink size={15} aria-hidden="true" />
      ) : (
        <ChevronRight size={16} aria-hidden="true" />
      )}
    </>
  );
  return service.external ? (
    <Anchor className="portal-service-link" href={service.href} target="_blank" rel="noreferrer">
      {content}
    </Anchor>
  ) : (
    <Anchor component={Link} className="portal-service-link" href={service.href} onClick={navigate}>
      {content}
    </Anchor>
  );
}
