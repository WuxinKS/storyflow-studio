import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createOutlineVersion } from '@/lib/outline-store';

export const PROJECT_SNAPSHOT_TITLE_PREFIX = 'Project Snapshot :: ';
export const PROJECT_SNAPSHOT_RESTORE_SCOPES = ['full', 'story', 'characters', 'visual', 'timeline'] as const;

export type ProjectSnapshotRestoreScope = (typeof PROJECT_SNAPSHOT_RESTORE_SCOPES)[number];

export type ProjectSnapshotStats = {
  ideaSeeds: number;
  outlines: number;
  chapters: number;
  scenes: number;
  shots: number;
  references: number;
  renderJobs: number;
};

export type ProjectSnapshotPayload = {
  version: 1;
  projectId: string;
  label: string;
  createdAt: string;
  project: {
    id: string;
    title: string;
    description: string | null;
    genre: string | null;
    premise: string | null;
    stage: string;
  };
  ideaSeeds: Array<{
    id: string;
    input: string;
    styleNotes: string | null;
    createdAt: string;
  }>;
  outlines: Array<{
    title: string;
    summary: string;
  }>;
  chapters: Array<{
    id: string;
    title: string;
    orderIndex: number;
    content: string;
    createdAt: string;
  }>;
  scenes: Array<{
    id: string;
    chapterId: string | null;
    title: string;
    summary: string | null;
    orderIndex: number;
    createdAt: string;
  }>;
  shots: Array<{
    id: string;
    sceneId: string | null;
    title: string;
    prompt: string | null;
    cameraNotes: string | null;
    orderIndex: number;
    createdAt: string;
  }>;
  references: Array<{
    id: string;
    type: string;
    sourceUrl: string | null;
    localPath: string | null;
    notes: string | null;
    createdAt: string;
  }>;
  renderJobs: Array<{
    id: string;
    status: string;
    provider: string | null;
    outputUrl: string | null;
    createdAt: string;
  }>;
  stats: ProjectSnapshotStats;
};

export type ProjectSnapshotSummary = ProjectSnapshotPayload & {
  snapshotId: string;
  title: string;
};

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return new Date(0).toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
  }
  return value.toISOString();
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatSnapshotLabel(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function buildSnapshotTitle(label?: string) {
  const normalized = normalizeString(label);
  return `${PROJECT_SNAPSHOT_TITLE_PREFIX}${normalized || formatSnapshotLabel()}`;
}

function deriveSnapshotLabel(title?: string, fallback?: string) {
  if (title?.startsWith(PROJECT_SNAPSHOT_TITLE_PREFIX)) {
    return title.slice(PROJECT_SNAPSHOT_TITLE_PREFIX.length).trim() || fallback || '未命名快照';
  }
  return fallback || '未命名快照';
}

async function getProjectSnapshotSource(projectId?: string) {
  const include = Prisma.validator<Prisma.ProjectInclude>()({
    ideaSeeds: { orderBy: { createdAt: 'desc' } },
    outlines: { orderBy: { createdAt: 'desc' } },
    chapters: { orderBy: { orderIndex: 'asc' } },
    scenes: { orderBy: { orderIndex: 'asc' } },
    shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
    references: { orderBy: { createdAt: 'desc' } },
    renderJobs: { orderBy: { createdAt: 'desc' } },
  });

  return projectId
    ? prisma.project.findUnique({
        where: { id: projectId },
        include,
      })
    : prisma.project.findFirst({
        orderBy: { updatedAt: 'desc' },
        include,
      });
}

type SnapshotSourceProject = NonNullable<Awaited<ReturnType<typeof getProjectSnapshotSource>>>;

function getLatestOutlines(outlines: SnapshotSourceProject['outlines']) {
  const seen = new Set<string>();

  return outlines
    .filter((outline) => !outline.title.startsWith(PROJECT_SNAPSHOT_TITLE_PREFIX))
    .filter((outline) => {
      const title = outline.title.trim();
      if (!title || seen.has(title)) return false;
      seen.add(title);
      return true;
    })
    .map((outline) => ({
      title: outline.title,
      summary: outline.summary,
    }));
}

function buildSnapshotStats(input: Pick<ProjectSnapshotPayload, 'ideaSeeds' | 'outlines' | 'chapters' | 'scenes' | 'shots' | 'references' | 'renderJobs'>): ProjectSnapshotStats {
  return {
    ideaSeeds: input.ideaSeeds.length,
    outlines: input.outlines.length,
    chapters: input.chapters.length,
    scenes: input.scenes.length,
    shots: input.shots.length,
    references: input.references.length,
    renderJobs: input.renderJobs.length,
  };
}

function buildProjectSnapshotPayload(project: SnapshotSourceProject, label?: string): ProjectSnapshotPayload {
  const outlines = getLatestOutlines(project.outlines);
  const payload: ProjectSnapshotPayload = {
    version: 1,
    projectId: project.id,
    label: normalizeString(label) || formatSnapshotLabel(),
    createdAt: new Date().toISOString(),
    project: {
      id: project.id,
      title: project.title,
      description: project.description,
      genre: project.genre,
      premise: project.premise,
      stage: project.stage,
    },
    ideaSeeds: project.ideaSeeds.map((item) => ({
      id: item.id,
      input: item.input,
      styleNotes: item.styleNotes,
      createdAt: toIsoString(item.createdAt),
    })),
    outlines,
    chapters: project.chapters.map((item) => ({
      id: item.id,
      title: item.title,
      orderIndex: item.orderIndex,
      content: item.content,
      createdAt: toIsoString(item.createdAt),
    })),
    scenes: project.scenes.map((item) => ({
      id: item.id,
      chapterId: item.chapterId,
      title: item.title,
      summary: item.summary,
      orderIndex: item.orderIndex,
      createdAt: toIsoString(item.createdAt),
    })),
    shots: project.shots.map((item) => ({
      id: item.id,
      sceneId: item.sceneId,
      title: item.title,
      prompt: item.prompt,
      cameraNotes: item.cameraNotes,
      orderIndex: item.orderIndex,
      createdAt: toIsoString(item.createdAt),
    })),
    references: project.references.map((item) => ({
      id: item.id,
      type: item.type,
      sourceUrl: item.sourceUrl,
      localPath: item.localPath,
      notes: item.notes,
      createdAt: toIsoString(item.createdAt),
    })),
    renderJobs: project.renderJobs.map((item) => ({
      id: item.id,
      status: item.status,
      provider: item.provider,
      outputUrl: item.outputUrl,
      createdAt: toIsoString(item.createdAt),
    })),
    stats: {
      ideaSeeds: 0,
      outlines: 0,
      chapters: 0,
      scenes: 0,
      shots: 0,
      references: 0,
      renderJobs: 0,
    },
  };

  payload.stats = buildSnapshotStats(payload);
  return payload;
}

function safeSnapshotStats(value: unknown): ProjectSnapshotStats {
  if (!value || typeof value !== 'object') {
    return {
      ideaSeeds: 0,
      outlines: 0,
      chapters: 0,
      scenes: 0,
      shots: 0,
      references: 0,
      renderJobs: 0,
    };
  }

  const record = value as Record<string, unknown>;
  return {
    ideaSeeds: typeof record.ideaSeeds === 'number' ? record.ideaSeeds : 0,
    outlines: typeof record.outlines === 'number' ? record.outlines : 0,
    chapters: typeof record.chapters === 'number' ? record.chapters : 0,
    scenes: typeof record.scenes === 'number' ? record.scenes : 0,
    shots: typeof record.shots === 'number' ? record.shots : 0,
    references: typeof record.references === 'number' ? record.references : 0,
    renderJobs: typeof record.renderJobs === 'number' ? record.renderJobs : 0,
  };
}

export function parseProjectSnapshot(
  summary: string | null | undefined,
  meta?: { id?: string; title?: string; createdAt?: Date | string },
): ProjectSnapshotSummary | null {
  if (!summary) return null;

  try {
    const parsed = JSON.parse(summary) as Partial<ProjectSnapshotPayload>;
    if (!parsed || parsed.version !== 1 || !parsed.projectId || !parsed.project) return null;

    const ideaSeeds = Array.isArray(parsed.ideaSeeds)
      ? parsed.ideaSeeds.map((item) => ({
          id: normalizeString(item?.id),
          input: normalizeString(item?.input),
          styleNotes: typeof item?.styleNotes === 'string' ? item.styleNotes : null,
          createdAt: toIsoString(item?.createdAt),
        }))
      : [];

    const outlines = Array.isArray(parsed.outlines)
      ? parsed.outlines
          .map((item) => ({
            title: normalizeString(item?.title),
            summary: typeof item?.summary === 'string' ? item.summary : '',
          }))
          .filter((item) => item.title)
      : [];

    const chapters = Array.isArray(parsed.chapters)
      ? parsed.chapters.map((item) => ({
          id: normalizeString(item?.id),
          title: normalizeString(item?.title),
          orderIndex: typeof item?.orderIndex === 'number' ? item.orderIndex : 0,
          content: typeof item?.content === 'string' ? item.content : '',
          createdAt: toIsoString(item?.createdAt),
        }))
      : [];

    const scenes = Array.isArray(parsed.scenes)
      ? parsed.scenes.map((item) => ({
          id: normalizeString(item?.id),
          chapterId: typeof item?.chapterId === 'string' ? item.chapterId : null,
          title: normalizeString(item?.title),
          summary: typeof item?.summary === 'string' ? item.summary : null,
          orderIndex: typeof item?.orderIndex === 'number' ? item.orderIndex : 0,
          createdAt: toIsoString(item?.createdAt),
        }))
      : [];

    const shots = Array.isArray(parsed.shots)
      ? parsed.shots.map((item) => ({
          id: normalizeString(item?.id),
          sceneId: typeof item?.sceneId === 'string' ? item.sceneId : null,
          title: normalizeString(item?.title),
          prompt: typeof item?.prompt === 'string' ? item.prompt : null,
          cameraNotes: typeof item?.cameraNotes === 'string' ? item.cameraNotes : null,
          orderIndex: typeof item?.orderIndex === 'number' ? item.orderIndex : 0,
          createdAt: toIsoString(item?.createdAt),
        }))
      : [];

    const references = Array.isArray(parsed.references)
      ? parsed.references.map((item) => ({
          id: normalizeString(item?.id),
          type: normalizeString(item?.type),
          sourceUrl: typeof item?.sourceUrl === 'string' ? item.sourceUrl : null,
          localPath: typeof item?.localPath === 'string' ? item.localPath : null,
          notes: typeof item?.notes === 'string' ? item.notes : null,
          createdAt: toIsoString(item?.createdAt),
        }))
      : [];

    const renderJobs = Array.isArray(parsed.renderJobs)
      ? parsed.renderJobs.map((item) => ({
          id: normalizeString(item?.id),
          status: normalizeString(item?.status),
          provider: typeof item?.provider === 'string' ? item.provider : null,
          outputUrl: typeof item?.outputUrl === 'string' ? item.outputUrl : null,
          createdAt: toIsoString(item?.createdAt),
        }))
      : [];

    const payload: ProjectSnapshotSummary = {
      version: 1,
      snapshotId: normalizeString(meta?.id),
      title: meta?.title || buildSnapshotTitle(parsed.label),
      projectId: normalizeString(parsed.projectId),
      label: deriveSnapshotLabel(meta?.title, normalizeString(parsed.label)),
      createdAt: meta?.createdAt ? toIsoString(meta.createdAt) : toIsoString(parsed.createdAt),
      project: {
        id: normalizeString(parsed.project.id),
        title: normalizeString(parsed.project.title),
        description: typeof parsed.project.description === 'string' ? parsed.project.description : null,
        genre: typeof parsed.project.genre === 'string' ? parsed.project.genre : null,
        premise: typeof parsed.project.premise === 'string' ? parsed.project.premise : null,
        stage: normalizeString(parsed.project.stage),
      },
      ideaSeeds,
      outlines,
      chapters,
      scenes,
      shots,
      references,
      renderJobs,
      stats: safeSnapshotStats(parsed.stats),
    };

    if (payload.stats.chapters === 0 && chapters.length > 0) {
      payload.stats = buildSnapshotStats(payload);
    }

    return payload;
  } catch {
    return null;
  }
}

function extractProjectSnapshots(outlines: SnapshotSourceProject['outlines']) {
  return outlines
    .filter((outline) => outline.title.startsWith(PROJECT_SNAPSHOT_TITLE_PREFIX))
    .map((outline) => parseProjectSnapshot(outline.summary, {
      id: outline.id,
      title: outline.title,
      createdAt: outline.createdAt,
    }))
    .filter((item): item is ProjectSnapshotSummary => Boolean(item))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export async function getProjectSnapshotWorkspace(projectId?: string) {
  const project = await getProjectSnapshotSource(projectId);
  if (!project) return null;

  const latestOutlines = getLatestOutlines(project.outlines);

  return {
    project: {
      id: project.id,
      title: project.title,
      premise: project.premise,
      stage: project.stage,
      updatedAt: toIsoString(project.updatedAt),
      stats: buildSnapshotStats({
        ideaSeeds: project.ideaSeeds.map((item) => ({
          id: item.id,
          input: item.input,
          styleNotes: item.styleNotes,
          createdAt: toIsoString(item.createdAt),
        })),
        outlines: latestOutlines,
        chapters: project.chapters.map((item) => ({
          id: item.id,
          title: item.title,
          orderIndex: item.orderIndex,
          content: item.content,
          createdAt: toIsoString(item.createdAt),
        })),
        scenes: project.scenes.map((item) => ({
          id: item.id,
          chapterId: item.chapterId,
          title: item.title,
          summary: item.summary,
          orderIndex: item.orderIndex,
          createdAt: toIsoString(item.createdAt),
        })),
        shots: project.shots.map((item) => ({
          id: item.id,
          sceneId: item.sceneId,
          title: item.title,
          prompt: item.prompt,
          cameraNotes: item.cameraNotes,
          orderIndex: item.orderIndex,
          createdAt: toIsoString(item.createdAt),
        })),
        references: project.references.map((item) => ({
          id: item.id,
          type: item.type,
          sourceUrl: item.sourceUrl,
          localPath: item.localPath,
          notes: item.notes,
          createdAt: toIsoString(item.createdAt),
        })),
        renderJobs: project.renderJobs.map((item) => ({
          id: item.id,
          status: item.status,
          provider: item.provider,
          outputUrl: item.outputUrl,
          createdAt: toIsoString(item.createdAt),
        })),
      }),
    },
    snapshots: extractProjectSnapshots(project.outlines),
  };
}

const STORY_OUTLINE_TITLES = ['Initial Outline Placeholder', 'Story Engine Synopsis', 'Story Engine Beat Sheet', 'AI Novel Chapter Index'] as const;
const CHARACTER_OUTLINE_TITLES = ['Character Drafts'] as const;
const VISUAL_OUTLINE_TITLES = ['Visual Bible'] as const;
const TIMELINE_OUTLINE_TITLES = ['Timeline Overrides'] as const;

function isRestoreScope(value: unknown): value is ProjectSnapshotRestoreScope {
  return typeof value === 'string' && PROJECT_SNAPSHOT_RESTORE_SCOPES.includes(value as ProjectSnapshotRestoreScope);
}

function getRestoreScopeLabel(scope: ProjectSnapshotRestoreScope) {
  if (scope === 'story') return '故事';
  if (scope === 'characters') return '角色';
  if (scope === 'visual') return '视觉';
  if (scope === 'timeline') return '时间线';
  return '整个项目';
}

function getSnapshotOutlinesByTitles(snapshot: ProjectSnapshotSummary, titles: readonly string[]) {
  return snapshot.outlines.filter((outline) => titles.includes(outline.title));
}

async function replaceOutlines(
  tx: Prisma.TransactionClient,
  projectId: string,
  nextOutlines: Array<{ title: string; summary: string }>,
  titles?: readonly string[],
) {
  const currentTitles = titles && titles.length > 0
    ? Array.from(new Set(titles.filter(Boolean)))
    : Array.from(new Set(nextOutlines.map((item) => item.title).filter(Boolean)));

  if (currentTitles.length > 0) {
    await tx.outline.deleteMany({
      where: {
        projectId,
        title: { in: currentTitles },
      },
    });
  }

  if (nextOutlines.length > 0) {
    await tx.outline.createMany({
      data: nextOutlines.map((item) => ({
        projectId,
        title: item.title,
        summary: item.summary,
      })),
    });
  }
}

export async function createProjectSnapshot(projectId: string, label?: string) {
  const project = await getProjectSnapshotSource(projectId);
  if (!project) throw new Error('项目不存在');

  const payload = buildProjectSnapshotPayload(project, label);
  const outline = await createOutlineVersion(
    project.id,
    buildSnapshotTitle(payload.label),
    JSON.stringify(payload, null, 2),
  );

  const snapshot = parseProjectSnapshot(outline.summary, {
    id: outline.id,
    title: outline.title,
    createdAt: outline.createdAt,
  });

  if (!snapshot) throw new Error('项目快照写入成功，但解析失败');
  return snapshot;
}

async function restoreFullSnapshot(
  tx: Prisma.TransactionClient,
  projectId: string,
  snapshot: ProjectSnapshotSummary,
  currentProject: SnapshotSourceProject,
) {
  await tx.renderJob.deleteMany({ where: { projectId } });
  await tx.shot.deleteMany({ where: { projectId } });
  await tx.scene.deleteMany({ where: { projectId } });
  await tx.chapter.deleteMany({ where: { projectId } });
  await tx.referenceAsset.deleteMany({ where: { projectId } });
  await tx.ideaSeed.deleteMany({ where: { projectId } });

  await tx.project.update({
    where: { id: projectId },
    data: {
      title: snapshot.project.title,
      description: snapshot.project.description,
      genre: snapshot.project.genre,
      premise: snapshot.project.premise,
      stage: snapshot.project.stage as 'IDEA' | 'STORY' | 'ADAPTATION' | 'STORYBOARD' | 'RENDER',
    },
  });

  if (snapshot.ideaSeeds.length > 0) {
    await tx.ideaSeed.createMany({
      data: snapshot.ideaSeeds.map((item) => ({
        id: item.id,
        projectId,
        input: item.input,
        styleNotes: item.styleNotes,
        createdAt: new Date(item.createdAt),
      })),
    });
  }

  if (snapshot.chapters.length > 0) {
    await tx.chapter.createMany({
      data: snapshot.chapters.map((item) => ({
        id: item.id,
        projectId,
        title: item.title,
        orderIndex: item.orderIndex,
        content: item.content,
        createdAt: new Date(item.createdAt),
      })),
    });
  }

  if (snapshot.scenes.length > 0) {
    await tx.scene.createMany({
      data: snapshot.scenes.map((item) => ({
        id: item.id,
        projectId,
        chapterId: item.chapterId,
        title: item.title,
        summary: item.summary,
        orderIndex: item.orderIndex,
        createdAt: new Date(item.createdAt),
      })),
    });
  }

  if (snapshot.shots.length > 0) {
    await tx.shot.createMany({
      data: snapshot.shots.map((item) => ({
        id: item.id,
        projectId,
        sceneId: item.sceneId,
        title: item.title,
        prompt: item.prompt,
        cameraNotes: item.cameraNotes,
        orderIndex: item.orderIndex,
        createdAt: new Date(item.createdAt),
      })),
    });
  }

  if (snapshot.references.length > 0) {
    await tx.referenceAsset.createMany({
      data: snapshot.references.map((item) => ({
        id: item.id,
        projectId,
        type: item.type,
        sourceUrl: item.sourceUrl,
        localPath: item.localPath,
        notes: item.notes,
        createdAt: new Date(item.createdAt),
      })),
    });
  }

  if (snapshot.renderJobs.length > 0) {
    await tx.renderJob.createMany({
      data: snapshot.renderJobs.map((item) => ({
        id: item.id,
        projectId,
        status: item.status,
        provider: item.provider,
        outputUrl: item.outputUrl,
        createdAt: new Date(item.createdAt),
      })),
    });
  }

  const outlineTitles = Array.from(new Set([
    ...currentProject.outlines
      .filter((item) => !item.title.startsWith(PROJECT_SNAPSHOT_TITLE_PREFIX))
      .map((item) => item.title),
    ...snapshot.outlines.map((item) => item.title),
  ]));

  await replaceOutlines(tx, projectId, snapshot.outlines, outlineTitles);
}

async function restoreStorySnapshot(tx: Prisma.TransactionClient, projectId: string, snapshot: ProjectSnapshotSummary) {
  await tx.ideaSeed.deleteMany({ where: { projectId } });
  await tx.chapter.deleteMany({ where: { projectId } });

  await tx.project.update({
    where: { id: projectId },
    data: {
      title: snapshot.project.title,
      description: snapshot.project.description,
      genre: snapshot.project.genre,
      premise: snapshot.project.premise,
      stage: snapshot.project.stage as 'IDEA' | 'STORY' | 'ADAPTATION' | 'STORYBOARD' | 'RENDER',
    },
  });

  if (snapshot.ideaSeeds.length > 0) {
    await tx.ideaSeed.createMany({
      data: snapshot.ideaSeeds.map((item) => ({
        id: item.id,
        projectId,
        input: item.input,
        styleNotes: item.styleNotes,
        createdAt: new Date(item.createdAt),
      })),
    });
  }

  if (snapshot.chapters.length > 0) {
    await tx.chapter.createMany({
      data: snapshot.chapters.map((item) => ({
        id: item.id,
        projectId,
        title: item.title,
        orderIndex: item.orderIndex,
        content: item.content,
        createdAt: new Date(item.createdAt),
      })),
    });
  }

  await replaceOutlines(
    tx,
    projectId,
    getSnapshotOutlinesByTitles(snapshot, STORY_OUTLINE_TITLES),
    STORY_OUTLINE_TITLES,
  );
}

async function restoreCharacterSnapshot(tx: Prisma.TransactionClient, projectId: string, snapshot: ProjectSnapshotSummary) {
  await replaceOutlines(
    tx,
    projectId,
    getSnapshotOutlinesByTitles(snapshot, CHARACTER_OUTLINE_TITLES),
    CHARACTER_OUTLINE_TITLES,
  );
}

async function restoreVisualSnapshot(tx: Prisma.TransactionClient, projectId: string, snapshot: ProjectSnapshotSummary) {
  await replaceOutlines(
    tx,
    projectId,
    getSnapshotOutlinesByTitles(snapshot, VISUAL_OUTLINE_TITLES),
    VISUAL_OUTLINE_TITLES,
  );
}

async function restoreTimelineSnapshot(tx: Prisma.TransactionClient, projectId: string, snapshot: ProjectSnapshotSummary) {
  await replaceOutlines(
    tx,
    projectId,
    getSnapshotOutlinesByTitles(snapshot, TIMELINE_OUTLINE_TITLES),
    TIMELINE_OUTLINE_TITLES,
  );
}

async function restoreSnapshotRecords(
  projectId: string,
  snapshot: ProjectSnapshotSummary,
  currentProject: SnapshotSourceProject,
  scope: ProjectSnapshotRestoreScope = 'full',
) {
  await prisma.$transaction(async (tx) => {
    if (scope === 'story') {
      await restoreStorySnapshot(tx, projectId, snapshot);
      return;
    }

    if (scope === 'characters') {
      await restoreCharacterSnapshot(tx, projectId, snapshot);
      return;
    }

    if (scope === 'visual') {
      await restoreVisualSnapshot(tx, projectId, snapshot);
      return;
    }

    if (scope === 'timeline') {
      await restoreTimelineSnapshot(tx, projectId, snapshot);
      return;
    }

    await restoreFullSnapshot(tx, projectId, snapshot, currentProject);
  });
}

export async function restoreProjectSnapshot(
  projectId: string,
  snapshotId: string,
  scope: ProjectSnapshotRestoreScope = 'full',
) {
  if (!isRestoreScope(scope)) throw new Error('不支持的恢复范围');

  const project = await getProjectSnapshotSource(projectId);
  if (!project) throw new Error('项目不存在');

  const targetOutline = project.outlines.find((outline) => outline.id === snapshotId && outline.title.startsWith(PROJECT_SNAPSHOT_TITLE_PREFIX));
  if (!targetOutline) throw new Error('指定快照不存在');

  const targetSnapshot = parseProjectSnapshot(targetOutline.summary, {
    id: targetOutline.id,
    title: targetOutline.title,
    createdAt: targetOutline.createdAt,
  });

  if (!targetSnapshot) throw new Error('快照内容损坏，无法恢复');
  if (targetSnapshot.projectId !== projectId) throw new Error('快照不属于当前项目');

  const backupLabel = `恢复前自动备份（${getRestoreScopeLabel(scope)}） ${formatSnapshotLabel()}`;
  const backupSnapshot = await createProjectSnapshot(projectId, backupLabel);
  await restoreSnapshotRecords(projectId, targetSnapshot, project, scope);

  return {
    scope,
    scopeLabel: getRestoreScopeLabel(scope),
    restored: targetSnapshot,
    backup: backupSnapshot,
    workspace: await getProjectSnapshotWorkspace(projectId),
  };
}
