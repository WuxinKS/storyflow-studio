"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ProjectSnapshotRestoreButton({
  projectId,
  snapshotId,
  snapshotLabel,
}: {
  projectId: string;
  snapshotId: string;
  snapshotLabel: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const onRestore = async () => {
    const shouldContinue = window.confirm(`确认恢复到快照「${snapshotLabel}」吗？系统会先自动备份当前状态。`);
    if (!shouldContinue) return;

    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/projects/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          snapshotId,
          action: 'restore',
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '项目快照恢复失败');
      setMessage(`已恢复到「${snapshotLabel}」，并自动备份当前状态。`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '恢复失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="action-row wrap-row compact-row">
      <button type="button" className="button-secondary" onClick={onRestore} disabled={loading}>
        {loading ? '恢复快照中…' : '恢复到这个快照'}
      </button>
      {message ? <span className="success-text">{message}</span> : null}
    </div>
  );
}
