import { prisma } from '@/lib/prisma';
import { getLatestOutlineByTitle } from '@/lib/outline-store';

type SyncTone = 'ok' | 'warn';

export type SyncCard = {
  tone: SyncTone;
  title: string;
  description: string;
};

function getLatestTime(values: Array<Date | null | undefined>) {
  const times = values
    .filter(Boolean)
    .map((value) => new Date(value as Date).getTime())
    .filter((value) => Number.isFinite(value));

  return times.length > 0 ? Math.max(...times) : null;
}

function isUpstreamNewer(upstream: number | null, downstream: number | null) {
  return Boolean(upstream && (!downstream || upstream > downstream));
}

function buildCard(tone: SyncTone, title: string, description: string): SyncCard {
  return { tone, title, description };
}

export async function getSyncStatus(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      outlines: { orderBy: { createdAt: 'desc' } },
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      renderJobs: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) return null;

  const storyOutline = getLatestOutlineByTitle(project.outlines, 'Story Engine Synopsis');
  const characterOutline = getLatestOutlineByTitle(project.outlines, 'Character Drafts');
  const visualOutline = getLatestOutlineByTitle(project.outlines, 'Visual Bible');

  const storyUpdatedAt = storyOutline?.createdAt ? new Date(storyOutline.createdAt).getTime() : null;
  const characterUpdatedAt = characterOutline?.createdAt ? new Date(characterOutline.createdAt).getTime() : null;
  const visualUpdatedAt = visualOutline?.createdAt ? new Date(visualOutline.createdAt).getTime() : null;
  const adaptationUpdatedAt = getLatestTime([
    ...project.scenes.map((item) => item.updatedAt || item.createdAt),
    ...project.shots.map((item) => item.updatedAt || item.createdAt),
  ]);
  const renderUpdatedAt = getLatestTime(project.renderJobs.map((item) => item.updatedAt || item.createdAt));

  const storyImpacts = [
    isUpstreamNewer(storyUpdatedAt, characterUpdatedAt) ? '角色' : null,
    isUpstreamNewer(storyUpdatedAt, visualUpdatedAt) ? '视觉' : null,
    isUpstreamNewer(storyUpdatedAt, adaptationUpdatedAt) ? '改编' : null,
    isUpstreamNewer(storyUpdatedAt, renderUpdatedAt) ? '渲染' : null,
  ].filter(Boolean) as string[];

  const characterImpacts = [
    isUpstreamNewer(characterUpdatedAt, adaptationUpdatedAt) ? '改编' : null,
    isUpstreamNewer(characterUpdatedAt, renderUpdatedAt) ? '渲染' : null,
  ].filter(Boolean) as string[];

  const visualImpacts = [
    isUpstreamNewer(visualUpdatedAt, renderUpdatedAt) ? '渲染' : null,
    isUpstreamNewer(visualUpdatedAt, renderUpdatedAt) ? '导出' : null,
  ].filter(Boolean) as string[];

  const adaptationNeedsRefresh = characterImpacts.includes('改编') || storyImpacts.includes('改编');
  const renderNeedsRefresh =
    characterImpacts.includes('渲染')
    || visualImpacts.includes('渲染')
    || isUpstreamNewer(adaptationUpdatedAt, renderUpdatedAt);

  const staleChecks = [
    storyImpacts.length > 0 ? `故事层已领先：${storyImpacts.join(' / ')}` : null,
    characterImpacts.length > 0 ? `角色层已领先：${characterImpacts.join(' / ')}` : null,
    visualImpacts.length > 0 ? `视觉层已领先：${visualImpacts.join(' / ')}` : null,
  ].filter(Boolean) as string[];

  const notices: string[] = [];
  if (adaptationNeedsRefresh) notices.push('上游故事或角色已更新，建议重新生成改编结果。');
  if (renderNeedsRefresh) notices.push('视觉、角色或改编结果已更新，建议重新创建或执行渲染任务。');
  if (!adaptationNeedsRefresh && !renderNeedsRefresh) notices.push('当前上下游时间顺序基本一致，暂无明显过期提醒。');

  const cards = {
    story: storyImpacts.length > 0
      ? buildCard('warn', '故事层已变更，建议刷新下游', `当前故事改动会继续影响：${storyImpacts.join(' / ')}。`)
      : buildCard('ok', '故事链路基本同步', '当前故事层与角色、视觉、改编、渲染的时间顺序基本一致。'),
    character: characterImpacts.length > 0
      ? buildCard('warn', '角色已更新，建议刷新下游', `当前角色改动会继续影响：${characterImpacts.join(' / ')}。`)
      : buildCard('ok', '角色链路基本同步', '当前角色草案与改编、渲染的时间顺序基本一致。'),
    visual: visualImpacts.length > 0
      ? buildCard('warn', '视觉已更新，建议刷新渲染与导出', `当前视觉改动会继续影响：${visualImpacts.join(' / ')}。`)
      : buildCard('ok', '视觉链路基本同步', '当前视觉总控与渲染链路的时间顺序基本一致。'),
    adaptation: adaptationNeedsRefresh
      ? buildCard('warn', '建议刷新改编', '上游故事或角色已领先于当前改编结果，建议重新生成 scene / shot。')
      : buildCard('ok', '当前改编链基本同步', '当前改编结果与上游故事、角色时间顺序基本一致。'),
    render: renderNeedsRefresh
      ? buildCard('warn', '建议刷新渲染', '视觉、角色或改编结果已领先于当前渲染任务，建议重新创建或执行渲染链。')
      : buildCard('ok', '当前渲染链基本同步', '当前渲染任务与视觉、角色、改编时间顺序基本一致。'),
  };

  return {
    adaptationNeedsRefresh,
    renderNeedsRefresh,
    storyImpacts,
    characterImpacts,
    visualImpacts,
    staleChecks,
    notices,
    cards,
  };
}
