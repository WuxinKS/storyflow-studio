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
  const generatedTotal = grouped.generatedImage.length + grouped.generatedAudio.length + grouped.generatedVideo.length;
  const previewableAssets = assets.filter((item) => item.previewKind).length;
  const linkedAssets = assets.filter((item) => item.links.length > 0).length;
  const assetReadinessLabel = getAssetCategoryLabel(assets.length);
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
            资产中心现在不只是一个素材列表，而是把角色、风格、参考和生成产物放到同一条素材链里，
            让我们能清楚地看到哪些输入已经稳定，哪些输出已经可复用。
          </p>

          <div className="meta-list">
            <span>资产总数 {assets.length}</span>
            <span>手动录入 {grouped.manual.length}</span>
            <span>基础资产 {grouped.character.length + grouped.styleBoard.length + grouped.scene.length + grouped.prop.length}</span>
            <span>参考资产 {grouped.reference.length}</span>
            <span>生成产物 {generatedTotal}</span>
          </div>

          <div className="action-row wrap-row">
            <Link href={buildProjectHref('/character-studio', project.id)} className="button-ghost">查看角色工作台</Link>
            <Link href={buildProjectHref('/visual-bible', project.id)} className="button-secondary">查看视觉圣经</Link>
            <Link href={buildProjectHref('/render-studio', project.id)} className="button-secondary">查看生成工作台</Link>
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
        eyebrow="Intake"
        title="资产录入台"
        description="手动补充角色、场景、道具、风格板和参考资产，让它们也能进入后续生成与交付链。"
      >
        <AssetEditor projectId={project.id} options={options} />
      </SectionCard>

      <SectionCard
        eyebrow="Coverage"
        title="资产覆盖概览"
        description="先看项目里哪些是基础世界资产，哪些是输入参考，哪些已经是生成产物。"
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
        <AssetLibraryBrowser sections={assetSections} />
      )}
    </div>
  );
}
