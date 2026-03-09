"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function NovelGenerateButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const onGenerate = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'generate-chapters' }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '小说章节生成失败');
      const count = (data.project.chapters || []).filter((chapter: { title: string }) => chapter.title.startsWith('AI生成｜')).length;
      setMessage(`已生成 ${count} 章 AI 小说章节`);
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
        {loading ? '生成小说章节中…' : '生成 AI 小说章节'}
      </button>
      {message ? <span className="success-text">{message}</span> : null}
    </div>
  );
}
