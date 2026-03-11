import Link from 'next/link';
import { AssetEditor } from '@/components/asset-editor';
import { MediaPreview } from '@/components/media-preview';
import { resolvePreviewSource } from '@/lib/media-preview';
import { getAssetBundle, getAssetEditorOptions, getLatestAssetProject } from '@/features/assets/service';
import { buildProjectHref } from '@/lib/project-links';

function typeLabel(type: string) {
  if (type === 'character') return '角色资产';
  if (type === 'scene') return '场景资产';
  if (type === 'prop') return '道具资产';
  if (type === 'style-board') return '风格资产';
  if (type === 'generated-image') return '生成图片';
  if (type === 'generated-audio') return '生成音频';
  if (type === 'generated-video') return '生成视频';
  return '参考资产';
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

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">资产中心</p>
        <h3>{project.title}</h3>
        <p>{project.premise || '暂无故事前提'}</p>
        <div className="meta-list">
          <span>资产总数：{assets.length}</span>
          <span>手动录入：{grouped.manual.length}</span>
          <span>角色资产：{grouped.character.length}</span>
          <span>参考资产：{grouped.reference.length}</span>
          <span>生成产物：{generatedTotal}</span>
        </div>
        <div className="action-row">
          <Link href={buildProjectHref('/character-studio', project.id)} className="button-ghost">查看角色工作台</Link>
          <Link href={buildProjectHref('/visual-bible', project.id)} className="button-secondary">查看视觉圣经</Link>
          <Link href={buildProjectHref('/render-studio', project.id)} className="button-secondary">查看生成工作台</Link>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">当前说明</span>
          <h4>资产中心 v2</h4>
          <p>当前版本不只聚合角色和参考，还会把渲染阶段沉淀出的图片、音频、视频产物一并纳入资产视图。</p>
        </div>
        <div className="asset-tile">
          <span className="label">当前用途</span>
          <h4>可录入、可关联、可复用</h4>
          <p>手动资产与自动生成产物会一起成为可追溯素材，供 Render、交付和后续再创作继续复用。</p>
        </div>
        <div className="asset-tile">
          <span className="label">产物概况</span>
          <h4>当前生成分布</h4>
          <p>图片：{grouped.generatedImage.length} / 音频：{grouped.generatedAudio.length} / 视频：{grouped.generatedVideo.length}</p>
        </div>
      </div>

      <AssetEditor projectId={project.id} options={options} />

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">角色与风格</span>
          <h4>基础资产</h4>
          <p>角色 {grouped.character.length} / 风格板 {grouped.styleBoard.length} / 场景 {grouped.scene.length}</p>
        </div>
        <div className="asset-tile">
          <span className="label">输入参考</span>
          <h4>参考素材</h4>
          <p>参考图与样片分析共 {grouped.reference.length} 条，可继续影响改编与视觉控制。</p>
        </div>
        <div className="asset-tile">
          <span className="label">输出沉淀</span>
          <h4>生成结果资产</h4>
          <p>当渲染执行完成后，图片、音频、视频会回写到这里，形成真正可追溯的媒体资产库。</p>
        </div>
      </div>

      <div className="asset-grid">
        {assets.length === 0 ? (
          <div className="asset-tile">
            <span className="label">空状态</span>
            <h4>还没有可用资产</h4>
            <p>先生成角色、视觉圣经或参考分析，或直接手动录入第一批资产。</p>
          </div>
        ) : (
          assets.map((asset) => {
            const previewHref = asset.previewKind ? resolvePreviewSource({ kind: asset.previewKind, sourceUrl: asset.sourceUrl, localPath: asset.localPath }) : null;

            return (
              <div key={asset.id} className="asset-tile scene-tile">
                {asset.previewKind ? (
                  <MediaPreview
                    kind={asset.previewKind}
                    title={asset.title}
                    sourceUrl={asset.sourceUrl}
                    localPath={asset.localPath}
                    fallbackLabel={asset.previewKind === 'video' ? '视频资产' : asset.previewKind === 'audio' ? '音频资产' : '图片资产'}
                  />
                ) : null}
                <span className="label">{typeLabel(asset.type)}</span>
                <h4>{asset.title}</h4>
                <p>{asset.summary}</p>
                <div className="tag-list">
                  <span className="tag-chip">{asset.mode === 'manual' ? '手动录入' : '自动聚合'}</span>
                  {asset.tags.map((tag) => (
                    <span key={`${asset.id}-${tag}`} className="tag-chip">{tag}</span>
                  ))}
                </div>
                <div className="meta-list">
                  <span>来源：{asset.source}</span>
                  {asset.links.map((link) => (
                    <span key={`${asset.id}-${link}`}>{link}</span>
                  ))}
                </div>
                {previewHref ? <a className="button-ghost" href={previewHref} target="_blank" rel="noreferrer">打开预览</a> : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
