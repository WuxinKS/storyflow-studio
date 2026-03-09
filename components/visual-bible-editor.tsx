"use client";

import { useEffect, useState } from 'react';
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

  const updateField = (field: keyof VisualBibleDraft, value: string) => {
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

  const onRegenerate = async (focus: 'all' | 'palette' | 'lighting' | 'lensLanguage' | 'motionLanguage') => {
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
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">视觉修订</p>
        <h3>视觉总控定稿与锁定入口</h3>
        <p>这里可以修订风格名、色彩、光线、镜头语言、运动语言与材质关键词；锁定色彩、光线、镜头语言、运动语言后，整套或局部重生都不会覆盖这些字段。</p>
        <div className="action-row wrap-row">
          <button type="button" className="button-primary" onClick={onSave} disabled={Boolean(loadingAction)}>
            {loadingAction === 'save' ? '保存视觉圣经中…' : '保存视觉修订'}
          </button>
          <button type="button" className="button-secondary" onClick={() => onRegenerate('all')} disabled={Boolean(loadingAction)}>
            {loadingAction === 'generate:all' ? '整套重生中…' : '整套重生（保留锁定）'}
          </button>
          {message ? <span className="success-text">{message}</span> : null}
        </div>
        <div className="action-row wrap-row compact-row">
          <button type="button" className="button-ghost" onClick={() => onRegenerate('palette')} disabled={Boolean(loadingAction)}>
            {loadingAction === 'generate:palette' ? '重生色彩中…' : '只重生色彩策略'}
          </button>
          <button type="button" className="button-ghost" onClick={() => onRegenerate('lighting')} disabled={Boolean(loadingAction)}>
            {loadingAction === 'generate:lighting' ? '重生光线中…' : '只重生光线策略'}
          </button>
          <button type="button" className="button-ghost" onClick={() => onRegenerate('lensLanguage')} disabled={Boolean(loadingAction)}>
            {loadingAction === 'generate:lensLanguage' ? '重生镜头中…' : '只重生镜头语言'}
          </button>
          <button type="button" className="button-ghost" onClick={() => onRegenerate('motionLanguage')} disabled={Boolean(loadingAction)}>
            {loadingAction === 'generate:motionLanguage' ? '重生运动中…' : '只重生运动语言'}
          </button>
        </div>
      </div>

      <div className="asset-grid two-up">
        <div className="asset-tile scene-tile">
          <div className="shot-list">
            <label className="shot-item">
              <strong>风格名</strong>
              <input value={draft.styleName} onChange={(event) => updateField('styleName', event.target.value)} />
            </label>
            <label className="shot-item">
              <strong>整体气质</strong>
              <textarea value={draft.visualTone} onChange={(event) => updateField('visualTone', event.target.value)} />
            </label>
            <label className="shot-item">
              <div className="field-head">
                <strong>色彩策略</strong>
                <button type="button" className={draft.locks.palette ? 'lock-toggle is-locked' : 'lock-toggle'} onClick={() => toggleLock('palette')}>
                  {draft.locks.palette ? '已锁定' : '锁定'}
                </button>
              </div>
              <textarea value={draft.palette} onChange={(event) => updateField('palette', event.target.value)} />
            </label>
            <label className="shot-item">
              <div className="field-head">
                <strong>光线策略</strong>
                <button type="button" className={draft.locks.lighting ? 'lock-toggle is-locked' : 'lock-toggle'} onClick={() => toggleLock('lighting')}>
                  {draft.locks.lighting ? '已锁定' : '锁定'}
                </button>
              </div>
              <textarea value={draft.lighting} onChange={(event) => updateField('lighting', event.target.value)} />
            </label>
          </div>
        </div>

        <div className="asset-tile scene-tile">
          <div className="shot-list">
            <label className="shot-item">
              <div className="field-head">
                <strong>镜头语言</strong>
                <button type="button" className={draft.locks.lensLanguage ? 'lock-toggle is-locked' : 'lock-toggle'} onClick={() => toggleLock('lensLanguage')}>
                  {draft.locks.lensLanguage ? '已锁定' : '锁定'}
                </button>
              </div>
              <textarea value={draft.lensLanguage} onChange={(event) => updateField('lensLanguage', event.target.value)} />
            </label>
            <label className="shot-item">
              <div className="field-head">
                <strong>运动语言</strong>
                <button type="button" className={draft.locks.motionLanguage ? 'lock-toggle is-locked' : 'lock-toggle'} onClick={() => toggleLock('motionLanguage')}>
                  {draft.locks.motionLanguage ? '已锁定' : '锁定'}
                </button>
              </div>
              <textarea value={draft.motionLanguage} onChange={(event) => updateField('motionLanguage', event.target.value)} />
            </label>
            <label className="shot-item">
              <strong>材质关键词</strong>
              <textarea value={draft.textureKeywords} onChange={(event) => updateField('textureKeywords', event.target.value)} />
            </label>
            <label className="shot-item">
              <strong>空间设计</strong>
              <textarea value={draft.sceneDesign} onChange={(event) => updateField('sceneDesign', event.target.value)} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
