import Link from 'next/link';
import { MediaPreview } from '@/components/media-preview';
import { SectionCard } from '@/components/section-card';
import { getStoryboardProject } from '@/features/storyboard/service';
import { getPreviewKindFromGeneratedType } from '@/lib/media-preview';
import { buildProjectHref } from '@/lib/project-links';
import { getShotKindFromTitle } from '@/lib/shot-taxonomy';

function hasReferenceFlavor(text: string | null) {
  if (!text) return false;
  return text.includes('参考构图') || text.includes('情绪参考') || text.includes('动作节奏参考');
}

function hasDirectorLanguage(text: string | null) {
  if (!text) return false;
  return text.includes('导演处理上强调') || text.includes('镜头重点放在');
}

function toPercent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
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

  const totalShots = project.scenes.reduce((sum, scene) => sum + scene.shots.length, 0);
  const flavoredCount = project.scenes.flatMap((scene) => scene.shots).filter((shot) => hasReferenceFlavor(shot.prompt)).length;
  const directorReadyCount = project.scenes.filter((scene) => hasDirectorLanguage(scene.summary)).length;
  const shotKinds = Array.from(new Set(project.scenes.flatMap((scene) => scene.shots).map((shot) => getShotKindFromTitle(shot.title)))).filter(Boolean);
  const mediaReadyShots = project.scenes.flatMap((scene) => scene.shots).filter((shot) => Boolean(shot.latestMedia)).length;
  const flavoredRate = toPercent(flavoredCount, totalShots);
  const previewRate = toPercent(mediaReadyShots, totalShots);

  return (
    <div className="page-stack">
      <div className="board-command-grid">
        <section className="snapshot-card board-command-card">
          <div className="board-panel-head">
            <div>
              <p className="eyebrow">Storyboard Command</p>
              <h3>{project.projectTitle}</h3>
            </div>
            <span className="status-pill status-pill-subtle">分镜阶段</span>
          </div>

          <p>
            这一站只保留导演真正会看的信息：场次结构、镜头卡、参考绑定和最新媒体结果，不再把所有说明堆成纯文本。
          </p>

          <div className="meta-list">
            <span>分场 {project.scenes.length}</span>
            <span>镜头 {totalShots}</span>
            <span>参考增强 {flavoredCount}</span>
            <span>分场定向 {project.bindingSummary.sceneBoundCount}</span>
            <span>镜头定向 {project.bindingSummary.shotBoundCount}</span>
            <span>生效镜头参考 {project.bindingSummary.effectiveShotBoundCount}</span>
          </div>

          <div className="action-row wrap-row">
            <Link href={buildProjectHref('/adaptation-lab', project.projectId)} className="button-ghost">返回改编工作台</Link>
            <Link href={buildProjectHref('/reference-lab', project.projectId)} className="button-secondary">管理参考绑定</Link>
            <Link href={buildProjectHref('/timeline', project.projectId)} className="button-secondary">继续到时间线</Link>
            <Link href={buildProjectHref('/render-studio', project.projectId)} className="button-secondary">继续到生成工作台</Link>
          </div>
        </section>

        <aside className="board-command-side">
          <div className="board-kpi-grid">
            <div className="asset-tile board-kpi-card">
              <span className="label">预览覆盖</span>
              <h4>{previewRate}%</h4>
              <div className="progress-strip">
                <span className="progress-fill progress-fill-accent-2" style={{ width: `${previewRate}%` }} />
              </div>
              <p>{mediaReadyShots} / {totalShots} 个镜头已经挂上了最新媒体结果。</p>
            </div>

            <div className="asset-tile board-kpi-card">
              <span className="label">参考增强</span>
              <h4>{flavoredRate}%</h4>
              <div className="progress-strip">
                <span className="progress-fill" style={{ width: `${flavoredRate}%` }} />
              </div>
              <p>{flavoredCount} / {totalShots} 个镜头已带参考强化提示。</p>
            </div>

            <div className="asset-tile board-kpi-card">
              <span className="label">导演语言覆盖</span>
              <h4>{directorReadyCount}</h4>
              <p>{directorReadyCount} / {project.scenes.length} 个分场已经具备导演语言摘要。</p>
            </div>

            <div className="asset-tile board-kpi-card">
              <span className="label">媒体沉淀</span>
              <h4>{project.mediaCounts.total}</h4>
              <p>图 {project.mediaCounts.images} / 音 {project.mediaCounts.audio} / 视 {project.mediaCounts.videos}</p>
            </div>
          </div>
        </aside>
      </div>

      <SectionCard
        eyebrow="Board Health"
        title="分镜板健康度"
        description="先看当前板面的覆盖度，再判断是先补提示词、补参考，还是直接去时间线和生成链。"
      >
        <div className="board-health-grid">
          <div className="asset-tile board-highlight-card">
            <span className="label">镜头类型</span>
            <h4>{shotKinds.length > 0 ? `${shotKinds.length} 类镜头` : '暂无镜头类型'}</h4>
            {shotKinds.length > 0 ? (
              <div className="tag-list">
                {shotKinds.map((kind) => (
                  <span key={kind} className="tag-chip">{kind}</span>
                ))}
              </div>
            ) : (
              <p>先回改编工作台生成镜头语言。</p>
            )}
          </div>

          <div className="asset-tile board-highlight-card">
            <span className="label">场次标题</span>
            <h4>分场结构已承接</h4>
            <p>{project.scenes.map((scene) => scene.title).join(' / ') || '暂无分场标题'}</p>
          </div>

          <div className="asset-tile board-highlight-card">
            <span className="label">定向绑定</span>
            <h4>{project.bindingSummary.effectiveShotBoundCount} 个镜头已生效</h4>
            <p>分场定向 {project.bindingSummary.sceneBoundCount} / 镜头直绑 {project.bindingSummary.shotBoundCount}，当前绑定结果已能直接影响生成。</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Storyboard"
        title="分场镜头板"
        description="按场次看镜头卡。每张卡直接带预览、提示词、镜头说明和参考绑定。"
      >
        <div className="board-scene-stack">
          {project.scenes.length === 0 ? (
            <div className="asset-tile">
              <span className="label">空状态</span>
              <h4>还没有分场 / 镜头</h4>
              <p>请先生成改编结果。</p>
            </div>
          ) : (
            project.scenes.map((scene) => (
              <section key={scene.id} className="snapshot-card board-scene-card">
                <div className="board-scene-head">
                  <div className="board-scene-copy">
                    <p className="eyebrow">Scene {String(scene.orderIndex).padStart(2, '0')}</p>
                    <h3>{scene.title}</h3>
                    <p>{scene.summary || '暂无分场摘要'}</p>
                  </div>

                  <div className="board-scene-side">
                    <span className="status-pill status-pill-subtle">{hasDirectorLanguage(scene.summary) ? '导演语言增强' : '基础版'}</span>
                    <div className="meta-list">
                      <span>镜头 {scene.shots.length}</span>
                      <span>图 {scene.mediaCounts.images}</span>
                      <span>音 {scene.mediaCounts.audio}</span>
                      <span>视 {scene.mediaCounts.videos}</span>
                    </div>
                  </div>
                </div>

                {scene.referenceTitles.length > 0 ? (
                  <div className="board-reference-card">
                    <div className="board-reference-copy">
                      <span className="label">分场定向参考</span>
                      <h4>{scene.referenceTitles[0]}</h4>
                      <p>{scene.referencePromptLine || '当前分场已绑定参考素材。'}</p>
                    </div>
                    <div className="tag-list">
                      {scene.referenceTitles.map((title) => (
                        <span key={`${scene.id}-${title}`} className="tag-chip">{title}</span>
                      ))}
                    </div>
                    {scene.referenceNote ? <p><strong>绑定说明：</strong>{scene.referenceNote}</p> : null}
                  </div>
                ) : null}

                <div className="board-shot-grid">
                  {scene.shots.map((shot, index) => (
                    <article key={shot.id} className="asset-tile board-shot-card">
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

                      <div className="board-shot-head">
                        <span className="label">{getShotKindFromTitle(shot.title)}</span>
                        <div className="tag-list">
                          {hasReferenceFlavor(shot.prompt) ? <span className="tag-chip">已注入参考</span> : null}
                          {shot.referenceTitles.length > 0 ? <span className="tag-chip">定向参考 {shot.referenceTitles.length}</span> : null}
                          {shot.hasDirectReferenceBinding ? <span className="tag-chip tag-chip-active">镜头直绑</span> : null}
                        </div>
                      </div>

                      <h4>{shot.title}</h4>
                      <p>{shot.prompt || '暂无镜头提示词'}</p>
                      <p><strong>镜头说明：</strong>{shot.cameraNotes || '暂无镜头说明'}</p>

                      <div className="meta-list">
                        <span>图 {shot.mediaCounts.images}</span>
                        <span>音 {shot.mediaCounts.audio}</span>
                        <span>视 {shot.mediaCounts.videos}</span>
                      </div>

                      {shot.referenceTitles.length > 0 ? (
                        <>
                          <div className="tag-list">
                            {shot.referenceTitles.map((title) => (
                              <span key={`${shot.id}-${title}`} className="tag-chip">{title}</span>
                            ))}
                          </div>
                          {shot.referencePromptLine ? <p><strong>定向参考：</strong>{shot.referencePromptLine}</p> : null}
                          {shot.referenceNote ? <p><strong>绑定说明：</strong>{shot.referenceNote}</p> : null}
                        </>
                      ) : null}

                      <p>
                        {shot.latestMedia
                          ? `最新产物：${shot.latestMedia.title}`
                          : '当前镜头还没有关联产物。'}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}
