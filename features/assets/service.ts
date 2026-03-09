import { prisma } from '@/lib/prisma';
import { getLatestOutlineByTitle, createOutlineVersion } from '@/lib/outline-store';
import { parseCharacterDrafts } from '@/features/characters/service';
import { parseVisualBibleDraft } from '@/features/visual/service';

export type AssetType = 'character' | 'scene' | 'prop' | 'style-board' | 'reference-image';

export type AssetEntry = {
  id: string;
  type: AssetType;
  title: string;
  summary: string;
  tags: string[];
  source: string;
  sceneId?: string;
  shotId?: string;
  characterName?: string;
  createdAt: string;
};

export type AssetCard = {
  id: string;
  type: AssetType;
  title: string;
  summary: string;
  tags: string[];
  source: string;
  links: string[];
  mode: 'auto' | 'manual';
};

function parseReferenceNotes(notes: string | null) {
  if (!notes) return [];
  return notes.split('\n').map((line) => line.trim()).filter(Boolean);
}

function parseAssetLibrary(content: string) {
  if (!content.trim()) return [] as AssetEntry[];

  try {
    const parsed = JSON.parse(content) as { items?: AssetEntry[] } | AssetEntry[];
    const items = Array.isArray(parsed) ? parsed : parsed.items || [];
    return items
      .filter(Boolean)
      .map((item) => ({
        id: String(item.id || '').trim(),
        type: item.type,
        title: String(item.title || '').trim(),
        summary: String(item.summary || '').trim(),
        tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
        source: String(item.source || '').trim() || '手动录入',
        sceneId: item.sceneId ? String(item.sceneId) : undefined,
        shotId: item.shotId ? String(item.shotId) : undefined,
        characterName: item.characterName ? String(item.characterName) : undefined,
        createdAt: String(item.createdAt || new Date().toISOString()),
      }))
      .filter((item) => item.id && item.title && item.summary);
  } catch {
    return [] as AssetEntry[];
  }
}

function serializeAssetLibrary(entries: AssetEntry[]) {
  return JSON.stringify({ version: 1, items: entries }, null, 2);
}

function buildAssetLinks(input: { sceneTitle?: string; shotTitle?: string; characterName?: string }) {
  return [
    input.sceneTitle ? `场景：${input.sceneTitle}` : null,
    input.shotTitle ? `镜头：${input.shotTitle}` : null,
    input.characterName ? `角色：${input.characterName}` : null,
  ].filter(Boolean) as string[];
}

function createEntryId() {
  return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function getLatestAssetProject() {
  return prisma.project.findFirst({
    orderBy: { updatedAt: 'desc' },
    include: {
      outlines: { orderBy: { createdAt: 'desc' } },
      references: { orderBy: { createdAt: 'desc' } },
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
    },
  });
}

export function getManualAssetEntries(project: Awaited<ReturnType<typeof getLatestAssetProject>>) {
  if (!project) return [] as AssetEntry[];
  const outline = getLatestOutlineByTitle(project.outlines, 'Asset Library');
  return parseAssetLibrary(outline?.summary || '');
}

export function getAssetBundle(project: Awaited<ReturnType<typeof getLatestAssetProject>>) {
  if (!project) return [] as AssetCard[];

  const characterOutline = getLatestOutlineByTitle(project.outlines, 'Character Drafts');
  const visualOutline = getLatestOutlineByTitle(project.outlines, 'Visual Bible');
  const characters = characterOutline ? parseCharacterDrafts(characterOutline.summary) : [];
  const visualBible = visualOutline ? parseVisualBibleDraft(visualOutline.summary) : null;
  const manualAssets = getManualAssetEntries(project);
  const sceneTitleMap = new Map(project.scenes.map((scene) => [scene.id, scene.title]));
  const shotTitleMap = new Map(project.shots.map((shot) => [shot.id, shot.title]));

  const characterAssets: AssetCard[] = characters.map((item, index) => ({
    id: `character-${index}-${item.name}`,
    type: 'character',
    title: item.name,
    summary: `${item.archetype}｜目标：${item.goal}｜冲突：${item.conflict}`,
    tags: [item.role, item.voiceStyle, item.visualAnchor].filter(Boolean),
    source: 'Character Drafts',
    links: buildAssetLinks({ characterName: item.name }),
    mode: 'auto',
  }));

  const styleAssets: AssetCard[] = visualBible
    ? [
        {
          id: 'style-visual-bible',
          type: 'style-board',
          title: visualBible.styleName,
          summary: `${visualBible.visualTone}｜色彩：${visualBible.palette}｜光线：${visualBible.lighting}`,
          tags: [visualBible.lensLanguage, visualBible.motionLanguage, visualBible.textureKeywords].filter(Boolean),
          source: 'Visual Bible',
          links: [],
          mode: 'auto',
        },
      ]
    : [];

  const sceneAssets: AssetCard[] = project.scenes.slice(0, 6).map((scene) => ({
    id: `scene-${scene.id}`,
    type: 'scene',
    title: scene.title,
    summary: scene.summary || '暂无场景摘要',
    tags: [`shots:${project.shots.filter((shot) => shot.sceneId === scene.id).length}`],
    source: 'Scenes',
    links: buildAssetLinks({ sceneTitle: scene.title }),
    mode: 'auto',
  }));

  const referenceAssets: AssetCard[] = project.references.map((item, index) => {
    const lines = parseReferenceNotes(item.notes);
    return {
      id: `reference-${item.id}`,
      type: 'reference-image',
      title: lines[0]?.replace(/^标题：/, '') || `参考资产 ${index + 1}`,
      summary: lines.slice(1, 3).join('｜') || '暂无参考摘要',
      tags: [item.type, ...lines.slice(1, 5).map((line) => line.replace(/^[^：]+：/, '').trim())].filter(Boolean),
      source: 'Reference Analysis',
      links: [],
      mode: 'auto',
    };
  });

  const manualCards: AssetCard[] = manualAssets.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    summary: item.summary,
    tags: item.tags,
    source: item.source,
    links: buildAssetLinks({
      sceneTitle: item.sceneId ? sceneTitleMap.get(item.sceneId) : undefined,
      shotTitle: item.shotId ? shotTitleMap.get(item.shotId) : undefined,
      characterName: item.characterName,
    }),
    mode: 'manual',
  }));

  return [...manualCards, ...characterAssets, ...styleAssets, ...sceneAssets, ...referenceAssets];
}

export function getAssetEditorOptions(project: Awaited<ReturnType<typeof getLatestAssetProject>>) {
  if (!project) {
    return {
      scenes: [],
      shots: [],
      characters: [],
    };
  }

  const characterOutline = getLatestOutlineByTitle(project.outlines, 'Character Drafts');
  const characters = characterOutline ? parseCharacterDrafts(characterOutline.summary) : [];

  return {
    scenes: project.scenes.map((scene) => ({ id: scene.id, title: scene.title })),
    shots: project.shots.map((shot) => ({ id: shot.id, title: shot.title })),
    characters: characters.map((character) => character.name),
  };
}

export async function saveManualAssetEntry(projectId: string, asset: Partial<AssetEntry>) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');

  const existingEntries = getManualAssetEntries(project);
  const entry: AssetEntry = {
    id: asset.id || createEntryId(),
    type: (asset.type || 'prop') as AssetType,
    title: String(asset.title || '').trim(),
    summary: String(asset.summary || '').trim(),
    tags: Array.isArray(asset.tags) ? asset.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    source: String(asset.source || '').trim() || '手动录入',
    sceneId: asset.sceneId ? String(asset.sceneId) : undefined,
    shotId: asset.shotId ? String(asset.shotId) : undefined,
    characterName: asset.characterName ? String(asset.characterName) : undefined,
    createdAt: asset.createdAt || new Date().toISOString(),
  };

  if (!entry.title || !entry.summary) {
    throw new Error('资产标题和摘要不能为空');
  }

  const nextEntries = [
    entry,
    ...existingEntries.filter((item) => item.id !== entry.id),
  ];

  await createOutlineVersion(projectId, 'Asset Library', serializeAssetLibrary(nextEntries));

  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      outlines: { orderBy: { createdAt: 'desc' } },
      references: { orderBy: { createdAt: 'desc' } },
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
    },
  });
}
