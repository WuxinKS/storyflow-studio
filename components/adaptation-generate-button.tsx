"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdaptationGenerateButton({
  projectId,
  mode = 'refresh',
}: {
  projectId: string;
  mode?: 'create' | 'refresh';
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const copy = mode === 'create'
    ? {
        button: '生成首版自动分镜',
        loading: '正在生成首版自动分镜…',
      }
    : {
        button: '按最新正文刷新自动分镜',
        loading: '正在刷新自动分镜…',
      };

  const onGenerate = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/adaptation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '改编失败');
      setMessage(`已生成 ${data.project.scenes.length} 个 scene、${data.project.shots.length} 个 shot`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '生成失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-stack">
      <div className="action-row wrap-row">
        <button type="button" className="button-primary" onClick={onGenerate} disabled={loading}>
          {loading ? copy.loading : copy.button}
        </button>
      </div>
      {message ? <span className="success-text">{message}</span> : null}
    </div>
  );
}
