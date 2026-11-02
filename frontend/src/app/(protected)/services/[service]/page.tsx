import Link from 'next/link';
import { notFound } from 'next/navigation';
import { portalModules } from '@/config/navigation';
import { PageHeader } from '@/components/portal/page-header';
const plannedServices = portalModules
  .flatMap((module) => module.services)
  .filter((service) => service.planned && !service.external);
export const dynamicParams = false;
export function generateStaticParams() {
  return plannedServices.map((service) => ({ service: service.href.slice('/services/'.length) }));
}
export async function generateMetadata({ params }: { params: Promise<{ service: string }> }) {
  const { service: id } = await params;
  const service = plannedServices.find((item) => item.href === `/services/${id}`);
  return { title: service ? `${service.label} — IT Service Portal` : 'IT Service Portal' };
}
export default async function ServicePage({ params }: { params: Promise<{ service: string }> }) {
  const { service: id } = await params;
  const service = plannedServices.find((item) => item.href === `/services/${id}`);
  if (!service) notFound();
  const Icon = service.icon;
  return (
    <section className="portal-coming-soon">
      <PageHeader title={service.label} description="บริการด้านไอทีและครุภัณฑ์" />
      <div className="portal-coming-soon-card">
        <span className="portal-coming-soon-icon">
          <Icon size={40} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <span className="portal-coming-soon-badge">อยู่ระหว่างพัฒนา</span>
        <h2>เตรียมพบกับบริการ{service.label}</h2>
        <p>
          บริการนี้ยังไม่เปิดให้ใช้งาน คุณยังสามารถใช้บริการอื่นที่เปิดให้บริการแล้วได้จากหน้าหลัก
        </p>
        <Link href="/" className="portal-primary-link">
          กลับหน้าหลัก
        </Link>
      </div>
    </section>
  );
}
