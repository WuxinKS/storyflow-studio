import Link from 'next/link';
import { AssetEditor } from '@/components/asset-editor';
import { AssetLibraryBrowser } from '@/components/asset-library-browser';
import { SectionCard } from '@/components/section-card';
import { getAssetBundle, getAssetEditorOptions, getLatestAssetProject } from '@/features/assets/service';
import { buildProjectHref } from '@/lib/project-links';

function getAssetCategoryLabel(count: number) {
  if (count >= 8) return '资产沉淀较完整';
  if (count >= 3) return '资产库正在成型';
  if (count > 0) return '已有初步沉淀';
  return '待录入资产';
}

type AssetsMission = {
  title: string;
  guidance: string;
  actionLabel: string;
  actionHref: string;
  actionMode: 'intake' | 'reference' | 'render' | 'library';
};

function summarizeAssetTitles(
  items: Array<{ title: string }>,
  options?: { limit?: number; fallback?: string },
) {
  const limit = options?.limit ?? 3;
  const fallback = options?.fallback ?? '暂时还没有条目';
  const titles = items.map((item) => item.title).filter(Boolean);
  if (titles.length === 0) return fallback;
  const picked = titles.slice(0, limit);
  return `${picked.join(' / ')}${titles.length > limit ? ` 等 ${titles.length} 条` : ''}`;
}

function getAssetsMission(input: {
  projectId: string;
  totalAssets: number;
  manualCount: number;
  referenceCount: number;
  generatedTotal: number;
  baseAssetCount: number;
  linkedAssets: number;
  shotCount: number;
}): AssetsMission {
  if (input.totalAssets === 0 || input.manualCount === 0) {
    return {
      title: input.totalAssets === 0 ? '先录入第一批关键资产' : '补第一条手动资产，让资产库开始可控',
      guidance: '先把角色、场景、道具或风格板中的关键设定手动记下来，后面自动生成的图片和视频才有稳定的复用锚点。',
      actionLabel: '打开资产录入台',
      actionHref: buildProjectHref('/assets#asset-intake', input.projectId),
      actionMode: 'intake',
    };
  }

  if (input.referenceCount === 0 && input.baseAssetCount > 0) {
    return {
      title: '补参考输入，让后续分镜和生成更稳定',
      guidance: '基础世界资产已经有了，但还缺真实参考约束。先补 1-3 条关键参考，再继续往生成链推进会更稳。',
      actionLabel: '去参考实验室补参考',
      actionHref: buildProjectHref('/reference-lab#reference-intake', input.projectId),
      actionMode: 'reference',
    };
  }

  if (input.generatedTotal === 0 && input.shotCount > 0) {
    return {
      title: '回生成工作台产出第一批图片或视频',
      guidance: '镜头已经准备好，下一步不是继续堆素材，而是先跑出第一批生成结果，让资产库开始真正回流媒体产物。',
      actionLabel: '去生成工作台继续推进',
      actionHref: buildProjectHref('/render-studio', input.projectId),
      actionMode: 'render',
    };
  }

  if (input.linkedAssets < Math.max(2, Math.ceil(input.totalAssets / 3))) {
    return {
      title: '先检查资产是否都挂上了来源与关联',
      guidance: '现在已经有不少资产，但可追溯关联还不够。先快速检查资产库，确保关键资产都能追到角色、场景或镜头。',
      actionLabel: '查看资产库重点条目',
      actionHref: buildProjectHref('/assets#asset-library', input.projectId),
      actionMode: 'library',
    };
  }

  return {
    title: '资产链已经跑起来，继续扩大可复用沉淀',
    guidance: '当前更适合回到生成工作台继续产出，或在资产库里挑关键条目做复查，不需要同时处理所有素材。',
    actionLabel: '继续回生成工作台',
    actionHref: buildProjectHref('/render-studio', input.projectId),
    actionMode: 'render',
  };
}

export async function AssetsData({ projectId }: { projectId?: string }) {
  const project = await getLatestAssetProject(projectId).catch(() => null);

  if (!project) {
    return (
      <div className="asset-tile">
        <span className="label">空状态</span>
        <h4>暂无项目</h4>
        <p>先创建项目，再来整理角色、风格、场景、参考资产和生成产物。</p>
      </div>
    );
  }

  const assets = getAssetBundle(project);
  const options = getAssetEditorOptions(project);
  const grouped = {
    character: assets.filter((item) => item.type === 'character'),
    styleBoard: assets.filter((item) => item.type === 'style-board'),
    scene: assets.filter((item) => item.type === 'scene'),
    prop: assets.filter((item) => item.type === 'prop'),
    reference: assets.filter((item) => item.type === 'reference-image'),
    generatedImage: assets.filter((item) => item.type === 'generated-image'),
    generatedAudio: assets.filter((item) => item.type === 'generated-audio'),
    generatedVideo: assets.filter((item) => item.type === 'generated-video'),
    manual: assets.filter((item) => item.mode === 'manual'),
  };
  const baseAssetCount = grouped.character.length + grouped.styleBoard.length + grouped.scene.length + grouped.prop.length;
  const generatedTotal = grouped.generatedImage.length + grouped.generatedAudio.length + grouped.generatedVideo.length;
  const previewableAssets = assets.filter((item) => item.previewKind).length;
  const linkedAssets = assets.filter((item) => item.links.length > 0).length;
  const assetReadinessLabel = getAssetCategoryLabel(assets.length);
  const assetMission = getAssetsMission({
    projectId: project.id,
    totalAssets: assets.length,
    manualCount: grouped.manual.length,
    referenceCount: grouped.reference.length,
    generatedTotal,
    baseAssetCount,
    linkedAssets,
    shotCount: project.shots.length,
  });
  const assetSections = [
    {
      key: 'manual',
      eyebrow: 'Manual',
      title: '手动资产库',
      description: '导演或美术手动补录的资产，会优先作为项目里的自定义世界设定。',
      items: grouped.manual,
    },
    {
      key: 'world',
      eyebrow: 'World',
      title: '角色 / 风格 / 场景 / 道具',
      description: '这些是项目的基础世界资产，负责稳定人物、视觉和空间认知。',
      items: [...grouped.character, ...grouped.styleBoard, ...grouped.scene, ...grouped.prop],
    },
    {
      key: 'reference',
      eyebrow: 'Reference',
      title: '参考资产',
      description: '输入参考会继续反哺改编、分镜、图片生成和视频生成。',
      items: grouped.reference,
    },
    {
      key: 'generated',
      eyebrow: 'Generated',
      title: '生成产物库',
      description: '所有生成出来的图片、音频和视频都会回流到这里，形成复用闭环。',
      items: [...grouped.generatedImage, ...grouped.generatedAudio, ...grouped.generatedVideo],
    },
  ].filter((section) => section.items.length > 0);
  const previewSections = assetSections.slice(0, 3);
  const hiddenSectionCount = Math.max(0, assetSections.length - previewSections.length);
  const showIntakeAsPrimary = assetMission.actionMode === 'intake';

  return (
    <div className="page-stack">
      <div className="library-command-grid">
        <section className="snapshot-card library-command-card">
          <div className="library-panel-head">
            <div>
              <p className="eyebrow">Asset Command</p>
              <h3>{project.title}</h3>
            </div>
            <span className="status-pill status-pill-subtle">{assetReadinessLabel}</span>
          </div>

          <p>
            这页现在先帮我们判断资产链缺哪一环：是补第一条关键资产、补参考约束，
            还是直接回生成工作台继续让图片 / 音频 / 视频回流进库。
          </p>

          <div className="meta-list">
            <span>资产总数 {assets.length}</span>
            <span>手动录入 {grouped.manual.length}</span>
            <span>基础资产 {baseAssetCount}</span>
            <span>参考资产 {grouped.reference.length}</span>
            <span>生成产物 {generatedTotal}</span>
          </div>

          <div className="asset-tile assets-focus-card">
            <span className="label">当前主任务</span>
            <h4>{assetMission.title}</h4>
            <p>{assetMission.guidance}</p>
            <div className="action-row wrap-row">
              <a href={assetMission.actionHref} className="button-primary">{assetMission.actionLabel}</a>
            </div>
            <details className="workflow-disclosure">
              <summary>需要时打开其他入口</summary>
              <div className="workflow-disclosure-body">
                <div className="action-row wrap-row">
                  <Link href={buildProjectHref('/character-studio', project.id)} className="button-ghost">查看角色工作台</Link>
                  <Link href={buildProjectHref('/visual-bible', project.id)} className="button-secondary">查看视觉圣经</Link>
                  <Link href={buildProjectHref('/render-studio', project.id)} className="button-secondary">查看生成工作台</Link>
                </div>
              </div>
            </details>
          </div>
        </section>

        <aside className="library-command-side">
          <div className="library-kpi-grid">
            <div className="asset-tile library-kpi-card">
              <span className="label">生成沉淀</span>
              <h4>{generatedTotal}</h4>
              <p>图片 {grouped.generatedImage.length} / 音频 {grouped.generatedAudio.length} / 视频 {grouped.generatedVideo.length}</p>
            </div>

            <div className="asset-tile library-kpi-card">
              <span className="label">可预览素材</span>
              <h4>{previewableAssets}</h4>
              <p>{previewableAssets} 个资产条目已可直接打开媒体预览。</p>
            </div>

            <div className="asset-tile library-kpi-card">
              <span className="label">可追溯关联</span>
              <h4>{linkedAssets}</h4>
              <p>{linkedAssets} 个资产已经挂接角色、场景、镜头或文件来源。</p>
            </div>

            <div className="asset-tile library-kpi-card">
              <span className="label">手动资产</span>
              <h4>{grouped.manual.length}</h4>
              <p>手动录入资产会与自动聚合的生成结果一起进入可复用资产库。</p>
            </div>
          </div>
        </aside>
      </div>

      <SectionCard
        eyebrow="Action"
        title="默认只打开当前最需要的资产动作"
        description="如果当前重点不是手动补录，录入台会先折叠起来，避免和资产检视同时抢注意力。"
      >
        {showIntakeAsPrimary ? (
          <div id="asset-intake" className="page-stack">
            <div className="asset-tile library-highlight-card">
              <span className="label">录入建议</span>
              <h4>先从最关键的设定开始</h4>
              <p>优先录角色、场景、风格或核心道具中的 1-3 条，不用一次把整座资产库补满。</p>
            </div>
            <AssetEditor projectId={project.id} options={options} />
          </div>
        ) : (
          <div id="asset-intake" className="library-health-grid">
            <div className="asset-tile library-highlight-card">
              <span className="label">手动资产</span>
              <h4>{grouped.manual.length === 0 ? '待补第一条' : `${grouped.manual.length} 条已录入`}</h4>
              <p>{summarizeAssetTitles(grouped.manual, { fallback: '还没有手动资产，建议先补 1 条关键设定。' })}</p>
            </div>

            <div className="asset-tile library-highlight-card">
              <span className="label">输入参考</span>
              <h4>{grouped.reference.length === 0 ? '待补参考' : `${grouped.reference.length} 条已接入`}</h4>
              <p>{summarizeAssetTitles(grouped.reference, { fallback: '还没有参考素材，后续生成容易缺少稳定约束。' })}</p>
            </div>

            <div className="asset-tile library-highlight-card">
              <span className="label">生成回流</span>
              <h4>{generatedTotal === 0 ? '待产出首批媒体' : `${generatedTotal} 条已回流`}</h4>
              <p>{summarizeAssetTitles([...grouped.generatedImage, ...grouped.generatedAudio, ...grouped.generatedVideo], { fallback: '还没有生成产物回到资产层。' })}</p>
            </div>
          </div>
        )}

        {!showIntakeAsPrimary ? (
          <details className="workflow-disclosure">
            <summary>需要时打开手动资产录入</summary>
            <div className="workflow-disclosure-body">
              <AssetEditor projectId={project.id} options={options} />
            </div>
          </details>
        ) : null}
      </SectionCard>

      <SectionCard
        eyebrow="Coverage"
        title="资产覆盖概览"
        description="先看世界设定、参考输入和生成回流三层是否齐了，再决定继续补录还是回主链推进。"
      >
        <div className="library-health-grid">
          <div className="asset-tile library-highlight-card">
            <span className="label">角色与风格</span>
            <h4>基础资产</h4>
            <p>角色 {grouped.character.length} / 风格板 {grouped.styleBoard.length} / 场景 {grouped.scene.length} / 道具 {grouped.prop.length}</p>
          </div>

          <div className="asset-tile library-highlight-card">
            <span className="label">输入参考</span>
            <h4>参考素材</h4>
            <p>参考图与样片分析共 {grouped.reference.length} 条，可继续影响改编、分镜和视觉控制。</p>
          </div>

          <div className="asset-tile library-highlight-card">
            <span className="label">输出沉淀</span>
            <h4>生成结果资产</h4>
            <p>图片、音频、视频会回写到这里，形成真正可追溯的媒体资产库。</p>
          </div>
        </div>
      </SectionCard>

      {assetSections.length === 0 ? (
        <div className="asset-tile">
          <span className="label">空状态</span>
          <h4>还没有可用资产</h4>
          <p>先生成角色、视觉圣经或参考分析，或直接手动录入第一批资产。</p>
        </div>
      ) : (
        <SectionCard
          eyebrow="Preview"
          title="默认先看关键资产，不默认展开全库"
          description="上面先看每个资产层的代表条目；需要搜索、筛选或检查全量素材时，再打开完整资产库。"
        >
          <div id="asset-library" className="library-health-grid">
            {previewSections.map((section) => (
              <div key={section.key} className="asset-tile library-highlight-card">
                <span className="label">{section.eyebrow}</span>
                <h4>{section.title}</h4>
                <p>{section.items.length} 条 · {summarizeAssetTitles(section.items)}</p>
              </div>
            ))}

            {hiddenSectionCount > 0 ? (
              <div className="asset-tile library-highlight-card">
                <span className="label">更多分组</span>
                <h4>还有 {hiddenSectionCount} 组未展开</h4>
                <p>完整资产库里还能继续查看其余分组、做搜索和按来源筛选。</p>
              </div>
            ) : null}
          </div>

          <details className="workflow-disclosure">
            <summary>需要时打开完整资产库</summary>
            <div className="workflow-disclosure-body">
              <AssetLibraryBrowser sections={assetSections} />
            </div>
          </details>
        </SectionCard>
      )}
    </div>
  );
}
