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

function buildShotMap(scenes: TimelineScene[]) {
  return new Map(scenes.flatMap((scene) => scene.shots.map((shot) => [shot.id, shot])));
}

export function TimelineEditor({ projectId, scenes }: { projectId: string; scenes: TimelineScene[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [shotMap, setShotMap] = useState<Map<string, TimelineShot>>(() => buildShotMap(scenes));

  useEffect(() => {
    setShotMap(buildShotMap(scenes));
  }, [scenes]);

  const updateShot = (shotId: string, field: keyof TimelineShot, value: string) => {
    setShotMap((current) => {
      const next = new Map(current);
      const shot = next.get(shotId);
      if (!shot) return current;

      if (field === 'duration' || field === 'emotion') {
        next.set(shotId, { ...shot, [field]: Number(value) });
        return next;
      }

      next.set(shotId, { ...shot, [field]: value });
      return next;
    });
  };

  const overrides = Array.from(shotMap.values()).map((shot) => ({
    shotId: shot.id,
    duration: shot.duration,
    emotion: shot.emotion,
    beatType: shot.beatType || undefined,
    note: shot.note || undefined,
  }));

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, overrides }),
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
    <form className="section-card timeline-editor-card" onSubmit={onSubmit}>
      <div className="section-header">
        <div>
          <p className="eyebrow">Timeline Edit</p>
          <h2>手动修时与节奏标记</h2>
        </div>
        <div className="section-header-side">
          <p>按场次分组调整镜头时长、情绪强度、峰值类型和备注，避免在大段文本里来回查找。</p>
          <div className="action-row wrap-row">
            <button type="submit" className="button-primary" disabled={loading}>
              {loading ? '保存时间线中…' : '保存时间线调整'}
            </button>
            {message ? <span className="success-text">{message}</span> : null}
          </div>
        </div>
      </div>

      <div className="timeline-edit-scene-stack">
        {scenes.map((scene, sceneIndex) => (
          <section key={scene.id} className="asset-tile timeline-edit-scene-card">
            <div className="timeline-edit-scene-head">
              <div>
                <span className="label">场次 {String(sceneIndex + 1).padStart(2, '0')}</span>
                <h4>{scene.title}</h4>
              </div>
              <span className="status-pill status-pill-subtle">{scene.shots.length} 个镜头</span>
            </div>

            <div className="timeline-edit-shot-grid">
              {scene.shots.map((shot) => {
                const current = shotMap.get(shot.id) || shot;
                return (
                  <div key={shot.id} className="shot-item timeline-edit-shot-card">
                    <strong>{current.title}</strong>
                    <div className="timeline-edit-field-grid">
                      <label>
                        <span>时长（秒）</span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={current.duration}
                          onChange={(event) => updateShot(shot.id, 'duration', event.target.value)}
                        />
                      </label>
                      <label>
                        <span>情绪强度（1-5）</span>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={current.emotion}
                          onChange={(event) => updateShot(shot.id, 'emotion', event.target.value)}
                        />
                      </label>
                    </div>
                    <label>
                      <span>节奏标记</span>
                      <select value={current.beatType || ''} onChange={(event) => updateShot(shot.id, 'beatType', event.target.value)}>
                        <option value="">不标记</option>
                        <option value="buffer">缓冲场</option>
                        <option value="key-scene">关键场</option>
                        <option value="conflict-peak">冲突峰值</option>
                        <option value="climax">高潮点</option>
                      </select>
                    </label>
                    <label>
                      <span>备注</span>
                      <textarea rows={3} value={current.note || ''} onChange={(event) => updateShot(shot.id, 'note', event.target.value)} />
                    </label>
                    {current.isManualDuration ? <span className="tag-chip tag-chip-active">已人工修时</span> : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </form>
  );
}
