"use client";

import Link from 'next/link';
import { sampleStoryAssets } from '@/features/story/model';
import { useProjectDraft } from '@/features/project/use-project-draft';

export function StorySetupOverview() {
  const { draft, ready } = useProjectDraft();

  return (
    <div className="story-setup-grid">
      <div className="snapshot-card">
        <p className="eyebrow">Project Direction</p>
        <h3>{ready ? draft.title : '加载中...'}</h3>
        <p>{ready ? draft.hook : '正在读取创意草稿…'}</p>
        <div className="meta-list">
          <span>题材：{ready ? draft.genre : '-'}</span>
          <span>风格：{ready ? draft.style : '-'}</span>
          <span>输出：{ready ? draft.output : '-'}</span>
        </div>
        <div className="action-row">
          <Link href="/idea-lab" className="button-ghost">返回修改创意</Link>
          <Link href="/chapter-studio" className="button-secondary">进入章节工作台</Link>
        </div>
      </div>
      <div className="asset-grid">
        {sampleStoryAssets.map((item) => (
          <div key={item.id} className="asset-tile">
            <span className="label">{item.type}</span>
            <h4>{item.name}</h4>
            <p>{item.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
