"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CharacterGenerateButton({
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
        button: '生成首版角色卡',
        loading: '正在生成首版角色卡…',
        success: '已基于当前故事生成首版角色草案。',
      }
    : {
        button: '按最新故事刷新角色卡',
        loading: '正在刷新角色草案…',
        success: '已按最新故事刷新角色草案，锁定字段会保留。',
      };

  const onGenerate = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'generate' }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '角色草案生成失败');
      setMessage(copy.success);
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
