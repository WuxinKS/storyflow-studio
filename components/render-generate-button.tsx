"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const PROVIDER_OPTIONS = [
  { key: 'image-sequence', label: '图像' },
  { key: 'voice-synthesis', label: '语音' },
  { key: 'video-assembly', label: '视频' },
] as const;

type RenderAction = 'create' | 'run' | 'retry' | 'advance';
type ProviderKey = (typeof PROVIDER_OPTIONS)[number]['key'];
type RenderActionMeta = {
  buttonLabel: string;
  loadingLabel: string;
  detailLabel: string;
};

const RENDER_ACTION_ORDER: RenderAction[] = ['create', 'run', 'retry', 'advance'];
const RENDER_ACTION_META: Record<RenderAction, RenderActionMeta> = {
  create: {
    buttonLabel: '创建渲染任务',
    loadingLabel: '创建任务中…',
    detailLabel: '重新创建渲染任务',
  },
  run: {
    buttonLabel: '执行可运行任务',
    loadingLabel: '执行任务中…',
    detailLabel: '执行可运行任务',
  },
  retry: {
    buttonLabel: '重试失败任务',
    loadingLabel: '重试失败任务中…',
    detailLabel: '重试失败任务',
  },
  advance: {
    buttonLabel: '推进执行中任务',
    loadingLabel: '推进执行中…',
    detailLabel: '推进执行中任务',
  },
};

function getSecondaryAction(primaryAction: RenderAction) {
  if (primaryAction === 'create') return 'run' as const;
  if (primaryAction === 'run') return 'advance' as const;
  if (primaryAction === 'retry') return 'advance' as const;
  return 'retry' as const;
}

export function RenderGenerateButton({
  projectId,
  primaryAction = 'create',
  primaryLabel,
  primaryLoadingLabel,
  secondaryAction,
  secondaryLabel,
  helperText,
}: {
  projectId: string;
  primaryAction?: RenderAction;
  primaryLabel?: string;
  primaryLoadingLabel?: string;
  secondaryAction?: RenderAction;
  secondaryLabel?: string;
  helperText?: string;
}) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const resolvedSecondaryAction = secondaryAction || getSecondaryAction(primaryAction);
  const primaryMeta = RENDER_ACTION_META[primaryAction];
  const secondaryMeta = RENDER_ACTION_META[resolvedSecondaryAction];
  const detailActions = RENDER_ACTION_ORDER.filter((action) => action !== primaryAction && action !== resolvedSecondaryAction);

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
            : action === 'retry'
              ? providerLabel
                ? `已重试 ${providerLabel} Provider 的失败任务`
                : '已重试全部失败任务'
              : providerLabel
                ? `已推进 ${providerLabel} Provider 的执行中任务`
                : '已推进全部执行中任务',
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
      <div className="story-primary-action">
        <button type="button" className="button-primary" onClick={() => callApi(primaryAction)} disabled={Boolean(loadingAction)}>
          {loadingAction === `${primaryAction}:all`
            ? (primaryLoadingLabel || primaryMeta.loadingLabel)
            : (primaryLabel || primaryMeta.buttonLabel)}
        </button>
        <button type="button" className="button-secondary" onClick={() => callApi(resolvedSecondaryAction)} disabled={Boolean(loadingAction)}>
          {loadingAction === `${resolvedSecondaryAction}:all`
            ? secondaryMeta.loadingLabel
            : (secondaryLabel || secondaryMeta.detailLabel)}
        </button>
      </div>
      {helperText ? <p className="helper-text">{helperText}</p> : null}
      <details className="workflow-disclosure">
        <summary>更多执行选项</summary>
        <div className="workflow-disclosure-body">
          <div className="action-row wrap-row compact-row">
            {detailActions.map((action) => (
              <button
                key={action}
                type="button"
                className="button-ghost"
                onClick={() => callApi(action)}
                disabled={Boolean(loadingAction)}
              >
                {loadingAction === `${action}:all` ? RENDER_ACTION_META[action].loadingLabel : RENDER_ACTION_META[action].detailLabel}
              </button>
            ))}
          </div>

          <div className="page-stack">
            <p className="helper-text">只需要处理单一供应商时，再展开下面三组按钮。</p>

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

            <div className="action-row wrap-row compact-row">
              {PROVIDER_OPTIONS.map((provider) => (
                <button
                  key={`advance-${provider.key}`}
                  type="button"
                  className="button-ghost"
                  onClick={() => callApi('advance', { provider: provider.key })}
                  disabled={Boolean(loadingAction)}
                >
                  {loadingAction === `advance:${provider.key}` ? `推进${provider.label}中…` : `只推进${provider.label}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </details>
      {message ? <span className="success-text">{message}</span> : null}
    </div>
  );
}
