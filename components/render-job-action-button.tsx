"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RenderJobActionButton({
  projectId,
  jobId,
  action,
  label,
}: {
  projectId: string;
  jobId: string;
  action: 'run' | 'retry' | 'advance';
  label: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const onClick = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, jobId, action }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '任务执行失败');
      setMessage(
        action === 'retry'
          ? '已重试该任务'
          : action === 'advance'
            ? '已推进该任务'
            : '已执行该任务',
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="action-row wrap-row compact-row">
      <button type="button" className="button-ghost" onClick={onClick} disabled={loading}>
        {loading ? '处理中…' : label}
      </button>
      {message ? <span className="success-text">{message}</span> : null}
    </div>
  );
}
