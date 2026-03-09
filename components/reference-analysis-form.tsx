"use client";

import { FormEvent, useState } from 'react';

export function ReferenceAnalysisForm({ projectId }: { projectId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSubmitting(true);
    setMessage('');

    try {
      const response = await fetch('/api/reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: String(formData.get('title') || ''),
          sourceType: String(formData.get('sourceType') || 'image'),
          framing: String(formData.get('framing') || ''),
          emotion: String(formData.get('emotion') || ''),
          movement: String(formData.get('movement') || ''),
          notes: String(formData.get('notes') || ''),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '参考分析保存失败');
      setMessage(`已记录参考分析，当前总数：${data.project.references.length}`);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form-card" onSubmit={onSubmit}>
      <div className="form-grid">
        <label>
          <span>参考标题</span>
          <input name="title" placeholder="例如：红衣人物恐惧特写" />
        </label>
        <label>
          <span>来源类型</span>
          <select name="sourceType" defaultValue="image">
            <option value="image">图片</option>
            <option value="video">视频</option>
          </select>
        </label>
        <label>
          <span>景别 / 构图</span>
          <input name="framing" placeholder="近景特写 / 强调手部与面部" />
        </label>
        <label>
          <span>情绪</span>
          <input name="emotion" placeholder="压迫、恐惧、临界紧张" />
        </label>
        <label>
          <span>动作 / 节奏</span>
          <input name="movement" placeholder="动作克制、细节强、悬疑节奏" />
        </label>
        <label className="full-width">
          <span>补充说明</span>
          <textarea name="notes" rows={4} placeholder="可记录色调、灯光、镜头语言、适合迁移到哪个场景。" />
        </label>
      </div>
      <div className="action-row wrap-row">
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? '正在保存…' : '保存参考分析'}
        </button>
        {message ? <span className="success-text">{message}</span> : null}
      </div>
    </form>
  );
}
