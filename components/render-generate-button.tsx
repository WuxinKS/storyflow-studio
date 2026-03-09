"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RenderGenerateButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const callApi = async (action: 'create' | 'run' | 'retry') => {
    setLoadingAction(action);
    setMessage('');
    try {
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '渲染任务操作失败');
      setMessage(
        action === 'create'
          ? `已创建 ${data.project.renderJobs.length} 个渲染任务`
          : action === 'run'
            ? '已执行可运行的渲染任务'
            : '已重试失败任务',
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="action-row wrap-row">
      <button type="button" className="button-primary" onClick={() => callApi('create')} disabled={Boolean(loadingAction)}>
        {loadingAction === 'create' ? '创建任务中…' : '创建渲染任务'}
      </button>
      <button type="button" className="button-secondary" onClick={() => callApi('run')} disabled={Boolean(loadingAction)}>
        {loadingAction === 'run' ? '执行任务中…' : '执行全部可运行任务'}
      </button>
      <button type="button" className="button-ghost" onClick={() => callApi('retry')} disabled={Boolean(loadingAction)}>
        {loadingAction === 'retry' ? '重试中…' : '重试失败任务'}
      </button>
      {message ? <span className="success-text">{message}</span> : null}
    </div>
  );
}
