"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type AssetEditorProps = {
  projectId: string;
  options: {
    scenes: Array<{ id: string; title: string }>;
    shots: Array<{ id: string; title: string }>;
    characters: string[];
  };
};

type AssetType = 'character' | 'scene' | 'prop' | 'style-board' | 'reference-image';

const DEFAULT_TYPE: AssetType = 'prop';

export function AssetEditor({ projectId, options }: AssetEditorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    type: DEFAULT_TYPE as AssetType,
    title: '',
    summary: '',
    tags: '',
    source: '手动录入',
    sceneId: '',
    shotId: '',
    characterName: '',
  });

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          asset: {
            ...form,
            tags: form.tags.split(/[，,]/).map((item) => item.trim()).filter(Boolean),
            sceneId: form.sceneId || undefined,
            shotId: form.shotId || undefined,
            characterName: form.characterName || undefined,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '资产保存失败');
      setMessage('资产条目已保存');
      setForm({
        type: DEFAULT_TYPE,
        title: '',
        summary: '',
        tags: '',
        source: '手动录入',
        sceneId: '',
        shotId: '',
        characterName: '',
      });
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="snapshot-card" onSubmit={onSubmit}>
      <p className="eyebrow">手动录入资产</p>
      <h3>资产中心 v1 录入口</h3>
      <p>可手动补充角色、场景、道具、风格板和参考图资产，并绑定到场景、镜头或角色，供后续渲染和复用链路消费。</p>
      <div className="form-grid">
        <label>
          <span>资产类型</span>
          <select value={form.type} onChange={(event) => updateField('type', event.target.value)}>
            <option value="character">角色</option>
            <option value="scene">场景</option>
            <option value="prop">道具</option>
            <option value="style-board">风格板</option>
            <option value="reference-image">参考图</option>
          </select>
        </label>
        <label>
          <span>资产标题</span>
          <input value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="例如：主角工牌 / 机房走廊 / 冷色风格板" />
        </label>
        <label className="full-width">
          <span>资产摘要</span>
          <textarea rows={4} value={form.summary} onChange={(event) => updateField('summary', event.target.value)} placeholder="写清用途、视觉特征或叙事作用。" />
        </label>
        <label>
          <span>标签（逗号分隔）</span>
          <input value={form.tags} onChange={(event) => updateField('tags', event.target.value)} placeholder="例如：冷光, 金属, 主角" />
        </label>
        <label>
          <span>来源</span>
          <input value={form.source} onChange={(event) => updateField('source', event.target.value)} placeholder="例如：导演手动补录 / 外部素材库" />
        </label>
        <label>
          <span>关联场景</span>
          <select value={form.sceneId} onChange={(event) => updateField('sceneId', event.target.value)}>
            <option value="">不绑定</option>
            {options.scenes.map((scene) => (
              <option key={scene.id} value={scene.id}>{scene.title}</option>
            ))}
          </select>
        </label>
        <label>
          <span>关联镜头</span>
          <select value={form.shotId} onChange={(event) => updateField('shotId', event.target.value)}>
            <option value="">不绑定</option>
            {options.shots.map((shot) => (
              <option key={shot.id} value={shot.id}>{shot.title}</option>
            ))}
          </select>
        </label>
        <label>
          <span>关联角色</span>
          <select value={form.characterName} onChange={(event) => updateField('characterName', event.target.value)}>
            <option value="">不绑定</option>
            {options.characters.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="action-row wrap-row">
        <button type="submit" className="button-primary" disabled={loading}>
          {loading ? '保存资产中…' : '保存资产条目'}
        </button>
        {message ? <span className="success-text">{message}</span> : null}
      </div>
    </form>
  );
}
