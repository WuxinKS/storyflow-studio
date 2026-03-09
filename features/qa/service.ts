import { prisma } from '@/lib/prisma';
import { getShotKindFromTitle, ALLOWED_SHOT_TITLES } from '@/lib/shot-taxonomy';
import { parseCharacterDrafts } from '@/features/characters/service';
import { parseVisualBibleDraft } from '@/features/visual/service';
import { exportProductionBundle, exportProviderPayloads, exportRenderPresets } from '@/features/render/service';

const TARGET_SCENE_COUNT = 5;
const TARGET_SHOT_COUNT = 20;
const TARGET_SHOT_COUNT_PER_SCENE = 4;

export type QaCheck = {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
};

export async function getQaProject() {
  return prisma.project.findFirst({
    orderBy: { updatedAt: 'desc' },
    include: {
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
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

export async function getQaReport() {
  const project = await getQaProject();
  if (!project) return null;

  const visualOutline = project.outlines.find((item) => item.title === 'Visual Bible');
  const characterOutline = project.outlines.find((item) => item.title === 'Character Drafts');
  const visualBible = visualOutline ? parseVisualBibleDraft(visualOutline.summary) : null;
  const characters = characterOutline ? parseCharacterDrafts(characterOutline.summary) : [];

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
    exportProductionBundle(project.id)
      .then((data) => ({ ok: true as const, data }))
      .catch((error) => ({ ok: false as const, error: error instanceof Error ? error.message : 'Unknown error' })),
  ]);

  const [presetExport, providerExport, bundleExport] = exportChecks;

  const checks: QaCheck[] = [
    {
      key: 'scene-count',
      label: '分场数量固定为 5 场',
      passed: project.scenes.length === TARGET_SCENE_COUNT,
      detail: `当前 ${project.scenes.length} 场，目标 ${TARGET_SCENE_COUNT} 场。`,
    },
    {
      key: 'shot-count',
      label: '镜头总数固定为 20 镜头',
      passed: project.shots.length === TARGET_SHOT_COUNT,
      detail: `当前 ${project.shots.length} 镜头，目标 ${TARGET_SHOT_COUNT} 镜头。`,
    },
    {
      key: 'shot-count-per-scene',
      label: '每场固定为 4 镜头',
      passed: shotsByScene.every((item) => item.count === TARGET_SHOT_COUNT_PER_SCENE),
      detail: shotsByScene.map((item) => `${item.sceneTitle}:${item.count}`).join(' / ') || '暂无场次数据',
    },
    {
      key: 'shot-taxonomy',
      label: '镜头类型已收敛到正式分类',
      passed: invalidShotKinds.length === 0,
      detail: invalidShotKinds.length === 0
        ? `当前类型：${Array.from(new Set(shotKinds)).join(' / ') || '暂无镜头类型'}`
        : `存在异常类型：${invalidShotKinds.join(' / ')}`,
    },
    {
      key: 'characters',
      label: '角色名称干净可用',
      passed: characters.length > 0 && characters.every((item) => isCleanCharacterName(item.name)),
      detail: characters.length > 0
        ? characters.map((item) => item.name).join(' / ')
        : '暂无角色草案',
    },
    {
      key: 'visual-bible',
      label: '视觉圣经已生成',
      passed: Boolean(visualBible?.styleName && visualBible.palette && visualBible.motionLanguage),
      detail: visualBible
        ? `${visualBible.styleName} / ${visualBible.palette} / ${visualBible.motionLanguage}`
        : '暂无视觉圣经',
    },
    {
      key: 'render-jobs',
      label: '渲染任务链已存在',
      passed: project.renderJobs.length > 0,
      detail: project.renderJobs.length > 0
        ? project.renderJobs.map((job) => `${job.provider}:${job.status}`).join(' / ')
        : '还没有渲染任务',
    },
    {
      key: 'export-presets',
      label: 'Render Presets 可成功导出',
      passed: presetExport.ok,
      detail: presetExport.ok
        ? `sceneTitles:${presetExport.data.sceneTitles.length} / presets:${presetExport.data.presets.length}`
        : presetExport.error,
    },
    {
      key: 'export-provider-payloads',
      label: 'Provider Payload 可成功导出',
      passed: providerExport.ok,
      detail: providerExport.ok
        ? `image:${providerExport.data.providers.imageSequence.length} / voice:${providerExport.data.providers.voiceSynthesis.length} / video:${providerExport.data.providers.videoAssembly.length}`
        : providerExport.error,
    },
    {
      key: 'export-production-bundle',
      label: 'Production Bundle 可成功写盘',
      passed: bundleExport.ok,
      detail: bundleExport.ok
        ? `${bundleExport.data.bundleDir} / ${bundleExport.data.zipPath}`
        : bundleExport.error,
    },
  ];

  return {
    projectId: project.id,
    projectTitle: project.title,
    checks,
    summary: {
      passed: checks.filter((item) => item.passed).length,
      total: checks.length,
      failed: checks.filter((item) => !item.passed).length,
      readyToDeliver: checks.every((item) => item.passed),
      failedLabels: checks.filter((item) => !item.passed).map((item) => item.label),
      bundleDir: bundleExport.ok ? bundleExport.data.bundleDir : null,
      zipPath: bundleExport.ok ? bundleExport.data.zipPath : null,
    },
  };
}
