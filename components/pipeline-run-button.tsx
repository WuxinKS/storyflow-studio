"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PipelineRunButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loadingMode, setLoadingMode] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const runPipeline = async (mode: 'prepare' | 'full') => {
    setLoadingMode(mode);
    setMessage('');
    try {
      const response = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, mode }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '流水线执行失败');
      const completedSteps = data.run.steps.filter((step: { status: string }) => step.status === 'completed').length;
      setMessage(mode === 'full' ? `已完成一键主链，共执行 ${completedSteps} 个步骤` : `已把主链推进到渲染任务阶段，共执行 ${completedSteps} 个步骤`);
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
        {loadingMode === 'full' ? '一键主链执行中…' : '一键跑完整主链'}
      </button>
      <button type="button" className="button-secondary" disabled={Boolean(loadingMode)} onClick={() => runPipeline('prepare')}>
        {loadingMode === 'prepare' ? '准备中…' : '一键生成到渲染任务'}
      </button>
      {message ? <span className="success-text">{message}</span> : null}
    </div>
  );
}
