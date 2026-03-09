"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type StoryAction = 'generate' | 'generate-synopsis' | 'generate-beats' | 'generate-scenes' | 'generate-chapters';

const AI_CHAPTER_PREFIX = 'AI生成｜';

function getVisibleChapterStats(project: { chapters: Array<{ title: string }>; outlines: Array<unknown> }) {
  const visibleChapters = project.chapters.filter((chapter) => !chapter.title.startsWith('Story Engine'));
  const aiChapters = visibleChapters.filter((chapter) => chapter.title.startsWith(AI_CHAPTER_PREFIX));

  return {
    outlineCount: project.outlines.length,
    visibleChapterCount: visibleChapters.length,
    aiChapterCount: aiChapters.length,
  };
}

export function StoryGenerateButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<StoryAction | null>(null);
  const [message, setMessage] = useState('');

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
      const actionLabelMap: Record<StoryAction, string> = {
        generate: '故事骨架与小说正文',
        'generate-synopsis': '故事梗概',
        'generate-beats': '结构节拍',
        'generate-scenes': '分场种子',
        'generate-chapters': 'AI 小说正文',
      };

      setMessage(
        `已更新${actionLabelMap[action]}：${stats.outlineCount} 条大纲 / ${stats.visibleChapterCount} 章可用章节 / ${stats.aiChapterCount} 章 AI 小说`,
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
      <div className="action-row wrap-row">
        <button type="button" className="button-primary" onClick={() => runAction('generate')} disabled={Boolean(loadingAction)}>
          {loadingAction === 'generate' ? '生成故事骨架与小说中…' : '生成故事骨架 + 小说正文'}
        </button>
        <button type="button" className="button-secondary" onClick={() => runAction('generate-chapters')} disabled={Boolean(loadingAction)}>
          {loadingAction === 'generate-chapters' ? '刷新小说正文中…' : '只刷新 AI 小说正文'}
        </button>
        <button type="button" className="button-ghost" onClick={() => runAction('generate-synopsis')} disabled={Boolean(loadingAction)}>
          {loadingAction === 'generate-synopsis' ? '重生故事梗概中…' : '只重生故事梗概'}
        </button>
        <button type="button" className="button-ghost" onClick={() => runAction('generate-beats')} disabled={Boolean(loadingAction)}>
          {loadingAction === 'generate-beats' ? '重生结构节拍中…' : '只重生结构节拍'}
        </button>
        <button type="button" className="button-ghost" onClick={() => runAction('generate-scenes')} disabled={Boolean(loadingAction)}>
          {loadingAction === 'generate-scenes' ? '重生分场种子中…' : '只重生分场种子'}
        </button>
      </div>
      {message ? <span className="success-text">{message}</span> : null}
    </div>
  );
}
