import clsx from 'clsx';
import type { SyncCard } from '@/features/sync/service';

export function SyncNoticeCard({ card }: { card: SyncCard }) {
  return (
    <div className={clsx('asset-tile', 'sync-notice-card', card.tone === 'warn' ? 'sync-notice-warn' : 'sync-notice-ok')}>
      <span className="label">sync notice</span>
      <h4>{card.title}</h4>
      <p>{card.description}</p>
    </div>
  );
}
