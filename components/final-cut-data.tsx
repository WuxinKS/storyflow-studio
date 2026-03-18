import Link from 'next/link';
import { MediaPreview } from '@/components/media-preview';
import { SectionCard } from '@/components/section-card';
import { getFinalCutPlan } from '@/features/final-cut/service';
import { buildLocalMediaPreviewHref, getPreviewKindFromGeneratedType } from '@/lib/media-preview';
import { buildProjectHref } from '@/lib/project-links';

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}分 ${seconds}秒`;
}

function getVisualSourceLabel(kind: 'video' | 'image' | 'missing') {
  if (kind === 'video') return '视频片段';
  if (kind === 'image') return '图片回退';
  return '缺失视觉';
}

function getAssemblyStateLabel(state: 'ready-full-video' | 'ready-preview' | 'blocked') {
  if (state === 'ready-full-video') return '完整视频版';
  if (state === 'ready-preview') return '预演拼装版';
  return '仍被阻塞';
}

function getReadinessCopy(input: {
  readyForFullVideo: boolean;
  readyForAssembly: boolean;
  missingVisualShots: number;
  scenesWithoutAudio: number;
}) {
  if (input.readyForFullVideo) {
    return {
      title: '完整成片就绪',
      description: '所有镜头都已有视频片段，场次音轨也已经补齐，可以直接进入最终拼装或交付。',
    };
  }

  if (input.readyForAssembly) {
    return {
      title: '可拼装预演版',
      description: '所有镜头至少都有视觉结果，但仍有图片回退或部分场次缺少音轨，适合先做预演验证。',
    };
  }

  if (input.missingVisualShots > 0) {
    return {
      title: '先补视觉产物',
      description: `当前仍有 ${input.missingVisualShots} 个镜头缺少视觉结果，成片链会被直接阻塞。`,
    };
  }

  return {
    title: '先补场次音轨',
    description: `当前仍有 ${input.scenesWithoutAudio} 个场次缺少音轨，建议先补完再做最终拼装。`,
  };
}

function getSceneAssemblyState(input: {
  missingVisualShots: number;
  imageFallbackShots: number;
  audioEntry: unknown | null;
}) {
  if (input.missingVisualShots > 0) return 'blocked' as const;
  if (input.imageFallbackShots > 0 || !input.audioEntry) return 'ready-preview' as const;
  return 'ready-full-video' as const;
}

function getSceneNextAction(input: {
  missingVisualShots: number;
  imageFallbackShots: number;
  audioEntry: unknown | null;
}) {
  if (input.missingVisualShots > 0) {
    return '回到生成工作台，优先补齐缺失视觉的镜头。';
  }
  if (!input.audioEntry) {
    return '先补这一场的音轨，再进入最终拼装。';
  }
  if (input.imageFallbackShots > 0) {
    return '可以先做预演，再逐步把图片回退替换成正式视频。';
  }
  return '这一场已经能直接纳入最终成片。';
}

export async function FinalCutData({ projectId }: { projectId?: string }) {
  const plan = await getFinalCutPlan(projectId).catch(() => null);

  if (!plan) {
    return (
      <div className="asset-tile">
        <span className="label">空状态</span>
        <h4>还没有成片预演数据</h4>
        <p>先完成时间线与渲染任务，系统才能基于镜头顺序、音轨与产物自动生成最终拼装计划。</p>
      </div>
    );
  }

  const readiness = getReadinessCopy({
    readyForFullVideo: plan.summary.readyForFullVideo,
    readyForAssembly: plan.summary.readyForAssembly,
    missingVisualShots: plan.summary.missingVisualShots,
    scenesWithoutAudio: plan.summary.scenesWithoutAudio,
  });
  const sceneReadyForFullVideo = plan.scenes.filter(
    (scene) => scene.missingVisualShots === 0 && scene.imageFallbackShots === 0 && scene.audioEntry,
  ).length;
  const sceneReadyForPreview = plan.scenes.filter((scene) => scene.missingVisualShots === 0).length;
  const routeCards = [
    {
      key: 'visual-gap',
      label: '01 补视觉',
      title: plan.summary.missingVisualShots > 0 ? `仍缺 ${plan.summary.missingVisualShots} 个镜头` : '视觉产物已补齐',
      description:
        plan.summary.missingVisualShots > 0
          ? '缺失视觉会直接阻塞 final cut，先回生成工作台补镜头。'
          : '所有镜头至少都有视觉结果，可以继续走拼装链。',
    },
    {
      key: 'video-gap',
      label: '02 替换图片回退',
      title: plan.summary.imageFallbackShots > 0 ? `${plan.summary.imageFallbackShots} 个镜头仍用图片回退` : '视频片段覆盖稳定',
      description:
        plan.summary.imageFallbackShots > 0
          ? '预演可以继续，但最好把关键镜头逐步替换成真正的视频片段。'
          : '关键镜头已经具备完整视频片段，节奏验证会更真实。',
    },
    {
      key: 'audio-gap',
      label: '03 补场次音轨',
      title: plan.summary.scenesWithoutAudio > 0 ? `仍缺 ${plan.summary.scenesWithoutAudio} 场音轨` : '场次音轨已齐',
      description:
        plan.summary.scenesWithoutAudio > 0
          ? '预演可以先看节奏，但最终成片最好让每一场都有完整音轨。'
          : '所有场次都已带上音轨，可直接进入完整装配。',
    },
    {
      key: 'assembly',
      label: '04 执行拼装',
      title: readiness.title,
      description: readiness.description,
    },
  ];

  return (
    <div className="page-stack">
      <div className="finalcut-command-grid">
        <section className="snapshot-card finalcut-command-card">
          <div className="finalcut-panel-head">
            <div>
              <p className="eyebrow">Final Cut</p>
              <h3>{plan.projectTitle}</h3>
            </div>
            <span className="status-pill status-pill-subtle">{getAssemblyStateLabel(plan.summary.assemblyState)}</span>
          </div>

          <p>
            这一页现在只做最后一段链路该做的判断：能不能拼、还差什么、具体会按什么顺序把镜头和音轨组装起来。
            这样我们在进入最终预演前，就能先把阻塞项和装配路径看清楚。
          </p>

          <div className="meta-list">
            <span>总时长 {plan.totalDurationLabel}</span>
            <span>场次 {plan.summary.sceneCount}</span>
            <span>镜头 {plan.summary.shotCount}</span>
            <span>视频覆盖 {plan.summary.videoCoverageRate}%</span>
            <span>视觉覆盖 {plan.summary.visualCoverageRate}%</span>
            <span>音轨覆盖 {plan.summary.audioCoverageRate}%</span>
          </div>

          <div className="finalcut-route-strip">
            <div className="finalcut-route-pill">
              <span className="label">Scene 全视频</span>
              <strong>{sceneReadyForFullVideo} / {plan.summary.sceneCount}</strong>
            </div>
            <div className="finalcut-route-pill">
              <span className="label">Scene 可预演</span>
              <strong>{sceneReadyForPreview} / {plan.summary.sceneCount}</strong>
            </div>
            <div className="finalcut-route-pill">
              <span className="label">镜头视频覆盖</span>
              <strong>{plan.summary.readyVideoShots} / {plan.summary.shotCount}</strong>
            </div>
            <div className="finalcut-route-pill">
              <span className="label">场次音轨</span>
              <strong>{plan.summary.scenesWithAudio} / {plan.summary.sceneCount}</strong>
            </div>
          </div>

          <div className="action-row wrap-row">
            <Link href={buildProjectHref('/render-studio', plan.projectId)} className="button-secondary">返回生成工作台</Link>
            <a className="button-ghost" href={`/api/render?action=assemble-final-cut-preview&projectId=${plan.projectId}&open=1`} target="_blank" rel="noreferrer">一键拼装并打开预演</a>
            <a className="button-ghost" href={`/api/render?action=export-final-cut-plan&projectId=${plan.projectId}`} target="_blank" rel="noreferrer">导出 Final Cut JSON</a>
            <Link href={buildProjectHref('/render-runs', plan.projectId)} className="button-ghost">查看运行诊断</Link>
            <Link href={buildProjectHref('/delivery-center', plan.projectId)} className="button-ghost">查看交付中心</Link>
          </div>
        </section>

        <aside className="finalcut-command-side">
          <div className="finalcut-kpi-grid">
            <div className="asset-tile finalcut-kpi-card">
              <span className="label">拼装状态</span>
              <h4>{readiness.title}</h4>
              <p>{readiness.description}</p>
            </div>

            <div className="asset-tile finalcut-kpi-card">
              <span className="label">视频覆盖</span>
              <h4>{plan.summary.videoCoverageRate}%</h4>
              <div className="progress-strip">
                <span className="progress-fill" style={{ width: `${plan.summary.videoCoverageRate}%` }} />
              </div>
              <p>{plan.summary.readyVideoShots} / {plan.summary.shotCount} 个镜头已有视频片段。</p>
            </div>

            <div className="asset-tile finalcut-kpi-card">
              <span className="label">视觉覆盖</span>
              <h4>{plan.summary.visualCoverageRate}%</h4>
              <div className="progress-strip">
                <span className="progress-fill progress-fill-accent-2" style={{ width: `${plan.summary.visualCoverageRate}%` }} />
              </div>
              <p>图片回退 {plan.summary.imageFallbackShots} 镜头，缺失视觉 {plan.summary.missingVisualShots} 镜头。</p>
            </div>

            <div className="asset-tile finalcut-kpi-card">
              <span className="label">音轨覆盖</span>
              <h4>{plan.summary.audioCoverageRate}%</h4>
              <div className="progress-strip">
                <span className="progress-fill progress-fill-accent-3" style={{ width: `${plan.summary.audioCoverageRate}%` }} />
              </div>
              <p>{plan.summary.scenesWithAudio} / {plan.summary.sceneCount} 个场次已匹配音轨。</p>
            </div>
          </div>
        </aside>
      </div>

      <SectionCard
        eyebrow="Decision"
        title="拼装判断与推进路线"
        description="先把阻塞点、推荐动作和预演路线摆平，再去看具体场次。"
      >
        <div className="finalcut-route-grid">
          {routeCards.map((card) => (
            <div key={card.key} className="asset-tile finalcut-route-card">
              <span className="label">{card.label}</span>
              <h4>{card.title}</h4>
              <p>{card.description}</p>
            </div>
          ))}
        </div>

        <div className="dashboard-split">
          <div className="asset-tile finalcut-list-panel">
            <span className="label">系统提醒</span>
            <h4>{plan.warnings.length === 0 ? '当前没有明显缺口' : `共有 ${plan.warnings.length} 条提醒`}</h4>
            <div className="finalcut-list">
              {plan.warnings.length === 0 ? (
                <div className="finalcut-list-item">
                  <strong>可以继续拼装</strong>
                  <span>时间线、视觉产物和音轨覆盖已经达到可继续推进的状态。</span>
                </div>
              ) : (
                plan.warnings.map((warning) => (
                  <div key={warning} className="finalcut-list-item">
                    <strong>{warning}</strong>
                    <span>建议回到生成工作台或运行诊断继续补齐。</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="asset-tile finalcut-list-panel">
            <span className="label">下一步动作</span>
            <h4>{plan.recommendedActions.length > 0 ? '按这个顺序推进' : '当前无需额外动作'}</h4>
            <div className="finalcut-list">
              {plan.recommendedActions.length > 0 ? (
                plan.recommendedActions.map((action) => (
                  <div key={action} className="finalcut-list-item">
                    <strong>建议动作</strong>
                    <span>{action}</span>
                  </div>
                ))
              ) : (
                <div className="finalcut-list-item">
                  <strong>可以直接交付</strong>
                  <span>当前 final cut 已经具备继续交付的条件。</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Overview"
        title="场次状态总览"
        description="先用一眼就能扫完的场次卡片，确认哪些场次已能进成片，哪些还要回去补。"
      >
        <div className="finalcut-scene-summary-grid">
          {plan.scenes.map((scene, index) => {
            const state = getSceneAssemblyState(scene);

            return (
              <div key={scene.sceneId} className="asset-tile finalcut-scene-summary-card">
                <div className="finalcut-panel-head">
                  <div>
                    <span className="label">Scene {String(index + 1).padStart(2, '0')}</span>
                    <h4>{scene.title}</h4>
                  </div>
                  <span className="status-pill status-pill-subtle">{getAssemblyStateLabel(state)}</span>
                </div>

                <p>{getSceneNextAction(scene)}</p>

                <div className="meta-list">
                  <span>视频 {scene.readyVideoShots}</span>
                  <span>回退 {scene.imageFallbackShots}</span>
                  <span>缺失 {scene.missingVisualShots}</span>
                  <span>音轨 {scene.audioEntry ? '已匹配' : '缺失'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Timeline"
        title="镜头顺序预演"
        description="这里直接按成片顺序看镜头采用的视频、图片回退和场次音轨，判断预演会长什么样。"
      >
        <div className="finalcut-timeline-grid">
          {plan.timelineItems.map((item) => (
            <div key={`${item.sceneId}-${item.shotId}-${item.orderIndex}`} className="asset-tile finalcut-timeline-item">
              <div className="finalcut-shot-card-head">
                <span className="label">#{String(item.orderIndex + 1).padStart(2, '0')}</span>
                <span className={`finalcut-source-pill finalcut-source-${item.visualSourceKind}`}>
                  {getVisualSourceLabel(item.visualSourceKind)}
                </span>
              </div>

              <h4>{item.shotTitle}</h4>
              <p>{item.sceneTitle}</p>

              <div className="meta-list">
                <span>类型 {item.kind}</span>
                <span>时长 {formatSeconds(item.duration)}</span>
                <span>{formatSeconds(item.startAt)} → {formatSeconds(item.endAt)}</span>
                <span>音轨 {item.sceneAudioEntry ? '已配' : '缺失'}</span>
              </div>

              {item.warnings.length > 0 ? (
                <div className="tag-list">
                  {item.warnings.map((warning) => (
                    <span key={`${item.shotId}-${warning}`} className="tag-chip tag-chip-active">{warning}</span>
                  ))}
                </div>
              ) : (
                <div className="tag-list">
                  <span className="tag-chip">可直接进入拼装</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Scenes"
        title="场次装配时间线"
        description="每个场次都拆成一张装配卡：先看场次状态，再看每个镜头最终采用的视频、图片回退和音轨关联。"
      >
        <div className="finalcut-scene-stack">
          {plan.scenes.map((scene, index) => {
            const sceneState = getSceneAssemblyState(scene);

            return (
              <section key={scene.sceneId} className="snapshot-card finalcut-scene-card">
                <div className="finalcut-scene-head">
                  <div className="finalcut-scene-copy">
                    <p className="eyebrow">Scene {String(index + 1).padStart(2, '0')}</p>
                    <h3>{scene.title}</h3>
                    <p>{scene.summary || '暂无场次摘要'}</p>
                  </div>

                  <div className="finalcut-scene-side">
                    <span className="status-pill status-pill-subtle">{getAssemblyStateLabel(sceneState)}</span>
                    <div className="meta-list">
                      <span>时间 {formatSeconds(scene.startAt)} → {formatSeconds(scene.endAt)}</span>
                      <span>时长 {formatSeconds(scene.duration)}</span>
                      <span>情绪 {scene.emotion}</span>
                      <span>视频 {scene.readyVideoShots}</span>
                      <span>回退 {scene.imageFallbackShots}</span>
                      <span>缺失 {scene.missingVisualShots}</span>
                    </div>
                  </div>
                </div>

                <div className={`finalcut-scene-audio ${scene.audioEntry ? '' : 'finalcut-scene-audio-missing'}`}>
                  {scene.audioEntry ? (
                    <>
                      <div>
                        <span className="label">场次音轨</span>
                        <h4>{scene.audioEntry.title}</h4>
                        <p>{getSceneNextAction(scene)}</p>
                      </div>
                      <div className="action-row wrap-row compact-row">
                        <span className="tag-chip">音轨已匹配</span>
                        {scene.audioEntry.localPath ? (
                          <a className="button-ghost" href={buildLocalMediaPreviewHref(scene.audioEntry.localPath)} target="_blank" rel="noreferrer">打开音轨工件</a>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="label">场次音轨</span>
                        <h4>当前还没有匹配音轨</h4>
                        <p>{getSceneNextAction(scene)}</p>
                      </div>
                      <div className="tag-list">
                        <span className="tag-chip tag-chip-active">建议先补音轨</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="finalcut-shot-grid">
                  {scene.shots.map((shot) => (
                    <div key={shot.shotId} className="asset-tile scene-tile finalcut-shot-card">
                      <MediaPreview
                        kind={shot.visualEntry ? getPreviewKindFromGeneratedType(shot.visualEntry.type) : null}
                        title={shot.visualEntry?.title || shot.shotTitle}
                        sourceUrl={shot.visualEntry?.sourceUrl}
                        localPath={shot.visualEntry?.localPath}
                        fallbackLabel={shot.shotTitle}
                      />

                      <div className="finalcut-shot-card-head">
                        <span className={`finalcut-source-pill finalcut-source-${shot.visualSourceKind}`}>
                          {getVisualSourceLabel(shot.visualSourceKind)}
                        </span>
                        {shot.beatType ? <span className="tag-chip">{shot.beatType}</span> : null}
                      </div>

                      <h4>{shot.shotTitle}</h4>
                      <p>{shot.visualEntry?.summary || '当前镜头还没有可用视觉产物。'}</p>

                      <div className="meta-list">
                        <span>类型 {shot.kind}</span>
                        <span>时长 {formatSeconds(shot.duration)}</span>
                        <span>时间 {formatSeconds(shot.startAt)} → {formatSeconds(shot.endAt)}</span>
                        <span>情绪 {shot.emotion}</span>
                      </div>

                      {shot.referenceTitles.length > 0 ? (
                        <div className="tag-list">
                          {shot.referenceTitles.map((title) => (
                            <span key={`${shot.shotId}-${title}`} className="tag-chip">{title}</span>
                          ))}
                        </div>
                      ) : null}

                      {shot.referencePromptLine ? <p><strong>定向参考：</strong>{shot.referencePromptLine}</p> : null}
                      {shot.referenceNote ? <p><strong>绑定说明：</strong>{shot.referenceNote}</p> : null}

                      {shot.warnings.length > 0 ? (
                        <div className="tag-list">
                          {shot.warnings.map((warning) => (
                            <span key={`${shot.shotId}-${warning}`} className="tag-chip tag-chip-active">{warning}</span>
                          ))}
                        </div>
                      ) : null}

                      <div className="action-row wrap-row compact-row">
                        {shot.visualEntry?.localPath ? (
                          <a className="button-ghost" href={buildLocalMediaPreviewHref(shot.visualEntry.localPath)} target="_blank" rel="noreferrer">打开视觉工件</a>
                        ) : null}
                        {shot.sceneAudioEntry?.localPath ? (
                          <a className="button-ghost" href={buildLocalMediaPreviewHref(shot.sceneAudioEntry.localPath)} target="_blank" rel="noreferrer">打开场次音轨</a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
