"use client";

import { FormEvent, useState } from 'react';

export function ChapterCreateForm({ projectId }: { projectId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSubmitting(true);
    setMessage('');

    try {
      const response = await fetch('/api/chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: String(formData.get('title') || ''),
          content: String(formData.get('content') || ''),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '创建章节失败');
      setMessage(`已创建章节：${data.chapter.title}`);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form-card" onSubmit={onSubmit}>
      <div className="form-grid">
        <label>
          <span>章节标题</span>
          <input name="title" placeholder="例如：第一章 失控核心" />
        </label>
        <label className="full-width">
          <span>章节内容</span>
          <textarea name="content" rows={6} placeholder="先写一个章节草稿占位，后面再接 AI 自动生成。" />
        </label>
      </div>
      <div className="action-row">
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? '正在创建…' : '新增章节'}
        </button>
        {message ? <span className="success-text">{message}</span> : null}
      </div>
    </form>
  );
}
