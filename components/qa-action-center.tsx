"use client";

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildProjectHref } from '@/lib/project-links';

type QaActionCheck = {
  key: string;
  passed: boolean;
};

type QaAction = 'pipeline-full' | 'pipeline-prepare' | 'adaptation' | 'render-create' | 'render-run' | 'render-retry';

function getActionLabel(action: QaAction, loading: boolean) {
  if (action === 'pipeline-full') return loading ? '主链重跑中…' : '一键重跑完整主链';
  if (action === 'pipeline-prepare') return loading ? '刷新到渲染任务中…' : '重跑到渲染任务';
  if (action === 'adaptation') return loading ? '刷新改编中…' : '只刷新改编';
  if (action === 'render-create') return loading ? '创建渲染任务中…' : '创建渲染任务';
  if (action === 'render-run') return loading ? '执行渲染中…' : '执行渲染任务';
  return loading ? '重试失败渲染中…' : '重试失败渲染';
}

export function QaActionCenter({
  projectId,
  checks,
  readyToDeliver,
}: {
  projectId: string;
  checks: QaActionCheck[];
  readyToDeliver: boolean;
}) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<QaAction | null>(null);
  const [message, setMessage] = useState('');
  const failedKeys = new Set(checks.filter((item) => !item.passed).map((item) => item.key));

  const hasSyncOrStructureIssue = [
    'scene-count',
    'shot-count',
    'shot-count-per-scene',
    'sync-stale',
  ].some((key) => failedKeys.has(key));
  const hasRenderCreateIssue = failedKeys.has('render-jobs');
  const hasRenderExecutionIssue = [
    'render-completed',
    'generated-media-index',
    'final-video',
  ].some((key) => failedKeys.has(key));

  const runAction = async (action: QaAction) => {
    setLoadingAction(action);
    setMessage('');
    try {
      const payload =
        action === 'pipeline-full'
          ? { url: '/api/pipeline', body: { projectId, mode: 'full' } }
          : action === 'pipeline-prepare'
            ? { url: '/api/pipeline', body: { projectId, mode: 'prepare' } }
            : action === 'adaptation'
              ? { url: '/api/adaptation', body: { projectId } }
              : action === 'render-create'
                ? { url: '/api/render', body: { projectId, action: 'create' } }
                : action === 'render-run'
                  ? { url: '/api/render', body: { projectId, action: 'run' } }
                  : { url: '/api/render', body: { projectId, action: 'retry' } };

      const response = await fetch(payload.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.body),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '执行失败');

      setMessage(
        action === 'pipeline-full'
          ? '已重新执行完整主链'
          : action === 'pipeline-prepare'
            ? '已把主链刷新到渲染任务阶段'
            : action === 'adaptation'
              ? '已刷新改编结果'
              : action === 'render-create'
                ? '已创建渲染任务'
                : action === 'render-run'
                  ? '已执行可运行的渲染任务'
                  : '已重试失败渲染任务',
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '执行失败');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="snapshot-card">
      <p className="eyebrow">快速修复</p>
      <h3>{readyToDeliver ? '当前主链已达可交付' : '发现问题后可直接处理'}</h3>
      <p>
        {readyToDeliver
          ? '当前 QA 已通过。你可以直接去生成工作台复看产物，或者继续保存快照作为交付版本。'
          : '这里把最常用的修复动作集中在一起：重跑主链、刷新改编、创建渲染任务、执行渲染，减少在页面间来回切换。'}
      </p>
      <div className="action-row wrap-row">
        <button type="button" className="button-primary" onClick={() => runAction('pipeline-full')} disabled={Boolean(loadingAction)}>
          {getActionLabel('pipeline-full', loadingAction === 'pipeline-full')}
        </button>
        <button type="button" className="button-secondary" onClick={() => runAction('pipeline-prepare')} disabled={Boolean(loadingAction)}>
          {getActionLabel('pipeline-prepare', loadingAction === 'pipeline-prepare')}
        </button>
        <Link href={buildProjectHref('/render-studio', projectId)} className="button-ghost">打开生成工作台</Link>
        <Link href={buildProjectHref('/story-setup', projectId)} className="button-ghost">打开故事设定</Link>
      </div>
      <div className="action-row wrap-row compact-row">
        {hasSyncOrStructureIssue ? (
          <button type="button" className="button-ghost" onClick={() => runAction('adaptation')} disabled={Boolean(loadingAction)}>
            {getActionLabel('adaptation', loadingAction === 'adaptation')}
          </button>
        ) : null}
        {hasRenderCreateIssue ? (
          <button type="button" className="button-ghost" onClick={() => runAction('render-create')} disabled={Boolean(loadingAction)}>
            {getActionLabel('render-create', loadingAction === 'render-create')}
          </button>
        ) : null}
        {hasRenderExecutionIssue ? (
          <button type="button" className="button-ghost" onClick={() => runAction('render-run')} disabled={Boolean(loadingAction)}>
            {getActionLabel('render-run', loadingAction === 'render-run')}
          </button>
        ) : null}
        {hasRenderCreateIssue || hasRenderExecutionIssue ? (
          <button type="button" className="button-ghost" onClick={() => runAction('render-retry')} disabled={Boolean(loadingAction)}>
            {getActionLabel('render-retry', loadingAction === 'render-retry')}
          </button>
        ) : null}
      </div>
      {message ? <span className="success-text">{message}</span> : null}
    </div>
  );
}
