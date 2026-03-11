import Link from 'next/link';
import { getStoryboardProject } from '@/features/storyboard/service';
import { MediaPreview } from '@/components/media-preview';
import { getShotKindFromTitle } from '@/lib/shot-taxonomy';
import { getPreviewKindFromGeneratedType } from '@/lib/media-preview';
import { buildProjectHref } from '@/lib/project-links';

function hasReferenceFlavor(text: string | null) {
  if (!text) return false;
  return text.includes('参考构图') || text.includes('情绪参考') || text.includes('动作节奏参考');
}

function hasDirectorLanguage(text: string | null) {
  if (!text) return false;
  return text.includes('导演处理上强调') || text.includes('镜头重点放在');
}

export async function StoryboardData({ projectId }: { projectId?: string }) {
  const project = await getStoryboardProject(projectId).catch(() => null);

  if (!project) {
    return (
      <div className="asset-tile">
        <span className="label">空状态</span>
        <h4>暂无分镜数据</h4>
        <p>先去改编实验室生成分场 / 镜头，再回来查看镜头板。</p>
      </div>
    );
  }

  const flavoredCount = project.scenes.flatMap((scene) => scene.shots).filter((shot) => hasReferenceFlavor(shot.prompt)).length;
  const directorReadyCount = project.scenes.filter((scene) => hasDirectorLanguage(scene.summary)).length;
  const shotKinds = Array.from(new Set(project.scenes.flatMap((scene) => scene.shots).map((shot) => getShotKindFromTitle(shot.title))));

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">分镜总览</p>
        <h3>{project.projectTitle}</h3>
        <p>当前镜头板已开始同时关联生成产物和镜头级定向参考，可在看结构的同时追踪每个镜头究竟继承了哪些参考素材。</p>
        <div className="meta-list">
          <span>分场：{project.scenes.length}</span>
          <span>镜头：{project.scenes.reduce((sum, scene) => sum + scene.shots.length, 0)}</span>
          <span>参考增强：{flavoredCount}</span>
          <span>定向分场：{project.bindingSummary.sceneBoundCount}</span>
          <span>定向镜头：{project.bindingSummary.shotBoundCount}</span>
          <span>生效镜头参考：{project.bindingSummary.effectiveShotBoundCount}</span>
          <span>导演语言分场：{directorReadyCount}</span>
          <span>已沉淀产物：{project.mediaCounts.total}</span>
        </div>
        <div className="action-row">
          <Link href={buildProjectHref('/adaptation-lab', project.projectId)} className="button-ghost">返回改编工作台</Link>
          <Link href={buildProjectHref('/reference-lab', project.projectId)} className="button-ghost">管理参考绑定</Link>
          <Link href={buildProjectHref('/render-studio', project.projectId)} className="button-secondary">继续到生成工作台</Link>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">分场标题</span>
          <h4>分场标题已承接</h4>
          <p>{project.scenes.map((scene) => scene.title).join(' / ') || '暂无分场标题'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">镜头分类</span>
          <h4>镜头类型分布</h4>
          <p>{shotKinds.join(' / ') || '暂无镜头类型'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">产物进度</span>
          <h4>当前媒体沉淀</h4>
          <p>图 {project.mediaCounts.images} / 音 {project.mediaCounts.audio} / 视 {project.mediaCounts.videos}</p>
        </div>
      </div>

      <div className="storyboard-grid">
        {project.scenes.length === 0 ? (
          <div className="asset-tile">
            <span className="label">空状态</span>
            <h4>还没有分场 / 镜头</h4>
            <p>请先生成改编结果。</p>
          </div>
        ) : (
          project.scenes.map((scene) => (
            <section key={scene.id} className="storyboard-column">
              <div className="storyboard-column-head">
                <span className="label">第 {scene.orderIndex} 场</span>
                <h4>{scene.title}</h4>
                <p>{scene.summary || '暂无分场摘要'}</p>
                <div className="meta-list">
                  <span>导演语言：{hasDirectorLanguage(scene.summary) ? '已启用' : '基础版'}</span>
                  <span>镜头数：{scene.shots.length}</span>
                  <span>图：{scene.mediaCounts.images}</span>
                  <span>音：{scene.mediaCounts.audio}</span>
                  <span>视：{scene.mediaCounts.videos}</span>
                  {scene.referenceTitles.length > 0 ? <span className="tag-chip">分场定向参考 {scene.referenceTitles.length}</span> : null}
                </div>
                {scene.referenceTitles.length > 0 ? (
                  <>
                    <div className="tag-list">
                      {scene.referenceTitles.map((title) => (
                        <span key={`${scene.id}-${title}`} className="tag-chip">{title}</span>
                      ))}
                    </div>
                    <p>{scene.referencePromptLine}</p>
                    {scene.referenceNote ? <p><strong>绑定说明：</strong>{scene.referenceNote}</p> : null}
                  </>
                ) : null}
              </div>
              <div className="storyboard-cards">
                {scene.shots.map((shot, index) => (
                  <article key={shot.id} className="frame-card">
                    {shot.latestMedia ? (
                      <MediaPreview
                        kind={getPreviewKindFromGeneratedType(shot.latestMedia.type)}
                        title={shot.latestMedia.title}
                        sourceUrl={shot.latestMedia.sourceUrl}
                        localPath={shot.latestMedia.localPath}
                        fallbackLabel={`镜头 ${index + 1}`}
                      />
                    ) : (
                      <div className="frame-preview">
                        <span>镜头 {index + 1}</span>
                      </div>
                    )}
                    <div className="frame-body">
                      <strong>{shot.title}</strong>
                      <p>{shot.prompt || '暂无镜头提示词'}</p>
                      <small>{shot.cameraNotes || '暂无镜头说明'}</small>
                      <div className="meta-list">
                        <span>类型：{getShotKindFromTitle(shot.title)}</span>
                        <span>图：{shot.mediaCounts.images}</span>
                        <span>音：{shot.mediaCounts.audio}</span>
                        <span>视：{shot.mediaCounts.videos}</span>
                        {hasReferenceFlavor(shot.prompt) ? <span className="tag-chip">已注入参考</span> : null}
                        {shot.referenceTitles.length > 0 ? <span className="tag-chip">定向参考 {shot.referenceTitles.length}</span> : null}
                        {shot.hasDirectReferenceBinding ? <span className="tag-chip">镜头直绑</span> : null}
                      </div>
                      {shot.referenceTitles.length > 0 ? (
                        <>
                          <div className="tag-list">
                            {shot.referenceTitles.map((title) => (
                              <span key={`${shot.id}-${title}`} className="tag-chip">{title}</span>
                            ))}
                          </div>
                          <p>{shot.referencePromptLine}</p>
                          {shot.referenceNote ? <p><strong>绑定说明：</strong>{shot.referenceNote}</p> : null}
                        </>
                      ) : null}
                      {shot.latestMedia ? (
                        <p>最新产物：{shot.latestMedia.title}｜{shot.latestMedia.localPath || shot.latestMedia.sourceUrl || '仅索引已记录'}</p>
                      ) : (
                        <p>当前镜头还没有关联产物。</p>
                      )}
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
