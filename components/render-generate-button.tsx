"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const PROVIDER_OPTIONS = [
  { key: 'image-sequence', label: '图像' },
  { key: 'voice-synthesis', label: '语音' },
  { key: 'video-assembly', label: '视频' },
] as const;

type RenderAction = 'create' | 'run' | 'retry';
type ProviderKey = (typeof PROVIDER_OPTIONS)[number]['key'];

export function RenderGenerateButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const callApi = async (action: RenderAction, options?: { provider?: ProviderKey; jobId?: string }) => {
    const actionKey = `${action}:${options?.provider || options?.jobId || 'all'}`;
    setLoadingAction(actionKey);
    setMessage('');
    try {
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action, provider: options?.provider, jobId: options?.jobId }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '渲染任务操作失败');

      const providerLabel = options?.provider
        ? PROVIDER_OPTIONS.find((item) => item.key === options.provider)?.label || '指定 Provider'
        : null;

      setMessage(
        action === 'create'
          ? `已创建 ${data.project.renderJobs.length} 个渲染任务`
          : action === 'run'
            ? providerLabel
              ? `已执行 ${providerLabel} Provider 的可运行任务`
              : '已执行全部可运行任务'
            : providerLabel
              ? `已重试 ${providerLabel} Provider 的失败任务`
              : '已重试全部失败任务',
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="page-stack">
      <div className="action-row wrap-row">
        <button type="button" className="button-primary" onClick={() => callApi('create')} disabled={Boolean(loadingAction)}>
          {loadingAction === 'create:all' ? '创建任务中…' : '创建渲染任务'}
        </button>
        <button type="button" className="button-secondary" onClick={() => callApi('run')} disabled={Boolean(loadingAction)}>
          {loadingAction === 'run:all' ? '执行任务中…' : '执行全部可运行任务'}
        </button>
        <button type="button" className="button-ghost" onClick={() => callApi('retry')} disabled={Boolean(loadingAction)}>
          {loadingAction === 'retry:all' ? '重试中…' : '重试失败任务'}
        </button>
      </div>
      <div className="action-row wrap-row compact-row">
        {PROVIDER_OPTIONS.map((provider) => (
          <button
            key={`run-${provider.key}`}
            type="button"
            className="button-ghost"
            onClick={() => callApi('run', { provider: provider.key })}
            disabled={Boolean(loadingAction)}
          >
            {loadingAction === `run:${provider.key}` ? `执行${provider.label}中…` : `只执行${provider.label}`}
          </button>
        ))}
      </div>
      <div className="action-row wrap-row compact-row">
        {PROVIDER_OPTIONS.map((provider) => (
          <button
            key={`retry-${provider.key}`}
            type="button"
            className="button-ghost"
            onClick={() => callApi('retry', { provider: provider.key })}
            disabled={Boolean(loadingAction)}
          >
            {loadingAction === `retry:${provider.key}` ? `重试${provider.label}中…` : `只重试${provider.label}`}
          </button>
        ))}
      </div>
      {message ? <span className="success-text">{message}</span> : null}
    </div>
  );
}
