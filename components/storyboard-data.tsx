import Link from 'next/link';
import { getStoryboardProject } from '@/features/storyboard/service';
import { getShotKindFromTitle } from '@/lib/shot-taxonomy';

function hasReferenceFlavor(text: string | null) {
  if (!text) return false;
  return text.includes('参考构图') || text.includes('情绪参考') || text.includes('动作节奏参考');
}

function hasDirectorLanguage(text: string | null) {
  if (!text) return false;
  return text.includes('导演处理上强调') || text.includes('镜头重点放在');
}

export async function StoryboardData() {
  const project = await getStoryboardProject().catch(() => null);

  if (!project) {
    return (
      <div className="asset-tile">
        <span className="label">empty</span>
        <h4>暂无 storyboard 数据</h4>
        <p>先去 Adaptation Lab 生成 scene / shot，再回来查看镜头板。</p>
      </div>
    );
  }

  const grouped = project.scenes.map((scene) => ({
    scene,
    shots: project.shots.filter((shot) => shot.sceneId === scene.id),
  }));
  const flavoredCount = project.shots.filter((shot) => hasReferenceFlavor(shot.prompt)).length;
  const directorReadyCount = project.scenes.filter((scene) => hasDirectorLanguage(scene.summary)).length;
  const shotKinds = Array.from(new Set(project.shots.map((shot) => getShotKindFromTitle(shot.title))));

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">Storyboard Overview</p>
        <h3>{project.title}</h3>
        <p>当前镜头板已开始承接导演语言增强版 adaptation 输出，可继续细化镜头语言、提示词和视觉风格。</p>
        <div className="meta-list">
          <span>Scenes：{project.scenes.length}</span>
          <span>Shots：{project.shots.length}</span>
          <span>Reference-enhanced：{flavoredCount}</span>
          <span>Director-ready scenes：{directorReadyCount}</span>
        </div>
        <div className="action-row">
          <Link href="/adaptation-lab" className="button-ghost">返回改编工作台</Link>
          <Link href="/render-studio" className="button-secondary">继续到 Render Studio</Link>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">scene titles</span>
          <h4>分场标题已承接</h4>
          <p>{project.scenes.map((scene) => scene.title).join(' / ') || '暂无 scene 标题'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">shot taxonomy</span>
          <h4>镜头类型分布</h4>
          <p>{shotKinds.join(' / ') || '暂无镜头类型'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">adaptation quality</span>
          <h4>底稿可读性</h4>
          <p>当前 storyboard 已不只展示 shot 列表，而是能直接看到 scene 标题、导演摘要与镜头职责。</p>
        </div>
      </div>

      <div className="storyboard-grid">
        {grouped.length === 0 ? (
          <div className="asset-tile">
            <span className="label">empty</span>
            <h4>还没有 scene / shot</h4>
            <p>请先生成改编结果。</p>
          </div>
        ) : (
          grouped.map(({ scene, shots }) => (
            <section key={scene.id} className="storyboard-column">
              <div className="storyboard-column-head">
                <span className="label">scene {scene.orderIndex}</span>
                <h4>{scene.title}</h4>
                <p>{scene.summary || '暂无 scene 摘要'}</p>
                <div className="meta-list">
                  <span>导演语言：{hasDirectorLanguage(scene.summary) ? '已启用' : '基础版'}</span>
                  <span>镜头数：{shots.length}</span>
                </div>
              </div>
              <div className="storyboard-cards">
                {shots.map((shot, index) => (
                  <article key={shot.id} className="frame-card">
                    <div className="frame-preview">
                      <span>Shot {index + 1}</span>
                    </div>
                    <div className="frame-body">
                      <strong>{shot.title}</strong>
                      <p>{shot.prompt || '暂无镜头提示词'}</p>
                      <small>{shot.cameraNotes || '暂无镜头说明'}</small>
                      <div className="meta-list">
                        <span>类型：{getShotKindFromTitle(shot.title)}</span>
                        {hasReferenceFlavor(shot.prompt) ? <span className="tag-chip">reference-enhanced</span> : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
