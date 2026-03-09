"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type TimelineShot = {
  id: string;
  title: string;
  duration: number;
  emotion: number;
  beatType: string | null;
  note: string;
  isManualDuration: boolean;
};

type TimelineScene = {
  id: string;
  title: string;
  shots: TimelineShot[];
};

export function TimelineEditor({ projectId, scenes }: { projectId: string; scenes: TimelineScene[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [shots, setShots] = useState<TimelineShot[]>(() => scenes.flatMap((scene) => scene.shots));

  useEffect(() => {
    setShots(scenes.flatMap((scene) => scene.shots));
  }, [scenes]);

  const updateShot = (shotId: string, field: keyof TimelineShot, value: string) => {
    setShots((current) => current.map((shot) => {
      if (shot.id !== shotId) return shot;
      if (field === 'duration' || field === 'emotion') {
        return { ...shot, [field]: Number(value) };
      }
      return { ...shot, [field]: value };
    }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          overrides: shots.map((shot) => ({
            shotId: shot.id,
            duration: shot.duration,
            emotion: shot.emotion,
            beatType: shot.beatType || undefined,
            note: shot.note || undefined,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '时间线保存失败');
      setMessage('时间线调整已保存');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="snapshot-card" onSubmit={onSubmit}>
      <p className="eyebrow">时间线微调</p>
      <h3>手动修时与节奏标记</h3>
      <p>可直接调整单镜头时长、情绪强度、峰值类型和备注，用于修正自动估时结果并补齐节奏标记。</p>
      <div className="asset-grid">
        {shots.map((shot) => (
          <div key={shot.id} className="shot-item">
            <strong>{shot.title}</strong>
            <label>
              <span>时长（秒）</span>
              <input type="number" min={1} max={20} value={shot.duration} onChange={(event) => updateShot(shot.id, 'duration', event.target.value)} />
            </label>
            <label>
              <span>情绪强度（1-5）</span>
              <input type="number" min={1} max={5} value={shot.emotion} onChange={(event) => updateShot(shot.id, 'emotion', event.target.value)} />
            </label>
            <label>
              <span>节奏标记</span>
              <select value={shot.beatType || ''} onChange={(event) => updateShot(shot.id, 'beatType', event.target.value)}>
                <option value="">不标记</option>
                <option value="buffer">缓冲场</option>
                <option value="key-scene">关键场</option>
                <option value="conflict-peak">冲突峰值</option>
                <option value="climax">高潮点</option>
              </select>
            </label>
            <label>
              <span>备注</span>
              <textarea rows={3} value={shot.note || ''} onChange={(event) => updateShot(shot.id, 'note', event.target.value)} />
            </label>
          </div>
        ))}
      </div>
      <div className="action-row wrap-row">
        <button type="submit" className="button-primary" disabled={loading}>
          {loading ? '保存时间线中…' : '保存时间线调整'}
        </button>
        {message ? <span className="success-text">{message}</span> : null}
      </div>
    </form>
  );
}
