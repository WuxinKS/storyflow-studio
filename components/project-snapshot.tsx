"use client";

import Link from 'next/link';
import { useProjectDraft } from '@/features/project/use-project-draft';

export function ProjectSnapshot() {
  const { draft, ready, reset } = useProjectDraft();

  return (
    <div className="snapshot-card">
      <div className="snapshot-header">
        <div>
          <p className="eyebrow">Current Draft</p>
          <h3>{ready ? draft.title : '加载中...'}</h3>
        </div>
        <span className="status-pill status-pill-subtle">{ready ? draft.output : 'draft'}</span>
      </div>
      <div className="snapshot-grid">
        <div>
          <span className="label">核心想法</span>
          <p>{ready ? draft.hook : '正在读取本地草稿…'}</p>
        </div>
        <div>
          <span className="label">题材</span>
          <p>{ready ? draft.genre : '-'}</p>
        </div>
        <div>
          <span className="label">风格</span>
          <p>{ready ? draft.style : '-'}</p>
        </div>
      </div>
      <div className="action-row">
        <Link href="/idea-lab" className="button-primary">编辑创意</Link>
        <Link href="/story-setup" className="button-secondary">进入设定</Link>
        <button type="button" className="button-ghost" onClick={reset}>重置草稿</button>
      </div>
    </div>
  );
}
