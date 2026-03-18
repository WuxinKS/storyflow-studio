"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type CharacterLocks = {
  name: boolean;
  role: boolean;
  archetype: boolean;
  goal: boolean;
  conflict: boolean;
};

type CharacterDraft = {
  name: string;
  role: string;
  archetype: string;
  goal: string;
  conflict: string;
  voiceStyle: string;
  visualAnchor: string;
  locks: CharacterLocks;
};

const LOCK_LABELS: Record<keyof CharacterLocks, string> = {
  name: '角色名',
  role: '角色定位',
  archetype: '角色原型',
  goal: '剧情目标',
  conflict: '核心冲突',
};

function roleLabel(role: string) {
  if (role === 'protagonist') return '主角';
  if (role === 'antagonist') return '对手';
  return '关键配角';
}

export function CharacterEditor({
  projectId,
  initialCharacters,
}: {
  projectId: string;
  initialCharacters: CharacterDraft[];
}) {
  const router = useRouter();
  const [characters, setCharacters] = useState<CharacterDraft[]>(initialCharacters);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setCharacters(initialCharacters);
  }, [initialCharacters]);

  const hasCharacters = useMemo(() => characters.length > 0, [characters]);
  const totalLockedFields = useMemo(
    () => characters.reduce((sum, character) => sum + Object.values(character.locks).filter(Boolean).length, 0),
    [characters],
  );

  const updateField = (index: number, field: keyof CharacterDraft, value: string) => {
    setCharacters((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const toggleLock = (index: number, field: keyof CharacterLocks) => {
    setCharacters((current) => current.map((item, itemIndex) => (
      itemIndex === index
        ? { ...item, locks: { ...item.locks, [field]: !item.locks[field] } }
        : item
    )));
  };

  const onSave = async () => {
    setLoadingAction('save');
    setMessage('');
    try {
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'save', characters }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '角色保存失败');
      setMessage('角色修订与锁定状态已保存');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setLoadingAction(null);
    }
  };

  const onRegenerate = async (targetRole?: string) => {
    setLoadingAction(targetRole ? `generate:${targetRole}` : 'generate');
    setMessage('');
    try {
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'generate', targetRole }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '角色重生失败');
      setMessage(targetRole ? '已局部重生角色，锁定字段已保留' : '已按最新故事重生角色，锁定字段已保留');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '重生失败');
    } finally {
      setLoadingAction(null);
    }
  };

  if (!hasCharacters) return null;

  return (
    <div className="character-editor-stack">
      <div className="snapshot-card character-editor-command">
        <div className="character-editor-head">
          <div>
            <p className="eyebrow">Character Control</p>
            <h3>角色定稿与局部重生</h3>
          </div>
          <span className="status-pill status-pill-subtle">{totalLockedFields} 项已锁定</span>
        </div>

        <p>
          建议顺序是先统一三类角色的定位，再锁住角色名、原型、目标和冲突，最后只对需要变化的角色做局部重生。
          这样角色关系不会在后续改编和分镜阶段漂移。
        </p>

        <div className="action-row wrap-row">
          <button type="button" className="button-primary" onClick={onSave} disabled={Boolean(loadingAction)}>
            {loadingAction === 'save' ? '保存角色中…' : '保存角色修订'}
          </button>
          <button type="button" className="button-secondary" onClick={() => onRegenerate()} disabled={Boolean(loadingAction)}>
            {loadingAction === 'generate' ? '按锁定重生中…' : '整套重生（保留锁定）'}
          </button>
          {message ? <span className="success-text">{message}</span> : null}
        </div>
      </div>

      <div className="character-editor-grid">
        {characters.map((character, index) => {
          const lockedFields = Object.entries(character.locks)
            .filter(([, locked]) => locked)
            .map(([field]) => LOCK_LABELS[field as keyof CharacterLocks]);

          return (
            <div key={`${character.role}-${index}`} className="asset-tile scene-tile character-edit-card">
              <div className="character-card-head">
                <div>
                  <span className="label">{roleLabel(character.role)}</span>
                  <h4>{character.name || `角色 ${index + 1}`}</h4>
                </div>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => onRegenerate(character.role)}
                  disabled={Boolean(loadingAction)}
                >
                  {loadingAction === `generate:${character.role}` ? '重生中…' : '只重生这个角色'}
                </button>
              </div>

              {lockedFields.length > 0 ? (
                <div className="tag-list">
                  {lockedFields.map((field) => (
                    <span key={`${character.role}-${field}`} className="tag-chip">{field}</span>
                  ))}
                </div>
              ) : null}

              <div className="shot-list">
                <label className="shot-item">
                  <div className="field-head">
                    <strong>角色名</strong>
                    <button type="button" className={character.locks.name ? 'lock-toggle is-locked' : 'lock-toggle'} onClick={() => toggleLock(index, 'name')}>
                      {character.locks.name ? '已锁定' : '锁定'}
                    </button>
                  </div>
                  <input value={character.name} onChange={(event) => updateField(index, 'name', event.target.value)} />
                </label>

                <label className="shot-item">
                  <div className="field-head">
                    <strong>角色定位</strong>
                    <button type="button" className={character.locks.role ? 'lock-toggle is-locked' : 'lock-toggle'} onClick={() => toggleLock(index, 'role')}>
                      {character.locks.role ? '已锁定' : '锁定'}
                    </button>
                  </div>
                  <select value={character.role} onChange={(event) => updateField(index, 'role', event.target.value)}>
                    <option value="protagonist">主角</option>
                    <option value="antagonist">对手</option>
                    <option value="support">关键配角</option>
                  </select>
                </label>

                <label className="shot-item">
                  <div className="field-head">
                    <strong>角色原型</strong>
                    <button type="button" className={character.locks.archetype ? 'lock-toggle is-locked' : 'lock-toggle'} onClick={() => toggleLock(index, 'archetype')}>
                      {character.locks.archetype ? '已锁定' : '锁定'}
                    </button>
                  </div>
                  <textarea value={character.archetype} onChange={(event) => updateField(index, 'archetype', event.target.value)} rows={4} />
                </label>

                <label className="shot-item">
                  <div className="field-head">
                    <strong>剧情目标</strong>
                    <button type="button" className={character.locks.goal ? 'lock-toggle is-locked' : 'lock-toggle'} onClick={() => toggleLock(index, 'goal')}>
                      {character.locks.goal ? '已锁定' : '锁定'}
                    </button>
                  </div>
                  <textarea value={character.goal} onChange={(event) => updateField(index, 'goal', event.target.value)} rows={4} />
                </label>

                <label className="shot-item">
                  <div className="field-head">
                    <strong>核心冲突</strong>
                    <button type="button" className={character.locks.conflict ? 'lock-toggle is-locked' : 'lock-toggle'} onClick={() => toggleLock(index, 'conflict')}>
                      {character.locks.conflict ? '已锁定' : '锁定'}
                    </button>
                  </div>
                  <textarea value={character.conflict} onChange={(event) => updateField(index, 'conflict', event.target.value)} rows={4} />
                </label>

                <label className="shot-item">
                  <strong>说话方式</strong>
                  <textarea value={character.voiceStyle} onChange={(event) => updateField(index, 'voiceStyle', event.target.value)} rows={4} />
                </label>

                <label className="shot-item">
                  <strong>视觉锚点</strong>
                  <textarea value={character.visualAnchor} onChange={(event) => updateField(index, 'visualAnchor', event.target.value)} rows={4} />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
