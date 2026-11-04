'use client';
import { Box, Title, Text, SimpleGrid } from '@mantine/core';

import { portalModules } from '@/config/navigation';
import { ModuleCard } from '@/components/portal/module-card';
import { PageHeader } from '@/components/portal/page-header';
import { HomeStatistics } from './home-statistics';
export function PortalHomePage() {
  return (
    <Box className="portal-home">
      <PageHeader
        eyebrow="IT SERVICE PORTAL"
        title="หน้าหลักระบบงานไอที"
        description="ศูนย์กลางการเข้าถึงบริการและกระบวนการด้านไอทีและครุภัณฑ์"
      />
      <HomeStatistics />
      <Box
        component="section"
        className="portal-services-section"
        aria-labelledby="portal-services-title"
      >
        <Box className="portal-section-heading">
          <Box>
            <Title order={2} id="portal-services-title">
              บริการและระบบงาน
            </Title>
            <Text component="p" className="portal-paragraph">
              เลือกบริการที่ต้องการใช้งาน
            </Text>
          </Box>
          <span>IT Services</span>
        </Box>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={20} className="portal-module-grid">
          {portalModules.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  );
}
