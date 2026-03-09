import Link from 'next/link';
import { AssetEditor } from '@/components/asset-editor';
import { getAssetBundle, getAssetEditorOptions, getLatestAssetProject } from '@/features/assets/service';

function typeLabel(type: string) {
  if (type === 'character') return '角色资产';
  if (type === 'scene') return '场景资产';
  if (type === 'prop') return '道具资产';
  if (type === 'style-board') return '风格资产';
  return '参考资产';
}

export async function AssetsData() {
  const project = await getLatestAssetProject().catch(() => null);

  if (!project) {
    return (
      <div className="asset-tile">
        <span className="label">empty</span>
        <h4>暂无项目</h4>
        <p>先创建项目，再来整理角色、风格、场景和参考资产。</p>
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
    manual: assets.filter((item) => item.mode === 'manual'),
  };

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
          <span>风格资产：{grouped.styleBoard.length}</span>
          <span>参考资产：{grouped.reference.length}</span>
        </div>
        <div className="action-row">
          <Link href="/character-studio" className="button-ghost">查看角色工作台</Link>
          <Link href="/visual-bible" className="button-secondary">查看视觉圣经</Link>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">当前说明</span>
          <h4>资产中心 v1</h4>
          <p>当前版本已不只是自动聚合，还支持手动补录资产，并把资产类型细分到角色、场景、道具、风格板和参考图。</p>
        </div>
        <div className="asset-tile">
          <span className="label">当前用途</span>
          <h4>可录入、可关联、可复用</h4>
          <p>手动资产可以直接关联到项目里的场景、镜头或角色，后续 Render 与导出链就能读取这些来源信息。</p>
        </div>
        <div className="asset-tile">
          <span className="label">关联概况</span>
          <h4>当前资产分布</h4>
          <p>场景：{grouped.scene.length} / 道具：{grouped.prop.length} / 风格板：{grouped.styleBoard.length} / 参考图：{grouped.reference.length}</p>
        </div>
      </div>

      <AssetEditor projectId={project.id} options={options} />

      <div className="asset-grid">
        {assets.length === 0 ? (
          <div className="asset-tile">
            <span className="label">empty</span>
            <h4>还没有可用资产</h4>
            <p>先生成角色、视觉圣经或参考分析，或直接手动录入第一批资产。</p>
          </div>
        ) : (
          assets.map((asset) => (
            <div key={asset.id} className="asset-tile scene-tile">
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
