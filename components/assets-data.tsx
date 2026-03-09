import Link from 'next/link';
import { getAssetBundle, getLatestAssetProject } from '@/features/assets/service';

function typeLabel(type: string) {
  if (type === 'character') return '角色资产';
  if (type === 'style') return '风格资产';
  if (type === 'scene') return '场景资产';
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
  const grouped = {
    character: assets.filter((item) => item.type === 'character'),
    style: assets.filter((item) => item.type === 'style'),
    scene: assets.filter((item) => item.type === 'scene'),
    reference: assets.filter((item) => item.type === 'reference'),
  };

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">资产中心</p>
        <h3>{project.title}</h3>
        <p>{project.premise || '暂无故事前提'}</p>
        <div className="meta-list">
          <span>资产总数：{assets.length}</span>
          <span>角色资产：{grouped.character.length}</span>
          <span>风格资产：{grouped.style.length}</span>
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
          <h4>资产中心 v0</h4>
          <p>当前版本先把角色草案、视觉圣经、分场摘要和参考分析统一整理成可浏览资产卡，作为后续资产生产链的起点。</p>
        </div>
        <div className="asset-tile">
          <span className="label">当前用途</span>
          <h4>先做资产聚合</h4>
          <p>让角色、风格、场景与参考不再分散在不同页面，而是先进入同一个资产入口，便于后续继续做关联和复用。</p>
        </div>
        <div className="asset-tile">
          <span className="label">后续方向</span>
          <h4>下一步继续补强</h4>
          <p>后面会继续加资产关联、手动录入、来源管理、参考图挂接和渲染复用能力。</p>
        </div>
      </div>

      <div className="asset-grid">
        {assets.length === 0 ? (
          <div className="asset-tile">
            <span className="label">empty</span>
            <h4>还没有可用资产</h4>
            <p>先生成角色、视觉圣经或参考分析，这里会自动聚合成第一批资产卡。</p>
          </div>
        ) : (
          assets.map((asset) => (
            <div key={asset.id} className="asset-tile scene-tile">
              <span className="label">{typeLabel(asset.type)}</span>
              <h4>{asset.title}</h4>
              <p>{asset.summary}</p>
              <div className="tag-list">
                {asset.tags.map((tag) => (
                  <span key={`${asset.id}-${tag}`} className="tag-chip">{tag}</span>
                ))}
              </div>
              <div className="meta-list">
                <span>来源：{asset.source}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
