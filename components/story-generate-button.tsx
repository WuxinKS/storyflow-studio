"use client";

import { useState } from 'react';

export function StoryGenerateButton({ projectId }: { projectId: string }) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const runAction = async (action: 'generate' | 'generate-synopsis' | 'generate-beats' | 'generate-scenes') => {
    setLoadingAction(action);
    setMessage('');
    try {
      const response = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Story Engine 生成失败');
      const outlines = data.project.outlines.length;
      const chapters = data.project.chapters.length;
      const actionLabelMap: Record<string, string> = {
        generate: '整套 story draft',
        'generate-synopsis': 'synopsis',
        'generate-beats': 'beat sheet',
        'generate-scenes': 'scene seeds',
      };
      setMessage(`已更新${actionLabelMap[action]}：${outlines} 条 outline / ${chapters} 个 chapter`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '生成失败');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="page-stack">
      <div className="action-row wrap-row">
        <button type="button" className="button-primary" onClick={() => runAction('generate')} disabled={Boolean(loadingAction)}>
          {loadingAction === 'generate' ? '整套 Story Engine 生成中…' : '整套生成 synopsis / beats / scenes'}
        </button>
        <button type="button" className="button-ghost" onClick={() => runAction('generate-synopsis')} disabled={Boolean(loadingAction)}>
          {loadingAction === 'generate-synopsis' ? '重生 synopsis…' : '只重生 synopsis'}
        </button>
        <button type="button" className="button-ghost" onClick={() => runAction('generate-beats')} disabled={Boolean(loadingAction)}>
          {loadingAction === 'generate-beats' ? '重生 beat sheet…' : '只重生 beat sheet'}
        </button>
        <button type="button" className="button-ghost" onClick={() => runAction('generate-scenes')} disabled={Boolean(loadingAction)}>
          {loadingAction === 'generate-scenes' ? '重生 scene seeds…' : '只重生 scene seeds'}
        </button>
      </div>
      {message ? <span className="success-text">{message}</span> : null}
    </div>
  );
}
