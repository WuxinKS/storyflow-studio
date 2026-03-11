"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type RestoreScope = 'full' | 'story' | 'characters' | 'visual' | 'timeline';

function getScopeLabel(scope: RestoreScope) {
  if (scope === 'story') return '故事';
  if (scope === 'characters') return '角色';
  if (scope === 'visual') return '视觉';
  if (scope === 'timeline') return '时间线';
  return '整个项目';
}

function getButtonLabel(scope: RestoreScope) {
  if (scope === 'story') return '只恢复故事';
  if (scope === 'characters') return '只恢复角色';
  if (scope === 'visual') return '只恢复视觉';
  if (scope === 'timeline') return '只恢复时间线';
  return '恢复整个项目';
}

export function ProjectSnapshotRestoreButton({
  projectId,
  snapshotId,
  snapshotLabel,
  scope = 'full',
}: {
  projectId: string;
  snapshotId: string;
  snapshotLabel: string;
  scope?: RestoreScope;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const onRestore = async () => {
    const scopeLabel = getScopeLabel(scope);
    const shouldContinue = window.confirm(`确认把${scopeLabel}恢复到快照「${snapshotLabel}」吗？系统会先自动备份当前状态。`);
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
          scope,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '项目快照恢复失败');
      setMessage(`已恢复${scopeLabel}，并自动备份当前状态。`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '恢复失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="action-row wrap-row compact-row">
      <button
        type="button"
        className={scope === 'full' ? 'button-secondary' : 'button-ghost'}
        onClick={onRestore}
        disabled={loading}
      >
        {loading ? `恢复${getScopeLabel(scope)}中…` : getButtonLabel(scope)}
      </button>
      {message ? <span className="success-text">{message}</span> : null}
    </div>
  );
}
