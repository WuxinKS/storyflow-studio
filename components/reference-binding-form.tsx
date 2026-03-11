"use client";

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type TargetType = 'scene' | 'shot';

export function ReferenceBindingForm({
  projectId,
  references,
  scenes,
  shots,
}: {
  projectId: string;
  references: Array<{ id: string; title: string }>;
  scenes: Array<{ id: string; title: string }>;
  shots: Array<{ id: string; title: string; sceneTitle: string }>;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<TargetType>(shots.length > 0 ? 'shot' : 'scene');

  const targetOptions = useMemo(
    () => (targetType === 'scene'
      ? scenes.map((scene) => ({ value: scene.id, label: scene.title }))
      : shots.map((shot) => ({ value: shot.id, label: `${shot.sceneTitle} · ${shot.title}` }))),
    [scenes, shots, targetType],
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const referenceIds = formData.getAll('referenceIds').map((item) => String(item));
    setSubmitting(true);
    setMessage('');

    try {
      const response = await fetch('/api/reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bind',
          projectId,
          targetType,
          targetId: String(formData.get('targetId') || ''),
          referenceIds,
          note: String(formData.get('note') || ''),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '定向绑定失败');

      setMessage(referenceIds.length > 0 ? '已更新该目标的定向参考。' : '已清空该目标的定向参考。');
      router.refresh();
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
          <span>绑定层级</span>
          <select value={targetType} onChange={(event) => setTargetType(event.target.value === 'scene' ? 'scene' : 'shot')}>
            <option value="shot">镜头</option>
            <option value="scene">分场</option>
          </select>
        </label>
        <label>
          <span>目标</span>
          <select key={targetType} name="targetId" defaultValue={targetOptions[0]?.value || ''}>
            {targetOptions.length === 0 ? <option value="">暂无可绑定目标</option> : null}
            {targetOptions.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="full-width">
          <span>绑定说明（可选）</span>
          <textarea name="note" rows={3} placeholder="例如：这一镜优先参考雨夜追逐的压迫构图与人物湿冷质感。" />
        </label>
        <div className="full-width page-stack">
          <span>选择参考（可多选）</span>
          <div className="tag-list">
            {references.map((reference) => (
              <label key={reference.id} className="tag-chip" style={{ cursor: 'pointer' }}>
                <input type="checkbox" name="referenceIds" value={reference.id} style={{ marginRight: 6 }} />
                {reference.title}
              </label>
            ))}
          </div>
          <p className="helper-text">提示：不勾选任何参考并提交，会清空当前目标已有的定向绑定。</p>
        </div>
      </div>
      <div className="action-row wrap-row">
        <button type="submit" className="button-primary" disabled={submitting || targetOptions.length === 0}>
          {submitting ? '正在保存…' : '保存定向绑定'}
        </button>
        {message ? <span className="success-text">{message}</span> : null}
      </div>
    </form>
  );
}
