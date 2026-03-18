"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type StoryAction = 'generate' | 'generate-synopsis' | 'generate-beats' | 'generate-scenes' | 'generate-chapters';

const AI_CHAPTER_PREFIX = 'AI生成｜';
const STORY_ACTION_ORDER: StoryAction[] = ['generate-synopsis', 'generate-beats', 'generate-scenes', 'generate-chapters'];
const STORY_ACTION_META: Record<StoryAction, {
  successLabel: string;
  buttonLabel: string;
  loadingLabel: string;
  detailLabel: string;
}> = {
  generate: {
    successLabel: '故事骨架与小说正文',
    buttonLabel: '一键重跑完整故事链',
    loadingLabel: '重跑完整故事链中…',
    detailLabel: '一键重跑完整故事链',
  },
  'generate-synopsis': {
    successLabel: '故事梗概',
    buttonLabel: '生成故事梗概',
    loadingLabel: '正在生成故事梗概…',
    detailLabel: '只重生故事梗概',
  },
  'generate-beats': {
    successLabel: '结构节拍',
    buttonLabel: '生成结构节拍',
    loadingLabel: '正在生成结构节拍…',
    detailLabel: '只重生结构节拍',
  },
  'generate-scenes': {
    successLabel: '分场种子',
    buttonLabel: '生成分场种子',
    loadingLabel: '正在生成分场种子…',
    detailLabel: '只重生分场种子',
  },
  'generate-chapters': {
    successLabel: 'AI 小说正文',
    buttonLabel: '生成 AI 小说正文',
    loadingLabel: '正在生成 AI 小说正文…',
    detailLabel: '只刷新 AI 小说正文',
  },
};

function getVisibleChapterStats(project: { chapters: Array<{ title: string }>; outlines: Array<unknown> }) {
  const visibleChapters = project.chapters.filter((chapter) => !chapter.title.startsWith('Story Engine'));
  const aiChapters = visibleChapters.filter((chapter) => chapter.title.startsWith(AI_CHAPTER_PREFIX));

  return {
    outlineCount: project.outlines.length,
    visibleChapterCount: visibleChapters.length,
    aiChapterCount: aiChapters.length,
  };
}

export function StoryGenerateButton({
  projectId,
  primaryAction = 'generate',
  primaryLabel,
  primaryLoadingLabel,
  helperText,
}: {
  projectId: string;
  primaryAction?: StoryAction;
  primaryLabel?: string;
  primaryLoadingLabel?: string;
  helperText?: string;
}) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<StoryAction | null>(null);
  const [message, setMessage] = useState('');
  const secondaryAction: StoryAction = primaryAction === 'generate' ? 'generate-chapters' : 'generate';
  const primaryMeta = STORY_ACTION_META[primaryAction];
  const secondaryMeta = STORY_ACTION_META[secondaryAction];
  const detailActions = STORY_ACTION_ORDER.filter((action) => action !== primaryAction && action !== secondaryAction);

  const runAction = async (action: StoryAction) => {
    setLoadingAction(action);
    setMessage('');
    try {
      const response = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '故事引擎执行失败');

      const stats = getVisibleChapterStats(data.project);
      setMessage(
        `已更新${STORY_ACTION_META[action].successLabel}：${stats.outlineCount} 条大纲 / ${stats.visibleChapterCount} 章可用章节 / ${stats.aiChapterCount} 章 AI 小说`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '生成失败');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="page-stack">
      <div className="story-primary-action">
        <button type="button" className="button-primary" onClick={() => runAction(primaryAction)} disabled={Boolean(loadingAction)}>
          {loadingAction === primaryAction ? (primaryLoadingLabel || primaryMeta.loadingLabel) : (primaryLabel || primaryMeta.buttonLabel)}
        </button>
        <button type="button" className="button-secondary" onClick={() => runAction(secondaryAction)} disabled={Boolean(loadingAction)}>
          {loadingAction === secondaryAction ? secondaryMeta.loadingLabel : secondaryMeta.detailLabel}
        </button>
      </div>
      {helperText ? <p className="helper-text">{helperText}</p> : null}
      <details className="workflow-disclosure">
        <summary>更多局部重生选项</summary>
        <div className="workflow-disclosure-body">
          <div className="action-row wrap-row">
            {detailActions.map((action) => (
              <button
                key={action}
                type="button"
                className="button-ghost"
                onClick={() => runAction(action)}
                disabled={Boolean(loadingAction)}
              >
                {loadingAction === action ? STORY_ACTION_META[action].loadingLabel : STORY_ACTION_META[action].detailLabel}
              </button>
            ))}
          </div>
          <p className="helper-text">当你只想微调某一层时，再使用这些按钮，不必整套重跑。</p>
        </div>
      </details>
      {message ? <span className="success-text">{message}</span> : null}
    </div>
  );
}
