"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CharacterGenerateButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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
      setMessage('已按最新故事更新角色草案，锁定字段会保留。');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '生成失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="action-row wrap-row">
      <button type="button" className="button-primary" onClick={onGenerate} disabled={loading}>
        {loading ? '正在生成角色草案…' : '生成 / 重生角色草案'}
      </button>
      {message ? <span className="success-text">{message}</span> : null}
    </div>
  );
}
