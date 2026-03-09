"use client";

import { useState } from 'react';

export function RenderGenerateButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const callApi = async (action: 'create' | 'advance') => {
    setLoading(true);
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
          : '已推进一轮任务状态',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="action-row wrap-row">
      <button type="button" className="button-primary" onClick={() => callApi('create')} disabled={loading}>
        {loading ? '处理中…' : '生成渲染任务占位'}
      </button>
      <button type="button" className="button-secondary" onClick={() => callApi('advance')} disabled={loading}>
        推进一步状态
      </button>
      {message ? <span className="success-text">{message}</span> : null}
    </div>
  );
}
