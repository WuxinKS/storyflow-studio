"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PipelineRunButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loadingMode, setLoadingMode] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [previewLogPath, setPreviewLogPath] = useState<string | null>(null);

  const toPreviewHref = (filePath: string) => `/api/media/file?path=${encodeURIComponent(filePath)}`;

  const runPipeline = async (mode: 'prepare' | 'full') => {
    setLoadingMode(mode);
    setMessage('');
    setPreviewPath(null);
    setPreviewLogPath(null);
    try {
      const response = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, mode }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '流水线执行失败');
      const completedSteps = data.run.steps.filter((step: { status: string }) => step.status === 'completed').length;
      const resolvedPreviewPath = typeof data.artifacts?.previewPath === 'string' ? data.artifacts.previewPath : null;
      const resolvedPreviewLogPath = typeof data.artifacts?.previewLogPath === 'string' ? data.artifacts.previewLogPath : null;
      const previewReady = Boolean(data.artifacts?.previewReady && resolvedPreviewPath);
      setPreviewPath(resolvedPreviewPath);
      setPreviewLogPath(resolvedPreviewLogPath);
      setMessage(
        mode === 'full'
          ? previewReady
            ? `已跑完整样片链，共完成 ${completedSteps} 个步骤，预演成片已生成。`
            : `已跑完整样片链，共完成 ${completedSteps} 个步骤。`
          : `已把流程推进到待执行任务阶段，共完成 ${completedSteps} 个步骤。`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '执行失败');
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <div className="action-row wrap-row">
      <button type="button" className="button-primary" disabled={Boolean(loadingMode)} onClick={() => runPipeline('full')}>
        {loadingMode === 'full' ? '完整样片链执行中…' : '直接生成完整样片链'}
      </button>
      <button type="button" className="button-secondary" disabled={Boolean(loadingMode)} onClick={() => runPipeline('prepare')}>
        {loadingMode === 'prepare' ? '准备中…' : '只推进到待执行任务'}
      </button>
      {previewPath ? (
        <a className="button-ghost" href={toPreviewHref(previewPath)} target="_blank" rel="noreferrer">打开预演成片</a>
      ) : null}
      {previewLogPath ? (
        <a className="button-ghost" href={toPreviewHref(previewLogPath)} target="_blank" rel="noreferrer">查看拼装日志</a>
      ) : null}
      {message ? <span className="success-text">{message}</span> : null}
    </div>
  );
}
