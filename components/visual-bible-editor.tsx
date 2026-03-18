"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type VisualLocks = {
  palette: boolean;
  lighting: boolean;
  lensLanguage: boolean;
  motionLanguage: boolean;
};

type VisualBibleDraft = {
  styleName: string;
  visualTone: string;
  palette: string;
  lighting: string;
  lensLanguage: string;
  motionLanguage: string;
  textureKeywords: string;
  sceneDesign: string;
  locks: VisualLocks;
};

type EditableField = Exclude<keyof VisualBibleDraft, 'locks'>;
type RegenerateFocus = 'all' | 'palette' | 'lighting' | 'lensLanguage' | 'motionLanguage';

const REGENERATE_ACTIONS: Array<{ focus: RegenerateFocus; label: string; pendingLabel: string }> = [
  { focus: 'palette', label: '只重生色彩策略', pendingLabel: '重生色彩中…' },
  { focus: 'lighting', label: '只重生光线策略', pendingLabel: '重生光线中…' },
  { focus: 'lensLanguage', label: '只重生镜头语言', pendingLabel: '重生镜头中…' },
  { focus: 'motionLanguage', label: '只重生运动语言', pendingLabel: '重生运动中…' },
];

export function VisualBibleEditor({
  projectId,
  initialDraft,
}: {
  projectId: string;
  initialDraft: VisualBibleDraft;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<VisualBibleDraft>(initialDraft);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  const lockSummary = useMemo(() => ([
    {
      key: 'palette',
      label: '色彩策略',
      description: '控制整体色彩基调与关键颜色刺点。',
      locked: draft.locks.palette,
    },
    {
      key: 'lighting',
      label: '光线策略',
      description: '控制亮暗关系、异常光源与画面照度。',
      locked: draft.locks.lighting,
    },
    {
      key: 'lensLanguage',
      label: '镜头语言',
      description: '控制景别偏好、观察距离和镜头组织方式。',
      locked: draft.locks.lensLanguage,
    },
    {
      key: 'motionLanguage',
      label: '运动语言',
      description: '控制推拉摇移、跟拍强度和镜头节奏。',
      locked: draft.locks.motionLanguage,
    },
  ]), [draft.locks.lensLanguage, draft.locks.lighting, draft.locks.motionLanguage, draft.locks.palette]);

  const lockedCount = lockSummary.filter((item) => item.locked).length;

  const updateField = (field: EditableField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const toggleLock = (field: keyof VisualLocks) => {
    setDraft((current) => ({
      ...current,
      locks: {
        ...current.locks,
        [field]: !current.locks[field],
      },
    }));
  };

  const onSave = async () => {
    setLoadingAction('save');
    setMessage('');
    try {
      const response = await fetch('/api/visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'save', draft }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '视觉圣经保存失败');
      setMessage('视觉圣经修订与锁定状态已保存');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setLoadingAction(null);
    }
  };

  const onRegenerate = async (focus: RegenerateFocus) => {
    setLoadingAction(`generate:${focus}`);
    setMessage('');
    try {
      const response = await fetch('/api/visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'generate', focus }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '视觉重生失败');
      setMessage(focus === 'all' ? '已整套重生视觉圣经，锁定字段已保留' : '已局部重生对应模块，锁定字段已保留');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '重生失败');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="visual-editor-stack">
      <div className="snapshot-card visual-editor-command">
        <div className="visual-editor-head">
          <div>
            <p className="eyebrow">Visual Control</p>
            <h3>视觉定稿与锁定</h3>
          </div>
          <span className="status-pill status-pill-subtle">{lockedCount} / 4 已锁定</span>
        </div>

        <p>
          推荐顺序是先人工修订风格，再锁住光色 / 镜头 / 运动规则，最后根据需要做整套或局部重生。
          这样后续图片和视频模型会更稳定地继承同一套视觉边界。
        </p>

        <div className="visual-lock-grid">
          {lockSummary.map((item) => (
            <div key={item.key} className="asset-tile visual-lock-card">
              <div className="field-head">
                <strong>{item.label}</strong>
                <button
                  type="button"
                  className={item.locked ? 'lock-toggle is-locked' : 'lock-toggle'}
                  onClick={() => toggleLock(item.key as keyof VisualLocks)}
                >
                  {item.locked ? '已锁定' : '锁定'}
                </button>
              </div>
              <p>{item.description}</p>
            </div>
          ))}
        </div>

        <div className="action-row wrap-row">
          <button type="button" className="button-primary" onClick={onSave} disabled={Boolean(loadingAction)}>
            {loadingAction === 'save' ? '保存视觉圣经中…' : '保存视觉修订'}
          </button>
          <button type="button" className="button-secondary" onClick={() => onRegenerate('all')} disabled={Boolean(loadingAction)}>
            {loadingAction === 'generate:all' ? '整套重生中…' : '整套重生（保留锁定）'}
          </button>
          {message ? <span className="success-text">{message}</span> : null}
        </div>

        <div className="visual-regenerate-grid">
          {REGENERATE_ACTIONS.map((item) => (
            <button
              key={item.focus}
              type="button"
              className="button-ghost"
              onClick={() => onRegenerate(item.focus)}
              disabled={Boolean(loadingAction)}
            >
              {loadingAction === `generate:${item.focus}` ? item.pendingLabel : item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="visual-editor-grid">
        <div className="asset-tile scene-tile visual-editor-card">
          <span className="label">风格与基调</span>
          <div className="visual-field-stack">
            <label className="shot-item">
              <strong>风格名</strong>
              <input value={draft.styleName} onChange={(event) => updateField('styleName', event.target.value)} />
            </label>
            <label className="shot-item">
              <strong>整体气质</strong>
              <textarea value={draft.visualTone} onChange={(event) => updateField('visualTone', event.target.value)} rows={5} />
            </label>
          </div>
        </div>

        <div className="asset-tile scene-tile visual-editor-card">
          <span className="label">光色系统</span>
          <div className="visual-field-stack">
            <label className="shot-item">
              <div className="field-head">
                <strong>色彩策略</strong>
                <button type="button" className={draft.locks.palette ? 'lock-toggle is-locked' : 'lock-toggle'} onClick={() => toggleLock('palette')}>
                  {draft.locks.palette ? '已锁定' : '锁定'}
                </button>
              </div>
              <textarea value={draft.palette} onChange={(event) => updateField('palette', event.target.value)} rows={5} />
            </label>
            <label className="shot-item">
              <div className="field-head">
                <strong>光线策略</strong>
                <button type="button" className={draft.locks.lighting ? 'lock-toggle is-locked' : 'lock-toggle'} onClick={() => toggleLock('lighting')}>
                  {draft.locks.lighting ? '已锁定' : '锁定'}
                </button>
              </div>
              <textarea value={draft.lighting} onChange={(event) => updateField('lighting', event.target.value)} rows={5} />
            </label>
          </div>
        </div>

        <div className="asset-tile scene-tile visual-editor-card">
          <span className="label">摄影规则</span>
          <div className="visual-field-stack">
            <label className="shot-item">
              <div className="field-head">
                <strong>镜头语言</strong>
                <button
                  type="button"
                  className={draft.locks.lensLanguage ? 'lock-toggle is-locked' : 'lock-toggle'}
                  onClick={() => toggleLock('lensLanguage')}
                >
                  {draft.locks.lensLanguage ? '已锁定' : '锁定'}
                </button>
              </div>
              <textarea value={draft.lensLanguage} onChange={(event) => updateField('lensLanguage', event.target.value)} rows={5} />
            </label>
            <label className="shot-item">
              <div className="field-head">
                <strong>运动语言</strong>
                <button
                  type="button"
                  className={draft.locks.motionLanguage ? 'lock-toggle is-locked' : 'lock-toggle'}
                  onClick={() => toggleLock('motionLanguage')}
                >
                  {draft.locks.motionLanguage ? '已锁定' : '锁定'}
                </button>
              </div>
              <textarea value={draft.motionLanguage} onChange={(event) => updateField('motionLanguage', event.target.value)} rows={5} />
            </label>
          </div>
        </div>

        <div className="asset-tile scene-tile visual-editor-card">
          <span className="label">材质与空间</span>
          <div className="visual-field-stack">
            <label className="shot-item">
              <strong>材质关键词</strong>
              <textarea value={draft.textureKeywords} onChange={(event) => updateField('textureKeywords', event.target.value)} rows={4} />
            </label>
            <label className="shot-item">
              <strong>空间设计</strong>
              <textarea value={draft.sceneDesign} onChange={(event) => updateField('sceneDesign', event.target.value)} rows={5} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
