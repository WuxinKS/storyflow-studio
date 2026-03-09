"use client";

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { defaultProjectDraft, ProjectDraft } from '@/features/project/draft';
import { useProjectDraft } from '@/features/project/use-project-draft';

export function IdeaLabForm() {
  const { draft, persist, ready } = useProjectDraft();
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>('');

  const current = ready ? draft : defaultProjectDraft;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const next: ProjectDraft = {
      title: String(formData.get('title') || ''),
      hook: String(formData.get('hook') || ''),
      genre: String(formData.get('genre') || ''),
      style: String(formData.get('style') || ''),
      output: String(formData.get('output') || 'video') as ProjectDraft['output'],
    };

    persist(next);
    setSaved(true);
    setSubmitting(true);
    setMessage('');

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || '保存到数据库失败');
      }
      setMessage(`已创建项目：${data.project.title}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSubmitting(false);
      setTimeout(() => setSaved(false), 1800);
    }
  };

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          <span>项目标题</span>
          <input name="title" defaultValue={current.title} placeholder="例如：灵感成片 Demo" />
        </label>
        <label>
          <span>目标输出</span>
          <select name="output" defaultValue={current.output}>
            <option value="novel">小说</option>
            <option value="screenplay">剧本</option>
            <option value="video">视频</option>
          </select>
        </label>
        <label className="full-width">
          <span>一句话创意</span>
          <textarea name="hook" rows={4} defaultValue={current.hook} />
        </label>
        <label>
          <span>题材</span>
          <input name="genre" defaultValue={current.genre} placeholder="科幻 / 奇幻 / 悬疑" />
        </label>
        <label>
          <span>风格</span>
          <input name="style" defaultValue={current.style} placeholder="电影感、短剧节奏、强情绪" />
        </label>
      </div>
      <div className="action-row">
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? '正在创建项目…' : '保存并创建项目'}
        </button>
        <Link href="/story-setup" className="button-secondary">下一步：故事设定</Link>
        {saved ? <span className="success-text">已保存到本地草稿</span> : null}
      </div>
      {message ? <p className="feedback-text">{message}</p> : null}
    </form>
  );
}
