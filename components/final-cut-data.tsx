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
            这一页现在只回答三个问题：能不能拼、缺口在哪里、每个场次最终会采用哪一段视觉和音轨。
          </p>

          <div className="meta-list">
            <span>总时长 {plan.totalDurationLabel}</span>
            <span>场次 {plan.summary.sceneCount}</span>
            <span>镜头 {plan.summary.shotCount}</span>
            <span>视频覆盖 {plan.summary.videoCoverageRate}%</span>
            <span>视觉覆盖 {plan.summary.visualCoverageRate}%</span>
            <span>音轨覆盖 {plan.summary.audioCoverageRate}%</span>
          </div>

          <div className="action-row wrap-row">
            <Link href={buildProjectHref('/render-studio', plan.projectId)} className="button-secondary">返回生成工作台</Link>
            <a className="button-ghost" href={`/api/render?action=export-final-cut-plan&projectId=${plan.projectId}`} target="_blank" rel="noreferrer">导出 Final Cut JSON</a>
            <a className="button-ghost" href={`/api/render?action=export-final-cut-assembly&projectId=${plan.projectId}`} target="_blank" rel="noreferrer">导出装配包 JSON</a>
            <a className="button-ghost" href={`/api/render?action=assemble-final-cut-preview&projectId=${plan.projectId}&open=1`} target="_blank" rel="noreferrer">一键拼装并打开预演</a>
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
        eyebrow="Assessment"
        title="当前拼装判定"
        description="先看阻塞项和下一步动作，再决定回去补生成、补音轨，还是直接拼装预演。"
      >
        <div className="finalcut-alert-grid">
          <div className="asset-tile finalcut-alert-card">
            <span className="label">阻塞情况</span>
            <h4>{getAssemblyStateLabel(plan.summary.assemblyState)}</h4>
            <p>
              缺失视觉 {plan.summary.missingVisualShots} 镜头 / 图片回退 {plan.summary.imageFallbackShots} 镜头 / 缺少音轨 {plan.summary.scenesWithoutAudio} 场。
            </p>
          </div>

          <div className="asset-tile finalcut-alert-card">
            <span className="label">预演建议</span>
            <h4>{plan.recommendedActions[0] || '当前没有额外建议'}</h4>
            <p>如果你只是先看节奏与结构，现在就可以用上方入口生成预演版。</p>
          </div>

          <div className="asset-tile finalcut-alert-card">
            <span className="label">装配包</span>
            <h4>FFmpeg 预演链已接好</h4>
            <p>系统会输出镜头片段清单、场次音轨清单和装配脚本，支持直接本地拼装。</p>
          </div>
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
        eyebrow="Scenes"
        title="场次装配时间线"
        description="每个场次都拆成一张装配卡：先看场次状态，再看每个镜头最终采用的视频、图片回退和音轨关联。"
      >
        <div className="finalcut-scene-stack">
          {plan.scenes.map((scene, index) => (
            <section key={scene.sceneId} className="snapshot-card finalcut-scene-card">
              <div className="finalcut-scene-head">
                <div className="finalcut-scene-copy">
                  <p className="eyebrow">Scene {String(index + 1).padStart(2, '0')}</p>
                  <h3>{scene.title}</h3>
                  <p>{scene.summary || '暂无场次摘要'}</p>
                </div>

                <div className="finalcut-scene-side">
                  <span className="status-pill status-pill-subtle">{formatSeconds(scene.startAt)} → {formatSeconds(scene.endAt)}</span>
                  <div className="meta-list">
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
                    </div>
                    <p>建议先回生成工作台补跑语音任务，否则最终拼装会缺少这一场的声音。</p>
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
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
