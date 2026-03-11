"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type TargetType = 'scene' | 'shot';

type BindingOption = {
  targetType: TargetType;
  targetId: string;
  targetLabel: string;
  referenceIds: string[];
  referenceTitles: string[];
  note: string;
  promptLine: string | null;
};

export function ReferenceBindingForm({
  projectId,
  references,
  scenes,
  shots,
  currentBindings,
}: {
  projectId: string;
  references: Array<{ id: string; title: string }>;
  scenes: Array<{ id: string; title: string }>;
  shots: Array<{ id: string; title: string; sceneTitle: string }>;
  currentBindings: BindingOption[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<TargetType>(shots.length > 0 ? 'shot' : 'scene');
  const [targetId, setTargetId] = useState('');
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const targetOptions = useMemo(
    () => (targetType === 'scene'
      ? scenes.map((scene) => ({ value: scene.id, label: scene.title }))
      : shots.map((shot) => ({ value: shot.id, label: `${shot.sceneTitle} · ${shot.title}` }))),
    [scenes, shots, targetType],
  );

  const bindingMap = useMemo(() => {
    const nextMap = new Map<string, BindingOption>();
    currentBindings.forEach((binding) => {
      nextMap.set(`${binding.targetType}:${binding.targetId}`, binding);
    });
    return nextMap;
  }, [currentBindings]);

  useEffect(() => {
    if (targetOptions.length === 0) {
      setTargetId('');
      return;
    }

    setTargetId((current) => (
      current && targetOptions.some((item) => item.value === current)
        ? current
        : targetOptions[0]?.value || ''
    ));
  }, [targetOptions]);

  const currentBinding = targetId ? bindingMap.get(`${targetType}:${targetId}`) || null : null;

  useEffect(() => {
    setSelectedReferenceIds(currentBinding?.referenceIds || []);
    setNote(currentBinding?.note || '');
  }, [currentBinding, targetType, targetId]);

  const persistBinding = async (referenceIds: string[], nextNote: string) => {
    const response = await fetch('/api/reference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'bind',
        projectId,
        targetType,
        targetId,
        referenceIds,
        note: nextNote,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || '定向绑定失败');
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!targetId) return;

    setSubmitting(true);
    setMessage('');

    try {
      await persistBinding(selectedReferenceIds, note);
      setMessage(selectedReferenceIds.length > 0 ? '已更新该目标的定向参考。' : '已清空该目标的定向参考。');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const onToggleReference = (referenceId: string, checked: boolean) => {
    setSelectedReferenceIds((current) => checked
      ? Array.from(new Set([...current, referenceId]))
      : current.filter((item) => item !== referenceId));
  };

  const onClearBinding = async () => {
    if (!targetId) return;
    setSubmitting(true);
    setMessage('');

    try {
      await persistBinding([], '');
      setSelectedReferenceIds([]);
      setNote('');
      setMessage('已清空当前目标的定向绑定。');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '清空失败');
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
          <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
            {targetOptions.length === 0 ? <option value="">暂无可绑定目标</option> : null}
            {targetOptions.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
        <div className="full-width asset-tile scene-tile">
          <span className="label">当前目标</span>
          <h4>{currentBinding?.targetLabel || targetOptions.find((item) => item.value === targetId)?.label || '请选择一个目标'}</h4>
          <p>
            {currentBinding
              ? '这个目标已经有定向参考，可直接在下方回填修改，也可以一键清空。'
              : '这个目标目前还没有定向绑定，提交后会把所选参考直接注入到分镜和渲染链。'}
          </p>
          {currentBinding?.referenceTitles.length ? (
            <div className="tag-list">
              {currentBinding.referenceTitles.map((title) => (
                <span key={`${currentBinding.targetId}-${title}`} className="tag-chip">{title}</span>
              ))}
            </div>
          ) : null}
          {currentBinding?.promptLine ? <p><strong>当前摘要：</strong>{currentBinding.promptLine}</p> : null}
        </div>
        <label className="full-width">
          <span>绑定说明（可选）</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="例如：这一镜优先参考雨夜追逐的压迫构图与人物湿冷质感。" />
        </label>
        <div className="full-width page-stack">
          <span>选择参考（可多选）</span>
          <div className="tag-list">
            {references.map((reference) => (
              <label key={reference.id} className="tag-chip" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="referenceIds"
                  value={reference.id}
                  checked={selectedReferenceIds.includes(reference.id)}
                  onChange={(event) => onToggleReference(reference.id, event.target.checked)}
                  style={{ marginRight: 6 }}
                />
                {reference.title}
              </label>
            ))}
          </div>
          <p className="helper-text">提示：当前会优先回填已有绑定；不勾选任何参考并提交，或点“清空当前绑定”，都会移除这个目标的定向参考。</p>
        </div>
      </div>
      <div className="action-row wrap-row">
        <button type="submit" className="button-primary" disabled={submitting || targetOptions.length === 0 || !targetId}>
          {submitting ? '正在保存…' : '保存定向绑定'}
        </button>
        <button type="button" className="button-ghost" disabled={submitting || !targetId || !currentBinding} onClick={onClearBinding}>
          {submitting ? '处理中…' : '清空当前绑定'}
        </button>
        {message ? <span className="success-text">{message}</span> : null}
      </div>
    </form>
  );
}
