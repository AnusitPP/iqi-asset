'use client';
import { portalModules } from '@/config/navigation';
import { ModuleCard } from '@/components/portal/module-card';
import { PageHeader } from '@/components/portal/page-header';
import { HomeStatistics } from './home-statistics';
export function PortalHomePage() {
  return (
    <div className="portal-home">
      <PageHeader
        eyebrow="IT SERVICE PORTAL"
        title="หน้าหลักระบบงานไอที"
        description="ศูนย์กลางการเข้าถึงบริการและกระบวนการด้านไอทีและครุภัณฑ์"
      />
      <HomeStatistics />
      <section className="portal-services-section" aria-labelledby="portal-services-title">
        <div className="portal-section-heading">
          <div>
            <h2 id="portal-services-title">บริการและระบบงาน</h2>
            <p>เลือกบริการที่ต้องการใช้งาน</p>
          </div>
          <span>IT Services</span>
        </div>
        <div className="portal-module-grid">
          {portalModules.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
      </section>
    </div>
  );
}
