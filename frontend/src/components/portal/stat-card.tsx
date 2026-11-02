import type { LucideIcon } from 'lucide-react';
export function StatCard({
  label,
  value,
  caption,
  icon: Icon,
  tone,
  state,
}: {
  label: string;
  value?: number;
  caption: string;
  icon: LucideIcon;
  tone: string;
  state: 'ready' | 'loading' | 'error' | 'restricted';
}) {
  return (
    <article
      className={`portal-stat-card tone-${tone}`}
      aria-label={label}
      aria-busy={state === 'loading'}
    >
      <div className="portal-stat-top">
        <span>{label}</span>
        <span className="portal-stat-icon">
          <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>
      <strong className={`portal-stat-value${state === 'loading' ? ' is-loading' : ''}`}>
        {state === 'ready' && value !== undefined
          ? new Intl.NumberFormat('th-TH').format(value)
          : state === 'loading'
            ? '…'
            : '—'}
      </strong>
      <span className="portal-stat-caption">
        {state === 'restricted'
          ? 'ข้อมูลสำหรับผู้มีสิทธิ์เข้าถึง'
          : state === 'error'
            ? 'ยังไม่สามารถอ่านข้อมูลได้'
            : state === 'loading'
              ? 'กำลังอ่านข้อมูลล่าสุด'
              : caption}
      </span>
    </article>
  );
}
