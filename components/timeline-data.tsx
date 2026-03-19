import Link from 'next/link';
import { SectionCard } from '@/components/section-card';
import { TimelineEditor } from '@/components/timeline-editor';
import { getTimelineBundle } from '@/features/timeline/service';
import { getTimelineBeatTypeLabel } from '@/lib/display';
import { buildProjectHref } from '@/lib/project-links';

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes}分 ${remain}秒`;
}

function truncateText(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trim()}…`;
}

function getTimelineMission(input: {
  sceneCount: number;
  warningCount: number;
  beatMarkedScenes: number;
  mediaReadyScenes: number;
  projectId: string;
}) {
  if (input.sceneCount === 0) {
    return {
      status: '待建立节奏骨架',
      title: '先回分镜板补结构',
      guidance: '没有可用场次时，时间线无法提供有效节奏判断，先回分镜板确认 scene / shot 更直接。',
      actionHref: buildProjectHref('/storyboard', input.projectId),
      actionLabel: '回到分镜板',
    };
  }

  if (input.warningCount > 0) {
    return {
      status: '优先清理节奏异常',
      title: '打开节奏修订台',
      guidance: '当前已有时长或峰值异常，先在时间线里做手动修时和标记，比直接继续生成更稳。',
      actionHref: '#timeline-editor',
      actionLabel: '去修订时间线',
    };
  }

  if (input.beatMarkedScenes < Math.ceil(input.sceneCount / 2)) {
    return {
      status: '建议补峰值标记',
      title: '补关键场次的节奏峰值',
      guidance: '至少先把关键转折、冲突峰值和高潮点标出来，后面看预演节奏会更清楚。',
      actionHref: '#timeline-editor',
      actionLabel: '去补峰值标记',
    };
  }

  if (input.mediaReadyScenes < input.sceneCount) {
    return {
      status: '节奏已稳定，可回生成',
      title: '回到生成工作台继续推进',
      guidance: '时间线已经足够稳定，这一页先收口，把注意力交回任务队列和最新产物。',
      actionHref: buildProjectHref('/render-studio', input.projectId),
      actionLabel: '回到生成工作台',
    };
  }

  return {
    status: '可进入成片预演',
    title: '把时间线交给成片预演',
    guidance: '节奏、峰值和媒体沉淀都已经比较完整，可以直接去 final cut 看整体拼装效果。',
    actionHref: buildProjectHref('/final-cut', input.projectId),
    actionLabel: '进入成片预演',
  };
}

export async function TimelineData({ projectId }: { projectId?: string }) {
  const timeline = await getTimelineBundle(projectId).catch(() => null);

  if (!timeline) {
    return (
      <div className="asset-tile">
        <span className="label">空状态</span>
        <h4>暂无时间线数据</h4>
        <p>请先生成改编与分镜结果，再回来查看节奏结构。</p>
      </div>
    );
  }

  const warningCount = timeline.warnings.filter((item) => item.level === 'warning').length;
  const beatMarkedScenes = timeline.scenes.filter((scene) => scene.beatMarkers.length > 0).length;
  const mediaReadyScenes = timeline.scenes.filter((scene) => scene.mediaCounts.total > 0).length;
  const timelineMission = getTimelineMission({
    sceneCount: timeline.scenes.length,
    warningCount,
    beatMarkedScenes,
    mediaReadyScenes,
    projectId: timeline.projectId,
  });
  const scenePreview = timeline.scenes.slice(0, 3);
  const overflowScenes = timeline.scenes.slice(scenePreview.length);

  return (
    <div className="page-stack">
      <div className="timeline-command-grid">
        <section className="snapshot-card timeline-command-card">
          <div className="timeline-panel-head">
            <div>
              <p className="eyebrow">Timeline Command</p>
              <h3>{timeline.projectTitle}</h3>
            </div>
            <span className="status-pill status-pill-subtle">{timeline.totalDurationLabel}</span>
          </div>

          <p>
            这页现在优先让你看节奏，而不是让你读满屏数据：先看总时长和异常，再对场次做修时、标峰值、补备注。
          </p>

          <div className="meta-list">
            <span>总时长 {timeline.totalDurationLabel}</span>
            <span>场次 {timeline.scenes.length}</span>
            <span>镜头 {timeline.scenes.reduce((sum, scene) => sum + scene.shotCount, 0)}</span>
            <span>已沉淀产物 {timeline.mediaCounts.total}</span>
            <span>异常提示 {warningCount}</span>
          </div>

          <div className="asset-tile timeline-focus-card">
            <span className="label">当前主任务</span>
            <h4>{timelineMission.title}</h4>
            <p>{timelineMission.guidance}</p>
            <div className="action-row wrap-row">
              <a href={timelineMission.actionHref} className="button-primary">{timelineMission.actionLabel}</a>
            </div>
            <details className="workflow-disclosure">
              <summary>需要时打开其他入口</summary>
              <div className="workflow-disclosure-body">
                <div className="action-row wrap-row">
                  <Link href={buildProjectHref('/storyboard', timeline.projectId)} className="button-ghost">返回分镜板</Link>
                  <Link href={buildProjectHref('/render-studio', timeline.projectId)} className="button-secondary">继续进入生成</Link>
                  <Link href={buildProjectHref('/final-cut', timeline.projectId)} className="button-secondary">查看成片预演</Link>
                </div>
              </div>
            </details>
          </div>
        </section>

        <aside className="timeline-command-side">
          <div className="timeline-kpi-grid">
            <div className="asset-tile timeline-kpi-card">
              <span className="label">情绪曲线</span>
              <h4>{timeline.emotionCurve.length} 段</h4>
              <p>{timeline.emotionCurve.map((item) => `${item.title}:${item.score}`).join(' / ')}</p>
            </div>

            <div className="asset-tile timeline-kpi-card">
              <span className="label">峰值覆盖</span>
              <h4>{beatMarkedScenes}</h4>
              <p>{beatMarkedScenes} / {timeline.scenes.length} 个场次已经打上节奏标记。</p>
            </div>

            <div className="asset-tile timeline-kpi-card">
              <span className="label">媒体覆盖</span>
              <h4>{mediaReadyScenes}</h4>
              <p>{mediaReadyScenes} / {timeline.scenes.length} 个场次已经有图片、音频或视频沉淀。</p>
            </div>

            <div className="asset-tile timeline-kpi-card">
              <span className="label">风险提示</span>
              <h4>{warningCount === 0 ? '稳定' : `${warningCount} 条`}</h4>
              <p>{warningCount === 0 ? '当前没有明显时长异常。' : '先处理过短、过长或缺少峰值标记的场次。'}</p>
            </div>
          </div>
        </aside>
      </div>

      <SectionCard
        eyebrow="Rhythm"
        title="节奏诊断"
        description="把异常提示和情绪走势放在一起，先判断节奏问题，再决定是否需要重排镜头。"
      >
        <div className="timeline-health-grid">
          <div className="asset-tile timeline-highlight-card">
            <span className="label">情绪走势</span>
            <h4>场次情绪曲线</h4>
            <div className="timeline-curve-list">
              {timeline.emotionCurve.map((item) => (
                <div key={item.sceneId} className="timeline-curve-item">
                  <strong>{item.title}</strong>
                  <span>{item.score}</span>
                  <small>{item.label}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="asset-tile timeline-highlight-card">
            <span className="label">媒体沉淀</span>
            <h4>生成覆盖状态</h4>
            <p>图 {timeline.mediaCounts.images} / 音 {timeline.mediaCounts.audio} / 视 {timeline.mediaCounts.videos}</p>
          </div>

          <div className="asset-tile timeline-highlight-card">
            <span className="label">异常提醒</span>
            <h4>{timeline.warnings.length === 0 ? '节奏状态稳定' : `共 ${timeline.warnings.length} 条提醒`}</h4>
            <p>{timeline.warnings[0]?.detail || '当前没有发现明显时长异常或峰值缺口，可以继续进入生成与交付检查。'}</p>
          </div>
        </div>
      </SectionCard>

      <details id="timeline-editor" className="workflow-disclosure" open={warningCount > 0}>
        <summary>{warningCount > 0 ? '节奏修订台已展开（当前存在异常）' : '需要时打开节奏修订台'}</summary>
        <div className="workflow-disclosure-body">
          <TimelineEditor projectId={timeline.projectId} scenes={timeline.scenes} />
        </div>
      </details>

      <SectionCard
        eyebrow="Timeline"
        title="默认先看前三场节奏"
        description="先用前几场判断节奏走向和峰值分布，完整场次地图按需再展开。"
      >
        <div className="timeline-scene-stack">
          {scenePreview.map((scene) => (
            <section key={scene.id} className="snapshot-card timeline-scene-card">
              <div className="timeline-scene-head">
                <div className="timeline-scene-copy">
                  <span className="label">场次</span>
                  <h3>{scene.title}</h3>
                  <p>{scene.summary ? truncateText(scene.summary, 110) : '暂无场景摘要'}</p>
                </div>

                <div className="timeline-scene-side">
                  <span className="status-pill status-pill-subtle">{formatSeconds(scene.startAt)} → {formatSeconds(scene.endAt)}</span>
                  <div className="meta-list">
                    <span>时长 {formatSeconds(scene.duration)}</span>
                    <span>镜头 {scene.shotCount}</span>
                    <span>情绪 {scene.emotionScore} / {scene.emotionLabel}</span>
                    <span>图 {scene.mediaCounts.images}</span>
                    <span>音 {scene.mediaCounts.audio}</span>
                    <span>视 {scene.mediaCounts.videos}</span>
                  </div>
                </div>
              </div>

              {scene.beatMarkers.length > 0 ? (
                <div className="tag-list">
                  {scene.beatMarkers.map((marker) => (
                    <span key={`${scene.id}-${marker}`} className="tag-chip">{marker}</span>
                  ))}
                </div>
              ) : (
                <p className="helper-text">当前场次还没有峰值标记。</p>
              )}

              <div className="timeline-shot-grid">
                {scene.shots.slice(0, 2).map((shot) => (
                  <article key={shot.id} className="asset-tile timeline-shot-card">
                    <h4>{shot.title}</h4>
                    <div className="meta-list">
                      <span>类型 {shot.kind}</span>
                      <span>时长 {formatSeconds(shot.duration)}</span>
                      <span>时间 {formatSeconds(shot.startAt)} → {formatSeconds(shot.endAt)}</span>
                      <span>情绪 {shot.emotion} / {shot.emotionLabel}</span>
                    </div>
                    <p>{shot.beatType ? `节奏标记：${getTimelineBeatTypeLabel(shot.beatType)}` : '尚未手动标记节奏节点。'}</p>
                    {shot.note ? <p>备注：{truncateText(shot.note, 72)}</p> : null}
                    <p>{shot.latestMedia ? `最新产物：${shot.latestMedia.title}` : '当前镜头还没有生成产物。'}</p>
                    {shot.isManualDuration ? <span className="tag-chip tag-chip-active">已人工修时</span> : null}
                  </article>
                ))}
              </div>

              {scene.shots.length > 2 ? (
                <details className="workflow-disclosure">
                  <summary>展开本场全部 {scene.shots.length} 个镜头</summary>
                  <div className="workflow-disclosure-body">
                    <div className="timeline-shot-grid">
                      {scene.shots.map((shot) => (
                        <article key={`${shot.id}-full`} className="asset-tile timeline-shot-card">
                          <h4>{shot.title}</h4>
                          <div className="meta-list">
                            <span>类型 {shot.kind}</span>
                            <span>时长 {formatSeconds(shot.duration)}</span>
                            <span>时间 {formatSeconds(shot.startAt)} → {formatSeconds(shot.endAt)}</span>
                            <span>情绪 {shot.emotion} / {shot.emotionLabel}</span>
                          </div>
                          <p>{shot.beatType ? `节奏标记：${getTimelineBeatTypeLabel(shot.beatType)}` : '尚未手动标记节奏节点。'}</p>
                          {shot.note ? <p>备注：{shot.note}</p> : null}
                          <p>{shot.latestMedia ? `最新产物：${shot.latestMedia.title}` : '当前镜头还没有生成产物。'}</p>
                          {shot.isManualDuration ? <span className="tag-chip tag-chip-active">已人工修时</span> : null}
                        </article>
                      ))}
                    </div>
                  </div>
                </details>
              ) : null}
            </section>
          ))}
        </div>

        {overflowScenes.length > 0 ? (
          <details className="workflow-disclosure">
            <summary>展开剩余 {overflowScenes.length} 个场次</summary>
            <div className="workflow-disclosure-body">
              <div className="timeline-scene-stack">
                {overflowScenes.map((scene) => (
                  <section key={`${scene.id}-rest`} className="snapshot-card timeline-scene-card">
                    <div className="timeline-scene-head">
                      <div className="timeline-scene-copy">
                        <span className="label">场次</span>
                        <h3>{scene.title}</h3>
                        <p>{scene.summary ? truncateText(scene.summary, 110) : '暂无场景摘要'}</p>
                      </div>

                      <div className="timeline-scene-side">
                        <span className="status-pill status-pill-subtle">{formatSeconds(scene.startAt)} → {formatSeconds(scene.endAt)}</span>
                        <div className="meta-list">
                          <span>时长 {formatSeconds(scene.duration)}</span>
                          <span>镜头 {scene.shotCount}</span>
                          <span>情绪 {scene.emotionScore} / {scene.emotionLabel}</span>
                          <span>图 {scene.mediaCounts.images}</span>
                          <span>音 {scene.mediaCounts.audio}</span>
                          <span>视 {scene.mediaCounts.videos}</span>
                        </div>
                      </div>
                    </div>

                    {scene.beatMarkers.length > 0 ? (
                      <div className="tag-list">
                        {scene.beatMarkers.map((marker) => (
                          <span key={`${scene.id}-${marker}-rest`} className="tag-chip">{marker}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="helper-text">当前场次还没有峰值标记。</p>
                    )}

                    <details className="workflow-disclosure">
                      <summary>查看本场镜头（{scene.shots.length} 个）</summary>
                      <div className="workflow-disclosure-body">
                        <div className="timeline-shot-grid">
                          {scene.shots.map((shot) => (
                            <article key={`${shot.id}-rest`} className="asset-tile timeline-shot-card">
                              <h4>{shot.title}</h4>
                              <div className="meta-list">
                                <span>类型 {shot.kind}</span>
                                <span>时长 {formatSeconds(shot.duration)}</span>
                                <span>时间 {formatSeconds(shot.startAt)} → {formatSeconds(shot.endAt)}</span>
                                <span>情绪 {shot.emotion} / {shot.emotionLabel}</span>
                              </div>
                              <p>{shot.beatType ? `节奏标记：${getTimelineBeatTypeLabel(shot.beatType)}` : '尚未手动标记节奏节点。'}</p>
                              {shot.note ? <p>备注：{shot.note}</p> : null}
                              <p>{shot.latestMedia ? `最新产物：${shot.latestMedia.title}` : '当前镜头还没有生成产物。'}</p>
                              {shot.isManualDuration ? <span className="tag-chip tag-chip-active">已人工修时</span> : null}
                            </article>
                          ))}
                        </div>
                      </div>
                    </details>
                  </section>
                ))}
              </div>
            </div>
          </details>
        ) : null}
      </SectionCard>
    </div>
  );
}
