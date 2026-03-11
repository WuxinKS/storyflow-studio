import { prisma } from '@/lib/prisma';
import { getShotKindFromTitle, ALLOWED_SHOT_TITLES } from '@/lib/shot-taxonomy';
import { parseCharacterDrafts } from '@/features/characters/service';
import { getGeneratedMediaEntries, summarizeGeneratedMediaCounts } from '@/features/media/service';
import { parseVisualBibleDraft } from '@/features/visual/service';
import { exportProductionBundle, exportProviderPayloads, exportRenderPresets } from '@/features/render/service';
import { buildReferenceBindingSnapshot } from '@/features/reference/service';
import { getSyncStatus } from '@/features/sync/service';
import { getLatestOutlineByTitle } from '@/lib/outline-store';

const TARGET_SCENE_COUNT = 5;
const TARGET_SHOT_COUNT = 20;
const TARGET_SHOT_COUNT_PER_SCENE = 4;

export type QaCheck = {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
  group: 'structure' | 'content' | 'sync' | 'render' | 'export';
  severity: 'blocker' | 'warning' | 'info';
  blocksDelivery: boolean;
};

export async function getQaProject(projectId?: string) {
  return projectId
    ? prisma.project.findUnique({
        where: { id: projectId },
        include: {
          scenes: { orderBy: { orderIndex: 'asc' } },
          shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
          references: { orderBy: { createdAt: 'desc' } },
          outlines: { orderBy: { createdAt: 'desc' } },
          renderJobs: { orderBy: { createdAt: 'desc' } },
        },
      })
    : prisma.project.findFirst({
        orderBy: { updatedAt: 'desc' },
        include: {
          scenes: { orderBy: { orderIndex: 'asc' } },
          shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
          references: { orderBy: { createdAt: 'desc' } },
          outlines: { orderBy: { createdAt: 'desc' } },
          renderJobs: { orderBy: { createdAt: 'desc' } },
        },
      });
}

function isCleanCharacterName(name: string) {
  if (!name.trim()) return false;
  if (/叫.+的|关键对手|关系人物|角色/.test(name)) return false;
  return true;
}

function hasReferenceFlavor(text: string | null) {
  if (!text) return false;
  return text.includes('参考构图') || text.includes('情绪参考') || text.includes('动作节奏参考');
}

function getMaturityLevel(input: { blockers: number; failed: number }) {
  if (input.blockers === 0 && input.failed === 0) return '可交付';
  if (input.blockers === 0) return '内测可用';
  return '草稿可用';
}

export async function getQaReport(projectId?: string, options?: { bundleExport?: Awaited<ReturnType<typeof exportProductionBundle>> | null }) {
  const project = await getQaProject(projectId);
  if (!project) return null;

  const visualOutline = getLatestOutlineByTitle(project.outlines, 'Visual Bible');
  const characterOutline = getLatestOutlineByTitle(project.outlines, 'Character Drafts');
  const visualBible = visualOutline ? parseVisualBibleDraft(visualOutline.summary) : null;
  const characters = characterOutline ? parseCharacterDrafts(characterOutline.summary) : [];
  const syncStatus = await getSyncStatus(project.id).catch(() => null);
  const generatedMedia = getGeneratedMediaEntries(project);
  const mediaCounts = summarizeGeneratedMediaCounts(generatedMedia);

  const shotKinds = project.shots.map((shot) => getShotKindFromTitle(shot.title));
  const invalidShotKinds = shotKinds.filter((kind) => !ALLOWED_SHOT_TITLES.includes(kind));
  const shotsByScene = project.scenes.map((scene) => ({
    sceneTitle: scene.title,
    count: project.shots.filter((shot) => shot.sceneId === scene.id).length,
  }));

  const exportChecks = await Promise.all([
    exportRenderPresets(project.id)
      .then((data) => ({ ok: true as const, data }))
      .catch((error) => ({ ok: false as const, error: error instanceof Error ? error.message : 'Unknown error' })),
    exportProviderPayloads(project.id)
      .then((data) => ({ ok: true as const, data }))
      .catch((error) => ({ ok: false as const, error: error instanceof Error ? error.message : 'Unknown error' })),
    (options?.bundleExport
      ? Promise.resolve({ ok: true as const, data: options.bundleExport })
      : exportProductionBundle(project.id)
          .then((data) => ({ ok: true as const, data }))
          .catch((error) => ({ ok: false as const, error: error instanceof Error ? error.message : 'Unknown error' }))),
  ]);

  const [presetExport, providerExport, bundleExport] = exportChecks;
  const failedRenderJobs = project.renderJobs.filter((job) => job.status === 'failed');
  const doneRenderJobs = project.renderJobs.filter((job) => job.status === 'done');
  const staleLabels = syncStatus?.staleChecks || [];
  const referenceCount = project.references.length;
  const flavoredShots = project.shots.filter((shot) => hasReferenceFlavor(shot.prompt)).length;
  const exportedReferenceCount = providerExport.ok ? providerExport.data.referenceProfile.total : 0;
  const referenceBindings = buildReferenceBindingSnapshot(project);

  const checks: QaCheck[] = [
    {
      key: 'scene-count',
      label: '分场数量固定为 5 场',
      passed: project.scenes.length === TARGET_SCENE_COUNT,
      detail: `当前 ${project.scenes.length} 场，目标 ${TARGET_SCENE_COUNT} 场。`,
      group: 'structure',
      severity: 'blocker',
      blocksDelivery: true,
    },
    {
      key: 'shot-count',
      label: '镜头总数固定为 20 镜头',
      passed: project.shots.length === TARGET_SHOT_COUNT,
      detail: `当前 ${project.shots.length} 镜头，目标 ${TARGET_SHOT_COUNT} 镜头。`,
      group: 'structure',
      severity: 'blocker',
      blocksDelivery: true,
    },
    {
      key: 'shot-count-per-scene',
      label: '每场固定为 4 镜头',
      passed: shotsByScene.every((item) => item.count === TARGET_SHOT_COUNT_PER_SCENE),
      detail: shotsByScene.map((item) => `${item.sceneTitle}:${item.count}`).join(' / ') || '暂无场次数据',
      group: 'structure',
      severity: 'warning',
      blocksDelivery: false,
    },
    {
      key: 'shot-taxonomy',
      label: '镜头类型已收敛到正式分类',
      passed: invalidShotKinds.length === 0,
      detail: invalidShotKinds.length === 0
        ? `当前类型：${Array.from(new Set(shotKinds)).join(' / ') || '暂无镜头类型'}`
        : `存在异常类型：${invalidShotKinds.join(' / ')}`,
      group: 'content',
      severity: 'warning',
      blocksDelivery: false,
    },
    {
      key: 'characters',
      label: '角色名称干净可用',
      passed: characters.length > 0 && characters.every((item) => isCleanCharacterName(item.name)),
      detail: characters.length > 0
        ? characters.map((item) => item.name).join(' / ')
        : '暂无角色草案',
      group: 'content',
      severity: 'warning',
      blocksDelivery: false,
    },
    {
      key: 'visual-bible',
      label: '视觉圣经已生成',
      passed: Boolean(visualBible?.styleName && visualBible.palette && visualBible.motionLanguage),
      detail: visualBible
        ? `${visualBible.styleName} / ${visualBible.palette} / ${visualBible.motionLanguage}`
        : '暂无视觉圣经',
      group: 'content',
      severity: 'warning',
      blocksDelivery: false,
    },
    {
      key: 'reference-injection',
      label: '参考素材已注入改编与生成链',
      passed: referenceCount === 0 || (flavoredShots > 0 && exportedReferenceCount >= referenceCount),
      detail: referenceCount === 0
        ? '当前没有参考素材，允许跳过。'
        : `参考 ${referenceCount} 条 / 参考增强镜头 ${flavoredShots} 条 / 载荷参考画像 ${exportedReferenceCount} 条。`,
      group: 'content',
      severity: referenceCount > 0 ? 'warning' : 'info',
      blocksDelivery: false,
    },
    {
      key: 'reference-bindings',
      label: '参考素材已有精确定向绑定',
      passed: referenceCount === 0 || referenceBindings.effectiveShotBindingCount > 0,
      detail: referenceCount === 0
        ? '当前没有参考素材，允许跳过。'
        : `参考 ${referenceCount} 条 / 分场直绑 ${referenceBindings.sceneBindingCount} / 镜头直绑 ${referenceBindings.shotBindingCount} / 生效镜头 ${referenceBindings.effectiveShotBindingCount}。`,
      group: 'content',
      severity: referenceCount > 0 ? 'warning' : 'info',
      blocksDelivery: false,
    },
    {
      key: 'sync-stale',
      label: '上下游链路没有过期',
      passed: staleLabels.length === 0,
      detail: staleLabels.join(' / ') || '当前没有发现明显链路过期。',
      group: 'sync',
      severity: staleLabels.length > 0 ? 'blocker' : 'info',
      blocksDelivery: staleLabels.length > 0,
    },
    {
      key: 'render-jobs',
      label: '渲染任务链已存在且无失败任务',
      passed: project.renderJobs.length > 0 && failedRenderJobs.length === 0,
      detail: project.renderJobs.length > 0
        ? project.renderJobs.map((job) => `${job.provider}:${job.status}`).join(' / ')
        : '还没有渲染任务',
      group: 'render',
      severity: project.renderJobs.length === 0 ? 'blocker' : 'warning',
      blocksDelivery: project.renderJobs.length === 0,
    },
    {
      key: 'render-completed',
      label: '至少一类渲染任务已完成',
      passed: doneRenderJobs.length > 0,
      detail: doneRenderJobs.length > 0
        ? doneRenderJobs.map((job) => `${job.provider}:done`).join(' / ')
        : '当前还没有完成的渲染任务。',
      group: 'render',
      severity: 'blocker',
      blocksDelivery: true,
    },
    {
      key: 'generated-media-index',
      label: '生成产物已沉淀到媒体索引',
      passed: doneRenderJobs.length > 0 && mediaCounts.total > 0,
      detail: mediaCounts.total > 0
        ? `图片:${mediaCounts.images} / 音频:${mediaCounts.audio} / 视频:${mediaCounts.videos}`
        : '当前媒体索引还没有生成产物。',
      group: 'render',
      severity: doneRenderJobs.length > 0 ? 'blocker' : 'warning',
      blocksDelivery: doneRenderJobs.length > 0,
    },
    {
      key: 'final-video',
      label: '至少已有一条视频产物',
      passed: mediaCounts.videos > 0,
      detail: mediaCounts.videos > 0
        ? `当前已有 ${mediaCounts.videos} 条视频产物。`
        : '当前还没有沉淀出视频产物。',
      group: 'render',
      severity: 'warning',
      blocksDelivery: false,
    },
    {
      key: 'export-presets',
      label: 'Render Presets 可成功导出',
      passed: presetExport.ok,
      detail: presetExport.ok
        ? `sceneTitles:${presetExport.data.sceneTitles.length} / presets:${presetExport.data.presets.length}`
        : presetExport.error,
      group: 'export',
      severity: 'warning',
      blocksDelivery: false,
    },
    {
      key: 'export-provider-payloads',
      label: 'Provider Payload 可成功导出',
      passed: providerExport.ok,
      detail: providerExport.ok
        ? `image:${providerExport.data.providers.imageSequence.length} / voice:${providerExport.data.providers.voiceSynthesis.length} / video:${providerExport.data.providers.videoAssembly.length}`
        : providerExport.error,
      group: 'export',
      severity: 'warning',
      blocksDelivery: false,
    },
    {
      key: 'export-production-bundle',
      label: 'Production Bundle 可成功写盘',
      passed: bundleExport.ok,
      detail: bundleExport.ok
        ? `${bundleExport.data.bundleDir} / ${bundleExport.data.zipPath}`
        : bundleExport.error,
      group: 'export',
      severity: 'blocker',
      blocksDelivery: !bundleExport.ok,
    },
  ];

  const failedChecks = checks.filter((item) => !item.passed);
  const blockers = failedChecks.filter((item) => item.blocksDelivery || item.severity === 'blocker');
  const warnings = failedChecks.filter((item) => !item.blocksDelivery && item.severity !== 'blocker');
  const groupedChecks = {
    structure: checks.filter((item) => item.group === 'structure'),
    content: checks.filter((item) => item.group === 'content'),
    sync: checks.filter((item) => item.group === 'sync'),
    render: checks.filter((item) => item.group === 'render'),
    export: checks.filter((item) => item.group === 'export'),
  };

  return {
    projectId: project.id,
    projectTitle: project.title,
    checks,
    groupedChecks,
    summary: {
      passed: checks.filter((item) => item.passed).length,
      total: checks.length,
      failed: failedChecks.length,
      blockerCount: blockers.length,
      warningCount: warnings.length,
      readyToDeliver: blockers.length === 0 && failedChecks.length === 0,
      maturity: getMaturityLevel({ blockers: blockers.length, failed: failedChecks.length }),
      failedLabels: failedChecks.map((item) => item.label),
      blockerLabels: blockers.map((item) => item.label),
      bundleDir: bundleExport.ok ? bundleExport.data.bundleDir : null,
      zipPath: bundleExport.ok ? bundleExport.data.zipPath : null,
    },
  };
}
